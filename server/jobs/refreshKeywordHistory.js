/**
 * 매달 1회 실행: DB에 저장된 모든 키워드의 이번달 검색량을 갱신.
 *
 * 실행 방법:
 *   node server/jobs/refreshKeywordHistory.js
 *
 * HTTP 트리거 (어떤 스케줄러든 사용 가능):
 *   POST /api/jobs/refresh  Authorization: Bearer {JOB_SECRET}
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

import { getPool, initDb } from '../db/index.js';
import { recordMonthlySearch } from '../services/keywordHistoryService.js';
import { fetchKeywordVolume } from '../services/naverKeywordService.js';

const BATCH_DELAY_MS = 500; // API 레이트리밋 방지용 딜레이

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runRefresh() {
  await initDb();
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL 미설정');

  // DB에 있는 모든 고유 키워드 조회
  const { rows } = await pool.query(
    'SELECT DISTINCT keyword FROM keyword_history ORDER BY keyword'
  );

  if (rows.length === 0) {
    console.log('[refresh] 저장된 키워드 없음, 종료');
    return { updated: 0, failed: 0 };
  }

  console.log(`[refresh] ${rows.length}개 키워드 갱신 시작`);
  let updated = 0;
  let failed  = 0;

  for (const { keyword } of rows) {
    try {
      const vol = await fetchKeywordVolume(keyword);
      if (vol) {
        await recordMonthlySearch(keyword, vol.pcSearch, vol.mobileSearch);
        console.log(`[refresh] ✓ ${keyword} PC:${vol.pcSearch} M:${vol.mobileSearch}`);
        updated++;
      } else {
        console.warn(`[refresh] - ${keyword} 데이터 없음`);
        failed++;
      }
    } catch (err) {
      console.error(`[refresh] ✗ ${keyword}:`, err.message);
      failed++;
    }
    await sleep(BATCH_DELAY_MS);
  }

  console.log(`[refresh] 완료 — 성공:${updated} 실패:${failed}`);
  return { updated, failed, total: rows.length };
}

// 직접 실행 시 (node server/jobs/refreshKeywordHistory.js)
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runRefresh()
    .then(({ updated, failed }) => {
      console.log(`완료: ${updated}개 갱신, ${failed}개 실패`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('갱신 실패:', err.message);
      process.exit(1);
    });
}
