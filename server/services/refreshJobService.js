import { getPool } from '../db/index.js';
import { refreshRanks } from './rankTrackerService.js';

const CHUNK_SIZE = 5;
const ITEM_DELAY_MS = 700;
const CHUNK_TIME_BUDGET_MS = 20000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isDone(job) {
  return job.status === 'completed' || job.status === 'failed';
}

export async function createRefreshJob(userId, trackedIds = null) {
  const pool = getPool();
  if (!pool) throw Object.assign(new Error('DB가 설정되지 않았습니다.'), { status: 503 });

  let ids;
  if (!trackedIds || !trackedIds.length) {
    const { rows } = await pool.query(
      `SELECT id FROM tracked_keywords WHERE user_id = $1`,
      [userId]
    );
    ids = rows.map(r => r.id);
  } else {
    const { rows } = await pool.query(
      `SELECT id FROM tracked_keywords WHERE id = ANY($1) AND user_id = $2`,
      [trackedIds, userId]
    );
    ids = rows.map(r => r.id);
  }
  if (!ids.length) throw Object.assign(new Error('갱신할 추적 항목이 없습니다.'), { status: 400 });

  const { rows: jobRows } = await pool.query(
    `INSERT INTO refresh_jobs (user_id, status, total_count)
     VALUES ($1, 'pending', $2)
     RETURNING id, status, total_count, completed_count, failed_count`,
    [userId, ids.length]
  );
  const job = jobRows[0];

  const values = ids.map((_, i) => `($1, $${i + 2})`).join(', ');
  await pool.query(
    `INSERT INTO refresh_job_items (job_id, tracked_id) VALUES ${values}`,
    [job.id, ...ids]
  );

  return { ...job, done: false };
}

export async function processNextChunk(userId, jobId) {
  const pool = getPool();
  if (!pool) throw Object.assign(new Error('DB가 설정되지 않았습니다.'), { status: 503 });

  const { rows: jobRows } = await pool.query(
    `SELECT * FROM refresh_jobs WHERE id = $1 AND user_id = $2`,
    [jobId, userId]
  );
  if (!jobRows.length) throw Object.assign(new Error('잡을 찾을 수 없습니다.'), { status: 404 });
  if (isDone(jobRows[0])) return { ...jobRows[0], done: true };

  await pool.query(
    `UPDATE refresh_jobs SET status = 'running' WHERE id = $1 AND status = 'pending'`,
    [jobId]
  );

  const { rows: items } = await pool.query(
    `SELECT id, tracked_id FROM refresh_job_items
     WHERE job_id = $1 AND status = 'pending' ORDER BY id ASC LIMIT $2`,
    [jobId, CHUNK_SIZE]
  );

  const chunkStartedAt = Date.now();
  for (let i = 0; i < items.length; i++) {
    if (Date.now() - chunkStartedAt > CHUNK_TIME_BUDGET_MS) break;
    const item = items[i];
    try {
      await refreshRanks(userId, item.tracked_id);
      await pool.query(
        `UPDATE refresh_job_items SET status = 'done', processed_at = NOW() WHERE id = $1`,
        [item.id]
      );
      await pool.query(
        `UPDATE refresh_jobs SET completed_count = completed_count + 1 WHERE id = $1`,
        [jobId]
      );
    } catch (err) {
      await pool.query(
        `UPDATE refresh_job_items SET status = 'failed', error_message = $2, processed_at = NOW() WHERE id = $1`,
        [item.id, String(err.message || '알 수 없는 오류').slice(0, 500)]
      );
      await pool.query(
        `UPDATE refresh_jobs SET failed_count = failed_count + 1 WHERE id = $1`,
        [jobId]
      );
    }
    if (i < items.length - 1) await sleep(ITEM_DELAY_MS);
  }

  const { rows: remaining } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM refresh_job_items WHERE job_id = $1 AND status = 'pending'`,
    [jobId]
  );
  const allProcessed = Number(remaining[0].cnt) === 0;

  if (allProcessed) {
    await pool.query(
      `UPDATE refresh_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [jobId]
    );
  }

  const { rows: finalRows } = await pool.query(`SELECT * FROM refresh_jobs WHERE id = $1`, [jobId]);
  return { ...finalRows[0], done: allProcessed };
}

export async function getJobStatus(userId, jobId) {
  const pool = getPool();
  if (!pool) throw Object.assign(new Error('DB가 설정되지 않았습니다.'), { status: 503 });
  const { rows } = await pool.query(
    `SELECT * FROM refresh_jobs WHERE id = $1 AND user_id = $2`,
    [jobId, userId]
  );
  if (!rows.length) throw Object.assign(new Error('잡을 찾을 수 없습니다.'), { status: 404 });
  return { ...rows[0], done: isDone(rows[0]) };
}

export async function retryFailedItems(userId, jobId) {
  const pool = getPool();
  if (!pool) throw Object.assign(new Error('DB가 설정되지 않았습니다.'), { status: 503 });

  const { rows: owned } = await pool.query(
    `SELECT id FROM refresh_jobs WHERE id = $1 AND user_id = $2`,
    [jobId, userId]
  );
  if (!owned.length) throw Object.assign(new Error('잡을 찾을 수 없습니다.'), { status: 404 });

  const { rows: failedItems } = await pool.query(
    `SELECT tracked_id FROM refresh_job_items WHERE job_id = $1 AND status = 'failed'`,
    [jobId]
  );
  const ids = failedItems.map(r => r.tracked_id);
  if (!ids.length) throw Object.assign(new Error('재시도할 실패 항목이 없습니다.'), { status: 400 });

  return createRefreshJob(userId, ids);
}
