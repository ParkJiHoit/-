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
    CREATE TABLE IF NOT EXISTS tracker_groups (
      id         SERIAL PRIMARY KEY,
      user_id    UUID        NOT NULL,
      name       TEXT        NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_tg_user ON tracker_groups (user_id);
  `);
  console.log('[DB] tracker_groups 테이블 준비 완료');
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
    ALTER TABLE tracked_keywords ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES tracker_groups(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_tk_group ON tracked_keywords (group_id);
    -- 삭제는 소프트 삭제로 처리해 rank_snapshots 이력을 보존한다. 같은 키워드/URL을
    -- 다시 등록하면 이 행이 upsert로 재활성화되어 과거 순위 기록이 그대로 이어진다.
    ALTER TABLE tracked_keywords ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    -- 그룹별로 완전히 독립적으로 키워드를 추적할 수 있도록, 키워드 중복 판정 범위를
    -- "사용자 전체"에서 "사용자+그룹"으로 좁힌다. group_id가 NULL(그룹 없음)인 경우도
    -- COALESCE로 하나의 고정된 값으로 취급해 그 안에서만 중복을 막는다.
    ALTER TABLE tracked_keywords DROP CONSTRAINT IF EXISTS tracked_keywords_user_id_keyword_mode_key;
    DROP INDEX IF EXISTS idx_tk_unique_per_group;
    CREATE UNIQUE INDEX idx_tk_unique_per_group
      ON tracked_keywords (user_id, keyword, mode, (COALESCE(group_id, -1)));
    -- 키워드 등록 시 딱 한 번만 조회해두는 월간 검색량(순위 갱신 때마다 다시 조회하지 않음).
    ALTER TABLE tracked_keywords ADD COLUMN IF NOT EXISTS pc_search INTEGER;
    ALTER TABLE tracked_keywords ADD COLUMN IF NOT EXISTS mobile_search INTEGER;
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
  await p.query(`
    ALTER TABLE rank_snapshots ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ranked';
    ALTER TABLE rank_snapshots DROP CONSTRAINT IF EXISTS rank_snapshots_status_check;
    ALTER TABLE rank_snapshots ADD CONSTRAINT rank_snapshots_status_check
      CHECK (status IN ('ranked','not_in_top5','fetch_failed'));
    -- 통합검색 블로그 collection 노출 여부(O/X). NULL은 미확인(all 모드 또는 조회 실패).
    ALTER TABLE rank_snapshots ADD COLUMN IF NOT EXISTS integrated_exposed BOOLEAN;
    -- 포스팅 발행일(검색결과에 표시된 날짜를 환산). 해석 불가/미노출이면 NULL.
    ALTER TABLE rank_snapshots ADD COLUMN IF NOT EXISTS post_date DATE;
  `);
  console.log('[DB] rank_snapshots.status 컬럼 준비 완료');
  await p.query(`
    CREATE TABLE IF NOT EXISTS refresh_jobs (
      id              SERIAL PRIMARY KEY,
      user_id         UUID        NOT NULL,
      status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
      total_count     INTEGER     NOT NULL DEFAULT 0,
      completed_count INTEGER     NOT NULL DEFAULT 0,
      failed_count    INTEGER     NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      completed_at    TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS refresh_job_items (
      id            SERIAL PRIMARY KEY,
      job_id        INTEGER NOT NULL REFERENCES refresh_jobs(id) ON DELETE CASCADE,
      tracked_id    INTEGER NOT NULL REFERENCES tracked_keywords(id) ON DELETE CASCADE,
      status        TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','failed')),
      error_message TEXT,
      processed_at  TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_rji_job_status ON refresh_job_items (job_id, status);
    CREATE INDEX IF NOT EXISTS idx_rj_user ON refresh_jobs (user_id);
  `);
  console.log('[DB] refresh_jobs / refresh_job_items 테이블 준비 완료');
  await p.query(`
    CREATE TABLE IF NOT EXISTS daily_usage (
      id         SERIAL PRIMARY KEY,
      user_id    UUID    NOT NULL,
      action     TEXT    NOT NULL,
      used_date  DATE    NOT NULL DEFAULT CURRENT_DATE,
      count      INTEGER NOT NULL DEFAULT 1,
      UNIQUE (user_id, action, used_date)
    );
    CREATE INDEX IF NOT EXISTS idx_du_user_date ON daily_usage (user_id, used_date);
  `);
  console.log('[DB] daily_usage 테이블 준비 완료');
  await p.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                  SERIAL PRIMARY KEY,
      user_id             UUID        NOT NULL UNIQUE,
      ls_subscription_id  TEXT        NOT NULL,
      ls_customer_id      TEXT,
      status              TEXT        NOT NULL DEFAULT 'active',
      variant_id          TEXT,
      current_period_end  TIMESTAMPTZ,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      updated_at          TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions (user_id);
  `);
  console.log('[DB] subscriptions 테이블 준비 완료');
  await p.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id         SERIAL PRIMARY KEY,
      type       TEXT        NOT NULL,
      content    TEXT        NOT NULL,
      email      TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('[DB] feedback 테이블 준비 완료');
}
