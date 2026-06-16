# 순위 추적 기능 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네이버 블로그탭 키워드 순위를 날짜별로 추적·시각화하는 "순위 추적" 탭을 구현한다.

**Architecture:** 서버에 `rankTracker` 라우트+서비스를 추가하고, 기존 `fetchBlogRankings()` 크롤러를 재활용해 순위를 PostgreSQL에 upsert한다. 프론트는 `RankTrackerPage`(좌우 패널 레이아웃) + `RankCalendar`(히트맵) + `RankChart`(꺾은선) 세 컴포넌트로 분리한다. Supabase JWT를 Authorization 헤더로 전달해 user_id별 데이터를 격리한다.

**Tech Stack:** Express, PostgreSQL(pg), axios+cheerio(기존 크롤러), React 18, Supabase Auth, SVG(순수 차트/캘린더)

---

## 파일 맵

| 상태 | 경로 | 역할 |
|------|------|------|
| 신규 | `server/routes/rankTracker.js` | REST 엔드포인트 5개 |
| 신규 | `server/services/rankTrackerService.js` | DB CRUD + 크롤러 연동 |
| 수정 | `server/db/index.js` | 테이블 2개 CREATE IF NOT EXISTS 추가 |
| 수정 | `server/server.js` | 라우트 마운트 |
| 신규 | `client/src/pages/RankTrackerPage.jsx` | 페이지 전체 (좌우 패널, 모달) |
| 신규 | `client/src/components/RankCalendar.jsx` | 날짜×블로그 히트맵 |
| 신규 | `client/src/components/RankChart.jsx` | 순위 추이 꺾은선 차트 |
| 수정 | `client/src/components/Navbar.jsx` | SERVICES 배열에 순위 추적 항목 추가 |
| 수정 | `client/src/App.jsx` | `rank-tracker` 탭 라우팅 + RankTrackerPage 렌더 |

---

## Task 1: DB 스키마 추가

**Files:**
- Modify: `server/db/index.js`

- [ ] **Step 1: `initDb()`에 두 테이블 CREATE 구문 추가**

`server/db/index.js`의 `initDb()` 안에서 기존 `keyword_history` 테이블 생성 쿼리 **뒤**에 아래를 추가한다.

```js
await p.query(`
  CREATE TABLE IF NOT EXISTS tracked_keywords (
    id         SERIAL PRIMARY KEY,
    user_id    UUID        NOT NULL,
    keyword    TEXT        NOT NULL,
    mode       TEXT        NOT NULL CHECK (mode IN ('blog','all')),
    blog_ids   TEXT[]      DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, keyword, mode)
  );
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
```

- [ ] **Step 2: 서버 재시작으로 테이블 생성 확인**

```bash
cd server && npm run dev
```

로그에 `[DB] rank_tracker 테이블 준비 완료` 출력되면 완료.

- [ ] **Step 3: 커밋**

```bash
git add server/db/index.js
git commit -m "feat: rank_tracker DB 테이블 추가"
```

---

## Task 2: 서버 서비스 — rankTrackerService.js

**Files:**
- Create: `server/services/rankTrackerService.js`

- [ ] **Step 1: 파일 생성**

```js
// server/services/rankTrackerService.js
import { getPool } from '../db/index.js';
import { fetchBlogRankings } from './blogRankingService.js';

// blogId 추출 헬퍼
function extractBlogId(url) {
  const m = String(url).match(/blog\.naver\.com\/([^/?#\s]+)/);
  return m ? m[1].toLowerCase() : null;
}

// ── 목록 조회 ────────────────────────────────────────────────────────────────
export async function listTracked(userId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, keyword, mode, blog_ids, created_at FROM tracked_keywords
     WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  // 각 항목의 최신 스냅샷 요약 첨부
  const result = await Promise.all(rows.map(async (row) => {
    const { rows: snaps } = await pool.query(
      `SELECT blog_id, rank, snapshotted_at FROM rank_snapshots
       WHERE tracked_id = $1 ORDER BY snapshotted_at DESC LIMIT 20`,
      [row.id]
    );
    // blog_id별 최신 rank
    const latestByBlog = {};
    for (const s of snaps) {
      if (!latestByBlog[s.blog_id]) latestByBlog[s.blog_id] = s.rank;
    }
    return { ...row, latestRanks: latestByBlog };
  }));
  return result;
}

// ── 등록 ─────────────────────────────────────────────────────────────────────
export async function createTracked(userId, keyword, mode, blogUrls = []) {
  const pool = getPool();
  const blogIds = blogUrls.map(extractBlogId).filter(Boolean);
  const { rows } = await pool.query(
    `INSERT INTO tracked_keywords (user_id, keyword, mode, blog_ids)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, keyword, mode) DO UPDATE SET blog_ids = EXCLUDED.blog_ids
     RETURNING id, keyword, mode, blog_ids, created_at`,
    [userId, keyword.trim(), mode, blogIds]
  );
  return rows[0];
}

// ── 삭제 ─────────────────────────────────────────────────────────────────────
export async function deleteTracked(userId, trackedId) {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM tracked_keywords WHERE id = $1 AND user_id = $2`,
    [trackedId, userId]
  );
  if (rowCount === 0) throw Object.assign(new Error('항목을 찾을 수 없습니다.'), { status: 404 });
}

// ── 스냅샷 히스토리 조회 ──────────────────────────────────────────────────────
export async function getSnapshots(userId, trackedId) {
  const pool = getPool();
  // user 소유 확인
  const { rows: own } = await pool.query(
    `SELECT id, keyword, mode, blog_ids FROM tracked_keywords WHERE id = $1 AND user_id = $2`,
    [trackedId, userId]
  );
  if (!own.length) throw Object.assign(new Error('항목을 찾을 수 없습니다.'), { status: 404 });

  const { rows: snaps } = await pool.query(
    `SELECT blog_id, rank, post_title, post_link, snapshotted_at
     FROM rank_snapshots WHERE tracked_id = $1
     ORDER BY snapshotted_at DESC, rank ASC NULLS LAST`,
    [trackedId]
  );
  return { tracked: own[0], snapshots: snaps };
}

// ── 수동 갱신 (크롤링 → upsert) ──────────────────────────────────────────────
export async function refreshRanks(userId, trackedId) {
  const pool = getPool();
  const { rows: own } = await pool.query(
    `SELECT id, keyword, mode, blog_ids FROM tracked_keywords WHERE id = $1 AND user_id = $2`,
    [trackedId, userId]
  );
  if (!own.length) throw Object.assign(new Error('항목을 찾을 수 없습니다.'), { status: 404 });

  const { keyword, mode, blog_ids } = own[0];
  const rankings = await fetchBlogRankings(keyword, 'blog'); // 상위 10개

  const today = new Date().toISOString().slice(0, 10);
  const upserts = [];

  if (mode === 'blog') {
    // 등록된 blog_ids 각각의 순위 추출
    for (const blogId of blog_ids) {
      const hit = rankings.find(r => r.blogId?.toLowerCase() === blogId.toLowerCase());
      upserts.push({
        blog_id: blogId,
        rank: hit ? hit.rank : null,
        post_title: hit?.title || null,
        post_link: hit?.postLink || null,
      });
    }
  } else {
    // 전체 순위 모드: 상위 10개 전부 저장
    for (const r of rankings) {
      if (!r.blogId) continue;
      upserts.push({
        blog_id: r.blogId,
        rank: r.rank,
        post_title: r.title || null,
        post_link: r.postLink || null,
      });
    }
  }

  for (const u of upserts) {
    await pool.query(
      `INSERT INTO rank_snapshots (tracked_id, blog_id, rank, post_title, post_link, snapshotted_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tracked_id, blog_id, snapshotted_at)
       DO UPDATE SET rank = EXCLUDED.rank, post_title = EXCLUDED.post_title, post_link = EXCLUDED.post_link`,
      [trackedId, u.blog_id, u.rank, u.post_title, u.post_link, today]
    );
  }

  console.log(`[rank-tracker] refresh ✓ "${keyword}" mode=${mode} upserted=${upserts.length}`);
  return { refreshed: upserts.length, date: today };
}
```

- [ ] **Step 2: 커밋**

```bash
git add server/services/rankTrackerService.js
git commit -m "feat: rankTrackerService — DB CRUD + 크롤러 연동"
```

---

## Task 3: 서버 라우트 + 마운트

**Files:**
- Create: `server/routes/rankTracker.js`
- Modify: `server/server.js`

- [ ] **Step 1: 라우트 파일 생성**

```js
// server/routes/rankTracker.js
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  listTracked, createTracked, deleteTracked,
  getSnapshots, refreshRanks,
} from '../services/rankTrackerService.js';

const router = Router();

// JWT → user_id 검증 미들웨어
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ message: '로그인이 필요합니다.' });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ message: '인증에 실패했습니다.' });
    req.userId = user.id;
    next();
  } catch {
    res.status(401).json({ message: '인증에 실패했습니다.' });
  }
}

router.use(requireAuth);

// GET /api/rank-tracker
router.get('/', async (req, res, next) => {
  try {
    const data = await listTracked(req.userId);
    res.json(data);
  } catch (e) { next(e); }
});

// POST /api/rank-tracker
router.post('/', async (req, res, next) => {
  try {
    const { keyword, mode, blogUrls } = req.body || {};
    if (!keyword?.trim()) return res.status(400).json({ message: '키워드를 입력해 주세요.' });
    if (!['blog', 'all'].includes(mode)) return res.status(400).json({ message: 'mode는 blog 또는 all이어야 합니다.' });
    if (mode === 'blog' && (!Array.isArray(blogUrls) || !blogUrls.length))
      return res.status(400).json({ message: '블로그 URL을 1개 이상 입력해 주세요.' });
    const data = await createTracked(req.userId, keyword, mode, blogUrls || []);
    res.status(201).json(data);
  } catch (e) { next(e); }
});

// DELETE /api/rank-tracker/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteTracked(req.userId, Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/rank-tracker/:id/refresh
router.post('/:id/refresh', async (req, res, next) => {
  try {
    const data = await refreshRanks(req.userId, Number(req.params.id));
    res.json(data);
  } catch (e) { next(e); }
});

// GET /api/rank-tracker/:id/snapshots
router.get('/:id/snapshots', async (req, res, next) => {
  try {
    const data = await getSnapshots(req.userId, Number(req.params.id));
    res.json(data);
  } catch (e) { next(e); }
});

export default router;
```

- [ ] **Step 2: `server.js`에 라우트 마운트**

`server/server.js` 상단 import 블록에 추가:
```js
import rankTrackerRoutes from './routes/rankTracker.js';
```

`app.use('/api/blog', blogRoutes);` 다음 줄에 추가:
```js
app.use('/api/rank-tracker', rankTrackerRoutes);
```

- [ ] **Step 3: `.env`에 Supabase 환경변수 확인**

`.env` (또는 `.env.example`) 에 아래 두 키가 있어야 한다:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

없으면 추가한다. 값은 Supabase 프로젝트 대시보드 → Settings → API에서 확인.

- [ ] **Step 4: 서버 재시작 후 health 확인**

```bash
cd server && npm run dev
# 별도 터미널:
curl -X GET http://localhost:4000/api/rank-tracker \
  -H "Authorization: Bearer INVALID_TOKEN"
# 기대 결과: {"message":"인증에 실패했습니다."}
```

- [ ] **Step 5: 커밋**

```bash
git add server/routes/rankTracker.js server/server.js
git commit -m "feat: /api/rank-tracker 라우트 추가"
```

---

## Task 4: RankCalendar 컴포넌트

**Files:**
- Create: `client/src/components/RankCalendar.jsx`

- [ ] **Step 1: 파일 생성**

```jsx
// client/src/components/RankCalendar.jsx
// props:
//   snapshots: Array<{ blog_id, rank, snapshotted_at }>
//   blogIds: string[]   — 추적 중인 blog_id 목록 (순서 보존)
//   days?: number       — 표시할 날짜 수 (기본 30)

function rankClass(rank) {
  if (rank == null) return 'out';
  if (rank === 1) return 'r1';
  if (rank <= 2) return 'r2';
  if (rank <= 3) return 'r3';
  if (rank <= 5) return 'r5';
  if (rank <= 7) return 'r7';
  return 'r10';
}

function getDates(days) {
  const dates = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export default function RankCalendar({ snapshots = [], blogIds = [], days = 30 }) {
  const dates = getDates(days);

  // { blog_id → { date → { rank, post_title } } }
  const byBlogDate = {};
  for (const s of snapshots) {
    if (!byBlogDate[s.blog_id]) byBlogDate[s.blog_id] = {};
    byBlogDate[s.blog_id][s.snapshotted_at] = { rank: s.rank, title: s.post_title };
  }

  const displayBlogIds = blogIds.length ? blogIds : [...new Set(snapshots.map(s => s.blog_id))];

  const cellStyle = {
    base: {
      width: '100%', aspectRatio: '1', borderRadius: 3,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 8, fontWeight: 700, cursor: 'pointer',
      transition: 'transform 0.1s', border: '1px solid transparent',
      color: 'transparent', position: 'relative',
    },
  };

  const colorMap = {
    r1:  { bg: 'rgba(48,209,88,0.85)',  border: 'rgba(48,209,88,0.4)' },
    r2:  { bg: 'rgba(48,209,88,0.65)',  border: 'rgba(48,209,88,0.3)' },
    r3:  { bg: 'rgba(48,209,88,0.45)',  border: 'rgba(48,209,88,0.2)' },
    r5:  { bg: 'rgba(255,159,10,0.50)', border: 'rgba(255,159,10,0.3)' },
    r7:  { bg: 'rgba(255,159,10,0.32)', border: 'rgba(255,159,10,0.15)' },
    r10: { bg: 'rgba(255,69,58,0.35)',  border: 'rgba(255,69,58,0.2)' },
    out: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.06)' },
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* 날짜 헤더 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `56px repeat(${dates.length}, minmax(18px, 1fr))`,
        gap: 3, minWidth: 480, marginBottom: 4,
      }}>
        <div />
        {dates.map(d => (
          <div key={d} style={{
            fontSize: 9, color: 'var(--text-tertiary)',
            textAlign: 'center', letterSpacing: '0.02em',
          }}>
            {d.slice(5).replace('-', '/')}
          </div>
        ))}
      </div>

      {/* 블로그별 행 */}
      {displayBlogIds.map(blogId => (
        <div key={blogId} style={{
          display: 'grid',
          gridTemplateColumns: `56px repeat(${dates.length}, minmax(18px, 1fr))`,
          gap: 3, minWidth: 480, marginBottom: 3,
        }}>
          <div style={{
            fontSize: 10, color: 'var(--text-tertiary)',
            textAlign: 'right', paddingRight: 6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            lineHeight: '18px',
          }} title={blogId}>
            {blogId.length > 8 ? blogId.slice(0, 8) + '…' : blogId}
          </div>
          {dates.map(date => {
            const snap = byBlogDate[blogId]?.[date];
            const rank = snap?.rank ?? null;
            const cls = rankClass(rank);
            const { bg, border } = colorMap[cls];
            const label = rank != null ? `${rank}위` : '미노출';
            return (
              <div
                key={date}
                title={`${blogId} · ${date} · ${label}${snap?.title ? '\n' + snap.title : ''}`}
                style={{
                  ...cellStyle.base,
                  background: bg,
                  borderColor: border,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.4)';
                  e.currentTarget.style.zIndex = '10';
                  e.currentTarget.style.color = rank != null ? '#fff' : 'rgba(255,255,255,0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.zIndex = '1';
                  e.currentTarget.style.color = 'transparent';
                }}
              >
                {rank != null ? rank : '–'}
              </div>
            );
          })}
        </div>
      ))}

      {/* 범례 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>순위:</span>
        {[
          { cls: 'r1', label: '1위' }, { cls: 'r2', label: '2위' },
          { cls: 'r3', label: '3위' }, { cls: 'r5', label: '5위' },
          { cls: 'r7', label: '7위' }, { cls: 'r10', label: '10위' },
          { cls: 'out', label: '미노출' },
        ].map(({ cls, label }) => (
          <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 12, height: 12, borderRadius: 3,
              background: colorMap[cls].bg,
              border: `1px solid ${colorMap[cls].border}`,
            }} />
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add client/src/components/RankCalendar.jsx
git commit -m "feat: RankCalendar 히트맵 컴포넌트"
```

---

## Task 5: RankChart 컴포넌트

**Files:**
- Create: `client/src/components/RankChart.jsx`

- [ ] **Step 1: 파일 생성**

```jsx
// client/src/components/RankChart.jsx
// props:
//   snapshots: Array<{ blog_id, rank, snapshotted_at }>
//   blogIds: string[]
//   days?: 7 | 30

import { useState } from 'react';

const CHART_COLORS = [
  '#30D158', '#0A84FF', '#FF9F0A', '#BF5AF2',
  '#FF453A', '#34C1FF', '#FF6B35', '#5E5CE6',
];

function getDates(days) {
  const dates = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export default function RankChart({ snapshots = [], blogIds = [] }) {
  const [days, setDays] = useState(7);
  const dates = getDates(days);
  const W = 700, H = 140, PAD_L = 28, PAD_R = 50, PAD_T = 14, PAD_B = 10;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const MAX_RANK = 10;

  // { blog_id → { date → rank } }
  const byBlogDate = {};
  for (const s of snapshots) {
    if (!byBlogDate[s.blog_id]) byBlogDate[s.blog_id] = {};
    if (s.rank != null) byBlogDate[s.blog_id][s.snapshotted_at] = s.rank;
  }

  const displayBlogIds = blogIds.length ? blogIds : [...new Set(snapshots.map(s => s.blog_id))];

  // rank → y 좌표 (1위 = 상단, 10위 = 하단)
  const rankToY = (rank) => PAD_T + ((rank - 1) / (MAX_RANK - 1)) * chartH;
  // date index → x 좌표
  const idxToX = (i) => PAD_L + (i / (dates.length - 1)) * chartW;

  return (
    <div>
      {/* 기간 토글 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 10 }}>
        {[7, 30].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              padding: '4px 12px', borderRadius: 7, border: '1px solid',
              borderColor: days === d ? 'rgba(10,132,255,0.4)' : 'var(--border-strong)',
              background: days === d ? 'rgba(10,132,255,0.12)' : 'rgba(255,255,255,0.05)',
              color: days === d ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {d}일
          </button>
        ))}
      </div>

      {/* SVG 차트 */}
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          {/* 그리드 + Y 레이블 */}
          {[1, 3, 5, 7, 10].map(rank => {
            const y = rankToY(rank);
            return (
              <g key={rank}>
                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                  stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <text x={PAD_L - 4} y={y + 3} fontSize="9"
                  fill="rgba(255,255,255,0.25)" textAnchor="end">{rank}위</text>
              </g>
            );
          })}

          {/* 라인 + 도트 */}
          {displayBlogIds.map((blogId, colorIdx) => {
            const color = CHART_COLORS[colorIdx % CHART_COLORS.length];
            const points = dates
              .map((date, i) => {
                const rank = byBlogDate[blogId]?.[date];
                return rank != null ? { x: idxToX(i), y: rankToY(rank), rank } : null;
              })
              .filter(Boolean);

            if (points.length < 1) return null;

            // 연결된 세그먼트만 그리기 (미노출 구간은 점선으로 끊김)
            const segments = [];
            let seg = [points[0]];
            for (let i = 1; i < points.length; i++) {
              seg.push(points[i]);
            }
            if (seg.length) segments.push(seg);

            return (
              <g key={blogId}>
                {segments.map((s, si) => (
                  <polyline
                    key={si}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={s.map(p => `${p.x},${p.y}`).join(' ')}
                  />
                ))}
                {/* 최신 도트 + 레이블 */}
                {points.length > 0 && (() => {
                  const last = points[points.length - 1];
                  return (
                    <g>
                      <circle cx={last.x} cy={last.y} r="4" fill={color} />
                      <text x={last.x + 7} y={last.y + 4} fontSize="9"
                        fill={color} fontWeight="700">{last.rank}위</text>
                    </g>
                  );
                })()}
              </g>
            );
          })}
        </svg>

        {/* X축 레이블 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: PAD_L, paddingRight: PAD_R, marginTop: 4 }}>
          {dates.filter((_, i) => i === 0 || i === Math.floor(dates.length / 2) || i === dates.length - 1).map(d => (
            <span key={d} style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              {d.slice(5).replace('-', '/')}
            </span>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
        {displayBlogIds.map((blogId, i) => (
          <div key={blogId} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 20, height: 2, background: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 1 }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{blogId}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add client/src/components/RankChart.jsx
git commit -m "feat: RankChart 순위 추이 꺾은선 컴포넌트"
```

---

## Task 6: RankTrackerPage 메인 페이지

**Files:**
- Create: `client/src/pages/RankTrackerPage.jsx`

- [ ] **Step 1: 파일 생성**

```jsx
// client/src/pages/RankTrackerPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import RankCalendar from '../components/RankCalendar';
import RankChart from '../components/RankChart';
import { RefreshCw, Plus, Trash2, X, ExternalLink } from 'lucide-react';

const API = (path) => `/api/rank-tracker${path}`;

async function apiFetch(path, options, token) {
  const res = await fetch(API(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || '오류가 발생했습니다.');
  return body;
}

export default function RankTrackerPage({ onLoginRequest }) {
  const { user, session } = useAuth();
  const token = session?.access_token;

  const [mode, setMode] = useState('blog');           // 'blog' | 'all'
  const [items, setItems] = useState([]);             // tracked_keywords[]
  const [selected, setSelected] = useState(null);     // 선택된 tracked item
  const [snapshots, setSnapshots] = useState([]);     // rank_snapshots[]
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');

  // 목록 로드
  const loadItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch('', {}, token);
      setItems(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // 항목 선택 → 스냅샷 로드
  const selectItem = useCallback(async (item) => {
    setSelected(item);
    setSnapshots([]);
    if (!token) return;
    try {
      const data = await apiFetch(`/${item.id}/snapshots`, {}, token);
      setSnapshots(data.snapshots || []);
    } catch (e) { setError(e.message); }
  }, [token]);

  // 수동 갱신
  const handleRefresh = async () => {
    if (!selected || !token) return;
    setRefreshing(true);
    try {
      await apiFetch(`/${selected.id}/refresh`, { method: 'POST' }, token);
      const data = await apiFetch(`/${selected.id}/snapshots`, {}, token);
      setSnapshots(data.snapshots || []);
      await loadItems();
    } catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  };

  // 삭제
  const handleDelete = async (id) => {
    if (!token) return;
    if (!confirm('추적 항목을 삭제할까요? 모든 순위 기록이 사라집니다.')) return;
    try {
      await apiFetch(`/${id}`, { method: 'DELETE' }, token);
      if (selected?.id === id) { setSelected(null); setSnapshots([]); }
      await loadItems();
    } catch (e) { setError(e.message); }
  };

  // 모드 필터링
  const filteredItems = items.filter(i => i.mode === mode);

  // 최신 순위 요약 (블로그 추적 모드)
  const latestRanks = selected?.latestRanks || {};
  const blogIds = selected?.blog_ids || [];

  // 최신 스냅샷 날짜
  const latestDate = snapshots.length ? snapshots[0].snapshotted_at : null;

  // 전체 순위 모드: 최신 날짜의 스냅샷
  const latestSnapshot = selected?.mode === 'all'
    ? snapshots.filter(s => s.snapshotted_at === latestDate).sort((a, b) => (a.rank || 99) - (b.rank || 99))
    : [];

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 14 }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>📊</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>로그인 후 이용할 수 있습니다</div>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.7 }}>
          키워드별 블로그 순위를 날짜별로 추적하고<br/>변화를 확인해보세요
        </p>
        <button
          onClick={onLoginRequest}
          style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          로그인하기
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 오류 */}
      {error && (
        <div style={{
          padding: '10px 16px', borderRadius: 10,
          background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)',
          fontSize: 13, color: '#FF453A', display: 'flex', justifyContent: 'space-between',
        }}>
          {error}
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#FF453A', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* 모드 탭 */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { id: 'blog', title: '블로그 추적 모드', desc: '특정 블로그가 키워드에서 몇 위인지 추적' },
          { id: 'all',  title: '전체 순위 모드',   desc: '키워드 블로그탭 상위 10개 스냅샷 기록' },
        ].map(m => (
          <div
            key={m.id}
            onClick={() => { setMode(m.id); setSelected(null); setSnapshots([]); }}
            style={{
              flex: 1, padding: '14px 18px', borderRadius: 14, cursor: 'pointer',
              border: `1.5px solid ${mode === m.id ? 'var(--accent)' : 'var(--border)'}`,
              background: mode === m.id ? 'rgba(10,132,255,0.08)' : 'var(--bg-elevated)',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: mode === m.id ? 'var(--accent)' : 'var(--text-primary)', marginBottom: 3 }}>{m.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{m.desc}</div>
          </div>
        ))}
      </div>

      {/* 바디 — 좌우 패널 */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>

        {/* 왼쪽: 추적 목록 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
              {mode === 'blog' ? '블로그 추적' : '전체 순위'} <span style={{ color: 'var(--accent)' }}>{filteredItems.length}</span>
            </span>
            <button
              onClick={() => setShowModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: '#fff',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Plus size={12} /> 등록
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>불러오는 중…</div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1.7 }}>
              등록된 추적 항목이 없습니다.<br/>위 등록 버튼으로 추가해보세요.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => selectItem(item)}
                  style={{
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    border: `1px solid ${selected?.id === item.id ? 'var(--accent)' : 'var(--border)'}`,
                    background: selected?.id === item.id ? 'rgba(10,132,255,0.06)' : 'var(--bg-elevated)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 999,
                      background: 'rgba(10,132,255,0.15)', border: '1px solid rgba(10,132,255,0.3)',
                      fontSize: 12, fontWeight: 700, color: 'var(--accent)',
                    }}>
                      {item.keyword}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, display: 'flex' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {mode === 'blog' && item.blog_ids?.map(blogId => {
                    const rank = item.latestRanks?.[blogId] ?? null;
                    return (
                      <div key={blogId} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', marginBottom: 3,
                      }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{blogId}</span>
                        <span style={{
                          fontSize: 13, fontWeight: 800,
                          fontFamily: "'Space Grotesk', sans-serif",
                          color: rank == null ? 'var(--text-tertiary)' : rank <= 3 ? '#30D158' : rank <= 6 ? '#FF9F0A' : 'var(--text-secondary)',
                        }}>
                          {rank != null ? `${rank}위` : '미노출'}
                        </span>
                      </div>
                    );
                  })}
                  {mode === 'all' && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      스냅샷 기록됨
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 오른쪽: 디테일 패널 */}
        {!selected ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: 360, color: 'var(--text-tertiary)', gap: 10, textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, opacity: 0.2 }}>←</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>항목을 선택하세요</div>
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>왼쪽 목록에서 추적 항목을 선택하면<br/>순위 기록과 차트를 확인할 수 있습니다</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* KPI 헤더 */}
            <div className="mac-card" style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
                    {selected.keyword}
                    {mode === 'blog' && blogIds.length > 0 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8 }}>블로그 {blogIds.length}개 추적</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {latestDate ? `마지막 갱신: ${latestDate}` : '아직 갱신 내역 없음'}
                  </div>
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-strong)',
                    color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                  {refreshing ? '갱신 중…' : '순위 갱신'}
                </button>
              </div>

              {/* KPI 칩 — 블로그 추적 모드 */}
              {mode === 'blog' && blogIds.length > 0 && (() => {
                const firstBlog = blogIds[0];
                const curRank = latestRanks[firstBlog] ?? null;
                const allRanks = snapshots.filter(s => s.blog_id === firstBlog && s.rank != null).map(s => s.rank);
                const bestRank = allRanks.length ? Math.min(...allRanks) : null;
                const trackDays = selected.created_at
                  ? Math.max(1, Math.round((Date.now() - new Date(selected.created_at)) / 86400000))
                  : 0;
                return (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { label: '현재 순위', value: curRank != null ? `${curRank}위` : '미노출', color: curRank != null && curRank <= 3 ? '#30D158' : curRank != null && curRank <= 6 ? '#FF9F0A' : 'var(--text-tertiary)' },
                      { label: '최고 순위', value: bestRank != null ? `${bestRank}위` : '—', color: '#30D158' },
                      { label: '추적 기간', value: `${trackDays}일`, color: 'var(--text-primary)' },
                      { label: '총 기록', value: `${snapshots.filter(s => s.blog_id === firstBlog).length}회`, color: 'var(--text-primary)' },
                    ].map(chip => (
                      <div key={chip.label} style={{
                        padding: '8px 14px', borderRadius: 10, minWidth: 80,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{chip.label}</span>
                        <span style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: chip.color, lineHeight: 1 }}>{chip.value}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* 캘린더 히트맵 */}
            <div className="mac-card" style={{ padding: '18px 22px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
                일별 노출 순위 — 캘린더
              </div>
              <RankCalendar
                snapshots={snapshots}
                blogIds={mode === 'blog' ? blogIds : [...new Set(snapshots.map(s => s.blog_id))]}
                days={30}
              />
            </div>

            {/* 순위 추이 차트 (블로그 추적 모드) */}
            {mode === 'blog' && (
              <div className="mac-card" style={{ padding: '18px 22px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
                  순위 추이
                </div>
                <RankChart snapshots={snapshots} blogIds={blogIds} />
              </div>
            )}

            {/* 전체 순위 테이블 (전체 순위 모드) */}
            {mode === 'all' && latestSnapshot.length > 0 && (
              <div className="mac-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                    현재 블로그탭 상위 10위 ({latestDate})
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                      {['순위', '포스팅 제목', '블로그'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {latestSnapshot.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: s.rank <= 3 ? '#30D158' : 'var(--text-primary)' }}>{s.rank}</span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', maxWidth: 360 }}>
                          {s.post_link ? (
                            <a href={s.post_link} target="_blank" rel="noreferrer"
                              style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.post_title || '(제목 없음)'}</span>
                              <ExternalLink size={10} style={{ flexShrink: 0, opacity: 0.4 }} />
                            </a>
                          ) : (s.post_title || '(제목 없음)')}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--accent)' }}>{s.blog_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}
      </div>

      {/* 등록 모달 */}
      {showModal && (
        <AddTrackerModal
          mode={mode}
          token={token}
          onClose={() => setShowModal(false)}
          onAdded={async () => { setShowModal(false); await loadItems(); }}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── 등록 모달 ─────────────────────────────────────────────────────────────────
function AddTrackerModal({ mode: defaultMode, token, onClose, onAdded }) {
  const [modalMode, setModalMode] = useState(defaultMode);
  const [keyword, setKeyword] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [blogUrls, setBlogUrls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function extractBlogId(url) {
    const m = String(url).match(/blog\.naver\.com\/([^/?#\s]+)/);
    return m ? m[1] : url.trim();
  }

  function addUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setBlogUrls(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    setUrlInput('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!keyword.trim()) { setError('키워드를 입력해 주세요.'); return; }
    if (modalMode === 'blog' && !blogUrls.length) { setError('블로그 URL을 1개 이상 추가해 주세요.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/rank-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ keyword: keyword.trim(), mode: modalMode, blogUrls }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '등록에 실패했습니다.');
      onAdded();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
        borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 480,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>추적 등록</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* 모드 선택 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {[{ id: 'blog', label: '블로그 추적', desc: '내 블로그 순위 추적' }, { id: 'all', label: '전체 순위', desc: '상위 10위 스냅샷' }].map(m => (
            <div key={m.id} onClick={() => setModalMode(m.id)} style={{
              flex: 1, padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
              border: `1.5px solid ${modalMode === m.id ? 'var(--accent)' : 'var(--border)'}`,
              background: modalMode === m.id ? 'rgba(10,132,255,0.08)' : 'transparent',
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: modalMode === m.id ? 'var(--accent)' : 'var(--text-secondary)' }}>{m.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{m.desc}</div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>타겟 키워드</label>
            <input
              value={keyword} onChange={e => setKeyword(e.target.value)}
              placeholder="예: 휴대폰창업"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 9, boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-strong)',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          {modalMode === 'blog' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>추적할 블로그 URL</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  value={urlInput} onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
                  placeholder="https://blog.naver.com/myblog"
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 9, boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-strong)',
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <button type="button" onClick={addUrl} style={{
                  padding: '9px 14px', borderRadius: 9, border: 'none', background: 'var(--accent)',
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                }}>추가</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {blogUrls.map(url => (
                  <span key={url} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 999,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-strong)',
                    fontSize: 12, color: 'var(--text-secondary)',
                  }}>
                    {extractBlogId(url)}
                    <button type="button" onClick={() => setBlogUrls(p => p.filter(u => u !== url))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex', lineHeight: 1 }}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && <p style={{ margin: 0, fontSize: 12, color: '#FF453A', fontWeight: 500 }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border-strong)',
              background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}>취소</button>
            <button type="submit" disabled={loading} style={{
              padding: '9px 20px', borderRadius: 9, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>{loading ? '등록 중…' : '등록하기'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add client/src/pages/RankTrackerPage.jsx
git commit -m "feat: RankTrackerPage 메인 페이지"
```

---

## Task 7: 네비게이션 + App.jsx 연결

**Files:**
- Modify: `client/src/components/Navbar.jsx`
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Navbar — SERVICES 배열에 순위 추적 추가**

`client/src/components/Navbar.jsx` 상단 import에 `TrendingUp` 추가:
```js
import { Search, Sparkles, FileText, TrendingUp } from 'lucide-react';
```

`SERVICES` 배열 마지막 항목 뒤에 추가:
```js
{ id: 'rank-tracker', icon: TrendingUp, label: '순위 추적', desc: '블로그 키워드 순위 일별 추적' }
```

- [ ] **Step 2: App.jsx — import 추가**

`client/src/App.jsx` 상단 import 블록에 추가:
```js
import RankTrackerPage from './pages/RankTrackerPage';
```

- [ ] **Step 3: App.jsx — switchTab 핸들러 확장**

`switchTab` 함수 내부 (기존 `if (next === 'blog') { ... }` 블록 뒤)에 추가:
```js
if (next === 'rank-tracker') { /* 별도 상태 초기화 없음 */ }
```

- [ ] **Step 4: App.jsx — HeroSection 헤드라인 추가**

`HeroSection` 내부에서 탭별 헤드라인을 분기하는 곳에 추가:
```jsx
{tab === 'rank-tracker' && (
  <>
    <span>키워드 순위를</span>
    <br />
    <strong style={{ background: 'linear-gradient(90deg,#30D158,#0A84FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
      날짜별로 추적하세요
    </strong>
  </>
)}
```

- [ ] **Step 5: App.jsx — RankTrackerPage 렌더**

기존 `{activeTab === 'blog' && ...}` 블록 뒤에 추가:
```jsx
{activeTab === 'rank-tracker' && (
  <RankTrackerPage onLoginRequest={() => setActiveTab('auth')} />
)}
```

- [ ] **Step 6: 커밋**

```bash
git add client/src/components/Navbar.jsx client/src/App.jsx
git commit -m "feat: 순위 추적 탭 네비게이션 연결"
```

---

## Task 8: @supabase/supabase-js 서버 의존성 확인

**Files:**
- Modify: `server/package.json` (필요 시)

- [ ] **Step 1: 서버에 supabase-js 설치 여부 확인**

```bash
cd server && node -e "import('@supabase/supabase-js').then(()=>console.log('OK')).catch(()=>console.log('MISSING'))"
```

`MISSING` 이면:
```bash
cd server && npm install @supabase/supabase-js
```

- [ ] **Step 2: 커밋 (설치했을 때만)**

```bash
git add server/package.json server/package-lock.json
git commit -m "chore: 서버에 @supabase/supabase-js 추가"
```

---

## Task 9: 통합 확인

- [ ] **Step 1: 서버 + 클라이언트 실행**

터미널 1:
```bash
cd server && npm run dev
```
터미널 2:
```bash
cd client && npm run dev
```

- [ ] **Step 2: 로그인 후 순위 추적 탭 진입 확인**

브라우저에서 `http://localhost:5173` → 로그인 → 네비게이션 "순위 추적" 클릭 → 페이지 렌더 확인

- [ ] **Step 3: 추적 등록 → 갱신 → 캘린더 확인**

1. "등록" 버튼 → 키워드 입력 + 블로그 URL 추가 → 등록하기
2. 왼쪽 목록에 항목 표시 확인
3. 항목 클릭 → 오른쪽 패널 표시 확인
4. "순위 갱신" 버튼 → 로딩 후 캘린더에 오늘 날짜 셀 색상 표시 확인

- [ ] **Step 4: 전체 순위 모드 확인**

1. 모드 탭 "전체 순위 모드" 클릭
2. 키워드만 등록
3. 갱신 후 상위 10위 테이블 표시 확인

- [ ] **Step 5: 최종 커밋**

```bash
git add -A
git commit -m "feat: 순위 추적 기능 구현 완료"
```
