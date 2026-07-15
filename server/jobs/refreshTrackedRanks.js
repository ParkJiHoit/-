// 매일 1회(Vercel Cron): 순위추적 항목을 가진 모든 유저에 대해, 시간 예산 안에서
// 최대한 처리한다. 이미 4시간 이내 갱신된 항목은 건너뛰므로(skipFresh), 하루 안에
// 수동 "전체 갱신"과 겹쳐 호출돼도 중복 작업이 되지 않는다.
import { getPool } from '../db/index.js';
import { createRefreshJob, processNextChunk } from '../services/refreshJobService.js';

const TIME_BUDGET_MS = 24000; // Vercel 함수 maxDuration(30s) 안에서 여유를 두고 멈춘다

export async function runScheduledRankRefresh() {
  const pool = getPool();
  if (!pool) return { message: 'DB 미설정', usersProcessed: 0 };

  const { rows: users } = await pool.query(
    `SELECT DISTINCT user_id FROM tracked_keywords WHERE deleted_at IS NULL`
  );

  const startedAt = Date.now();
  const results = [];

  for (const { user_id } of users) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      results.push({ userId: user_id, skipped: true, reason: '시간 예산 소진 — 다음 크론 또는 수동 갱신으로' });
      continue;
    }
    try {
      let current = await createRefreshJob(user_id, null, true);
      while (!current.done && Date.now() - startedAt < TIME_BUDGET_MS) {
        current = await processNextChunk(user_id, current.id);
      }
      results.push({
        userId: user_id,
        jobId: current.id,
        done: current.done,
        completed: current.completed_count,
        failed: current.failed_count,
        total: current.total_count,
      });
    } catch (err) {
      // skipFresh로 인해 "전부 최근에 갱신됨"이면 정상적인 무처리 상황이다.
      results.push({ userId: user_id, skipped: true, reason: err.message });
    }
  }

  console.log('[jobs/refresh-ranks] 결과:', JSON.stringify(results));
  return { usersProcessed: results.length, results };
}
