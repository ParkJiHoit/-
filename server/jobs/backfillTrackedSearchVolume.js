/**
 * 1회 실행: 이미 등록된 순위 추적 키워드 중 월간 검색량이 아직 없는(이 기능 추가 이전에
 * 등록된) 키워드에 한해 검색량을 조회해 채워 넣는다. 새로 등록되는 키워드는 등록 시점에
 * 자동으로 채워지므로 이 스크립트를 다시 실행할 필요는 없다.
 *
 * 실행 방법 (DATABASE_URL이 설정된 환경에서):
 *   node server/jobs/backfillTrackedSearchVolume.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

import { getPool, initDb } from '../db/index.js';
import { fetchKeywordVolume } from '../services/naverKeywordService.js';

const BATCH_DELAY_MS = 500; // API 레이트리밋 방지용 딜레이

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBackfill() {
  await initDb();
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL 미설정');

  const { rows } = await pool.query(
    `SELECT id, keyword FROM tracked_keywords
     WHERE deleted_at IS NULL AND pc_search IS NULL AND mobile_search IS NULL`
  );

  if (rows.length === 0) {
    console.log('[backfill] 검색량이 비어 있는 추적 키워드 없음, 종료');
    return { updated: 0, failed: 0, total: 0 };
  }

  // 같은 키워드가 여러 그룹/모드로 등록돼 있어도 검색량 조회는 키워드당 한 번만 한다.
  const idsByKeyword = new Map();
  for (const { id, keyword } of rows) {
    if (!idsByKeyword.has(keyword)) idsByKeyword.set(keyword, []);
    idsByKeyword.get(keyword).push(id);
  }

  console.log(`[backfill] 고유 키워드 ${idsByKeyword.size}개 (총 ${rows.length}개 항목) 백필 시작`);
  let updated = 0;
  let failed = 0;

  for (const [keyword, ids] of idsByKeyword) {
    try {
      const vol = await fetchKeywordVolume(keyword);
      if (vol) {
        await pool.query(
          `UPDATE tracked_keywords SET pc_search = $1, mobile_search = $2 WHERE id = ANY($3)`,
          [vol.pcSearch, vol.mobileSearch, ids]
        );
        console.log(`[backfill] ✓ ${keyword} PC:${vol.pcSearch} M:${vol.mobileSearch} (${ids.length}개 항목)`);
        updated += ids.length;
      } else {
        console.warn(`[backfill] - ${keyword} 데이터 없음`);
        failed += ids.length;
      }
    } catch (err) {
      console.error(`[backfill] ✗ ${keyword}:`, err.message);
      failed += ids.length;
    }
    await sleep(BATCH_DELAY_MS);
  }

  console.log(`[backfill] 완료 — 성공:${updated} 실패:${failed}`);
  return { updated, failed, total: rows.length };
}

// 직접 실행 시 (node server/jobs/backfillTrackedSearchVolume.js)
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runBackfill()
    .then(({ updated, failed }) => {
      console.log(`완료: ${updated}개 갱신, ${failed}개 실패`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('백필 실패:', err.message);
      process.exit(1);
    });
}
