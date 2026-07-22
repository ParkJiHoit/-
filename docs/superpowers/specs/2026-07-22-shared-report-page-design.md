# 순위추적 공유 리포트 페이지 개선 설계 스펙

**작성일:** 2026-07-22
**범위:** `report_shares` 테이블/서비스, 관련 API 라우트, `ShareReportModal.jsx`, `SharedReportPage.jsx`. 순위 추적 본 기능(갱신 로직, 메인 테이블)은 변경하지 않는다.
**적용 대상:** 프리미엄 사용자의 "리포트 공유" 기능.

---

## 1. 배경 및 문제

현재 리포트 공유는 그룹 하나에 공유 링크 하나가 고정으로 묶여 있다(`report_shares.group_id NOT NULL`). 그래서:

- 툴바에서 "전체 그룹"을 보고 있을 때는 공유 버튼 자체가 안 보인다(특정 그룹을 선택해야만 노출).
- 읽기 전용 리포트 페이지(`SharedReportPage.jsx`)는 표 하나만 덩그러니 있고, KPI 요약도, 그룹 전환도, 정렬도, 기간 필터도, 변동사항 요약도 없다.
- 링크를 오래 전에 공유했으면 그 사이 등록된 새 링크까지 전부 다 보여서, "최근에 뭘 했는지" 파악이 안 된다.

이번 개선은 리포트 공유를 클라이언트에게 보여줄 만한 "성과 리포트"로 다듬는 것이 목표다.

---

## 2. 데이터 모델 변경

### `report_shares` 테이블
```sql
ALTER TABLE report_shares ALTER COLUMN group_id DROP NOT NULL;
```
- `group_id = NULL` → "전체 그룹" 공유를 의미.
- `UNIQUE(user_id, group_id)`는 그대로 둔다. Postgres는 NULL을 서로 다른 값으로 취급해 이 제약만으로는 사용자당 "전체" 링크를 하나로 못 막으므로, 서비스 레이어(`getShareForGroup`/`createShareForGroup`에 대응하는 "전체용" 함수)에서 `group_id IS NULL` 조건으로 명시적으로 조회해 기존 링크 재사용 여부를 판단한다(그룹별 공유와 동일한 패턴, `group_id` 파라미터만 `null` 허용).
- 새 컬럼은 추가하지 않는다. 14일 컷오프는 기존 `report_shares.created_at`(공유 링크가 생성/재발급된 시각)을 그대로 "스냅샷 기준일"로 사용해 서버에서 `created_at - 14일`로 계산한다. 링크를 해제 후 재생성하면 `created_at`이 갱신되므로 컷오프도 자연스럽게 그 시점 기준으로 다시 고정된다.

### 서비스 레이어 (`reportShareService.js`)
- `getShareForGroup`/`createShareForGroup`/`revokeShareForGroup`은 `groupId` 인자로 `null`을 받을 수 있게 하고, 내부 쿼리를 `group_id = $2`에서 `group_id IS NOT DISTINCT FROM $2`로 바꿔 NULL도 정확히 매칭되게 한다. 별도 함수를 새로 만들지 않고 기존 함수를 그대로 확장한다(그룹 존재 검증은 `groupId`가 `null`이 아닐 때만 수행).
- `getPublicReport(token)`: 지금은 `items`를 `group_id === groupId`로 한 그룹만 필터링해서 반환하는데, 이제
  - `report_shares.group_id`가 `NULL`이면 **모든 그룹의 아이템 + 그룹 메타(`id`, `name`) 목록**을 반환 (`groups: [{id, name}]`, `items: [...]` 전체, 각 item에 `group_id` 포함).
  - `group_id`가 특정 값이면 지금처럼 그 그룹의 아이템만 반환하고 `groups`는 그 그룹 하나만 담긴 배열(프론트에서 전환 UI를 안 그리도록 `groups.length <= 1`로 판별).
  - 두 경우 모두 14일 컷오프(아래 4절)를 적용해서 필터링한 뒤 반환한다.

---

## 3. 공유 생성 UX

- `TrackerToolbar.jsx`: 공유 버튼을 `selectedGroupId` 유무와 무관하게 항상 노출한다. 그룹 선택 중이면 지금처럼 "이 그룹 리포트 공유", 전체 그룹 보기 중이면 "전체 리포트 공유"로 레이블만 바뀐다.
- `ShareReportModal.jsx`: `groupId` prop이 `null`일 수 있게 하고, API 경로를 그룹별(`/groups/:groupId/share`)과 전체용(`/share`, 신설) 두 가지로 나눈다. 모달 안내 문구도 "전체 그룹의 순위 데이터를..."로 분기.
- 라우트(`rankTracker.js`): `GET/POST/DELETE /api/rank-tracker/share`(전체용, groupId 없음)를 신설하고, 내부적으로 기존 그룹용 서비스 함수를 `groupId=null`로 호출한다.
- 사용자는 두 종류의 링크를 각각 독립적으로 발급/해제할 수 있다 — 특정 고객에게는 그 고객 그룹 전용 링크를, 내부 검토용으로는 전체 링크를 따로 공유 가능.

---

## 4. 14일 컷오프

- 기준: 공유 링크의 `report_shares.created_at`(스냅샷 고정 시점).
- 필터 대상: 각 링크(`blog_ids` 원소)의 등록일 — 오늘 세션에 고친 `tracked_blog_links.added_at` 기준 (링크 단위 실제 추가 시점). `all` 모드 아이템은 링크 개념이 없으므로 키워드의 `tracked_keywords.created_at` 기준.
- `getPublicReport`에서 `listTracked`가 반환한 `latestRanks[blogId].addedDate`(이미 링크별 정확한 등록일이 들어있음, 오늘 수정한 로직 그대로 재사용)를 이용해 `addedDate >= (report_shares.created_at - 14일)`인 링크만 남긴다. 한 키워드의 모든 링크가 필터링돼서 사라지면 그 키워드 자체를 결과에서 제외한다.
- 컷오프는 API 응답 시점에 서버에서 한 번 계산해서 이미 필터링된 데이터만 내려준다 — 클라이언트는 필터링 로직을 모른다(보안/일관성).

---

## 5. 읽기 전용 리포트 페이지 (`SharedReportPage.jsx`)

### 5-1. KPI 요약 카드
- 기존 `TrackerStatCards` 컴포넌트를 그대로 재사용한다(새로 안 만듦). `compact` prop을 추가해 패딩/폰트를 줄인 작은 버전을 렌더링(메인 페이지는 `compact` 미지정 시 기존과 동일하게 유지 — 회귀 없음).
- 그룹 전환 시(아래 5-2) 선택된 그룹 기준으로 재계산.

### 5-2. 그룹 전환
- API 응답에 `groups.length > 1`이면(=전체 링크로 들어온 경우) 상단에 그룹 선택 드롭다운(전체 / 그룹명 각각)을 렌더링. 선택 시 클라이언트 사이드에서 `items`를 필터링 — 응답에 이미 전체 데이터가 들어있으므로 재요청 없음.
- `groups.length <= 1`이면(그룹 전용 링크) 전환 UI를 아예 그리지 않는다 — 다른 그룹 존재 여부조차 노출하지 않는다(보안 요구사항 유지).

### 5-3. 정렬
- 링크 단위 등록일(`addedDate`) 내림차순 고정 — 최근 추가된 링크가 위로. 같은 키워드 안에서도 이 기준으로 정렬(가장 최근 링크가 그 키워드 그룹의 첫 행이 되도록).

### 5-4. 주요 변동사항 요약
- KPI 카드 아래, 테이블 위에 배치.
- 계산: 리포트에 포함된 각 링크에 대해 "가장 오래된 스냅샷의 순위" vs "가장 최신 스냅샷의 순위"를 비교(둘 다 `rank_snapshots`에서 조회, `getPublicReport`에서 함께 계산해 API 응답에 `changes: [{keyword, blogId, fromRank, toRank}]` 형태로 포함).
- 표시 기준: `toRank`가 없던 상태(`fromRank`가 null 또는 status가 ranked가 아니었음)에서 5위 이내로 새로 진입했거나, 순위가 3계단 이상 상승한 항목만 추린다(전부 나열하면 오히려 안 읽힘 — 의미 있는 변화만).
- UI: "📈 3위 이내 신규 진입: OO키워드" / "📈 OO키워드 5위 → 2위" 같은 짧은 불릿 리스트, 최대 5~6개까지만. 변동이 하나도 없으면 섹션 자체를 숨긴다.
- 결정론적 계산만 사용 — 외부 API(제미나이 등) 연동은 이번 범위에서 제외. 나중에 추가하고 싶어지면 이 결정론적 요약 위에 AI 문장 요약을 얹는 방식으로 확장 가능하도록, `changes` 배열을 API 응답에 그대로 노출해둔다(향후 AI 연동 시 이 배열을 그대로 프롬프트 입력으로 재사용 가능).

### 5-5. 테이블 스타일
- 행 단위/계층 구조(키워드 → 블로그)는 유지.
- 순위 뱃지를 지금의 텍스트+색상에서 칩(pill) 형태의 배경색 배지로 바꿔 스캔하기 쉽게 함(`formatRankStatus`가 주는 label/color를 그대로 배지 배경/텍스트에 적용 — 새 색상 체계 발명 안 함).
- 스파크라인(순위 추이 미니 그래프)은 이번 범위에서 제외.

---

## 6. 자기 검토 메모
- `all` 모드 아이템은 링크가 없어 "변동사항" 계산에서 키워드 자체의 최신/과거 순위(=최상위 랭크)로 대체 비교한다.
- `report_shares.group_id`가 가리키던 그룹이 나중에 삭제되면(`tracker_groups` FK `ON DELETE CASCADE`), 그 그룹 전용 공유 링크도 함께 삭제된다 — 기존 동작 그대로, 전체 링크는 그룹 삭제와 무관하게 유지됨.
