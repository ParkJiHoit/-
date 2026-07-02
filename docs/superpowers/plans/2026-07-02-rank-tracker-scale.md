# 순위 추적 대량화 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 순위 추적 기능이 키워드 ~100개 / 포스팅 월 200~300건 규모를 감당하도록 (1) 포스팅 단위 정밀 매칭과 조회 실패 상태 분리로 정확도를 높이고, (2) CSV/엑셀 대량 등록을 지원하고, (3) Vercel 서버리스(30초 제한)에서 동작하는 서버사이드 잡+청크 기반 일괄 새로고침을 추가한다.

**Architecture:** 기존 `rankTrackerService.js`/`blogRankingService.js`의 매칭 로직을 `blogId` 단위에서 `blogId+logNo`(특정 포스팅) 단위로 정밀화하고, `rank_snapshots`에 `status`(ranked/not_in_top5/fetch_failed) 컬럼을 추가해 스크래핑 실패를 구분한다. 신규 `bulkImportService.js`가 CSV/붙여넣기 텍스트를 유연하게 파싱하고, 신규 `refreshJobService.js`가 `refresh_jobs`/`refresh_job_items` 테이블 기반으로 대량 갱신을 청크 단위(5개씩)로 처리해 Vercel 함수 실행 제한 안에서 동작하며 브라우저 재접속 시에도 이어할 수 있게 한다.

**Tech Stack:** Node.js 24 (ESM), Express, PostgreSQL(`pg`), React 18, `xlsx`(SheetJS, 이미 client에 설치됨), 신규 테스트는 Node 내장 `node:test`/`node:assert` 사용(새 의존성 추가 안 함).

## Global Constraints

- 배포는 Vercel 서버리스(`api/index.js`, `maxDuration: 30`) — 일괄 처리는 반드시 청크 단위로 30초 안에 끝나야 함.
- 1차 적용 대상은 운영자 계정(`ADMIN_EMAILS`, 기본값 `qkrwlgh52660724@gmail.com`)뿐이며, `req.isAdmin`은 키워드 개수 제한을 완전히 우회한다(기존 패턴 유지, 새 "무제한 플래그" 만들지 않음).
- 자동 스케줄링(Vercel Cron)과 프리미엄 요금제 한도 재설계는 이번 범위 밖.
- 개별 새로고침(`POST /:id/refresh`)의 `daily_usage.rank_refresh` 카운트는 그대로 유지하고, 신규 일괄 새로고침(잡 기반) 경로는 이 카운트를 전혀 건드리지 않는다.
- 순위 유효 판정은 상위 5위까지. 6~10위는 UI상 `not_in_top5`로 취급하되, 원본 `rank` 값은 그대로 저장한다(스크래핑 자체는 상위 10개 유지, 변경 없음).
- 신규 의존성 추가 금지 — 서버 테스트는 `node:test`, 클라이언트 CSV/엑셀 파싱은 이미 설치된 `xlsx` 사용.
- 로컬 개발 환경에 `DATABASE_URL`이 설정돼 있지 않을 수 있다 — `getPool()`은 이 경우 `null`을 반환하고 `initDb()`는 경고 후 조용히 스킵한다(기존 동작). DB 필요 검증은 배포 환경(운영자 계정)에서 최종 확인한다.

---

### Task 1: 테스트 러너 준비 + DB 스키마 확장

**Files:**
- Modify: `server/package.json`
- Modify: `server/db/index.js:46-70`

**Interfaces:**
- Produces: `rank_snapshots.status` 컬럼(`'ranked' | 'not_in_top5' | 'fetch_failed'`, 기본값 `'ranked'`), `refresh_jobs` 테이블, `refresh_job_items` 테이블. 이후 모든 Task가 이 스키마를 전제로 한다.

- [ ] **Step 1: `server/package.json`에 테스트 스크립트 추가**

`server/package.json`의 `scripts` 블록을 다음과 같이 수정:

```json
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js",
    "test": "node --test services",
    "refresh-history": "node jobs/refreshKeywordHistory.js",
    "seed": "node jobs/seedKeywordHistory.js"
  },
```

- [ ] **Step 2: `initDb()`에 스키마 확장 SQL 추가**

`server/db/index.js`의 `rank_tracker 테이블 준비 완료` 로그(현재 70행) 직후, `daily_usage` 테이블 생성 블록(현재 71행) 이전에 다음을 삽입:

```js
  await p.query(`
    ALTER TABLE rank_snapshots ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ranked';
    ALTER TABLE rank_snapshots DROP CONSTRAINT IF EXISTS rank_snapshots_status_check;
    ALTER TABLE rank_snapshots ADD CONSTRAINT rank_snapshots_status_check
      CHECK (status IN ('ranked','not_in_top5','fetch_failed'));
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
```

- [ ] **Step 3: import/문법 오류 없이 로드되는지 확인**

Run (in `server/`):
```bash
node -e "import('./db/index.js').then(m=>m.initDb()).then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"
```
Expected: `[DB] DATABASE_URL 미설정 — 히스토리 기능 비활성화` 경고 후 `OK` 출력 (로컬에 `DATABASE_URL`이 없으므로 실제 테이블 생성은 스킵됨 — 문법 오류 없이 함수가 끝까지 실행되는지만 확인).

- [ ] **Step 4: `node --test` 러너 자체가 동작하는지 확인**

Run (in `server/`):
```bash
mkdir -p services && printf "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\ntest('probe', () => assert.equal(1+1, 2));\n" > services/__probe.test.js
npm test
rm services/__probe.test.js
```
Expected: `tests 1`, `pass 1`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add server/package.json server/db/index.js
git commit -m "feat: add refresh_jobs schema, status column, node:test runner"
```

---

### Task 2: blogRankingService — 포스팅 고유번호(logNo) 추출

**Files:**
- Modify: `server/services/blogRankingService.js:188-200`
- Test: `server/services/blogRankingService.test.js`

**Interfaces:**
- Produces: `buildRankingList(raw, domains)` — 순수 함수. `raw`: `{ title, author, dateRaw, postLink, type }[]`, `domains`: `string[]`. 반환: `{ rank, title, author, date, daysAgo, postLink, type, blogId, logNo }[]` (`logNo`는 포스팅 번호 문자열 또는 `null`).
- 기존 `scrapeNaverTab`의 반환값도 동일한 형태를 유지하되 `logNo` 필드가 추가됨 — Task 3/4에서 이 필드를 사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`server/services/blogRankingService.test.js` 신규 작성:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRankingList } from './blogRankingService.js';

test('blogId와 logNo를 함께 추출한다', () => {
  const raw = [
    { title: 'A', author: 'author1', dateRaw: '2026.07.01.', postLink: 'https://blog.naver.com/myblog123/223456789', type: 'blog' },
  ];
  const result = buildRankingList(raw, ['blog.naver.com']);
  assert.equal(result.length, 1);
  assert.equal(result[0].blogId, 'myblog123');
  assert.equal(result[0].logNo, '223456789');
  assert.equal(result[0].rank, 1);
});

test('logNo가 없는 링크는 logNo=null을 반환한다', () => {
  const raw = [
    { title: 'B', author: 'author2', dateRaw: '', postLink: 'https://blog.naver.com/myblog123', type: 'blog' },
  ];
  const result = buildRankingList(raw, ['blog.naver.com']);
  assert.equal(result[0].blogId, 'myblog123');
  assert.equal(result[0].logNo, null);
});

test('도메인이 일치하지 않는 링크는 걸러낸다', () => {
  const raw = [
    { title: 'C', author: '', dateRaw: '', postLink: 'https://cafe.naver.com/x/1', type: 'cafe' },
  ];
  const result = buildRankingList(raw, ['blog.naver.com']);
  assert.equal(result.length, 0);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run (in `server/`):
```bash
node --test services/blogRankingService.test.js
```
Expected: FAIL — `buildRankingList is not a function` (아직 export 안 됨).

- [ ] **Step 3: `buildRankingList` 구현 및 export**

`server/services/blogRankingService.js`의 191~199행(기존 `return raw.filter(...).map(...)` 블록)을 다음으로 교체:

```js
  return buildRankingList(raw, config.domains);
}

export function buildRankingList(raw, domains) {
  return raw
    .filter(r => r.postLink && isValidNaverUrl(r.postLink, domains))
    .map((r, i) => {
      const m = r.postLink.match(/blog\.naver\.com\/([^/?#\s]+)\/(\d+)/);
      return {
        rank: i + 1,
        title: r.title,
        author: r.author,
        date: formatDate(r.dateRaw),
        daysAgo: parseDaysAgo(r.dateRaw),
        postLink: r.postLink,
        type: r.type || detectType(r.postLink),
        blogId: m?.[1]?.toLowerCase() || '',
        logNo: m?.[2] || null,
      };
    });
}
```

주의: 원래 195행 `return raw` 앞에 있던 `async function scrapeNaverTab(...) {` 의 닫는 중괄호 위치가 바뀌므로, 교체 후 `scrapeNaverTab` 함수가 `return buildRankingList(raw, config.domains);` 한 줄로 끝나고 그 다음에 `buildRankingList` 함수가 독립적으로 정의되는 구조가 되어야 한다.

- [ ] **Step 4: 테스트 통과 확인**

Run (in `server/`):
```bash
node --test services/blogRankingService.test.js
```
Expected: `tests 3`, `pass 3`, `fail 0`.

- [ ] **Step 5: 서버가 정상 기동하는지 스모크 확인**

Run (in `server/`):
```bash
node server.js &
sleep 2
curl -s http://localhost:4000/api/health
kill %1
```
Expected: `{"status":"ok"}` 출력 (import/문법 오류로 서버가 죽지 않아야 함).

- [ ] **Step 6: Commit**

```bash
git add server/services/blogRankingService.js server/services/blogRankingService.test.js
git commit -m "feat: extract post logNo alongside blogId in blog ranking scraper"
```

---

### Task 3: rankTrackerService — 포스팅 단위 식별자(postKey) 순수 함수

**Files:**
- Modify: `server/services/rankTrackerService.js:1-7`
- Test: `server/services/rankTrackerService.test.js`

**Interfaces:**
- Consumes: 스크래핑 결과 항목의 `{ blogId, logNo }` (Task 2 산출물).
- Produces: `extractPostKey(url)` → `{ blogId, logNo } | null`. `postKeyToString({ blogId, logNo })` → `string`(`"blogId"` 또는 `"blogId/logNo"`). `parsePostKeyString(stored)` → `{ blogId, logNo }`. `findMatchingRank(rankings, storedKey)` → 매칭된 랭킹 객체 또는 `null`. Task 4가 이 네 함수를 사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`server/services/rankTrackerService.test.js` 신규 작성:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractPostKey, postKeyToString, parsePostKeyString, findMatchingRank } from './rankTrackerService.js';

test('blog.naver.com/{id}/{logNo} 형식에서 blogId와 logNo를 추출한다', () => {
  const key = extractPostKey('https://blog.naver.com/myblog123/223456789');
  assert.deepEqual(key, { blogId: 'myblog123', logNo: '223456789' });
});

test('m.blog.naver.com 모바일 URL도 지원한다', () => {
  const key = extractPostKey('https://m.blog.naver.com/myblog123/223456789?a=1');
  assert.deepEqual(key, { blogId: 'myblog123', logNo: '223456789' });
});

test('PostView.naver?blogId=&logNo= 쿼리 형식도 지원한다', () => {
  const key = extractPostKey('https://blog.naver.com/PostView.naver?blogId=myblog123&logNo=223456789');
  assert.deepEqual(key, { blogId: 'myblog123', logNo: '223456789' });
});

test('포스팅 번호 없이 블로그 URL만 있으면 logNo는 null', () => {
  const key = extractPostKey('https://blog.naver.com/myblog123');
  assert.deepEqual(key, { blogId: 'myblog123', logNo: null });
});

test('네이버 블로그 URL이 아니면 null을 반환한다', () => {
  assert.equal(extractPostKey('https://example.com/foo'), null);
});

test('postKeyToString / parsePostKeyString은 서로 역변환된다', () => {
  const key = { blogId: 'myblog123', logNo: '223456789' };
  const str = postKeyToString(key);
  assert.equal(str, 'myblog123/223456789');
  assert.deepEqual(parsePostKeyString(str), key);

  const blogOnly = { blogId: 'myblog123', logNo: null };
  assert.equal(postKeyToString(blogOnly), 'myblog123');
  assert.deepEqual(parsePostKeyString('myblog123'), { blogId: 'myblog123', logNo: null });
});

test('findMatchingRank: logNo가 저장돼 있으면 blogId+logNo 정확히 일치해야 매칭', () => {
  const rankings = [
    { rank: 1, blogId: 'myblog123', logNo: '111' },
    { rank: 2, blogId: 'myblog123', logNo: '222' },
  ];
  assert.equal(findMatchingRank(rankings, 'myblog123/222').rank, 2);
  assert.equal(findMatchingRank(rankings, 'myblog123/999'), null);
});

test('findMatchingRank: logNo가 없으면(레거시) blogId만으로 첫 매칭을 반환', () => {
  const rankings = [
    { rank: 1, blogId: 'myblog123', logNo: '111' },
    { rank: 2, blogId: 'myblog123', logNo: '222' },
  ];
  assert.equal(findMatchingRank(rankings, 'myblog123').rank, 1);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run (in `server/`):
```bash
node --test services/rankTrackerService.test.js
```
Expected: FAIL — `extractPostKey is not a function`.

- [ ] **Step 3: 구현**

`server/services/rankTrackerService.js`의 4~7행(기존 `extractBlogId` 함수)을 다음으로 교체:

```js
export function extractPostKey(url) {
  const str = String(url || '').trim();

  let m = str.match(/(?:m\.)?blog\.naver\.com\/([^/?#\s]+)\/(\d+)/);
  if (m) return { blogId: m[1].toLowerCase(), logNo: m[2] };

  if (/blog\.naver\.com\/PostView\.naver\?/.test(str)) {
    const blogIdMatch = str.match(/[?&]blogId=([^&]+)/);
    const logNoMatch = str.match(/[?&]logNo=([^&]+)/);
    if (blogIdMatch && logNoMatch) {
      return { blogId: decodeURIComponent(blogIdMatch[1]).toLowerCase(), logNo: logNoMatch[1] };
    }
  }

  m = str.match(/blog\.naver\.com\/([^/?#\s]+)/);
  if (m) return { blogId: m[1].toLowerCase(), logNo: null };

  return null;
}

export function postKeyToString({ blogId, logNo }) {
  return logNo ? `${blogId}/${logNo}` : blogId;
}

export function parsePostKeyString(stored) {
  const [blogId, logNo] = String(stored).split('/');
  return { blogId, logNo: logNo || null };
}

export function findMatchingRank(rankings, storedKey) {
  const { blogId, logNo } = parsePostKeyString(storedKey);
  if (logNo) {
    return rankings.find(r => r.blogId?.toLowerCase() === blogId && r.logNo === logNo) || null;
  }
  return rankings.find(r => r.blogId?.toLowerCase() === blogId) || null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run (in `server/`):
```bash
node --test services/rankTrackerService.test.js
```
Expected: `tests 8`, `pass 8`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add server/services/rankTrackerService.js server/services/rankTrackerService.test.js
git commit -m "feat: add post-level (blogId+logNo) key extraction and matching helpers"
```

---

### Task 4: rankTrackerService — 정밀 매칭 + 조회 실패 상태를 refreshRanks에 반영, 병합 upsert 추가

**Files:**
- Modify: `server/services/rankTrackerService.js` (전체, Task 3에서 이어서)

**Interfaces:**
- Consumes: `extractPostKey`, `postKeyToString`, `findMatchingRank` (Task 3). `rank_snapshots.status` 컬럼, `logNo` 필드가 포함된 랭킹 객체 (Task 1, 2).
- Produces: `createTracked(userId, keyword, mode, blogUrls)` — 이제 `blogId/logNo` 형식으로 저장. `mergeTrackedBlogUrls(userId, keyword, mode, newUrls)` — 기존 `blog_ids`에 신규 URL만 append(중복 제거). `refreshRanks`가 반환하는 각 스냅샷에 `status` 반영. `listTracked`의 `latestRanks[blogId]`가 `{ rank, status }` 객체로 변경(기존엔 숫자였음 — Task 12에서 프론트가 이 변경을 반영). Task 7(대량 등록), Task 9(일괄 새로고침)가 이 함수들을 사용한다.

- [ ] **Step 1: `createTracked`가 postKey를 저장하도록 수정**

`server/services/rankTrackerService.js`의 `createTracked` 함수(기존 31~42행)를 다음으로 교체:

```js
export async function createTracked(userId, keyword, mode, blogUrls = []) {
  const pool = getPool();
  const blogIds = blogUrls
    .map(u => { const k = extractPostKey(u); return k ? postKeyToString(k) : null; })
    .filter(Boolean);
  const { rows } = await pool.query(
    `INSERT INTO tracked_keywords (user_id, keyword, mode, blog_ids)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, keyword, mode) DO UPDATE SET blog_ids = EXCLUDED.blog_ids
     RETURNING id, keyword, mode, blog_ids, created_at`,
    [userId, keyword.trim(), mode, blogIds]
  );
  return rows[0];
}

export async function mergeTrackedBlogUrls(userId, keyword, mode, newUrls = []) {
  const pool = getPool();
  const newIds = newUrls
    .map(u => { const k = extractPostKey(u); return k ? postKeyToString(k) : null; })
    .filter(Boolean);
  const { rows } = await pool.query(
    `INSERT INTO tracked_keywords (user_id, keyword, mode, blog_ids)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, keyword, mode) DO UPDATE
       SET blog_ids = ARRAY(
         SELECT DISTINCT unnest(tracked_keywords.blog_ids || EXCLUDED.blog_ids)
       )
     RETURNING id, keyword, mode, blog_ids, created_at`,
    [userId, keyword.trim(), mode, newIds]
  );
  return rows[0];
}
```

- [ ] **Step 2: `listTracked`/`getSnapshots`가 `status`를 함께 조회하도록 수정**

`listTracked` 함수(기존 9~29행) 중 스냅샷 조회 쿼리와 `latestByBlog` 조립부를 다음으로 교체:

```js
    const { rows: snaps } = await pool.query(
      `SELECT blog_id, rank, status, TO_CHAR(snapshotted_at, 'YYYY-MM-DD') AS snapshotted_at
       FROM rank_snapshots WHERE tracked_id = $1 ORDER BY snapshotted_at DESC LIMIT 20`,
      [row.id]
    );
    const latestByBlog = {};
    for (const s of snaps) {
      if (!latestByBlog[s.blog_id]) latestByBlog[s.blog_id] = { rank: s.rank, status: s.status };
    }
```

`getSnapshots` 함수(기존 53~69행)의 스냅샷 조회 쿼리 `SELECT` 절에 `status`를 추가:

```js
  const { rows: snaps } = await pool.query(
    `SELECT blog_id, rank, status, post_title, post_link,
            TO_CHAR(snapshotted_at, 'YYYY-MM-DD') AS snapshotted_at
     FROM rank_snapshots WHERE tracked_id = $1
     ORDER BY snapshotted_at DESC, rank ASC NULLS LAST`,
    [trackedId]
  );
```

- [ ] **Step 3: `refreshRanks`가 정밀 매칭 + status를 반영하도록 수정**

`refreshRanks` 함수(기존 71~126행) 전체를 다음으로 교체:

```js
export async function refreshRanks(userId, trackedId) {
  const pool = getPool();
  const { rows: own } = await pool.query(
    `SELECT id, keyword, mode, blog_ids FROM tracked_keywords WHERE id = $1 AND user_id = $2`,
    [trackedId, userId]
  );
  if (!own.length) throw Object.assign(new Error('항목을 찾을 수 없습니다.'), { status: 404 });

  const { keyword, mode, blog_ids } = own[0];
  const rankings = await fetchBlogRankings(keyword, 'blog');
  const fetchFailed = rankings.length === 0;

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const upserts = [];

  if (mode === 'blog') {
    for (const storedKey of blog_ids) {
      const hit = fetchFailed ? null : findMatchingRank(rankings, storedKey);
      // 상위 5위까지만 "노출 성공"으로 판정 (스펙 2-C) — 6~10위도 매칭은 되지만
      // UI/집계상 순위권 밖으로 취급한다. 실제 순위 값은 rank 컬럼에 그대로 남긴다.
      const isRankedWithinTop5 = !!hit && hit.rank <= 5;
      upserts.push({
        blog_id: storedKey,
        rank: hit ? hit.rank : null,
        post_title: hit?.title || null,
        post_link: hit?.postLink || null,
        status: fetchFailed ? 'fetch_failed' : (isRankedWithinTop5 ? 'ranked' : 'not_in_top5'),
      });
    }
  } else if (fetchFailed) {
    upserts.push({ blog_id: '__fetch_failed__', rank: null, post_title: null, post_link: null, status: 'fetch_failed' });
  } else {
    for (const r of rankings) {
      if (!r.blogId) continue;
      upserts.push({
        blog_id: r.blogId,
        rank: r.rank,
        post_title: r.title || null,
        post_link: r.postLink || null,
        status: 'ranked',
      });
    }
  }

  for (const u of upserts) {
    await pool.query(
      `INSERT INTO rank_snapshots (tracked_id, blog_id, rank, post_title, post_link, status, snapshotted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tracked_id, blog_id, snapshotted_at)
       DO UPDATE SET rank = EXCLUDED.rank, post_title = EXCLUDED.post_title,
                     post_link = EXCLUDED.post_link, status = EXCLUDED.status`,
      [trackedId, u.blog_id, u.rank, u.post_title, u.post_link, u.status, today]
    );
  }

  await pool.query(
    `UPDATE tracked_keywords SET last_refreshed_at = NOW() WHERE id = $1`,
    [trackedId]
  );

  console.log(`[rank-tracker] refresh ${fetchFailed ? '✗ fetch_failed' : '✓'} "${keyword}" mode=${mode} upserted=${upserts.length}`);
  return { refreshed: upserts.length, date: today, fetchFailed };
}
```

(기존 코드에 있던 미사용 변수 `nowKST` 계산은 실제로 어디에도 쓰이지 않던 죽은 코드였으므로 제거한다.)

- [ ] **Step 4: 기존 단위 테스트가 여전히 통과하는지 확인**

Run (in `server/`):
```bash
node --test services/rankTrackerService.test.js services/blogRankingService.test.js
```
Expected: 두 파일 모두 `fail 0`.

- [ ] **Step 5: 서버 스모크 확인**

Run (in `server/`):
```bash
node server.js &
sleep 2
curl -s http://localhost:4000/api/health
kill %1
```
Expected: `{"status":"ok"}`.

- [ ] **Step 6: Commit**

```bash
git add server/services/rankTrackerService.js
git commit -m "feat: apply post-level matching and fetch-failure status to refreshRanks"
```

---

### Task 5: 라우트 버그 수정 — 키워드 개수 제한 쿼리가 존재하지 않는 테이블을 참조하던 문제

**Files:**
- Modify: `server/routes/rankTracker.js:55-84`

**Interfaces:**
- Produces: `assertKeywordCapacity(req, additionalCount)` — 라우트 파일 내부 헬퍼. Task 7(대량 등록 확정 라우트)이 재사용한다.

현재 `POST /` 핸들러(63~79행)는 `FROM rank_tracked`를 조회하는데 실제 테이블명은 `tracked_keywords`다. 이 때문에 비관리자 계정이 키워드를 등록할 때마다 쿼리가 예외를 던지고 500 에러로 이어진다. 이번 대량 등록 기능에서 동일한 한도 체크를 재사용해야 하므로 이 자리에서 고쳐야 한다.

- [ ] **Step 1: 헬퍼로 추출 + 오타 수정**

`server/routes/rankTracker.js`의 `router.post('/', ...)` 핸들러(기존 55~84행)를 다음으로 교체:

```js
async function assertKeywordCapacity(req, additionalCount) {
  if (req.isAdmin) return;
  const pool = getPool();
  if (!pool) return;
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM tracked_keywords WHERE user_id = $1`,
    [req.userId]
  );
  const current = Number(rows[0]?.cnt || 0);
  const maxKeywords = req.isSubscribed ? 30 : 0;
  if (current + additionalCount > maxKeywords) {
    const err = new Error(
      req.isSubscribed
        ? `프리미엄 플랜은 최대 ${maxKeywords}개의 키워드를 추적할 수 있습니다. (현재 ${current}개)`
        : '순위 추적은 프리미엄 플랜 전용 기능입니다.'
    );
    err.status = 403;
    err.limitExceeded = true;
    throw err;
  }
}

router.post('/', async (req, res, next) => {
  try {
    const { keyword, mode, blogUrls } = req.body || {};
    if (!keyword?.trim()) return res.status(400).json({ message: '키워드를 입력해 주세요.' });
    if (!['blog', 'all'].includes(mode)) return res.status(400).json({ message: 'mode는 blog 또는 all이어야 합니다.' });
    if (mode === 'blog' && (!Array.isArray(blogUrls) || !blogUrls.length))
      return res.status(400).json({ message: '블로그 URL을 1개 이상 입력해 주세요.' });

    await assertKeywordCapacity(req, 1);

    const data = await createTracked(req.userId, keyword, mode, blogUrls || []);
    res.status(201).json(data);
  } catch (e) {
    if (e.limitExceeded) return res.status(e.status).json({ message: e.message, limitExceeded: true });
    next(e);
  }
});
```

- [ ] **Step 2: 서버 스모크 확인**

Run (in `server/`):
```bash
node server.js &
sleep 2
curl -s http://localhost:4000/api/health
kill %1
```
Expected: `{"status":"ok"}`.

- [ ] **Step 3: Commit**

```bash
git add server/routes/rankTracker.js
git commit -m "fix: correct tracked_keywords table name in keyword-cap check, extract assertKeywordCapacity"
```

---

### Task 6: bulkImportService — CSV/붙여넣기 텍스트 파싱 (순수 함수)

**Files:**
- Create: `server/services/bulkImportService.js`
- Test: `server/services/bulkImportService.test.js`

**Interfaces:**
- Produces: `parseBulkImportText(text)` → `{ rows: {rowNumber, keyword, url}[], errors: {rowNumber, reason, raw}[] }`. `groupParsedRows(rows, existingKeywordSet)` → `{ keyword, urls: string[], isNew: boolean }[]`. Task 7(라우트)이 이 두 함수를 사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`server/services/bulkImportService.test.js` 신규 작성:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBulkImportText, groupParsedRows } from './bulkImportService.js';

test('헤더가 있는 CSV(콤마 구분)를 파싱한다', () => {
  const text = '키워드,url\n강남맛집,https://blog.naver.com/abc/111\n강남맛집,https://blog.naver.com/def/222';
  const { rows, errors } = parseBulkImportText(text);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].keyword, '강남맛집');
  assert.equal(rows[0].url, 'https://blog.naver.com/abc/111');
});

test('엑셀에서 복사한 탭 구분 텍스트를 파싱한다', () => {
  const text = 'keyword\turl\n부산여행\thttps://blog.naver.com/xyz/333';
  const { rows } = parseBulkImportText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].keyword, '부산여행');
});

test('헤더 없이 키워드,URL 두 열만 있어도 첫 열=키워드, 둘째 열=URL로 인식한다', () => {
  const text = '제주맛집,https://blog.naver.com/jeju/444\n서울카페,https://blog.naver.com/seoul/555';
  const { rows, errors } = parseBulkImportText(text);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].keyword, '제주맛집');
  assert.equal(rows[1].keyword, '서울카페');
});

test('URL 열이 먼저 오고 헤더가 인식되면 컬럼 순서를 따른다', () => {
  const text = 'url,키워드\nhttps://blog.naver.com/foo/1,강릉여행';
  const { rows } = parseBulkImportText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].keyword, '강릉여행');
  assert.equal(rows[0].url, 'https://blog.naver.com/foo/1');
});

test('blog.naver.com이 아닌 URL은 오류로 분류된다', () => {
  const text = '키워드,url\n테스트,https://example.com/1';
  const { rows, errors } = parseBulkImportText(text);
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].reason, /blog\.naver\.com/);
});

test('키워드가 비어 있는 행은 오류로 분류된다', () => {
  const text = '키워드,url\n,https://blog.naver.com/foo/1';
  const { rows, errors } = parseBulkImportText(text);
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].reason, /키워드/);
});

test('빈 줄은 무시한다', () => {
  const text = '키워드,url\n\n강남맛집,https://blog.naver.com/abc/111\n\n';
  const { rows, errors } = parseBulkImportText(text);
  assert.equal(rows.length, 1);
  assert.equal(errors.length, 0);
});

test('groupParsedRows: 같은 키워드의 URL을 하나로 묶고 신규 여부를 표시한다', () => {
  const rows = [
    { rowNumber: 2, keyword: '강남맛집', url: 'https://blog.naver.com/abc/111' },
    { rowNumber: 3, keyword: '강남맛집', url: 'https://blog.naver.com/def/222' },
    { rowNumber: 4, keyword: '부산여행', url: 'https://blog.naver.com/xyz/333' },
  ];
  const groups = groupParsedRows(rows, new Set(['부산여행']));
  const gangnam = groups.find(g => g.keyword === '강남맛집');
  const busan = groups.find(g => g.keyword === '부산여행');
  assert.equal(gangnam.urls.length, 2);
  assert.equal(gangnam.isNew, true);
  assert.equal(busan.isNew, false);
});

test('groupParsedRows: 같은 URL이 중복되면 하나로 합친다', () => {
  const rows = [
    { rowNumber: 2, keyword: '강남맛집', url: 'https://blog.naver.com/abc/111' },
    { rowNumber: 3, keyword: '강남맛집', url: 'https://blog.naver.com/abc/111' },
  ];
  const groups = groupParsedRows(rows, new Set());
  assert.equal(groups[0].urls.length, 1);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run (in `server/`):
```bash
node --test services/bulkImportService.test.js
```
Expected: FAIL — `Cannot find module './bulkImportService.js'`.

- [ ] **Step 3: 구현**

`server/services/bulkImportService.js` 신규 작성:

```js
const KEYWORD_HEADERS = ['키워드', 'keyword', '검색어', 'kw'];
const URL_HEADERS = ['url', '링크', 'link', '블로그주소', '포스팅주소', '블로그url'];

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase();
}

function isNaverBlogUrl(str) {
  return /blog\.naver\.com\//.test(String(str || ''));
}

function splitLine(line) {
  if (line.includes('\t')) return line.split('\t').map(c => c.trim());
  return line.split(',').map(c => c.trim());
}

export function parseBulkImportText(text) {
  const lines = String(text || '')
    .split(/\r\n|\n|\r/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (!lines.length) return { rows: [], errors: [] };

  const firstCells = splitLine(lines[0]);
  let keywordIdx = firstCells.findIndex(c => KEYWORD_HEADERS.includes(normalizeHeader(c)));
  let urlIdx = firstCells.findIndex(c => URL_HEADERS.includes(normalizeHeader(c)));

  let startIdx;
  if (keywordIdx !== -1 && urlIdx !== -1) {
    startIdx = 1;
  } else {
    keywordIdx = 0;
    urlIdx = 1;
    const looksLikeHeader = firstCells.length >= 2 &&
      !isNaverBlogUrl(firstCells[0]) && !isNaverBlogUrl(firstCells[1]);
    startIdx = looksLikeHeader ? 1 : 0;
  }

  const rows = [];
  const errors = [];

  for (let i = startIdx; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const keyword = (cells[keywordIdx] || '').trim();
    const url = (cells[urlIdx] || '').trim();
    const rowNumber = i + 1;

    if (!keyword && !url) continue;
    if (!keyword) {
      errors.push({ rowNumber, reason: '키워드가 비어 있습니다.', raw: lines[i] });
      continue;
    }
    if (!isNaverBlogUrl(url)) {
      errors.push({ rowNumber, reason: 'blog.naver.com 형식의 URL이 아닙니다.', raw: lines[i] });
      continue;
    }
    rows.push({ rowNumber, keyword, url });
  }

  return { rows, errors };
}

export function groupParsedRows(rows, existingKeywordSet) {
  const groups = new Map();
  for (const { keyword, url } of rows) {
    if (!groups.has(keyword)) groups.set(keyword, new Set());
    groups.get(keyword).add(url);
  }

  return Array.from(groups.entries()).map(([keyword, urlSet]) => ({
    keyword,
    urls: Array.from(urlSet),
    isNew: !existingKeywordSet.has(keyword),
  }));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run (in `server/`):
```bash
node --test services/bulkImportService.test.js
```
Expected: `tests 9`, `pass 9`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add server/services/bulkImportService.js server/services/bulkImportService.test.js
git commit -m "feat: add flexible CSV/pasted-text parser for bulk keyword import"
```

---

### Task 7: 대량 등록 API 라우트 (미리보기 → 확정)

**Files:**
- Modify: `server/routes/rankTracker.js`

**Interfaces:**
- Consumes: `parseBulkImportText`, `groupParsedRows` (Task 6), `mergeTrackedBlogUrls` (Task 4), `assertKeywordCapacity` (Task 5).
- Produces: `POST /api/rank-tracker/bulk-import/preview` (body: `{ text }` → `{ groups, errors, newKeywordCount }`), `POST /api/rank-tracker/bulk-import/confirm` (body: `{ groups: {keyword, urls}[] }` → `{ created }`). Task 8(프론트)이 이 두 엔드포인트를 호출한다.

- [ ] **Step 1: import 추가**

`server/routes/rankTracker.js` 상단 import 블록을 다음으로 교체:

```js
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  listTracked, createTracked, deleteTracked,
  getSnapshots, refreshRanks, mergeTrackedBlogUrls,
} from '../services/rankTrackerService.js';
import { parseBulkImportText, groupParsedRows } from '../services/bulkImportService.js';
import { checkDailyLimit, ADMIN_EMAILS } from '../middleware/usageLimit.js';
import { getPool } from '../db/index.js';
```

- [ ] **Step 2: 라우트 추가**

`server/routes/rankTracker.js`의 `export default router;` 바로 앞에 다음 두 라우트를 추가:

```js
router.post('/bulk-import/preview', async (req, res, next) => {
  try {
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ message: '업로드할 내용이 없습니다.' });

    const { rows, errors } = parseBulkImportText(text);

    let existingKeywords = new Set();
    const pool = getPool();
    if (pool) {
      const { rows: existing } = await pool.query(
        `SELECT keyword FROM tracked_keywords WHERE user_id = $1 AND mode = 'blog'`,
        [req.userId]
      );
      existingKeywords = new Set(existing.map(r => r.keyword));
    }

    const groups = groupParsedRows(rows, existingKeywords);
    res.json({ groups, errors, newKeywordCount: groups.filter(g => g.isNew).length });
  } catch (e) { next(e); }
});

router.post('/bulk-import/confirm', async (req, res, next) => {
  try {
    const { groups } = req.body || {};
    if (!Array.isArray(groups) || !groups.length) {
      return res.status(400).json({ message: '등록할 항목이 없습니다.' });
    }

    const pool = getPool();
    if (pool) {
      const { rows: existing } = await pool.query(
        `SELECT keyword FROM tracked_keywords WHERE user_id = $1 AND mode = 'blog'`,
        [req.userId]
      );
      const existingSet = new Set(existing.map(r => r.keyword));
      const newCount = groups.filter(g => !existingSet.has(g.keyword)).length;
      await assertKeywordCapacity(req, newCount);
    }

    let created = 0;
    for (const g of groups) {
      if (!g.keyword?.trim() || !Array.isArray(g.urls) || !g.urls.length) continue;
      await mergeTrackedBlogUrls(req.userId, g.keyword, 'blog', g.urls);
      created++;
    }
    res.status(201).json({ created });
  } catch (e) {
    if (e.limitExceeded) return res.status(e.status).json({ message: e.message, limitExceeded: true });
    next(e);
  }
});
```

- [ ] **Step 3: 서버 스모크 확인 + 인증 없이 401이 반환되는지 확인**

Run (in `server/`):
```bash
node server.js &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/api/rank-tracker/bulk-import/preview -H "Content-Type: application/json" -d '{"text":"a,b"}'
kill %1
```
Expected: `401` (인증 헤더 없이 요청했으므로 `requireAuth`에서 막힘 — 라우트가 정상적으로 등록되어 미들웨어까지는 도달했다는 뜻).

- [ ] **Step 4: Commit**

```bash
git add server/routes/rankTracker.js
git commit -m "feat: add bulk-import preview/confirm endpoints"
```

---

### Task 8: 프론트 — 대량 등록 모달 (CSV/엑셀 업로드 + 붙여넣기)

**Files:**
- Create: `client/src/components/BulkImportModal.jsx`
- Modify: `client/src/pages/RankTrackerPage.jsx`

**Interfaces:**
- Consumes: `POST /bulk-import/preview`, `POST /bulk-import/confirm` (Task 7). `xlsx`(SheetJS, 이미 `client/package.json`에 설치됨).
- Produces: `BulkImportModal({ token, onClose, onImported })` 컴포넌트. `onImported()`는 등록 확정 후 호출되어 부모가 목록을 새로고침하게 한다.

- [ ] **Step 1: `BulkImportModal.jsx` 작성**

`client/src/components/BulkImportModal.jsx` 신규 작성:

```jsx
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload } from 'lucide-react';

export default function BulkImportModal({ token, onClose, onImported }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null); // { groups, errors, newKeywordCount }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleFile(file) {
    const isExcel = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (isExcel) {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        setText(XLSX.utils.sheet_to_csv(sheet));
      } else {
        setText(String(evt.target.result || ''));
      }
    };
    if (isExcel) reader.readAsBinaryString(file);
    else reader.readAsText(file);
  }

  async function handlePreview() {
    if (!text.trim()) { setError('키워드/URL 데이터를 입력하거나 파일을 업로드해 주세요.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/rank-tracker/bulk-import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '미리보기에 실패했습니다.');
      setPreview(body);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleConfirm() {
    if (!preview?.groups?.length) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/rank-tracker/bulk-import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ groups: preview.groups }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '등록에 실패했습니다.');
      onImported();
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
        borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 640,
        maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>대량 등록 (CSV/엑셀)</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {!preview ? (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7, marginTop: 0 }}>
              "키워드"와 "URL" 두 열로 된 CSV/엑셀 파일을 업로드하거나, 엑셀에서 복사한 내용을 아래에 붙여넣으세요.
              헤더 이름은 자유롭게(키워드/검색어, url/링크 등) 써도 자동으로 인식됩니다.
            </p>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              padding: '10px 14px', borderRadius: 9, border: '1px dashed var(--border-strong)',
              color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12, width: 'fit-content',
            }}>
              <Upload size={14} />
              파일 선택 (.csv, .xlsx)
              <input
                type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
            </label>
            <textarea
              value={text} onChange={e => setText(e.target.value)}
              placeholder={'키워드\tURL\n강남맛집\thttps://blog.naver.com/abc/111'}
              rows={10}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 9, boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-strong)',
                color: 'var(--text-primary)', fontSize: 12, fontFamily: 'monospace', outline: 'none', resize: 'vertical',
              }}
            />
            {error && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#FF453A', fontWeight: 500 }}>{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={onClose} style={{
                padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border-strong)',
                background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>취소</button>
              <button type="button" onClick={handlePreview} disabled={loading} style={{
                padding: '9px 20px', borderRadius: 9, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>{loading ? '분석 중…' : '미리보기'}</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              키워드 <b style={{ color: 'var(--accent)' }}>{preview.groups.length}</b>개
              (신규 <b style={{ color: '#30D158' }}>{preview.newKeywordCount}</b>개,
              기존 갱신 {preview.groups.length - preview.newKeywordCount}개)
              {preview.errors.length > 0 && <> · 오류 <b style={{ color: '#FF453A' }}>{preview.errors.length}</b>건</>}
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              {preview.groups.map(g => (
                <div key={g.keyword} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: g.isNew ? '#30D158' : 'var(--text-secondary)' }}>
                    {g.isNew ? '[신규] ' : '[기존] '}{g.keyword}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>URL {g.urls.length}개</span>
                </div>
              ))}
              {preview.errors.map((e, i) => (
                <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, color: '#FF453A' }}>
                  {e.rowNumber}행: {e.reason}
                </div>
              ))}
            </div>
            {error && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#FF453A', fontWeight: 500 }}>{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setPreview(null)} style={{
                padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border-strong)',
                background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>다시 입력</button>
              <button type="button" onClick={handleConfirm} disabled={loading || !preview.groups.length} style={{
                padding: '9px 20px', borderRadius: 9, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>{loading ? '등록 중…' : `${preview.groups.length}개 등록하기`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `RankTrackerPage.jsx`에 모달 연동**

`client/src/pages/RankTrackerPage.jsx` 상단 import에 추가:

```js
import BulkImportModal from '../components/BulkImportModal';
```

`useState` 선언부(기존 40행 `const [showModal, setShowModal] = useState(false);` 아래)에 추가:

```js
  const [showBulkModal, setShowBulkModal] = useState(false);
```

"등록" 버튼(기존 237~247행) 바로 앞에 대량 등록 버튼 추가:

```jsx
              <button
                onClick={() => setShowBulkModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-strong)',
                  background: 'var(--bg-overlay)', color: 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                대량 등록
              </button>
```

컴포넌트 최하단, 기존 `{showModal && <AddTrackerModal ... />}` 블록(487~495행) 바로 뒤에 추가:

```jsx
      {showBulkModal && (
        <BulkImportModal
          token={token}
          onClose={() => setShowBulkModal(false)}
          onImported={async () => { setShowBulkModal(false); await loadItems(); }}
        />
      )}
```

- [ ] **Step 3: 클라이언트 빌드 확인**

Run (in `client/`):
```bash
npm install --no-audit --no-fund
npm run build
```
Expected: 빌드가 오류 없이 `dist/`를 생성하고 종료 코드 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/BulkImportModal.jsx client/src/pages/RankTrackerPage.jsx
git commit -m "feat: add bulk CSV/Excel import modal to rank tracker page"
```

---

### Task 9: refreshJobService — 서버사이드 잡 생성/청크 처리

**Files:**
- Create: `server/services/refreshJobService.js`

**Interfaces:**
- Consumes: `refreshRanks` (기존, Task 4에서 정확도 반영됨). `refresh_jobs`/`refresh_job_items` 테이블 (Task 1).
- Produces: `createRefreshJob(userId, trackedIds?)` → job row. `processNextChunk(userId, jobId)` → `{ ...job, done: boolean }`. `getJobStatus(userId, jobId)` → `{ ...job, done: boolean }`. `retryFailedItems(userId, jobId)` → 새 job row (실패 항목만 재등록). Task 10(라우트)이 이 네 함수를 사용한다.

- [ ] **Step 1: 구현**

`server/services/refreshJobService.js` 신규 작성:

```js
import { getPool } from '../db/index.js';
import { refreshRanks } from './rankTrackerService.js';

const CHUNK_SIZE = 5;
const ITEM_DELAY_MS = 700;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isDone(job) {
  return job.status === 'completed' || job.status === 'failed';
}

export async function createRefreshJob(userId, trackedIds = null) {
  const pool = getPool();
  if (!pool) throw Object.assign(new Error('DB가 설정되지 않았습니다.'), { status: 503 });

  let ids = trackedIds;
  if (!ids || !ids.length) {
    const { rows } = await pool.query(
      `SELECT id FROM tracked_keywords WHERE user_id = $1`,
      [userId]
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

  for (let i = 0; i < items.length; i++) {
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
```

- [ ] **Step 2: import/문법 오류 없이 로드되는지 확인**

Run (in `server/`):
```bash
node -e "import('./services/refreshJobService.js').then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"
```
Expected: `OK` 출력.

- [ ] **Step 3: Commit**

```bash
git add server/services/refreshJobService.js
git commit -m "feat: add DB-backed refresh job service with chunked processing"
```

---

### Task 10: 일괄 새로고침 API 라우트

**Files:**
- Modify: `server/routes/rankTracker.js`

**Interfaces:**
- Consumes: `createRefreshJob`, `processNextChunk`, `getJobStatus`, `retryFailedItems` (Task 9).
- Produces: `POST /api/rank-tracker/refresh-jobs` (body: `{ trackedIds?: number[] }` → job), `POST /api/rank-tracker/refresh-jobs/:id/process-chunk` → job, `GET /api/rank-tracker/refresh-jobs/:id` → job, `POST /api/rank-tracker/refresh-jobs/:id/retry-failed` → 새 job. Task 11(프론트)이 이 엔드포인트들을 호출한다. **이 라우트들에는 `checkDailyLimit('rank_refresh')`를 붙이지 않는다** — 개별 새로고침의 일일 한도와 완전히 분리하는 것이 설계 의도다.

- [ ] **Step 1: import 추가**

`server/routes/rankTracker.js` 상단 import에 추가:

```js
import { createRefreshJob, processNextChunk, getJobStatus, retryFailedItems } from '../services/refreshJobService.js';
```

- [ ] **Step 2: 라우트 추가**

`server/routes/rankTracker.js`의 `export default router;` 바로 앞(Task 7에서 추가한 bulk-import 라우트 뒤)에 추가:

```js
router.post('/refresh-jobs', async (req, res, next) => {
  try {
    const { trackedIds } = req.body || {};
    const job = await createRefreshJob(req.userId, Array.isArray(trackedIds) ? trackedIds : null);
    res.status(201).json(job);
  } catch (e) { next(e); }
});

router.post('/refresh-jobs/:id/process-chunk', async (req, res, next) => {
  try {
    const job = await processNextChunk(req.userId, Number(req.params.id));
    res.json(job);
  } catch (e) { next(e); }
});

router.get('/refresh-jobs/:id', async (req, res, next) => {
  try {
    const job = await getJobStatus(req.userId, Number(req.params.id));
    res.json(job);
  } catch (e) { next(e); }
});

router.post('/refresh-jobs/:id/retry-failed', async (req, res, next) => {
  try {
    const job = await retryFailedItems(req.userId, Number(req.params.id));
    res.status(201).json(job);
  } catch (e) { next(e); }
});
```

- [ ] **Step 3: 서버 스모크 확인**

Run (in `server/`):
```bash
node server.js &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/api/rank-tracker/refresh-jobs
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/rank-tracker/refresh-jobs/1
kill %1
```
Expected: 두 요청 모두 `401` (인증 헤더 없음 — 라우트는 정상 등록되어 `requireAuth`까지 도달).

- [ ] **Step 4: Commit**

```bash
git add server/routes/rankTracker.js
git commit -m "feat: add refresh-job endpoints (create, process-chunk, status, retry-failed)"
```

---

### Task 11: 프론트 — 기존 "전체 갱신" 버튼을 잡 기반 일괄 새로고침으로 교체

**Files:**
- Modify: `client/src/pages/RankTrackerPage.jsx:87-112`

**Interfaces:**
- Consumes: `POST /refresh-jobs`, `POST /refresh-jobs/:id/process-chunk`, `POST /refresh-jobs/:id/retry-failed` (Task 10).

현재 `handleRefreshAll`(87~112행)은 키워드마다 `/refresh`를 순차 호출하는 방식이라 개별 새로고침 일일 한도(`daily_usage.rank_refresh`)에 그대로 걸린다. 이를 잡 기반 엔드포인트 호출로 교체한다. 버튼 라벨/진행률 표시(`refreshAllProgress.done/total`)는 기존 그대로 재사용한다.

- [ ] **Step 1: `handleRefreshAll`을 잡 기반으로 교체 + 재시도 상태 추가**

`useState` 선언부(기존 39행 `const [refreshAllProgress, ...]` 아래)에 추가:

```js
  const [failedJobId, setFailedJobId] = useState(null);
```

기존 `handleRefreshAll` 함수(87~112행)를 다음으로 교체:

```js
  const runJobToCompletion = async (job) => {
    let current = job;
    setRefreshAllProgress({ done: current.completed_count + current.failed_count, total: current.total_count });
    while (!current.done) {
      current = await apiFetch(`/refresh-jobs/${current.id}/process-chunk`, { method: 'POST' }, token);
      setRefreshAllProgress({ done: current.completed_count + current.failed_count, total: current.total_count });
    }
    return current;
  };

  const handleRefreshAll = async () => {
    if (!token || filteredItems.length === 0) return;
    setRefreshingAll(true);
    setFailedJobId(null);
    try {
      const job = await apiFetch('/refresh-jobs', { method: 'POST' }, token);
      const finished = await runJobToCompletion(job);
      if (finished.failed_count > 0) setFailedJobId(finished.id);

      const listData = await apiFetch('', {}, token).catch(() => null);
      if (listData) {
        setItems(listData);
        if (selected) {
          const refreshed = listData.find(i => i.id === selected.id);
          if (refreshed) {
            setSelected(refreshed);
            const snapshotData = await apiFetch(`/${refreshed.id}/snapshots`, {}, token).catch(() => null);
            if (snapshotData) setSnapshots(snapshotData.snapshots || []);
          }
        }
      }
    } catch (e) { setError(e.message); }
    finally { setRefreshingAll(false); }
  };

  const handleRetryFailed = async () => {
    if (!token || !failedJobId) return;
    setRefreshingAll(true);
    try {
      const job = await apiFetch(`/refresh-jobs/${failedJobId}/retry-failed`, { method: 'POST' }, token);
      const finished = await runJobToCompletion(job);
      setFailedJobId(finished.failed_count > 0 ? finished.id : null);
      const listData = await apiFetch('', {}, token).catch(() => null);
      if (listData) setItems(listData);
    } catch (e) { setError(e.message); }
    finally { setRefreshingAll(false); }
  };
```

- [ ] **Step 2: 실패 재시도 버튼 추가**

"전체 갱신" 버튼(기존 220~236행) 바로 뒤, 등록 버튼 앞에 추가:

```jsx
              {failedJobId && !refreshingAll && (
                <button
                  onClick={handleRetryFailed}
                  title="실패한 항목만 다시 시도"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,69,58,0.3)',
                    background: 'rgba(255,69,58,0.08)', color: '#FF453A',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  실패 항목 재시도
                </button>
              )}
```

- [ ] **Step 3: 클라이언트 빌드 확인**

Run (in `client/`):
```bash
npm run build
```
Expected: 오류 없이 종료 코드 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/RankTrackerPage.jsx
git commit -m "feat: switch bulk refresh button to job-based backend, add failed-item retry"
```

---

### Task 12: 프론트 — 조회 실패(fetch_failed) 상태를 순위 미노출과 구분 표시

**Files:**
- Modify: `client/src/pages/RankTrackerPage.jsx`

**Interfaces:**
- Consumes: `listTracked`의 `latestRanks[blogId]`가 이제 `{ rank, status }` 객체 (Task 4 변경 사항).

- [ ] **Step 1: 리스트 항목의 순위 배지에 상태 반영**

`filteredItems.map(...)` 안, 블로그별 순위 표시 블록(기존 327~344행)을 다음으로 교체:

```jsx
                  {mode === 'blog' && item.blog_ids?.map(blogId => {
                    const entry = item.latestRanks?.[blogId] ?? null;
                    const rank = entry?.rank ?? null;
                    const status = entry?.status ?? null;
                    // status는 이미 상위 5위 판정을 반영한다(백엔드 refreshRanks) — 'ranked'일 때만 숫자를 보여준다.
                    const label = status === 'fetch_failed' ? '⚠ 조회 실패' : (status === 'ranked' && rank != null ? `${rank}위` : '미노출');
                    const color = status === 'fetch_failed'
                      ? '#FF9F0A'
                      : status !== 'ranked' || rank == null ? 'var(--text-tertiary)' : rank <= 3 ? '#30D158' : '#FF9F0A';
                    return (
                      <div key={blogId} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', marginBottom: 3,
                      }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{blogId}</span>
                        <span style={{
                          fontSize: 14, fontWeight: 800,
                          fontFamily: "'Space Grotesk', sans-serif",
                          color,
                        }}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
```

- [ ] **Step 2: 상세 패널의 "현재 순위" KPI 칩에 상태 반영**

상세 패널 KPI 칩 블록(기존 392~419행) 중 `curRank` 계산부를 다음으로 교체:

```jsx
              {mode === 'blog' && blogIds.length > 0 && (() => {
                const firstBlog = blogIds[0];
                const firstEntry = latestRanks[firstBlog] ?? null;
                const curRank = firstEntry?.rank ?? null;
                const curStatus = firstEntry?.status ?? null;
                const allRanks = snapshots.filter(s => s.blog_id === firstBlog && s.rank != null).map(s => s.rank);
                const bestRank = allRanks.length ? Math.min(...allRanks) : null;
                const trackDays = selected.created_at
                  ? Math.max(1, Math.round((Date.now() - new Date(selected.created_at)) / 86400000))
                  : 0;
                return (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 0' }}>
                    {[
                      {
                        label: '현재 순위',
                        value: curStatus === 'fetch_failed' ? '⚠ 조회 실패' : (curStatus === 'ranked' && curRank != null ? `${curRank}위` : '미노출'),
                        color: curStatus === 'fetch_failed' ? '#FF9F0A' : (curStatus === 'ranked' && curRank != null && curRank <= 3 ? '#30D158' : curStatus === 'ranked' ? '#FF9F0A' : 'var(--text-tertiary)'),
                      },
                      { label: '최고 순위', value: bestRank != null ? `${bestRank}위` : '—', color: '#30D158' },
                      { label: '추적 기간', value: `${trackDays}일`, color: 'var(--text-primary)' },
                      { label: '총 기록', value: `${snapshots.filter(s => s.blog_id === firstBlog).length}회`, color: 'var(--text-primary)' },
                    ].map(chip => (
                      <div key={chip.label} style={{
                        padding: '8px 14px', borderRadius: 10, minWidth: 80,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{chip.label}</span>
                        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: chip.color, lineHeight: 1 }}>{chip.value}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
```

- [ ] **Step 2: 클라이언트 빌드 확인**

Run (in `client/`):
```bash
npm run build
```
Expected: 오류 없이 종료 코드 0.

- [ ] **Step 3: 전체 서버 테스트 스위트 재확인 (회귀 확인)**

Run (in `server/`):
```bash
npm test
```
Expected: `blogRankingService.test.js`, `rankTrackerService.test.js`, `bulkImportService.test.js` 모두 통과 (`fail 0`).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/RankTrackerPage.jsx
git commit -m "feat: distinguish fetch-failure from out-of-range in rank tracker UI"
```

---

## 최종 수동 QA (DATABASE_URL이 설정된 환경에서, 운영자 계정으로)

로컬 샌드박스에는 `DATABASE_URL`이 없어 위 각 Task의 자동 검증은 파싱/매칭 로직의 단위 테스트와 서버 기동 스모크 테스트로 제한된다. 실제 DB가 연결된 환경(로컬에 `.env` 구성 또는 배포 환경)에서 운영자 계정으로 아래를 눈으로 확인해야 최종 완료로 간주한다:

1. 순위 추적 페이지 → "대량 등록" → CSV 파일 업로드(키워드/URL 두 열, 대충 만든 헤더) → 미리보기에서 신규/기존 구분이 맞는지 → 등록 확정 → 목록에 반영되는지 확인.
2. "전체 갱신" 클릭 → 진행률이 올라가며 완료되는지, 완료 후 목록의 순위가 갱신되는지 확인. 갱신 도중 페이지를 새로고침해도 잡이 이어지는지(재접속 후 "전체 갱신" 재클릭 시 이미 처리된 항목은 건너뛰는지) 확인.
3. 일부러 존재하지 않는 블로그 URL을 등록해 "미노출"로 뜨는지, 네트워크를 잠시 끊고 갱신해 "⚠ 조회 실패"가 "미노출"과 다르게 표시되는지 확인.
4. 같은 블로그가 같은 키워드로 여러 포스팅을 등록한 경우, 각 포스팅이 개별적으로 정확한 순위를 갖는지(하나로 뭉개지지 않는지) 확인.
