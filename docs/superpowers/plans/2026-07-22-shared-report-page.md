# 순위추적 공유 리포트 페이지 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 순위추적 "리포트 공유"를 그룹 전용 링크뿐 아니라 전체 그룹 링크도 지원하게 하고, 읽기 전용 리포트 페이지에 KPI 카드/그룹 전환/정렬/14일 컷오프/주요 변동사항 요약을 추가한다.

**Architecture:** `report_shares.group_id`를 nullable로 바꿔 `NULL`을 "전체 그룹" 공유로 취급한다. 서버는 `getPublicReport(token)`이 반환하는 응답에 `groups`(전체 공유일 때만 여러 개), 필터링된 `items`, 계산된 `changes`(주요 변동사항)를 담아 내려주고, 클라이언트(`SharedReportPage.jsx`)는 이 응답 하나로 그룹 전환·정렬·요약을 전부 클라이언트 사이드에서 처리한다(추가 API 호출 없음).

**Tech Stack:** Express + PostgreSQL(`pg`), React, `node:test`(서버 유닛 테스트), Vite.

## Global Constraints

- DB 스키마 변경은 `server/db/index.js`의 `initDb()`에 `CREATE TABLE IF NOT EXISTS`/`ALTER TABLE` 형태로 추가한다(멱등성 유지 — 서버 재시작마다 실행돼도 안전해야 함).
- 서버 쪽 새 순수 로직(DB 접근 없는 함수)은 `node:test`로 유닛 테스트를 작성한다. 이 저장소는 클라이언트 쪽 자동화 테스트 프레임워크가 없으므로(`client/package.json`에 test 스크립트 없음), React 컴포넌트 변경은 `npm run build`로 빌드 성공을 확인하는 것으로 검증한다(기존 관례 그대로).
- 새 색상/뱃지 스타일을 발명하지 않는다 — `client/src/styles.css`의 기존 `.mac-badge`/`.mac-badge-green`/`.mac-badge-orange`/`.mac-badge-gray` 클래스를 재사용한다.
- 순위 상태 라벨/색상 로직은 `client/src/components/rankTracker/trackerFormat.js`의 `formatRankStatus`를 그대로 참조한다(새로 만들지 않음).
- 각 작업 완료 후 `git add` + `git commit`. 커밋 메시지는 이 저장소의 기존 스타일(한글, `type: 설명` 형식)을 따른다.

---

### Task 1: DB — `report_shares.group_id`를 nullable로 변경

**Files:**
- Modify: `server/db/index.js:206-221`

**Interfaces:**
- Consumes: 없음 (스키마 변경만).
- Produces: `report_shares.group_id`가 `NULL`을 허용 — 이후 모든 작업이 "NULL = 전체 그룹 공유"로 취급.

- [ ] **Step 1: `report_shares` 테이블 정의에 nullable 허용 + 마이그레이션 구문 추가**

`server/db/index.js`의 기존 블록(206-221행)을 아래로 교체한다:

```js
  await p.query(`
    -- 클라이언트에게 링크만 공유하면 로그인 없이 볼 수 있는 읽기전용 그룹 리포트.
    -- 토큰은 추측 불가능한 무작위 문자열이며, 유출돼도 그 그룹의 순위 데이터만
    -- 노출되고(엑셀 내보내기와 동일한 수준) 계정 정보나 다른 그룹은 보이지 않는다.
    -- group_id가 NULL이면 "전체 그룹" 공유를 의미한다.
    CREATE TABLE IF NOT EXISTS report_shares (
      id          SERIAL PRIMARY KEY,
      token       TEXT        NOT NULL UNIQUE,
      user_id     UUID        NOT NULL,
      group_id    INTEGER     REFERENCES tracker_groups(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      revoked_at  TIMESTAMPTZ,
      UNIQUE (user_id, group_id)
    );
    ALTER TABLE report_shares ALTER COLUMN group_id DROP NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_rs_token ON report_shares (token);
  `);
  console.log('[DB] report_shares 테이블 준비 완료');
```

(신규 설치 환경에서는 `CREATE TABLE`부터 이미 nullable로 만들어지고, 기존 환경에서는 `ALTER TABLE ... DROP NOT NULL`이 실행된다 — 이미 NOT NULL이 아니어도 이 구문은 에러 없이 통과하므로 매 배포마다 실행돼도 안전하다.)

- [ ] **Step 2: 문법 확인**

Run: `cd server && node --check db/index.js`
Expected: 에러 없이 종료.

- [ ] **Step 3: 커밋**

```bash
git add server/db/index.js
git commit -m "feat: report_shares.group_id를 nullable로 변경 (전체 그룹 공유 준비)"
```

---

### Task 2: 서비스 — 그룹 NULL 지원 + 순수 헬퍼 함수(14일 컷오프, 변동사항 계산) + 테스트

**Files:**
- Modify: `server/services/reportShareService.js`
- Test: `server/services/reportShareService.test.js` (신규)

**Interfaces:**
- Consumes: 없음.
- Produces:
  - `getShareForGroup(userId, groupId)` / `createShareForGroup(userId, groupId)` / `revokeShareForGroup(userId, groupId)` — `groupId`로 `null` 허용(전체 그룹).
  - `filterItemsByCutoff(items, cutoffDate)` — 순수 함수, `items`는 `listTracked()`가 반환하는 배열과 동일한 shape, `cutoffDate`는 `'YYYY-MM-DD'` 문자열. 링크(blog_id) 단위로 `latestRanks[blogId].addedDate >= cutoffDate`인 것만 남기고, 살아남은 링크가 하나도 없는 아이템은 통째로 제외. `mode === 'all'` 아이템은 `created_at`으로 판단.
  - `computeRankChanges(snapshotPairs)` — 순수 함수, `snapshotPairs: [{ keyword, blogId, fromRank, fromStatus, toRank, toStatus }]`를 받아 `[{ keyword, blogId, fromRank, toRank, type: 'new_top5' | 'improved' }]`(최대 6개)를 반환. Task 3에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`server/services/reportShareService.test.js` 신규 생성:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterItemsByCutoff, computeRankChanges } from './reportShareService.js';

test('filterItemsByCutoff: blog 모드는 링크별 addedDate 기준으로 컷오프 이전 링크를 제외한다', () => {
  const items = [
    {
      keyword: 'A', mode: 'blog', created_at: '2026-07-01T00:00:00Z',
      blog_ids: ['blog1/1', 'blog2/2'],
      latestRanks: {
        'blog1/1': { rank: 3, status: 'ranked', addedDate: '2026-07-20' },
        'blog2/2': { rank: null, status: null, addedDate: '2026-07-01' },
      },
    },
  ];
  const result = filterItemsByCutoff(items, '2026-07-10');
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].blog_ids, ['blog1/1']);
  assert.deepEqual(Object.keys(result[0].latestRanks), ['blog1/1']);
});

test('filterItemsByCutoff: 남는 링크가 하나도 없으면 아이템 자체를 제외한다', () => {
  const items = [
    {
      keyword: 'B', mode: 'blog', created_at: '2026-07-01T00:00:00Z',
      blog_ids: ['blog1/1'],
      latestRanks: { 'blog1/1': { rank: 5, status: 'ranked', addedDate: '2026-07-01' } },
    },
  ];
  const result = filterItemsByCutoff(items, '2026-07-10');
  assert.equal(result.length, 0);
});

test('filterItemsByCutoff: all 모드는 created_at으로 판단한다', () => {
  const items = [
    { keyword: 'C', mode: 'all', created_at: '2026-07-20T00:00:00Z', blog_ids: [], latestRanks: {} },
    { keyword: 'D', mode: 'all', created_at: '2026-07-01T00:00:00Z', blog_ids: [], latestRanks: {} },
  ];
  const result = filterItemsByCutoff(items, '2026-07-10');
  assert.equal(result.length, 1);
  assert.equal(result[0].keyword, 'C');
});

test('computeRankChanges: 미노출/미확인 상태에서 5위 이내 신규 진입하면 new_top5로 표시', () => {
  const pairs = [
    { keyword: 'A', blogId: 'blog1/1', fromRank: null, fromStatus: 'not_in_top5', toRank: 4, toStatus: 'ranked' },
  ];
  const result = computeRankChanges(pairs);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'new_top5');
});

test('computeRankChanges: 3계단 이상 상승하면 improved로 표시, 2계단 이하는 제외', () => {
  const pairs = [
    { keyword: 'A', blogId: 'blog1/1', fromRank: 8, fromStatus: 'ranked', toRank: 5, toStatus: 'ranked' }, // 3계단, 포함
    { keyword: 'B', blogId: 'blog2/2', fromRank: 5, fromStatus: 'ranked', toRank: 4, toStatus: 'ranked' }, // 1계단, 제외
  ];
  const result = computeRankChanges(pairs);
  assert.equal(result.length, 1);
  assert.equal(result[0].keyword, 'A');
  assert.equal(result[0].type, 'improved');
});

test('computeRankChanges: 최신 상태가 순위권 밖이면 변동사항에서 제외한다', () => {
  const pairs = [
    { keyword: 'A', blogId: 'blog1/1', fromRank: 2, fromStatus: 'ranked', toRank: null, toStatus: 'not_in_top5' },
  ];
  assert.equal(computeRankChanges(pairs).length, 0);
});

test('computeRankChanges: 최대 6개까지만 반환한다', () => {
  const pairs = Array.from({ length: 10 }, (_, i) => ({
    keyword: `K${i}`, blogId: `b${i}/1`, fromRank: null, fromStatus: 'not_in_top5', toRank: 3, toStatus: 'ranked',
  }));
  assert.equal(computeRankChanges(pairs).length, 6);
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd server && node --test services/reportShareService.test.js`
Expected: FAIL — `filterItemsByCutoff`/`computeRankChanges`가 export되지 않았다는 에러.

- [ ] **Step 3: `reportShareService.js`에 NULL 허용 + 순수 헬퍼 구현**

`server/services/reportShareService.js` 전체를 아래로 교체한다:

```js
import crypto from 'crypto';
import { getPool } from '../db/index.js';
import { listTracked } from './rankTrackerService.js';

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export async function getShareForGroup(userId, groupId) {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT token FROM report_shares WHERE user_id = $1 AND group_id IS NOT DISTINCT FROM $2 AND revoked_at IS NULL`,
    [userId, groupId]
  );
  return rows.length ? { token: rows[0].token } : null;
}

export async function createShareForGroup(userId, groupId) {
  const pool = getPool();
  if (!pool) throw Object.assign(new Error('DB가 설정되어 있지 않습니다.'), { status: 500 });

  if (groupId != null) {
    const { rows: groupRows } = await pool.query(
      `SELECT id FROM tracker_groups WHERE id = $1 AND user_id = $2`,
      [groupId, userId]
    );
    if (!groupRows.length) throw Object.assign(new Error('그룹을 찾을 수 없습니다.'), { status: 404 });
  }

  // 이미 활성 공유 링크가 있으면 그대로 재사용(버튼을 여러 번 눌러도 링크가 안 바뀌게).
  // 예전에 만들었다가 해지한 적이 있으면 새 토큰으로 재발급한다(예전 링크는 계속 무효).
  const existing = await pool.query(
    `SELECT token, revoked_at FROM report_shares WHERE user_id = $1 AND group_id IS NOT DISTINCT FROM $2`,
    [userId, groupId]
  );
  if (existing.rows.length && !existing.rows[0].revoked_at) {
    return { token: existing.rows[0].token };
  }

  const token = generateToken();
  if (existing.rows.length) {
    await pool.query(
      `UPDATE report_shares SET token = $1, revoked_at = NULL, created_at = NOW()
       WHERE user_id = $2 AND group_id IS NOT DISTINCT FROM $3`,
      [token, userId, groupId]
    );
  } else {
    await pool.query(
      `INSERT INTO report_shares (token, user_id, group_id) VALUES ($1, $2, $3)`,
      [token, userId, groupId]
    );
  }
  return { token };
}

export async function revokeShareForGroup(userId, groupId) {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `UPDATE report_shares SET revoked_at = NOW()
     WHERE user_id = $1 AND group_id IS NOT DISTINCT FROM $2 AND revoked_at IS NULL`,
    [userId, groupId]
  );
}

// 리포트 공유 시점(report_shares.created_at)으로부터 14일 이전에 등록된 링크는
// "이미 안정화된 옛날 항목"으로 보고 공개 리포트에서 뺀다 — 링크(blog_ids)는
// listTracked()가 계산해주는 latestRanks[blogId].addedDate(링크별 실제 등록일)를
// 기준으로 판단하고, all 모드는 링크 개념이 없어 키워드 자체의 created_at을 쓴다.
export function filterItemsByCutoff(items, cutoffDate) {
  const result = [];
  for (const item of items) {
    if (item.mode === 'all') {
      const itemDate = item.created_at ? new Date(item.created_at).toISOString().slice(0, 10) : null;
      if (itemDate && itemDate >= cutoffDate) result.push(item);
      continue;
    }
    const keptBlogIds = (item.blog_ids || []).filter((blogId) => {
      const addedDate = item.latestRanks?.[blogId]?.addedDate;
      return addedDate && addedDate >= cutoffDate;
    });
    if (!keptBlogIds.length) continue;
    const keptLatestRanks = {};
    for (const blogId of keptBlogIds) keptLatestRanks[blogId] = item.latestRanks[blogId];
    result.push({ ...item, blog_ids: keptBlogIds, latestRanks: keptLatestRanks });
  }
  return result;
}

const NEW_TOP5_THRESHOLD = 5;
const IMPROVED_THRESHOLD = 3;
const MAX_CHANGES = 6;

// 리포트에 포함된 각 링크의 "가장 오래된 스냅샷"과 "가장 최신 스냅샷"을 비교해
// 눈에 띄는 변화(신규 5위 이내 진입, 3계단 이상 상승)만 추려낸다. 전부 나열하면
// 오히려 안 읽히므로 의미 있는 변화만 최대 6개까지 반환한다.
export function computeRankChanges(snapshotPairs) {
  const changes = [];
  for (const p of snapshotPairs) {
    const wasRanked = p.fromStatus === 'ranked' && p.fromRank != null;
    const isRanked = p.toStatus === 'ranked' && p.toRank != null;
    if (!isRanked) continue;
    if (!wasRanked && p.toRank <= NEW_TOP5_THRESHOLD) {
      changes.push({ keyword: p.keyword, blogId: p.blogId, fromRank: p.fromRank, toRank: p.toRank, type: 'new_top5' });
    } else if (wasRanked && p.fromRank - p.toRank >= IMPROVED_THRESHOLD) {
      changes.push({ keyword: p.keyword, blogId: p.blogId, fromRank: p.fromRank, toRank: p.toRank, type: 'improved' });
    }
  }
  return changes.slice(0, MAX_CHANGES);
}

// 로그인 없이 접근 가능한 공개 리포트 데이터는 Task 3에서 구현한다(getPublicReport).
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd server && node --test services/reportShareService.test.js`
Expected: 8개 테스트 모두 PASS.

- [ ] **Step 5: 커밋**

```bash
git add server/services/reportShareService.js server/services/reportShareService.test.js
git commit -m "feat: 리포트 공유 서비스에 전체 그룹(NULL) 지원 + 14일 컷오프/변동사항 순수 헬퍼 추가"
```

---

### Task 3: 서비스 — `getPublicReport` 재작성 (전체 그룹 응답 + 컷오프 적용 + 변동사항 포함)

**Files:**
- Modify: `server/services/reportShareService.js` (Task 2에서 만든 파일 끝에 이어서 작성)

**Interfaces:**
- Consumes: `listTracked(userId)` (`server/services/rankTrackerService.js`, 기존 함수, 각 아이템에 `id, keyword, mode, blog_ids, group_id, created_at, latestRanks: {[blogId]: {rank, status, integratedExposed, addedDate}}, searchVolume` 포함), `filterItemsByCutoff`, `computeRankChanges` (Task 2에서 정의).
- Produces: `getPublicReport(token)` → `null`(토큰 무효) 또는
  ```ts
  {
    groupName: string | null,        // 그룹 전용 공유면 그 그룹명, 전체 공유면 null
    groups: Array<{ id: number, name: string }>,  // 전체 공유일 때만 채워짐(그룹 전용이면 빈 배열)
    items: Array<listTracked 항목 + group_id>,     // 컷오프 필터링 완료된 상태
    changes: Array<{ keyword, blogId, fromRank, toRank, type }>,
  }
  ```
  Task 6(`SharedReportPage.jsx`)에서 이 shape을 그대로 소비한다.

- [ ] **Step 1: `getPublicReport` 작성**

`server/services/reportShareService.js` 파일 끝(Task 2에서 남긴 주석 자리)에 아래 코드를 추가한다:

```js
async function fetchGroupNames(pool, userId) {
  const { rows } = await pool.query(
    `SELECT id, name FROM tracker_groups WHERE user_id = $1 ORDER BY name ASC`,
    [userId]
  );
  return rows;
}

// 리포트에 포함된(=컷오프를 통과한) 각 링크의 최초/최신 순위를 비교해 변동사항을 만든다.
// items는 filterItemsByCutoff를 통과한 뒤의 목록 — 즉 이미 "이 리포트에 보일" 링크만 담고 있다.
async function fetchChanges(pool, items) {
  const trackedIds = [...new Set(items.map((i) => i.id))];
  if (!trackedIds.length) return [];

  const [{ rows: earliest }, { rows: latest }] = await Promise.all([
    pool.query(
      `SELECT DISTINCT ON (tracked_id, blog_id) tracked_id, blog_id, rank, status
       FROM rank_snapshots WHERE tracked_id = ANY($1)
       ORDER BY tracked_id, blog_id, snapshotted_at ASC`,
      [trackedIds]
    ),
    pool.query(
      `SELECT DISTINCT ON (tracked_id, blog_id) tracked_id, blog_id, rank, status
       FROM rank_snapshots WHERE tracked_id = ANY($1)
       ORDER BY tracked_id, blog_id, snapshotted_at DESC`,
      [trackedIds]
    ),
  ]);

  const earliestByKey = new Map(earliest.map((r) => [`${r.tracked_id}:${r.blog_id}`, r]));
  const latestByKey = new Map(latest.map((r) => [`${r.tracked_id}:${r.blog_id}`, r]));
  const keywordById = new Map(items.map((i) => [i.id, i.keyword]));

  const pairs = [];
  for (const key of latestByKey.keys()) {
    const [trackedIdStr, blogId] = key.split(':');
    const trackedId = Number(trackedIdStr);
    const from = earliestByKey.get(key);
    const to = latestByKey.get(key);
    if (!to) continue;
    pairs.push({
      keyword: keywordById.get(trackedId) ?? '',
      blogId,
      fromRank: from?.rank ?? null,
      fromStatus: from?.status ?? null,
      toRank: to.rank,
      toStatus: to.status,
    });
  }
  return computeRankChanges(pairs);
}

// 로그인 없이 접근 가능한 공개 리포트 — 계정 정보는 절대 노출하지 않고, 이미 엑셀
// 내보내기로도 공유 가능한 수준(키워드·블로그·순위)의 데이터만 반환한다.
// group_id가 NULL인 공유(전체 그룹)는 groups 배열을 채워서 내려주고, 그룹 전용
// 공유는 groups를 빈 배열로 둬서 클라이언트가 다른 그룹의 존재 자체를 모르게 한다.
export async function getPublicReport(token) {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT rs.user_id, rs.group_id, rs.created_at, tg.name AS group_name
     FROM report_shares rs
     LEFT JOIN tracker_groups tg ON tg.id = rs.group_id
     WHERE rs.token = $1 AND rs.revoked_at IS NULL`,
    [token]
  );
  if (!rows.length) return null;
  const { user_id: userId, group_id: groupId, created_at: sharedAt, group_name: groupName } = rows[0];

  const cutoffDate = new Date(new Date(sharedAt).getTime() - 14 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const all = await listTracked(userId);
  const scoped = groupId == null ? all : all.filter((i) => i.group_id === groupId);
  const items = filterItemsByCutoff(scoped, cutoffDate).map((i) => ({
    id: i.id,
    keyword: i.keyword,
    mode: i.mode,
    blog_ids: i.blog_ids,
    group_id: i.group_id,
    latestRanks: i.latestRanks,
    searchVolume: i.searchVolume,
  }));

  const [groups, changes] = await Promise.all([
    groupId == null ? fetchGroupNames(pool, userId) : Promise.resolve([]),
    fetchChanges(pool, items),
  ]);

  return { groupName: groupId == null ? null : groupName, groups, items, changes };
}
```

- [ ] **Step 2: 문법 확인**

Run: `cd server && node --check services/reportShareService.js`
Expected: 에러 없이 종료.

- [ ] **Step 3: 기존 서버 테스트 전체 재확인(회귀 없는지)**

Run: `cd server && npm test`
Expected: 모든 테스트 PASS (Task 2에서 추가한 것 포함).

- [ ] **Step 4: 커밋**

```bash
git add server/services/reportShareService.js
git commit -m "feat: getPublicReport가 전체 그룹 응답(groups)/14일 컷오프/변동사항(changes)을 반환하도록 재작성"
```

---

### Task 4: 라우트 — 전체 그룹 공유용 `/api/rank-tracker/share` 엔드포인트

**Files:**
- Modify: `server/routes/rankTracker.js:335-354` (기존 그룹 전용 라우트 바로 아래에 추가)

**Interfaces:**
- Consumes: `getShareForGroup`, `createShareForGroup`, `revokeShareForGroup` (Task 2에서 `groupId=null` 지원하도록 수정됨).
- Produces: `GET/POST/DELETE /api/rank-tracker/share` — 그룹 전용 라우트와 동일한 응답 shape(`{ token }` 또는 `{ token: null }`, `{ ok: true }`)이지만 URL에 `groupId`가 없다. Task 5(`ShareReportModal.jsx`)가 이 경로를 호출한다.

- [ ] **Step 1: 라우트 추가**

`server/routes/rankTracker.js`의 기존 그룹 공유 라우트(335-354행) 바로 아래에 추가:

```js
router.get('/share', requirePremium, async (req, res, next) => {
  try {
    const share = await getShareForGroup(req.userId, null);
    res.json(share || { token: null });
  } catch (e) { next(e); }
});

router.post('/share', requirePremium, async (req, res, next) => {
  try {
    const share = await createShareForGroup(req.userId, null);
    res.json(share);
  } catch (e) { next(e); }
});

router.delete('/share', requirePremium, async (req, res, next) => {
  try {
    await revokeShareForGroup(req.userId, null);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
```

주의: Express는 라우트를 등록 순서대로 매칭하지만 `/share`와 `/groups/:groupId/share`는 경로 리터럴이 겹치지 않으므로(`/groups/`로 시작하는지 여부) 순서와 무관하게 정상 매칭된다.

- [ ] **Step 2: 문법 확인**

Run: `cd server && node --check routes/rankTracker.js`
Expected: 에러 없이 종료.

- [ ] **Step 3: 커밋**

```bash
git add server/routes/rankTracker.js
git commit -m "feat: 전체 그룹 리포트 공유용 /api/rank-tracker/share 엔드포인트 추가"
```

---

### Task 5: 클라이언트 — 툴바/모달/페이지 배선 (전체 그룹에서도 공유 버튼 노출)

**Files:**
- Modify: `client/src/components/rankTracker/TrackerToolbar.jsx:35-47`
- Modify: `client/src/components/rankTracker/ShareReportModal.jsx`
- Modify: `client/src/pages/RankTrackerPage.jsx:863-870`

**Interfaces:**
- Consumes: Task 4의 `/api/rank-tracker/share` 및 기존 `/api/rank-tracker/groups/:groupId/share`.
- Produces: 없음(최종 사용자 플로우).

- [ ] **Step 1: `TrackerToolbar.jsx` — 공유 버튼을 그룹 선택 여부와 무관하게 노출**

`client/src/components/rankTracker/TrackerToolbar.jsx`의 35-47행을 아래로 교체:

```jsx
      {selectedGroupId && (
        <>
          <button onClick={onRenameGroup} title="그룹 이름 변경" className="mac-btn-ghost mac-btn-sm" style={{ display: 'flex', padding: 6 }}>
            <Pencil size={12} />
          </button>
          <button onClick={onDeleteGroup} title="그룹 삭제" className="mac-btn-ghost mac-btn-sm" style={{ display: 'flex', padding: 6, color: '#FF453A' }}>
            <Trash2 size={12} />
          </button>
        </>
      )}
      <button
        onClick={onOpenShareModal}
        title={selectedGroupId ? '이 그룹 리포트 공유' : '전체 그룹 리포트 공유'}
        className="mac-btn-ghost mac-btn-sm"
        style={{ display: 'flex', padding: 6 }}
      >
        <Share2 size={12} />
      </button>
```

- [ ] **Step 2: `ShareReportModal.jsx` — `groupId=null`(전체 그룹) 지원**

`client/src/components/rankTracker/ShareReportModal.jsx` 전체를 아래로 교체:

```jsx
import { useEffect, useState } from 'react';
import { X, Share2, Copy, Check } from 'lucide-react';

export default function ShareReportModal({ token, groupId, groupName, onClose }) {
  const [shareToken, setShareToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const isAllGroups = groupId == null;
  const API = isAllGroups ? '/api/rank-tracker/share' : `/api/rank-tracker/groups/${groupId}/share`;
  const shareUrl = shareToken ? `${window.location.origin}/?report=${shareToken}` : '';
  const displayName = isAllGroups ? '전체 그룹' : groupName;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API, { headers: { 'Authorization': `Bearer ${token}` } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || '불러오지 못했습니다.');
        setShareToken(body.token || null);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [API, token]);

  async function handleCreate() {
    setWorking(true); setError('');
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '링크 생성에 실패했습니다.');
      setShareToken(body.token);
    } catch (e) { setError(e.message); }
    finally { setWorking(false); }
  }

  async function handleRevoke() {
    if (!confirm('공유 링크를 해제할까요? 이미 공유된 링크는 더 이상 열리지 않습니다.')) return;
    setWorking(true); setError('');
    try {
      const res = await fetch(API, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('해제에 실패했습니다.');
      setShareToken(null);
    } catch (e) { setError(e.message); }
    finally { setWorking(false); }
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700 }}>
            <Share2 size={17} style={{ color: 'var(--accent)' }} />
            리포트 공유
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>불러오는 중…</div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7, marginTop: 0 }}>
              <b>{displayName}</b>{isAllGroups ? '의 모든 그룹' : ''} 순위 데이터를 로그인 없이 볼 수 있는 읽기전용 링크입니다.
              클라이언트에게 공유하면 편집 없이 순위만 확인할 수 있어요. 최근 14일 이내 등록된 링크만 표시됩니다.
            </p>

            {shareToken ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input readOnly value={shareUrl} className="mac-input" style={{ flex: 1, fontSize: 12 }} onClick={e => e.target.select()} />
                  <button onClick={handleCopy} className="mac-btn-ghost mac-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
                {error && <div style={{ marginBottom: 14, fontSize: 12, color: '#FF453A' }}>{error}</div>}
                <button onClick={handleRevoke} disabled={working} className="mac-btn-ghost mac-btn-sm" style={{ width: '100%', color: '#FF453A' }}>
                  {working ? '처리 중...' : '공유 링크 해제'}
                </button>
              </>
            ) : (
              <>
                {error && <div style={{ marginBottom: 14, fontSize: 12, color: '#FF453A' }}>{error}</div>}
                <button onClick={handleCreate} disabled={working} className="mac-btn mac-btn-sm" style={{ width: '100%' }}>
                  {working ? '생성 중...' : '공유 링크 만들기'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `RankTrackerPage.jsx` — 그룹 미선택 상태에서도 모달 렌더링**

`client/src/pages/RankTrackerPage.jsx`의 863-870행을 아래로 교체:

```jsx
      {showShareModal && (
        <ShareReportModal
          token={token}
          groupId={selectedGroupId || null}
          groupName={selectedGroupId ? (groups.find(g => String(g.id) === selectedGroupId)?.name || '그룹') : null}
          onClose={() => setShowShareModal(false)}
        />
      )}
```

- [ ] **Step 4: 빌드 확인**

Run: `cd client && npm run build`
Expected: 에러 없이 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add client/src/components/rankTracker/TrackerToolbar.jsx client/src/components/rankTracker/ShareReportModal.jsx client/src/pages/RankTrackerPage.jsx
git commit -m "feat: 전체 그룹 보기에서도 리포트 공유 버튼/모달 사용 가능하게 변경"
```

---

### Task 6: 클라이언트 — `TrackerStatCards`에 `compact` prop 추가

**Files:**
- Modify: `client/src/components/rankTracker/TrackerStatCards.jsx`

**Interfaces:**
- Consumes: 없음(props 확장만).
- Produces: `<TrackerStatCards mode filteredItems compact />` — `compact=true`면 카드 패딩/폰트가 축소된 버전. `compact` 미지정 시 기존과 100% 동일(회귀 없음). Task 7(`SharedReportPage.jsx`)이 `compact` 사용.

- [ ] **Step 1: `StatCard`와 `TrackerStatCards`에 `compact` prop 추가**

`client/src/components/rankTracker/TrackerStatCards.jsx` 전체를 아래로 교체:

```jsx
import { Target, Link2, Trophy, Radio } from 'lucide-react';

function StatCard({ label, value, total, color, icon: Icon, sub, compact }) {
  const pct = total ? Math.round((value / total) * 100) : null;
  return (
    <article className="mac-card" style={{
      padding: compact ? '14px 16px' : '20px 22px 20px', minHeight: compact ? 96 : 154,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: compact ? 8 : 14,
      background: `radial-gradient(ellipse at top left, ${color}14 0%, transparent 60%)`,
      borderTop: `1px solid ${color}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: compact ? 10.5 : 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          {label}
        </span>
        {!compact && (
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: color + '18', border: `1px solid ${color}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={17} style={{ color }} />
          </div>
        )}
      </div>
      <p style={{ margin: 0, fontSize: compact ? 24 : 38, fontWeight: 800, letterSpacing: '-1px', fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
        {total != null && <span style={{ fontSize: compact ? 12 : 17, color: 'var(--text-tertiary)', fontWeight: 600 }}>/{total}</span>}
        {pct !== null && <span style={{ fontSize: compact ? 12 : 16, color, fontWeight: 700, marginLeft: compact ? 6 : 9 }}>{pct}%</span>}
      </p>
      {!compact && (pct !== null ? (
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.7s cubic-bezier(0.34,1.2,0.64,1)' }} />
        </div>
      ) : sub != null && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>{sub}</p>
      ))}
    </article>
  );
}

export default function TrackerStatCards({ mode, filteredItems, compact = false }) {
  const keywordCount = filteredItems.length;

  if (mode === 'all') {
    const top5KeywordCount = filteredItems.filter(item =>
      Object.values(item.latestRanks || {}).some(r => r.rank != null && r.rank <= 5)
    ).length;
    return (
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: compact ? 8 : 10 }}>
        <StatCard label="추적 키워드" value={keywordCount} total={null} color="#8E8E93" icon={Target} sub="키워드 블로그탭 상위 10개 스냅샷" compact={compact} />
        <StatCard label="5위 내 노출" value={top5KeywordCount} total={keywordCount} color="#30D158" icon={Trophy} sub={null} compact={compact} />
      </section>
    );
  }

  const allLinks = filteredItems.flatMap(item => (item.blog_ids || []).map(blogId => ({
    entry: item.latestRanks?.[blogId] ?? null,
  })));
  const linkCount = allLinks.length;
  const top5LinkCount = allLinks.filter(l => l.entry?.status === 'ranked').length;
  const integratedCount = allLinks.filter(l => l.entry?.integratedExposed === true).length;
  const distinctGroups = new Set(filteredItems.map(i => i.group_id).filter(id => id != null));
  const avgLinks = keywordCount > 0 ? (linkCount / keywordCount).toFixed(1) : '0';

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: compact ? 8 : 10 }}>
      <StatCard label="추적 키워드" value={keywordCount} total={null} color="#8E8E93" icon={Target}
        sub={distinctGroups.size > 0 ? `그룹 ${distinctGroups.size}개에 분산` : '그룹 미지정'} compact={compact} />
      <StatCard label="추적 링크" value={linkCount} total={null} color="#0A84FF" icon={Link2}
        sub={`키워드당 평균 ${avgLinks}개`} compact={compact} />
      <StatCard label="5위 내 노출" value={top5LinkCount} total={linkCount} color="#30D158" icon={Trophy} sub={null} compact={compact} />
      <StatCard label="통검 노출 중" value={integratedCount} total={linkCount} color="#5E5CE6" icon={Radio} sub={null} compact={compact} />
    </section>
  );
}
```

- [ ] **Step 2: 빌드 확인 + 메인 페이지 회귀 없는지 수동 확인**

Run: `cd client && npm run build`
Expected: 에러 없이 빌드 성공. (`RankTrackerPage.jsx`는 `compact`를 안 넘기므로 기존 카드 그대로 렌더링돼야 함 — `git diff`로 `RankTrackerPage.jsx`가 이 작업에서 변경되지 않았는지 확인.)

- [ ] **Step 3: 커밋**

```bash
git add client/src/components/rankTracker/TrackerStatCards.jsx
git commit -m "feat: TrackerStatCards에 compact 모드 추가 (공유 리포트 페이지용)"
```

---

### Task 7: 클라이언트 — `SharedReportPage.jsx` 전면 재구성

**Files:**
- Modify: `client/src/pages/SharedReportPage.jsx`

**Interfaces:**
- Consumes: `GET /api/public-reports/:token` (Task 3에서 정의한 응답 shape: `{ groupName, groups, items, changes }`), `TrackerStatCards`(Task 6, `compact` prop), `formatRankStatus`(`client/src/components/rankTracker/trackerFormat.js`, 기존).
- Produces: 없음(최종 페이지).

- [ ] **Step 1: 전체 파일 교체**

`client/src/pages/SharedReportPage.jsx` 전체를 아래로 교체:

```jsx
import { useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import TrackerStatCards from '../components/rankTracker/TrackerStatCards';
import { formatRankStatus } from '../components/rankTracker/trackerFormat';
import logoLight from '../assets/logo-light.png';
import logoDark from '../assets/logo-dark.png';

// 사이트 전체에서 쓰는 뱃지 팔레트(client/src/styles.css의 .mac-badge-*)를 그대로
// 재사용한다 — 리포트 페이지만을 위한 새 색상 체계를 만들지 않는다.
function rankBadgeClass(status, rank) {
  if (status === 'fetch_failed') return 'mac-badge mac-badge-orange';
  if (status === 'ranked' && rank != null) return rank <= 3 ? 'mac-badge mac-badge-green' : 'mac-badge mac-badge-orange';
  return 'mac-badge mac-badge-gray';
}

function earliestAddedDate(item) {
  const dates = Object.values(item.latestRanks || {}).map(r => r.addedDate).filter(Boolean);
  return dates.length ? dates.sort().at(-1) : null; // 링크 여러 개면 "가장 최근에 추가된 링크" 기준으로 정렬
}

export default function SharedReportPage({ token }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(''); // '' = 전체

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public-reports/${encodeURIComponent(token)}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || '리포트를 불러오지 못했습니다.');
        if (!cancelled) setReport(body);
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const filteredItems = useMemo(() => {
    if (!report) return [];
    const scoped = !selectedGroupId
      ? report.items
      : report.items.filter(i => String(i.group_id ?? '') === selectedGroupId);
    return [...scoped].sort((a, b) => {
      const ad = earliestAddedDate(a) || '';
      const bd = earliestAddedDate(b) || '';
      return bd.localeCompare(ad); // 최신이 위로
    });
  }, [report, selectedGroupId]);

  const filteredChanges = useMemo(() => {
    if (!report) return [];
    if (!selectedGroupId) return report.changes;
    const keywordsInScope = new Set(filteredItems.map(i => i.keyword));
    return report.changes.filter(c => keywordsInScope.has(c.keyword));
  }, [report, selectedGroupId, filteredItems]);

  const mode = filteredItems[0]?.mode || 'blog';
  const showGroupSwitcher = !!report && report.groups.length > 0;
  const headerTitle = selectedGroupId
    ? report?.groups.find(g => String(g.id) === selectedGroupId)?.name
    : (report?.groupName || '전체 그룹');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={logoDark} alt="RANKLET" style={{ height: 22, width: 'auto' }} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>순위 추적 공유 리포트</span>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)', fontSize: 13 }}>불러오는 중…</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <div style={{ fontSize: 40, opacity: 0.25, marginBottom: 12 }}>🔒</div>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0 }}>{error}</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>{headerTitle}</h1>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                  추적 키워드 {filteredItems.length}개 · 최근 14일 이내 등록된 링크만 표시 · 읽기 전용 공유 리포트
                </p>
              </div>
              {showGroupSwitcher && (
                <select
                  value={selectedGroupId}
                  onChange={e => setSelectedGroupId(e.target.value)}
                  style={{
                    height: 34, padding: '0 10px', borderRadius: 8,
                    background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
                    color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="">전체 그룹</option>
                  {report.groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                </select>
              )}
            </div>

            <div style={{ margin: '20px 0' }}>
              <TrackerStatCards mode={mode} filteredItems={filteredItems} compact />
            </div>

            {filteredChanges.length > 0 && (
              <div className="mac-card" style={{ padding: '16px 20px', margin: '0 0 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  <TrendingUp size={15} style={{ color: '#30D158' }} />
                  주요 변동사항
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredChanges.map((c, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {c.type === 'new_top5' ? '📈 5위 이내 신규 진입: ' : '📈 '}
                      <b style={{ color: 'var(--text-primary)' }}>{c.keyword}</b>
                      {c.type === 'improved' && <> {c.fromRank}위 → <b style={{ color: '#30D158' }}>{c.toRank}위</b></>}
                      {c.type === 'new_top5' && <> (<b style={{ color: '#30D158' }}>{c.toRank}위</b>)</>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {filteredItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)', fontSize: 13 }}>
                최근 14일 이내 등록된 추적 항목이 없습니다.
              </div>
            ) : (
              <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table className="mac-table" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '10%' }}>등록일</th>
                      <th style={{ width: '22%' }}>키워드</th>
                      <th style={{ width: '28%' }}>블로그</th>
                      <th style={{ width: '12%' }}>검색량</th>
                      <th style={{ width: '12%' }}>순위</th>
                      <th style={{ width: '16%' }}>통검</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.flatMap((item, idx) => {
                      const blogIds = item.mode === 'blog' ? (item.blog_ids || []) : [];
                      const rows = blogIds.length ? blogIds : [null];
                      return rows.map((blogId, i) => {
                        const entry = blogId ? item.latestRanks?.[blogId] : null;
                        const { label } = formatRankStatus(entry?.rank ?? null, entry?.status ?? null);
                        return (
                          <tr key={`${idx}-${blogId ?? 'x'}-${i}`} style={{ borderTop: i === 0 ? '2px solid var(--border-strong)' : undefined }}>
                            <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{i === 0 ? (entry?.addedDate || '—') : ''}</td>
                            <td style={{ fontWeight: i === 0 ? 700 : 400, color: i === 0 ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                              {i === 0 ? item.keyword : '↳'}
                            </td>
                            <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{blogId || '—'}</td>
                            <td>{i === 0 ? (item.searchVolume ?? '—') : ''}</td>
                            <td>{blogId ? <span className={rankBadgeClass(entry?.status ?? null, entry?.rank ?? null)}>{label}</span> : '—'}</td>
                            <td style={{ color: entry?.integratedExposed ? '#0A84FF' : 'var(--text-tertiary)', fontWeight: 700 }}>
                              {entry?.integratedExposed == null ? '—' : (entry.integratedExposed ? 'O' : 'X')}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd client && npm run build`
Expected: 에러 없이 빌드 성공.

- [ ] **Step 3: 커밋**

```bash
git add client/src/pages/SharedReportPage.jsx
git commit -m "feat: 공유 리포트 페이지에 KPI 카드/그룹 전환/정렬/변동사항 요약 추가"
```

---

### Task 8: 통합 확인 및 푸시

**Files:** 없음(검증만).

- [ ] **Step 1: 서버 전체 테스트**

Run: `cd server && npm test`
Expected: 모든 테스트(기존 + Task 2에서 추가한 것) PASS.

- [ ] **Step 2: 클라이언트 빌드**

Run: `cd client && npm run build`
Expected: 에러 없이 빌드 성공.

- [ ] **Step 3: 원격 동기화 후 푸시**

```bash
git fetch origin
git log HEAD..origin/master --oneline   # 새 커밋이 있으면 먼저 병합
git pull origin master --no-edit        # 필요시
git push origin master
```

- [ ] **Step 4: 수동 확인 체크리스트 (실제 배포 후, 다른 컴퓨터에서 이어받을 사람에게 안내)**

  - [ ] 전체 그룹 보기에서 "리포트 공유" 버튼이 보이는지
  - [ ] 전체 그룹 링크 생성 → 새 탭에서 열었을 때 KPI 카드 + 그룹 전환 드롭다운이 뜨는지
  - [ ] 그룹 전용 링크(기존 방식)는 그룹 전환 드롭다운 없이 그 그룹만 보이는지 (다른 그룹 노출 안 됨 재확인 — 보안 회귀 체크)
  - [ ] 14일보다 오래된 링크만 있는 그룹으로 전체 링크를 만들면 "최근 14일 이내 등록된 추적 항목이 없습니다" 문구가 뜨는지
  - [ ] 순위가 크게 개선된 더미 데이터가 있으면 "주요 변동사항" 섹션에 뜨는지, 변동이 없으면 섹션 자체가 안 보이는지
