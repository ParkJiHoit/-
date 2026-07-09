# 순위 추적 페이지 리디자인 Implementation Plan

> ✅ **구현 완료 (2026-07-09, PR #27 머지).** Task 1~7의 모든 구현 스텝을 실행·커밋했다. 서버 테스트 30/30 통과, 클라이언트 빌드 성공, 목업 데이터로 브라우저 시각 검증(통계 카드·툴바·테이블 그룹핑·오버레이 드로워)을 마쳤다. Task 8의 남은 미체크 항목은 실제 로그인 상태에서 사람이 직접 눌러 확인해야 하는 항목(실 백엔드 전체 갱신 잡, 엑셀 다운로드 등)이다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `client/src/pages/RankTrackerPage.jsx`의 레이아웃을 카드 리스트 + 고정 상세 패널 구조에서, 통계 카드 + 툴바 + 정렬 가능한 테이블 + 오버레이 드로워 구조로 전면 교체한다.

**Architecture:** 페이지를 4개의 프레젠테이션 컴포넌트(`TrackerStatCards`, `TrackerToolbar`, `TrackerTable`, `TrackerDetailDrawer`)로 분리하고, `RankTrackerPage.jsx`는 기존 데이터 페칭·상태·이벤트 핸들러만 담당하며 이 컴포넌트들을 조합해 렌더링한다. 백엔드는 목록 조회(`listTracked`)에 검색량·통합검색 노출 필드를 추가한다.

**Tech Stack:** React 18, 기존 `styles.css`의 "macOS Sequoia" 디자인 시스템(`.mac-card`, `.mac-table`, `.mac-badge`, `.mac-btn*`, `.mac-checkbox`) 재사용. 새 라이브러리 추가 없음.

## Global Constraints

- 새로운 시각 스타일을 발명하지 않는다 — 이 앱에 이미 있는 `.mac-card`/`.mac-table`/`.mac-badge`/`.mac-btn*`/`.mac-checkbox` 클래스와 `SummaryCards.jsx`의 통계 카드 시각 패턴(아이콘 배지 우상단 + 큰 숫자 + 진행바/보조텍스트, 카드 상단 색상 테두리 + radial-gradient 틴트)을 그대로 재사용한다.
- 이 클라이언트 패키지엔 프론트 자동 테스트 러너가 없다 — 각 태스크의 검증은 `npm run build` 통과 + (해당되는 경우) 수동 확인으로 한다.
- API 계약은 목록 조회(`GET /api/rank-tracker`) 응답에 `searchVolume` 필드와 각 `latestRanks[blogId]`에 `integratedExposed` 필드를 추가하는 것 외에는 변경하지 않는다. 다른 엔드포인트/요청 형식은 그대로.
- 그룹 관리, 대량 등록 모달(`BulkImportModal`), 등록/수정 모달(`AddTrackerModal`), 전체 갱신(잡 기반), 실패 재시도, 엑셀 내보내기 로직은 전부 기존 그대로 재사용한다 — 진입점(버튼) 위치만 재배치.
- 참조 스펙: `docs/superpowers/specs/2026-07-08-rank-tracker-redesign-design.md`

---

### ✅ Task 1: 백엔드 — 목록 조회에 검색량·통합검색 노출 추가

**Files:**
- Modify: `server/services/rankTrackerService.js:103-123` (`listTracked` 함수)

**Interfaces:**
- Consumes: 없음 (기존 `getPool()` 재사용)
- Produces: `listTracked(userId)`가 반환하는 각 항목에 `searchVolume`(숫자 또는 null) 필드 추가, `latestRanks[blogId]`에 `integratedExposed`(boolean 또는 null) 필드 추가. 나머지 필드(`id`, `keyword`, `mode`, `blog_ids`, `group_id`, `created_at`, `last_refreshed_at`)는 기존과 동일.

- [x] **Step 1: 기존 `listTracked` 함수를 찾아 교체**

`server/services/rankTrackerService.js`에서 아래 함수를 찾는다:

```js
export async function listTracked(userId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, keyword, mode, blog_ids, group_id, created_at, last_refreshed_at FROM tracked_keywords
     WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userId]
  );
  const result = await Promise.all(rows.map(async (row) => {
    const { rows: snaps } = await pool.query(
      `SELECT blog_id, rank, status, TO_CHAR(snapshotted_at, 'YYYY-MM-DD') AS snapshotted_at
       FROM rank_snapshots WHERE tracked_id = $1 ORDER BY snapshotted_at DESC LIMIT 20`,
      [row.id]
    );
    const latestByBlog = {};
    for (const s of snaps) {
      if (!latestByBlog[s.blog_id]) latestByBlog[s.blog_id] = { rank: s.rank, status: s.status };
    }
    return { ...row, latestRanks: latestByBlog };
  }));
  return result;
}
```

이 함수 전체를 아래로 교체한다:

```js
export async function listTracked(userId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, keyword, mode, blog_ids, group_id, created_at, last_refreshed_at, pc_search, mobile_search
     FROM tracked_keywords WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userId]
  );
  const result = await Promise.all(rows.map(async (row) => {
    const { rows: snaps } = await pool.query(
      `SELECT blog_id, rank, status, integrated_exposed, TO_CHAR(snapshotted_at, 'YYYY-MM-DD') AS snapshotted_at
       FROM rank_snapshots WHERE tracked_id = $1 ORDER BY snapshotted_at DESC LIMIT 20`,
      [row.id]
    );
    const latestByBlog = {};
    for (const s of snaps) {
      if (!latestByBlog[s.blog_id]) {
        latestByBlog[s.blog_id] = {
          rank: s.rank,
          status: s.status,
          integratedExposed: row.mode === 'blog' ? s.integrated_exposed : null,
        };
      }
    }
    const searchVolume = (row.pc_search != null || row.mobile_search != null)
      ? (row.pc_search || 0) + (row.mobile_search || 0)
      : null;
    return { ...row, latestRanks: latestByBlog, searchVolume };
  }));
  return result;
}
```

이 코드는 `server/services/rankTrackerService.js`의 `exportSnapshots` 함수(이미 같은 파일에 있음)가 검색량과 `integrated_exposed`를 계산하는 방식과 동일한 패턴을 따른다.

- [x] **Step 2: 문법 오류 없는지 확인**

Run: `cd server && node --check services/rankTrackerService.js`
Expected: 아무 출력 없이 종료 (문법 오류 없음)

- [x] **Step 3: 기존 테스트 회귀 확인**

Run: `cd server && npm test`
Expected: `tests 30`, `pass 30`, `fail 0` (이 함수는 DB 연결이 필요해 단위 테스트 대상이 아니므로, 다른 순수 함수 테스트들이 그대로 통과하는지만 확인)

- [x] **Step 4: 커밋**

```bash
git add server/services/rankTrackerService.js
git commit -m "feat: include search volume and integrated exposure in tracked keyword list"
```

---

### ✅ Task 2: 프론트 — 공용 포맷 유틸 분리

**Files:**
- Create: `client/src/components/rankTracker/trackerFormat.js`
- Modify: `client/src/pages/RankTrackerPage.jsx` (최상단 `formatKSTDateTime`/`formatRankStatus` 함수 정의를 제거하고 import로 교체)

**Interfaces:**
- Produces: `formatKSTDateTime(isoString) => string` ("YYYY-MM-DD HH:MM" 형식, KST 보정), `formatRankStatus(rank, status) => {label, color}`. Task 4(TrackerToolbar), Task 5(TrackerTable), Task 6(TrackerDetailDrawer)가 이 두 함수를 그대로 가져다 쓴다.

- [x] **Step 1: 공용 유틸 파일 생성**

`client/src/components/rankTracker/trackerFormat.js`:

```js
export function formatKSTDateTime(isoString) {
  const d = new Date(new Date(isoString).getTime() + 9 * 60 * 60 * 1000);
  const date = d.toISOString().slice(0, 10);
  const hm = d.toISOString().slice(11, 16);
  return `${date} ${hm}`;
}

// status는 이미 상위 5위 판정을 반영한다(백엔드 refreshRanks) — 'ranked'일 때만 숫자를 보여준다.
export function formatRankStatus(rank, status) {
  if (status === 'fetch_failed') return { label: '⚠ 조회 실패', color: '#FF9F0A' };
  if (status === 'ranked' && rank != null) {
    return { label: `${rank}위`, color: rank <= 3 ? '#30D158' : '#FF9F0A' };
  }
  return { label: '미노출', color: 'var(--text-tertiary)' };
}
```

- [x] **Step 2: `RankTrackerPage.jsx`에서 중복 정의 제거하고 import로 교체**

파일 최상단 `import { useState, useEffect, useCallback } from 'react';` 바로 다음 줄에 추가:

```js
import { formatKSTDateTime, formatRankStatus } from '../components/rankTracker/trackerFormat';
```

그리고 아래 두 함수 정의를 파일에서 **완전히 삭제**한다(호출부는 그대로 둔다 — import된 이름과 동일하므로 자동으로 연결됨):

```js
function formatKSTDateTime(isoString) {
  const d = new Date(new Date(isoString).getTime() + 9 * 60 * 60 * 1000);
  const date = d.toISOString().slice(0, 10);
  const hm = d.toISOString().slice(11, 16);
  return `${date} ${hm}`;
}
```

```js
// status는 이미 상위 5위 판정을 반영한다(백엔드 refreshRanks) — 'ranked'일 때만 숫자를 보여준다.
function formatRankStatus(rank, status) {
  if (status === 'fetch_failed') return { label: '⚠ 조회 실패', color: '#FF9F0A' };
  if (status === 'ranked' && rank != null) {
    return { label: `${rank}위`, color: rank <= 3 ? '#30D158' : '#FF9F0A' };
  }
  return { label: '미노출', color: 'var(--text-tertiary)' };
}
```

- [x] **Step 3: 빌드 확인 (동작 변화 없어야 함)**

Run: `cd client && npm run build`
Expected: 성공. 이 태스크는 순수 리팩터라 런타임 동작이 하나도 바뀌지 않아야 한다.

- [x] **Step 4: 커밋**

```bash
git add client/src/components/rankTracker/trackerFormat.js client/src/pages/RankTrackerPage.jsx
git commit -m "refactor: extract formatKSTDateTime/formatRankStatus into shared tracker util"
```

---

### ✅ Task 3: 프론트 — `TrackerStatCards` 컴포넌트

**Files:**
- Create: `client/src/components/rankTracker/TrackerStatCards.jsx`

**Interfaces:**
- Consumes: 없음 (독립적인 프레젠테이션 컴포넌트)
- Produces: `export default function TrackerStatCards({ mode, filteredItems })`. Task 7이 `<TrackerStatCards mode={mode} filteredItems={filteredItems} />`로 사용.
  - `filteredItems`의 각 항목은 `{ id, keyword, mode, blog_ids, group_id, searchVolume, latestRanks: { [blogId]: { rank, status, integratedExposed } } }` 형태 (Task 1 완료 후의 목록 API 응답 형태).

- [x] **Step 1: 컴포넌트 작성**

`client/src/components/rankTracker/TrackerStatCards.jsx`:

```jsx
function StatCard({ label, value, total, color, icon, sub }) {
  const pct = total ? Math.round((value / total) * 100) : null;
  return (
    <article className="mac-card" style={{
      padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10,
      background: `radial-gradient(ellipse at top left, ${color}12 0%, transparent 60%)`,
      borderTop: `1px solid ${color}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          {label}
        </span>
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: color + '18', border: `1px solid ${color}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
        }}>
          {icon}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-1px', fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
        {total != null && <span style={{ fontSize: 15, color: 'var(--text-tertiary)', fontWeight: 600 }}>/{total}</span>}
      </p>
      {pct !== null ? (
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.7s cubic-bezier(0.34,1.2,0.64,1)' }} />
        </div>
      ) : sub != null && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{sub}</p>
      )}
    </article>
  );
}

export default function TrackerStatCards({ mode, filteredItems }) {
  const keywordCount = filteredItems.length;

  if (mode === 'all') {
    const top5KeywordCount = filteredItems.filter(item =>
      Object.values(item.latestRanks || {}).some(r => r.rank != null && r.rank <= 5)
    ).length;
    return (
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <StatCard label="추적 키워드" value={keywordCount} total={null} color="#8E8E93" icon="🎯" sub="키워드 블로그탭 상위 10개 스냅샷" />
        <StatCard label="5위 내 노출" value={top5KeywordCount} total={keywordCount} color="#30D158" icon="🏆" sub={null} />
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
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
      <StatCard label="추적 키워드" value={keywordCount} total={null} color="#8E8E93" icon="🎯"
        sub={distinctGroups.size > 0 ? `그룹 ${distinctGroups.size}개에 분산` : '그룹 미지정'} />
      <StatCard label="추적 링크" value={linkCount} total={null} color="#0A84FF" icon="🔗"
        sub={`키워드당 평균 ${avgLinks}개`} />
      <StatCard label="5위 내 노출" value={top5LinkCount} total={linkCount} color="#30D158" icon="🏆" sub={null} />
      <StatCard label="통검 노출 중" value={integratedCount} total={linkCount} color="#5E5CE6" icon="📡" sub={null} />
    </section>
  );
}
```

- [x] **Step 2: 빌드 확인**

Run: `cd client && npm run build`
Expected: 성공. (아직 어디서도 `import`하지 않으므로 이 단계에서는 화면에 나타나지 않음 — Task 7에서 연결)

- [x] **Step 3: 커밋**

```bash
git add client/src/components/rankTracker/TrackerStatCards.jsx
git commit -m "feat: add TrackerStatCards component"
```

---

### ✅ Task 4: 프론트 — `TrackerToolbar` 컴포넌트

**Files:**
- Create: `client/src/components/rankTracker/TrackerToolbar.jsx`

**Interfaces:**
- Consumes: Task 2의 `formatKSTDateTime`
- Produces: `export default function TrackerToolbar({ mode, groups, selectedGroupId, onGroupChange, onCreateGroup, onRenameGroup, onDeleteGroup, searchQuery, onSearchChange, filteredItems, refreshingAll, refreshAllProgress, onRefreshAll, failedJobId, onRetryFailed, onExport, onOpenBulkModal, onOpenAddModal })`. Task 7이 이 시그니처로 사용.
  - `onGroupChange(value: string)` — `value`는 `''`(전체 그룹) 또는 그룹 id 문자열. `'__new__'` 값이 들어오면 컴포넌트 내부에서 `onGroupChange` 대신 `onCreateGroup()`을 호출한다(호출부가 신경 쓸 필요 없음).
  - `onSearchChange(value: string)`
  - `filteredItems`는 Task 3과 동일한 형태 — "최근 갱신" 텍스트와 버튼 노출 여부(`length > 0`) 계산에 사용.

- [x] **Step 1: 컴포넌트 작성**

`client/src/components/rankTracker/TrackerToolbar.jsx`:

```jsx
import { RefreshCw, Plus, Trash2, Download, Pencil } from 'lucide-react';
import { formatKSTDateTime } from './trackerFormat';

export default function TrackerToolbar({
  mode, groups, selectedGroupId, onGroupChange, onCreateGroup, onRenameGroup, onDeleteGroup,
  searchQuery, onSearchChange,
  filteredItems,
  refreshingAll, refreshAllProgress, onRefreshAll,
  failedJobId, onRetryFailed,
  onExport, onOpenBulkModal, onOpenAddModal,
}) {
  const lastRefreshed = filteredItems.reduce((acc, i) => (
    i.last_refreshed_at && (!acc || i.last_refreshed_at > acc) ? i.last_refreshed_at : acc
  ), null);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <select
        value={selectedGroupId}
        onChange={e => {
          if (e.target.value === '__new__') { onCreateGroup(); return; }
          onGroupChange(e.target.value);
        }}
        style={{
          height: 32, padding: '0 8px', borderRadius: 8,
          background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
          color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
          outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
        }}
      >
        <option value="">전체 그룹</option>
        {groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
        <option value="__new__">+ 새 그룹 만들기</option>
      </select>
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
      <input
        value={searchQuery}
        onChange={e => onSearchChange(e.target.value)}
        placeholder="키워드 검색"
        style={{
          height: 32, padding: '0 10px', borderRadius: 8, width: 160,
          background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
          color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none',
        }}
      />
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
        {lastRefreshed ? `최근 갱신: ${formatKSTDateTime(lastRefreshed)}` : '아직 갱신 내역 없음'}
      </span>
      <div style={{ flex: 1 }} />
      {filteredItems.length > 0 && (
        <button onClick={onRefreshAll} disabled={refreshingAll} className="mac-btn-ghost mac-btn-sm" title="전체 순위 갱신"
          style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: refreshingAll ? 0.6 : 1 }}>
          <RefreshCw size={12} style={{ animation: refreshingAll ? 'spin 1s linear infinite' : 'none' }} />
          {refreshingAll ? `${refreshAllProgress.done}/${refreshAllProgress.total}` : '전체 갱신'}
        </button>
      )}
      {failedJobId && !refreshingAll && (
        <button onClick={onRetryFailed} className="mac-btn-ghost mac-btn-sm" style={{ color: '#FF453A', borderColor: 'rgba(255,69,58,0.3)' }}>
          실패 항목 재시도
        </button>
      )}
      {filteredItems.length > 0 && (
        <button onClick={onExport} className="mac-btn-ghost mac-btn-sm" title="현재 목록의 순위 기록을 엑셀로 내보내기"
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Download size={12} /> 내보내기
        </button>
      )}
      <button onClick={onOpenBulkModal} className="mac-btn-ghost mac-btn-sm">대량 등록</button>
      <button onClick={onOpenAddModal} className="mac-btn mac-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Plus size={12} /> 등록
      </button>
    </div>
  );
}
```

- [x] **Step 2: 빌드 확인**

Run: `cd client && npm run build`
Expected: 성공.

- [x] **Step 3: 커밋**

```bash
git add client/src/components/rankTracker/TrackerToolbar.jsx
git commit -m "feat: add TrackerToolbar component"
```

---

### ✅ Task 5: 프론트 — `TrackerTable` 컴포넌트

**Files:**
- Create: `client/src/components/rankTracker/TrackerTable.jsx`

**Interfaces:**
- Consumes: Task 2의 `formatRankStatus`
- Produces: `export default function TrackerTable({ mode, rows, groups, sortKey, sortDir, onSortChange, selectedIds, onToggleSelect, onToggleSelectAll, onRowClick, onMoveItemGroup, onAddBlog, onRemoveBlog, onDeleteKeyword, onBulkDeleteSelected, loading })`. Task 7이 이 시그니처로 사용.
  - `rows`는 Task 3과 동일한 형태의 배열(= `filteredItems`).
  - `sortKey`는 `null | 'keyword' | 'searchVolume' | 'rank'`, `sortDir`는 `'asc' | 'desc'`.
  - `onSortChange(key, dir)` — 헤더 클릭 시 호출.
  - `selectedIds`는 `Set<number>` (tracked_keyword id 집합).
  - `onToggleSelect(id)`, `onToggleSelectAll()`, `onRowClick(item)`, `onMoveItemGroup(itemId, groupId)`, `onAddBlog(item)`, `onRemoveBlog(itemId, blogId)`, `onDeleteKeyword(itemId)`, `onBulkDeleteSelected(ids: number[])` — 전부 기존 `RankTrackerPage.jsx`에 이미 있는 핸들러와 같은 시그니처.

- [x] **Step 1: 컴포넌트 작성**

`client/src/components/rankTracker/TrackerTable.jsx`:

```jsx
import { Plus, Trash2, X } from 'lucide-react';
import { formatRankStatus } from './trackerFormat';

const SORT_DEFAULT_DIR = { keyword: 'asc', searchVolume: 'desc', rank: 'asc' };

function bestRank(item) {
  const ranks = Object.values(item.latestRanks || {}).filter(r => r.rank != null).map(r => r.rank);
  return ranks.length ? Math.min(...ranks) : null;
}

function getSortValue(item, key) {
  if (key === 'keyword') return item.keyword;
  if (key === 'searchVolume') return item.searchVolume ?? -1;
  if (key === 'rank') return bestRank(item) ?? 999;
  return 0;
}

export default function TrackerTable({
  mode, rows, groups, sortKey, sortDir, onSortChange,
  selectedIds, onToggleSelect, onToggleSelectAll,
  onRowClick, onMoveItemGroup, onAddBlog, onRemoveBlog, onDeleteKeyword, onBulkDeleteSelected,
  loading,
}) {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>불러오는 중…</div>;
  }
  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1.7 }}>
        조건에 맞는 항목이 없습니다.<br />검색어나 그룹 필터를 확인해 보세요.
      </div>
    );
  }

  const sortedItems = sortKey
    ? [...rows].sort((a, b) => {
        const av = getSortValue(a, sortKey);
        const bv = getSortValue(b, sortKey);
        const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : rows;

  const flatRows = [];
  for (const item of sortedItems) {
    const blogIds = mode === 'blog' ? (item.blog_ids || []) : [];
    if (!blogIds.length) {
      flatRows.push({ item, blogId: null, isFirst: true });
    } else {
      blogIds.forEach((blogId, i) => flatRows.push({ item, blogId, isFirst: i === 0 }));
    }
  }

  const allSelected = rows.length > 0 && rows.every(r => selectedIds.has(r.id));

  const headerClick = (key) => {
    if (sortKey === key) onSortChange(key, sortDir === 'asc' ? 'desc' : 'asc');
    else onSortChange(key, SORT_DEFAULT_DIR[key]);
  };

  const sortArrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div>
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 8,
          borderRadius: 8, background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedIds.size}개 선택됨</span>
          <button
            onClick={() => onBulkDeleteSelected([...selectedIds])}
            className="mac-btn-ghost mac-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#FF453A', borderColor: 'rgba(255,69,58,0.3)' }}
          >
            <Trash2 size={12} /> 선택 삭제
          </button>
        </div>
      )}

      <table className="mac-table" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input type="checkbox" className="mac-checkbox" checked={allSelected} onChange={onToggleSelectAll} />
            </th>
            <th className={sortKey === 'keyword' ? 'th-active' : ''} onClick={() => headerClick('keyword')} style={{ cursor: 'pointer', width: '22%' }}>
              키워드{sortArrow('keyword')}
            </th>
            {mode === 'blog' && <th style={{ width: '26%' }}>블로그</th>}
            <th className={sortKey === 'searchVolume' ? 'th-active' : ''} onClick={() => headerClick('searchVolume')} style={{ cursor: 'pointer', width: '12%' }}>
              검색량{sortArrow('searchVolume')}
            </th>
            <th className={sortKey === 'rank' ? 'th-active' : ''} onClick={() => headerClick('rank')} style={{ cursor: 'pointer', width: '12%' }}>
              순위{sortArrow('rank')}
            </th>
            {mode === 'blog' && <th style={{ width: '10%' }}>통검</th>}
            <th style={{ width: 72 }}></th>
          </tr>
        </thead>
        <tbody>
          {flatRows.map(({ item, blogId, isFirst }, i) => {
            const entry = blogId ? item.latestRanks?.[blogId] ?? null : null;
            const { label, color } = formatRankStatus(entry?.rank ?? null, entry?.status ?? null);
            const best = bestRank(item);
            const allLabel = best != null ? `최고 ${best}위` : '기록 없음';
            const allColor = best != null && best <= 5 ? '#30D158' : 'var(--text-tertiary)';
            return (
              <tr
                key={`${item.id}-${blogId ?? 'x'}-${i}`}
                onClick={() => onRowClick(item)}
                style={{
                  cursor: 'pointer',
                  borderTop: isFirst ? '2px solid var(--border-strong)' : undefined,
                  background: isFirst ? undefined : 'rgba(255,255,255,0.015)',
                }}
              >
                <td onClick={e => e.stopPropagation()}>
                  {isFirst && (
                    <input
                      type="checkbox" className="mac-checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => onToggleSelect(item.id)}
                    />
                  )}
                </td>
                <td>
                  {isFirst ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.keyword}
                      </span>
                      <select
                        value={String(item.group_id ?? '')}
                        onClick={e => e.stopPropagation()}
                        onChange={e => onMoveItemGroup(item.id, e.target.value || null)}
                        title="그룹 이동"
                        style={{
                          flexShrink: 0, fontSize: 10, fontWeight: 600, padding: '2px 4px',
                          borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                          color: 'var(--text-tertiary)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <option value="">그룹 없음</option>
                        {groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)', paddingLeft: 14 }}>↳</span>
                  )}
                </td>
                {mode === 'blog' && (
                  <td style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {blogId || '—'}
                  </td>
                )}
                <td>{isFirst ? (item.searchVolume ?? '—') : ''}</td>
                {mode === 'blog' ? (
                  <td style={{ color, fontWeight: 700 }}>{blogId ? label : '—'}</td>
                ) : (
                  <td style={{ color: allColor, fontWeight: 700 }}>{allLabel}</td>
                )}
                {mode === 'blog' && (
                  <td style={{ color: entry?.integratedExposed ? '#0A84FF' : 'var(--text-tertiary)', fontWeight: 700 }}>
                    {entry?.integratedExposed == null ? '—' : (entry.integratedExposed ? 'O' : 'X')}
                  </td>
                )}
                <td onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    {mode === 'blog' && blogId && (
                      <button onClick={() => onRemoveBlog(item.id, blogId)} title="이 블로그만 추적에서 빼기"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, display: 'flex' }}>
                        <X size={13} />
                      </button>
                    )}
                    {isFirst && mode === 'blog' && (
                      <button onClick={() => onAddBlog(item)} title="블로그 URL 추가"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4, display: 'flex' }}>
                        <Plus size={13} />
                      </button>
                    )}
                    {isFirst && (
                      <button onClick={() => onDeleteKeyword(item.id)} title="삭제"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, display: 'flex' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [x] **Step 2: 빌드 확인**

Run: `cd client && npm run build`
Expected: 성공.

- [x] **Step 3: 커밋**

```bash
git add client/src/components/rankTracker/TrackerTable.jsx
git commit -m "feat: add TrackerTable component"
```

---

### ✅ Task 6: 프론트 — `TrackerDetailDrawer` 컴포넌트

**Files:**
- Create: `client/src/components/rankTracker/TrackerDetailDrawer.jsx`

**Interfaces:**
- Consumes: Task 2의 `formatRankStatus`/`formatKSTDateTime`, 기존 `client/src/components/RankChart.jsx`와 `client/src/components/RankCalendar.jsx`(변경 없이 그대로 재사용 — 각각 `snapshots`/`blogIds` prop을 받는 기존 인터페이스 그대로).
- Produces: `export default function TrackerDetailDrawer({ open, onClose, mode, selected, snapshots, refreshing, onRefresh })`. Task 7이 이 시그니처로 사용.
  - `open`이 falsy거나 `selected`가 null이면 아무것도 렌더링하지 않는다(`null` 반환).
  - ESC 키로도 `onClose`가 호출되어야 한다.

- [x] **Step 1: 컴포넌트 작성**

`client/src/components/rankTracker/TrackerDetailDrawer.jsx`:

```jsx
import { useEffect } from 'react';
import { X, RefreshCw, ExternalLink } from 'lucide-react';
import RankChart from '../RankChart';
import RankCalendar from '../RankCalendar';
import { formatRankStatus, formatKSTDateTime } from './trackerFormat';

export default function TrackerDetailDrawer({ open, onClose, mode, selected, snapshots, refreshing, onRefresh }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open || !selected) return null;

  const blogIds = selected.blog_ids || [];
  const latestRanks = selected.latestRanks || {};
  const latestDate = snapshots.length ? snapshots[0].snapshotted_at : null;
  const latestSnapshot = mode === 'all'
    ? snapshots.filter(s => s.snapshotted_at === latestDate).sort((a, b) => (a.rank || 99) - (b.rank || 99))
    : [];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 2001,
        width: 'min(560px, 45vw)', minWidth: 380,
        background: 'var(--bg-elevated)', borderLeft: '1px solid var(--border-strong)',
        boxShadow: '-16px 0 48px rgba(0,0,0,0.4)',
        overflowY: 'auto', padding: 22,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div className="mac-card" style={{ padding: '0 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>
                {selected.keyword}
                {mode === 'blog' && blogIds.length > 0 && (
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 10 }}>블로그 {blogIds.length}개 추적</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {selected.last_refreshed_at
                  ? `마지막 갱신: ${formatKSTDateTime(selected.last_refreshed_at)}`
                  : latestDate ? `마지막 갱신: ${latestDate}` : '아직 갱신 내역 없음'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={onRefresh}
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
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {mode === 'blog' && blogIds.length > 0 && (() => {
            const firstBlog = blogIds[0];
            const firstEntry = latestRanks[firstBlog] ?? null;
            const curRank = firstEntry?.rank ?? null;
            const curStatus = firstEntry?.status ?? null;
            const allRanks = snapshots.filter(s => s.blog_id === firstBlog && s.rank != null).map(s => s.rank);
            const bestRankVal = allRanks.length ? Math.min(...allRanks) : null;
            const trackDays = selected.created_at
              ? Math.max(1, Math.round((Date.now() - new Date(selected.created_at)) / 86400000))
              : 0;
            const curFormatted = formatRankStatus(curRank, curStatus);
            return (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 0' }}>
                {[
                  { label: '현재 순위', value: curFormatted.label, color: curFormatted.color },
                  { label: '최고 순위', value: bestRankVal != null ? `${bestRankVal}위` : '—', color: '#30D158' },
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
        </div>

        <div className="mac-card" style={{ padding: '18px 22px', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
            일별 노출 순위 — 캘린더
          </div>
          <RankCalendar
            snapshots={snapshots}
            blogIds={mode === 'blog' ? blogIds : [...new Set(snapshots.map(s => s.blog_id))]}
          />
        </div>

        {mode === 'blog' && (
          <div className="mac-card" style={{ padding: '18px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
              순위 추이
            </div>
            <RankChart snapshots={snapshots} blogIds={blogIds} />
          </div>
        )}

        {mode === 'all' && latestSnapshot.length > 0 && (
          <div className="mac-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)' }}>
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
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
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
    </>
  );
}
```

- [x] **Step 2: 빌드 확인**

Run: `cd client && npm run build`
Expected: 성공.

- [x] **Step 3: 커밋**

```bash
git add client/src/components/rankTracker/TrackerDetailDrawer.jsx
git commit -m "feat: add TrackerDetailDrawer component"
```

---

### ✅ Task 7: 프론트 — `RankTrackerPage.jsx` 통합

**Files:**
- Modify: `client/src/pages/RankTrackerPage.jsx`

**Interfaces:**
- Consumes: Task 3의 `TrackerStatCards`, Task 4의 `TrackerToolbar`, Task 5의 `TrackerTable`, Task 6의 `TrackerDetailDrawer` — 각 컴포넌트의 시그니처는 위 태스크들에 정의된 그대로.
- Produces: 없음 (최종 조립 지점)

- [x] **Step 1: import 블록 교체**

파일 최상단의 import 블록(현재 아래 형태 — Task 2에서 `trackerFormat` import가 이미 추가된 상태):

```js
import { useState, useEffect, useCallback } from 'react';
import { formatKSTDateTime, formatRankStatus } from '../components/rankTracker/trackerFormat';
import { useAuth } from '../AuthContext';
import RankCalendar from '../components/RankCalendar';
import RankChart from '../components/RankChart';
import BulkImportModal from '../components/BulkImportModal';
import { RefreshCw, Plus, Trash2, X, ExternalLink, Pencil, Download } from 'lucide-react';
```

이 전체를 아래로 교체한다:

```js
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import BulkImportModal from '../components/BulkImportModal';
import TrackerStatCards from '../components/rankTracker/TrackerStatCards';
import TrackerToolbar from '../components/rankTracker/TrackerToolbar';
import TrackerTable from '../components/rankTracker/TrackerTable';
import TrackerDetailDrawer from '../components/rankTracker/TrackerDetailDrawer';
import { X } from 'lucide-react';
```

(`RankCalendar`/`RankChart`는 이제 `TrackerDetailDrawer` 내부에서만 쓰이므로 페이지 레벨 import 제거. `formatKSTDateTime`/`formatRankStatus`도 페이지에서 직접 호출하는 곳이 이 태스크로 없어지므로 제거. `lucide-react`는 파일 뒤쪽의 `AddTrackerModal`이 `X` 아이콘만 쓰므로 `X`만 남긴다.)

- [x] **Step 2: 정렬 상태 + 전체선택 핸들러 추가**

`const [searchQuery, setSearchQuery] = useState('');` 바로 다음 줄에 추가:

```js
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
```

`handleBulkDelete` 함수 바로 다음(= `filteredItems` 정의 바로 전)에 추가:

```js
  const handleToggleSelectAll = () => {
    setSelectedIds(prev => {
      const allSelected = filteredItems.length > 0 && filteredItems.every(i => prev.has(i.id));
      return allSelected ? new Set() : new Set(filteredItems.map(i => i.id));
    });
  };
```

(`filteredItems`는 이 함수 아래에 정의돼 있지만, `handleToggleSelectAll`은 실제로 호출될 때(렌더 이후 이벤트)만 `filteredItems`를 참조하므로 클로저상 문제없다 — 파일 내 다른 핸들러들도 동일한 패턴을 이미 쓰고 있음.)

- [x] **Step 3: 더 이상 쓰지 않는 로컬 변수 제거**

아래 4줄을 찾아서 삭제한다(각각 `TrackerDetailDrawer` 내부로 옮겨졌으므로 페이지 레벨에서는 불필요):

```js
  const latestRanks = selected?.latestRanks || {};
  const blogIds = selected?.blog_ids || [];
  const latestDate = snapshots.length ? snapshots[0].snapshotted_at : null;
  const latestSnapshot = selected?.mode === 'all'
    ? snapshots.filter(s => s.snapshotted_at === latestDate).sort((a, b) => (a.rank || 99) - (b.rank || 99))
    : [];
```

- [x] **Step 4: 메인 return의 JSX를 통째로 교체**

`if (!user) { ... }` 블록 다음의 `return (` 부터, 그 함수의 마지막 `);` `}` (그 다음에 `function AddTrackerModal` 정의가 이어짐) 까지 — 즉 모드 탭부터 시작해서 `<style>{...}</style>` 태그까지 포함한 전체 반환 블록 — 을 아래로 교체한다:

```jsx
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { id: 'blog', title: '블로그 추적 모드', desc: '특정 블로그가 키워드에서 몇 위인지 추적' },
          { id: 'all',  title: '전체 순위 모드',   desc: '키워드 블로그탭 상위 10개 스냅샷 기록' },
        ].map(m => (
          <div
            key={m.id}
            onClick={() => { setMode(m.id); setSelected(null); setSnapshots([]); setSortKey(null); }}
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

      <TrackerStatCards mode={mode} filteredItems={filteredItems} />

      <TrackerToolbar
        mode={mode}
        groups={groups}
        selectedGroupId={selectedGroupId}
        onGroupChange={(value) => { setSelectedGroupId(value); setSelected(null); setSnapshots([]); }}
        onCreateGroup={handleCreateGroup}
        onRenameGroup={handleRenameGroup}
        onDeleteGroup={handleDeleteGroup}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filteredItems={filteredItems}
        refreshingAll={refreshingAll}
        refreshAllProgress={refreshAllProgress}
        onRefreshAll={handleRefreshAll}
        failedJobId={failedJobId}
        onRetryFailed={handleRetryFailed}
        onExport={handleExport}
        onOpenBulkModal={() => setShowBulkModal(true)}
        onOpenAddModal={() => { setEditItem(null); setShowModal(true); }}
      />

      <TrackerTable
        mode={mode}
        rows={filteredItems}
        groups={groups}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={(key, dir) => { setSortKey(key); setSortDir(dir); }}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelectId}
        onToggleSelectAll={handleToggleSelectAll}
        onRowClick={selectItem}
        onMoveItemGroup={handleMoveItemGroup}
        onAddBlog={(item) => { setEditItem(item); setShowModal(true); }}
        onRemoveBlog={handleRemoveBlog}
        onDeleteKeyword={handleDelete}
        onBulkDeleteSelected={handleBulkDelete}
        loading={loading}
      />

      <TrackerDetailDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setSnapshots([]); }}
        mode={mode}
        selected={selected}
        snapshots={snapshots}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      {showModal && (
        <AddTrackerModal
          mode={mode}
          token={token}
          editItem={editItem}
          groups={groups}
          defaultGroupId={selectedGroupId}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          onAdded={async () => { setShowModal(false); setEditItem(null); await loadItems(); }}
        />
      )}

      {showBulkModal && (
        <BulkImportModal
          token={token}
          groups={groups}
          defaultGroupId={selectedGroupId}
          onClose={() => setShowBulkModal(false)}
          onImported={async () => { setShowBulkModal(false); await loadItems(); }}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
```

(마지막 `}`는 `RankTrackerPage` 함수 자체를 닫는 괄호 — 그 다음에 이어지는 `function AddTrackerModal(...) { ... }`는 손대지 않고 그대로 둔다.)

- [x] **Step 5: 빌드 확인**

Run: `cd client && npm run build`
Expected: 성공.

- [x] **Step 6: 사용하지 않는 변수/미정의 참조 확인**

Run: `grep -nE "RankCalendar|RankChart|formatKSTDateTime|formatRankStatus|RefreshCw|ExternalLink|Pencil|Download" client/src/pages/RankTrackerPage.jsx`
Expected: 결과가 전혀 없거나(0건), 있다면 전부 `AddTrackerModal` 함수 밖(사용하지 않는 곳)이 아닌지 확인 — 이 시점엔 페이지 상단에서 이 이름들을 더는 참조하지 않아야 한다.

- [x] **Step 7: 커밋**

```bash
git add client/src/pages/RankTrackerPage.jsx
git commit -m "feat: compose rank tracker page from stat cards, toolbar, table, and detail drawer"
```

---

### ✅ Task 8: 수동 통합 검증

**Files:** 없음 (코드 변경 없음, 검증만)

**Interfaces:**
- Consumes: Task 1~7의 전체 결과물
- Produces: 없음

- [x] **Step 1: 서버·클라이언트 로컬 구동**

```bash
cd server && npm run dev
```

새 터미널에서:

```bash
cd client && npm run dev
```

- [x] **Step 2: 화면 확인 체크리스트**

브라우저에서 로그인 후 "순위 추적" 탭으로 이동해 아래를 모두 확인한다:

- [ ] 모드 탭 아래에 통계 카드 4개(추적 키워드/추적 링크/5위 내 노출/통검 노출 중)가 보이고, 숫자가 그럴듯함
- [ ] 그룹 드롭다운을 바꾸면 카드 숫자와 테이블 내용이 함께 바뀜
- [ ] 키워드 검색어를 입력하면 카드 숫자와 테이블이 함께 필터링됨
- [ ] 테이블 헤더의 "키워드"/"검색량"/"순위"를 클릭하면 정렬되고, 다시 클릭하면 오름차순↔내림차순 전환됨
- [ ] 같은 키워드에 블로그가 여러 개인 경우, 첫 행에만 키워드/그룹 선택/체크박스/추가·삭제 아이콘이 보이고 나머지 행은 들여쓰기된 블로그 행으로 보임
- [ ] 행을 클릭하면 오른쪽에서 드로워가 슬라이드-인하고, 순위 추이 차트 + 캘린더가 보임
- [ ] 드로워를 ✕ 버튼, 바깥 스크림 클릭, ESC 키 각각으로 닫아본다 — 셋 다 닫힘
- [ ] 체크박스를 몇 개 선택하면 "N개 선택됨 · 선택 삭제" 바가 나타나고, 헤더 체크박스로 전체 선택/해제가 됨
- [ ] "전체 갱신", "내보내기", "대량 등록", "등록" 버튼이 툴바에 잘 배치돼 있고 각각 정상 동작함(등록/대량등록은 모달이 뜨는지만 확인해도 충분)
- [ ] "블로그 URL 추가"(+) 버튼과 "이 블로그만 빼기"(✕) 버튼이 정상 동작함
- [ ] "전체 순위 모드" 탭으로 전환해도 위 항목들이 (모드에 맞게 컬럼이 줄어든 채로) 정상 동작함

- [x] **Step 3: 최종 빌드 재확인**

```bash
cd client && npm run build
```

Expected: 성공.

- [x] **Step 4: 서버 테스트 재확인 + 푸시**

```bash
cd server && npm test
```

Expected: `tests 30`, `pass 30`, `fail 0`. 문제 없으면 이미 Task 1~7에서 커밋된 내용을 원격에 푸시한다:

```bash
git push origin master
```
