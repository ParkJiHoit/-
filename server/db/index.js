import pg from 'pg';

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      return null; // DB 없으면 gracefully skip
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Render PostgreSQL 필수
      max: 5,
      idleTimeoutMillis: 30000,
    });
    pool.on('error', (err) => {
      console.error('[DB] 연결 오류:', err.message);
    });
  }
  return pool;
}

export async function initDb() {
  const p = getPool();
  if (!p) {
    console.warn('[DB] DATABASE_URL 미설정 — 히스토리 기능 비활성화');
    return;
  }
  await p.query(`
    CREATE TABLE IF NOT EXISTS keyword_history (
      id            SERIAL PRIMARY KEY,
      keyword       TEXT        NOT NULL,
      year          SMALLINT    NOT NULL,
      month         SMALLINT    NOT NULL,
      pc_search     INTEGER     NOT NULL DEFAULT 0,
      mobile_search INTEGER     NOT NULL DEFAULT 0,
      total_search  INTEGER     NOT NULL DEFAULT 0,
      recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (keyword, year, month)
    );
    CREATE INDEX IF NOT EXISTS idx_kh_keyword ON keyword_history (keyword);
  `);
  console.log('[DB] keyword_history 테이블 준비 완료');
}
