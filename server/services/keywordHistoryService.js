import { getPool } from '../db/index.js';

// 현재 달 검색량을 기록 (이미 있으면 UPDATE)
export async function recordMonthlySearch(keyword, pcSearch, mobileSearch) {
  const pool = getPool();
  if (!pool || !keyword) return;

  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const total = (pcSearch || 0) + (mobileSearch || 0);

  try {
    await pool.query(
      `INSERT INTO keyword_history (keyword, year, month, pc_search, mobile_search, total_search)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (keyword, year, month)
       DO UPDATE SET
         pc_search     = EXCLUDED.pc_search,
         mobile_search = EXCLUDED.mobile_search,
         total_search  = EXCLUDED.total_search,
         recorded_at   = NOW()`,
      [keyword.trim().toLowerCase(), year, month, pcSearch || 0, mobileSearch || 0, total]
    );
  } catch (err) {
    console.error('[History] 기록 실패:', err.message);
  }
}

// 키워드의 전체 히스토리 조회 (오래된 순)
export async function getSearchHistory(keyword) {
  const pool = getPool();
  if (!pool || !keyword) return [];

  try {
    const { rows } = await pool.query(
      `SELECT year, month, pc_search, mobile_search, total_search
       FROM keyword_history
       WHERE keyword = $1
       ORDER BY year ASC, month ASC`,
      [keyword.trim().toLowerCase()]
    );
    return rows;
  } catch (err) {
    console.error('[History] 조회 실패:', err.message);
    return [];
  }
}
