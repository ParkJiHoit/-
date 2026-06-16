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
  await p.query(`
    CREATE TABLE IF NOT EXISTS tracked_keywords (
      id                SERIAL PRIMARY KEY,
      user_id           UUID        NOT NULL,
      keyword           TEXT        NOT NULL,
      mode              TEXT        NOT NULL CHECK (mode IN ('blog','all')),
      blog_ids          TEXT[]      DEFAULT '{}',
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      last_refreshed_at TIMESTAMPTZ,
      UNIQUE (user_id, keyword, mode)
    );
    ALTER TABLE tracked_keywords ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS rank_snapshots (
      id             SERIAL PRIMARY KEY,
      tracked_id     INTEGER     NOT NULL REFERENCES tracked_keywords(id) ON DELETE CASCADE,
      blog_id        TEXT        NOT NULL,
      rank           SMALLINT,
      post_title     TEXT,
      post_link      TEXT,
      snapshotted_at DATE        NOT NULL DEFAULT CURRENT_DATE,
      UNIQUE (tracked_id, blog_id, snapshotted_at)
    );
    CREATE INDEX IF NOT EXISTS idx_rs_tracked_date ON rank_snapshots (tracked_id, snapshotted_at DESC);
  `);
  console.log('[DB] rank_tracker 테이블 준비 완료');
}
