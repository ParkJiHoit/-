# 순위 추적 대량화 개선 설계 스펙

**작성일:** 2026-07-02
**범위:** 기존 [순위 추적 기능](2026-06-16-rank-tracker-design.md)을 키워드 ~100개 / 포스팅 월 200~300건 규모까지 다룰 수 있도록 확장
**적용 대상:** 1차는 운영자(본인) 계정 한정. 검증 후 프리미엄 사용자 대상 정식 기능화는 별도 논의.

---

## 1. 배경 및 문제

현재 순위 추적 기능은 다음 세 가지 이유로 대량 트래킹(키워드 ~100개, 월 200~300건 포스팅)을 감당하지 못한다.

1. **등록이 전량 수동** — `AddTrackerModal`에서 블로그 URL을 chip으로 하나씩 입력. 수십~수백 건을 이 방식으로 등록하는 건 비현실적.
2. **갱신이 키워드 1개씩, 사용자 일일 한도에 묶여 있음** — `daily_usage`의 `rank_refresh` 액션이 베이직 2회/일, 프리미엄 10회/일로 제한되어 있어 키워드 100개를 정기적으로 갱신할 방법이 없음.
3. **매칭이 blogId 단위라 정확도가 떨어짐** — 같은 블로그가 같은 키워드로 여러 포스팅을 올리면, 상위 10위 중 그 블로그의 아무 포스팅이나 잡혀 등록한 특정 포스팅의 순위가 아닐 수 있음. 또한 스크래핑 자체 실패와 "실제 순위 밖"이 구분되지 않아, 대량 처리 중 네이버 DOM 변경/차단이 발생하면 전체 데이터가 조용히 오염될 위험이 있음.

배포 환경은 Vercel 서버리스(`api/index.js`, `maxDuration: 30`)이며 상시 구동 프로세스가 없어, 기존 `node-cron` 기반 배치는 프로덕션에서 동작하지 않는다. 이번 개선은 **완전 자동화가 아닌, "한 번의 클릭으로 대량 처리"를 1차 목표**로 하고 자동 스케줄링은 다음 단계로 미룬다.

---

## 2. 정확도 개선

### 2-A. 포스팅 단위 정밀 매칭

- 등록 URL에서 `blogId`뿐 아니라 `logNo`(포스팅 고유 번호)까지 추출해 식별자를 `{blogId}` 또는 `{blogId}/{logNo}` 형태로 저장.
  - `logNo`가 있으면(포스팅 단위 등록): 스크래핑 결과에서도 동일하게 `blogId+logNo`를 추출해 **정확히 그 포스팅**이 매칭될 때만 순위로 인정.
  - `logNo`가 없으면(기존 blogId 단위 데이터, 하위호환): 기존처럼 해당 블로그의 최상위 노출 포스팅으로 폴백.
- `blogRankingService.scrapeNaverTab`의 반환 객체에 `logNo` 필드를 추가 (현재는 `blogId`만 추출, `postLink`에서 `/{blogId}/{logNo}` 패턴으로 함께 파싱).
- URL 정규화 함수(`extractPostKey`)는 `blog.naver.com/{id}/{logNo}`, `m.blog.naver.com/{id}/{logNo}`, `blog.naver.com/PostView.naver?blogId={id}&logNo={logNo}` 세 가지 형식을 모두 지원.

### 2-B. 조회 실패와 "순위 밖" 상태 분리

- `rank_snapshots`에 `status` 컬럼 추가: `ranked`(순위 확인됨) / `not_in_top5`(정상 조회, 등록 포스팅 미노출) / `fetch_failed`(스크래핑 자체 실패, 데이터 신뢰 불가).
- `fetchBlogRankings`가 빈 배열을 반환하는 경우(2회 재시도 후에도 0건)는 `rank=null`이 아니라 `status='fetch_failed'`로 기록 — "순위가 없다"와 "조회를 못 했다"를 구분.
- UI에서 `fetch_failed`는 "⚠ 조회 실패"로 별도 표시하고, 해당 항목만 골라 재시도할 수 있게 함.

### 2-C. 조회 깊이 정책

- 스크래핑 자체는 기존과 동일하게 상위 10개까지 수집(이미 구현되어 있어 변경 불필요).
- 다만 실질적 판단 기준은 **상위 5위까지**로 통일: 6위 이하는 UI/집계상 `not_in_top5`(순위권 밖)로 취급. 6~10위 원본 rank 값은 `rank_snapshots.rank`에 그대로 저장해 향후 필요 시 활용 가능하도록 남겨둔다.

---

## 3. 대량 등록 (CSV/엑셀 업로드)

### 3-A. 입력 방식
- 파일 업로드(.csv, .xlsx) 또는 텍스트 붙여넣기(엑셀에서 복사한 탭 구분 텍스트) 둘 다 지원.
- 2개 컬럼만 사용: 키워드, 포스팅 URL.

### 3-B. 유연한 파싱
- 헤더 이름 후보 매칭(대소문자/공백 무시): 키워드 컬럼 = `["키워드", "keyword", "검색어", "kw"]`, URL 컬럼 = `["url", "링크", "link", "블로그주소", "포스팅주소"]`.
- 헤더 컬럼명이 후보와 매칭되지 않으면, 첫 번째 행이 헤더인지 데이터인지 휴리스틱으로 판별(두 컬럼 중 하나가 URL 패턴이면 데이터 행으로 간주) 후 **첫 열 = 키워드, 둘째 열 = URL** 고정 규칙으로 폴백.
- 컬럼 순서(키워드가 먼저든 URL이 먼저든)는 헤더 매칭 결과를 우선 따르고, 폴백 시에는 URL 패턴이 있는 열을 URL 컬럼으로 자동 판별.

### 3-C. 미리보기 → 확정 플로우
- 업로드 즉시 서버에 반영하지 않고, 파싱 결과를 키워드별로 그룹핑해 미리보기 화면에 표시:
  - 신규 키워드 / 기존 키워드에 URL 추가 구분
  - 파싱 실패 행(사유 포함: `blog.naver.com` 형식 아님, 키워드 공란 등)
- 사용자가 확인 후 "등록" 버튼으로 확정해야 실제 DB에 반영.

### 3-D. 등록 로직
- 이미 존재하는 키워드(`user_id + keyword + mode` 유니크)면 기존 `blog_ids` 배열에 신규 URL만 append(중복 제거).
- 신규 키워드면 새 `tracked_keywords` row 생성.
- 같은 키워드가 CSV 여러 행에 걸쳐 나오면 하나의 tracked_keyword로 자동 병합.

---

## 4. 일괄 새로고침 (서버사이드 잡 + 청크 처리)

### 4-A. 아키텍처 선택 이유
클라이언트 순차 반복(브라우저 닫으면 중단, 재개 불가)이나 외부 큐 서비스 도입(현재 규모엔 과함) 대신, **DB 기반 잡 테이블 + 청크 처리**를 택한다. Vercel의 30초 함수 실행 제한 안에서 한 번에 처리 가능한 만큼만 처리하고, 잡 상태를 DB에 영속화해 재개 가능하게 하며, 추후 Vercel Cron이 동일한 처리 엔드포인트를 주기적으로 호출하도록만 바꾸면 코드 재작성 없이 자동화로 전환 가능하다.

### 4-B. 신규 테이블
```sql
CREATE TABLE refresh_jobs (
  id              SERIAL PRIMARY KEY,
  user_id         UUID        NOT NULL,
  status          TEXT        NOT NULL CHECK (status IN ('pending','running','completed','failed')) DEFAULT 'pending',
  total_count     INTEGER     NOT NULL DEFAULT 0,
  completed_count INTEGER     NOT NULL DEFAULT 0,
  failed_count    INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE refresh_job_items (
  id           SERIAL PRIMARY KEY,
  job_id       INTEGER NOT NULL REFERENCES refresh_jobs(id) ON DELETE CASCADE,
  tracked_id   INTEGER NOT NULL REFERENCES tracked_keywords(id) ON DELETE CASCADE,
  status       TEXT    NOT NULL CHECK (status IN ('pending','done','failed')) DEFAULT 'pending',
  error_message TEXT,
  processed_at TIMESTAMPTZ
);
CREATE INDEX ON refresh_job_items (job_id, status);
```

### 4-C. 처리 흐름
1. "전체 새로고침" 클릭 → `POST /api/rank-tracker/refresh-jobs` — 사용자의 모든(또는 선택한) `tracked_keywords`를 `refresh_job_items`로 등록, `job.status='pending'`.
2. 프론트가 `POST /api/rank-tracker/refresh-jobs/:id/process-chunk`를 반복 호출.
   - 서버는 `pending` 상태 아이템을 청크 단위(예: 5개)로 가져와 순차 처리 — 요청 사이 짧은 랜덤 딜레이(0.5~1초)를 둬서 네이버 차단 리스크를 줄임.
   - 각 아이템은 기존 `refreshRanks` 로직 재사용, 결과에 따라 `done`/`failed` 갱신.
   - 청크 처리 후 `{completed, total, done: boolean}` 반환.
3. 프론트는 `done=false`인 동안 다음 청크를 계속 호출, 진행률 바 표시. 브라우저를 닫아도 잡/아이템 상태는 DB에 남아 있어 페이지 재진입 시 이어서 처리 가능.
4. 실패 아이템(`status='failed'`)만 모아 재시도하는 버튼 제공.

---

## 5. 한도 정책

- 기존 개별 수동 새로고침(`rank_refresh` 액션, `daily_usage` 카운트)은 그대로 유지.
- 일괄 새로고침(잡 기반)은 별도 액션으로 분리하며 `daily_usage` 카운트에 포함하지 않음.
- 키워드 등록 개수 제한(현재 프리미엄 30개)은 운영자 계정에 한해 관리자 플래그로 상향(예: 200개). 프리미엄 정식 기능화 시 요금제 티어별 한도는 별도 설계.

---

## 6. API 변경 요약

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/rank-tracker/bulk-import/preview` | CSV/붙여넣기 텍스트 파싱 → 미리보기(그룹핑, 신규/기존/실패 구분) 반환. DB 반영 없음 |
| POST | `/api/rank-tracker/bulk-import/confirm` | 미리보기 결과 확정 → 실제 `tracked_keywords` upsert |
| POST | `/api/rank-tracker/refresh-jobs` | 일괄 새로고침 잡 생성 |
| POST | `/api/rank-tracker/refresh-jobs/:id/process-chunk` | 다음 청크 처리, 진행 상태 반환 |
| GET | `/api/rank-tracker/refresh-jobs/:id` | 잡 진행 상태 조회(재접속 시 이어하기용) |

기존 `/api/rank-tracker/:id/refresh`(개별 새로고침)는 변경 없이 유지.

---

## 7. DB 스키마 변경 요약

- `tracked_keywords.blog_ids`: 배열 요소를 `{blogId}` 또는 `{blogId}/{logNo}` 형태로 저장(기존 blogId-only 데이터는 그대로 호환).
- `rank_snapshots`: `status TEXT CHECK (status IN ('ranked','not_in_top5','fetch_failed'))` 컬럼 추가.
- 신규 테이블: `refresh_jobs`, `refresh_job_items` (섹션 4-B).

---

## 8. 미포함 범위 (v1)

- 완전 자동 스케줄링(Vercel Cron 연동) — 인프라 준비되면 다음 단계에서 `process-chunk` 엔드포인트를 재사용해 확장.
- 블로그 RSS 자동 매칭/신규 포스팅 자동 감지 — CSV 수동 등록으로 우선 커버.
- 프리미엄 요금제 정식 한도·과금 체계 재설계 — 운영자 계정 검증 후 별도 논의.
- 오래된/비활성 포스팅 자동 아카이빙 — 필요성 확인되면 후속 개선.
