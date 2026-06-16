# 순위 추적 기능 설계 스펙

**작성일:** 2026-06-16  
**범위:** 네이버 블로그탭 순위 추적 대시보드 (블로그탭 전용 1차)

---

## 1. 개요

키워드와 블로그 URL을 등록하면 네이버 블로그탭 노출 순위를 날짜별로 기록하고 변화를 시각화하는 기능. 네비게이션에 "순위 추적" 탭을 신설하여 독립 페이지로 운영한다.

---

## 2. 두 가지 추적 모드

### 2-A. 블로그 추적 모드
- 타겟 키워드 1개 + 블로그 URL 여러 개 등록
- 각 블로그 포스팅이 해당 키워드 블로그탭에서 몇 위인지 추적
- 10위 밖이면 "미노출"로 기록

### 2-B. 전체 순위 모드
- 키워드 1개 등록
- 블로그탭 상위 10위 전체를 스냅샷으로 기록
- 기존 `blogRankingService.fetchBlogRankings()` 그대로 활용

---

## 3. 저장 방식

- Supabase Auth 연동 — 로그인한 유저별로 데이터 귀속
- 서버 PostgreSQL DB에 영구 저장 (휘발 없음)
- 갱신 방식: 수동 (새로고침 버튼)

---

## 4. DB 스키마

### `tracked_keywords` 테이블
```sql
CREATE TABLE tracked_keywords (
  id          SERIAL PRIMARY KEY,
  user_id     UUID        NOT NULL,          -- Supabase auth.users.id
  keyword     TEXT        NOT NULL,
  mode        TEXT        NOT NULL CHECK (mode IN ('blog', 'all')),
  blog_ids    TEXT[]      DEFAULT '{}',      -- 블로그 추적 모드용 blogId 배열
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, keyword, mode)
);
```

### `rank_snapshots` 테이블
```sql
CREATE TABLE rank_snapshots (
  id              SERIAL PRIMARY KEY,
  tracked_id      INTEGER     NOT NULL REFERENCES tracked_keywords(id) ON DELETE CASCADE,
  blog_id         TEXT        NOT NULL,      -- blog.naver.com/{blogId}
  rank            SMALLINT,                  -- NULL = 미노출
  post_title      TEXT,
  post_link       TEXT,
  snapshotted_at  DATE        NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (tracked_id, blog_id, snapshotted_at)
);
CREATE INDEX ON rank_snapshots (tracked_id, snapshotted_at DESC);
```

---

## 5. API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/rank-tracker` | 내 추적 목록 전체 조회 |
| POST | `/api/rank-tracker` | 추적 등록 (keyword + mode + blog_ids) |
| DELETE | `/api/rank-tracker/:id` | 추적 삭제 |
| POST | `/api/rank-tracker/:id/refresh` | 수동 순위 갱신 (크롤링 → DB 저장) |
| GET | `/api/rank-tracker/:id/snapshots` | 날짜별 스냅샷 히스토리 조회 |

모든 엔드포인트는 `Authorization: Bearer <supabase_jwt>` 헤더로 user_id 검증.

---

## 6. 순위 조회 로직

`/refresh` 호출 시:
1. `blogRankingService.fetchBlogRankings(keyword, 'blog')` 호출 (기존 크롤러)
2. 결과(상위 10개)에서 등록된 blog_ids 각각의 rank 추출
3. `rank_snapshots` upsert (같은 날 이미 있으면 덮어쓰기)
4. 전체 순위 모드는 상위 10개 모두 저장 (blog_id = 각 포스팅의 blogId)

---

## 7. 프론트엔드 구조

### 페이지: `RankTrackerPage.jsx`
```
RankTrackerPage
├── 모드 탭 (블로그 추적 / 전체 순위)
├── 왼쪽 패널: TrackerList
│   └── TrackerItem (클릭 → 오른쪽 패널 데이터 교체)
└── 오른쪽 패널: TrackerDetail
    ├── KPI 칩 (현재순위, 전일대비, 최고순위, 추적기간)
    ├── RankCalendar (날짜 × 블로그별 히트맵)
    ├── RankChart (순위 추이 꺾은선 / 7일·30일 토글)
    └── RankTable (전체 순위 모드 전용)
```

### 신규 파일
- `client/src/pages/RankTrackerPage.jsx`
- `client/src/components/RankCalendar.jsx`
- `client/src/components/RankChart.jsx`
- `server/routes/rankTracker.js`
- `server/services/rankTrackerService.js`

### 기존 파일 수정
- `client/src/App.jsx` — 네비게이션에 "순위 추적" 탭 추가
- `server/server.js` — `/api/rank-tracker` 라우트 등록
- `server/db/index.js` — `tracked_keywords`, `rank_snapshots` 테이블 생성 추가

---

## 8. UI 상세

- 왼쪽 항목 클릭 시 오른쪽 패널 전체 교체 (API 재호출)
- 캘린더 히트맵: 색상 강도로 순위 표현 (1위=진초록, 5위=주황, 7위↓=빨강, 미노출=회색)
- 순위 추이 차트: 여러 블로그 동시 표시, 색상 구분, 7일/30일 토글
- 등록 모달: 키워드 입력 + 블로그 URL 칩 형태로 여러 개 추가
- 로그인 안 된 상태: "로그인 후 이용 가능" 안내

---

## 9. 미포함 범위 (1차)

- 자동 스케줄 갱신 (수동 갱신만)
- 통합검색(통검) / 카페탭 / 기사탭 (블로그탭만)
- 알림 기능 (순위 변동 알림)
- 엑셀 내보내기
