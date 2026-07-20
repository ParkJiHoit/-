import { getPool } from '../db/index.js';
import { refreshRanks } from './rankTrackerService.js';

const CHUNK_SIZE = 5;
const ITEM_DELAY_MS = 700;
const CHUNK_TIME_BUDGET_MS = 20000;
// "전체 갱신"을 같은 날 여러 번 눌러도 방금 갱신한 항목까지 처음부터 다시 훑지
// 않도록, skipFresh가 true면 이 시간 내에 이미 갱신된 항목은 건너뛴다.
const SKIP_FRESH_COOLDOWN_HOURS = 4;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isDone(job) {
  return job.status === 'completed' || job.status === 'failed';
}

export async function createRefreshJob(userId, trackedIds = null, skipFresh = false) {
  const pool = getPool();
  if (!pool) throw Object.assign(new Error('DB가 설정되지 않았습니다.'), { status: 503 });

  // 직전 갱신이 조회 실패로 끝난 항목은 last_refreshed_at이 방금 갱신된 것처럼
  // 찍혀 있어도(실패든 성공이든 무조건 갱신 시각을 기록하므로) 쿨다운과 무관하게
  // 항상 다시 시도 대상에 포함시킨다 — 그렇지 않으면 "전체 갱신"을 반복 클릭해도
  // 조회 실패 항목만 계속 쿨다운에 가려 아예 재시도되지 않는다.
  const freshnessClause = skipFresh
    ? `AND (
        last_refreshed_at IS NULL
        OR last_refreshed_at < NOW() - make_interval(hours => ${SKIP_FRESH_COOLDOWN_HOURS})
        OR EXISTS (
          SELECT 1 FROM rank_snapshots rs
          WHERE rs.tracked_id = tracked_keywords.id
            AND rs.status = 'fetch_failed'
            AND rs.snapshotted_at = (
              SELECT MAX(rs2.snapshotted_at) FROM rank_snapshots rs2 WHERE rs2.tracked_id = tracked_keywords.id
            )
        )
      )`
    : '';

  let ids;
  if (!trackedIds || !trackedIds.length) {
    const { rows } = await pool.query(
      `SELECT id FROM tracked_keywords WHERE user_id = $1 AND deleted_at IS NULL ${freshnessClause}`,
      [userId]
    );
    ids = rows.map(r => r.id);
  } else {
    const { rows } = await pool.query(
      `SELECT id FROM tracked_keywords WHERE id = ANY($1) AND user_id = $2 AND deleted_at IS NULL ${freshnessClause}`,
      [trackedIds, userId]
    );
    ids = rows.map(r => r.id);
  }
  if (!ids.length) {
    const message = skipFresh
      ? `모두 최근 ${SKIP_FRESH_COOLDOWN_HOURS}시간 내에 갱신된 항목입니다.`
      : '갱신할 추적 항목이 없습니다.';
    throw Object.assign(new Error(message), { status: 400 });
  }

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
      const result = await refreshRanks(userId, item.tracked_id);
      // refreshRanks는 "조회 실패"를 예외로 던지지 않고 { fetchFailed: true }로
      // 정상 반환한다 — 여기서 걸러주지 않으면 잡/재시도 메커니즘이 이 항목을
      // 그냥 "완료"로 취급해버려서 자동 재시도도, 수동 재시도 버튼도 절대 이 항목을
      // 다시 시도하지 않게 된다.
      if (result.fetchFailed) {
        throw new Error('조회 실패 (검색 결과를 가져오지 못했습니다)');
      }
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
