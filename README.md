# 네이버 키워드/블로그 분석 대시보드

네이버 검색광고 API, 네이버 검색 Open API, 데이터랩 API, 그리고 직접 크롤링을 조합해 키워드 발굴부터 블로그 콘텐츠 전략, 상위노출 순위 추적까지 지원하는 SaaS 대시보드입니다. Supabase 인증과 LemonSqueezy 구독 결제를 붙여 베이직(무료)/프리미엄 플랜으로 운영합니다.

## 주요 기능

### 1. 키워드 분석
기준 키워드 1개를 입력하면 연관 키워드, PC/모바일 검색량, 경쟁도, 포화도, 효율 점수를 분석하고 창업 의도·비용/수익 등 의도 유형으로 자동 분류합니다. 데이터랩 검색 트렌드 인사이트, 컬럼 표시 설정, 필터/정렬, 엑셀 다운로드를 지원합니다. (`client/src/App.jsx`, `server/routes/keywords.js`)

### 2. 블로그 구조 분석
특정 키워드의 블로그탭+VIEW탭 상위 10개 포스팅을 수집해 제목 내 키워드 위치·포함률, 발행 최신성, 블로그 다양성(고유 저자 수), 평균 방문자 수 등을 분석하고 자동 인사이트를 생성합니다 — "이 키워드에서 이기려면 어떤 콘텐츠를 써야 하는가"를 알려주는 상위 블로그 벤치마킹 도구입니다. (`server/services/blogStructureService.js`, `client/src/components/BlogStructurePanel.jsx`)

### 3. 블로그 진단
블로그 URL 하나를 활동성·상위노출 이력·영향력·신뢰도·블로그 연차 5개 항목으로 평가해 S~D 등급을 산출합니다 — 광고주 배포/협업 적합성을 빠르게 판단할 때 씁니다. (`server/services/blogAuditService.js`, `client/src/components/BlogAuditPanel.jsx`)

### 4. 순위 추적
등록한 키워드×블로그(또는 특정 포스팅)가 네이버 블로그탭에서 몇 위에 있는지 날짜별로 추적하고 히트맵/그래프로 시각화합니다. (`client/src/pages/RankTrackerPage.jsx`, `server/routes/rankTracker.js`)

- **두 가지 모드**: 블로그 추적(특정 포스팅이 몇 위인지, 상위 5위 이내만 "노출"로 판정) / 전체 순위(키워드 블로그탭 상위 10개 스냅샷)
- **포스팅 단위 정밀 매칭**: 블로그 하나가 같은 키워드로 여러 포스팅을 올려도 등록한 그 포스팅만 정확히 추적 (blogId+포스팅번호 기준)
- **조회 실패 구분 표시**: 스크래핑 자체가 실패한 경우(`조회실패`)와 실제로 순위 밖인 경우(`미노출`)를 구분해 데이터 신뢰도 확보
- **그룹 관리**: 추적 항목을 그룹으로 묶어 분류/필터링
- **CSV/엑셀 대량 등록**: 키워드·URL 목록을 붙여넣거나 파일 업로드하면 헤더 형식 관계없이 자동 인식, 미리보기 후 일괄 등록
- **잡 기반 일괄 새로고침**: 수십~수백 개 키워드를 청크 단위로 순차 처리해 서버리스 실행시간 제한 안에서 안전하게 전체 갱신, 진행률 표시 및 실패 항목만 재시도
- **엑셀 내보내기**: 날짜×키워드/블로그 순위를 색상 히트맵으로 표현한 워크북(원본 데이터 시트 포함) 다운로드

### 5. 계정 / 구독
Supabase Auth(구글 로그인 + 이메일 회원가입)로 로그인하며, 베이직(무료)과 프리미엄(월간 구독, 7일 무료체험) 플랜을 LemonSqueezy 결제로 운영합니다. 기능별 일일 사용 한도가 플랜에 따라 다르게 적용됩니다. (`client/src/AuthContext.jsx`, `client/src/components/PricingPage.jsx`, `server/routes/billing.js`, `server/routes/webhooks.js`, `server/middleware/usageLimit.js`)

## 프로젝트 구조

```text
client/
  src/
    pages/            AuthPage, RankTrackerPage
    components/       BlogStructurePanel, BlogAuditPanel, PricingPage,
                       RankCalendar, RankChart, BulkImportModal 등
    App.jsx            탭 전환(키워드 분석 / 블로그 / 순위 추적 / 요금제)
    AuthContext.jsx     Supabase 세션 관리

server/
  routes/
    keywords.js         키워드 분석/확장
    blog.js             블로그 구조 분석 / 진단
    rankTracker.js       순위 추적(등록/갱신/그룹/대량등록/일괄잡)
    billing.js           LemonSqueezy 체크아웃
    webhooks.js          결제 웹훅 수신
    jobs.js              외부 크론 트리거
    feedback.js          사용자 피드백 저장
  services/
    naverKeywordService.js   검색광고 API 연동
    naverBlogService.js       Open API / 데이터랩 연동
    blogStructureService.js   블로그 구조 분석
    blogAuditService.js       블로그 진단
    blogRankingService.js     네이버 블로그탭 크롤링
    rankTrackerService.js     순위 추적 핵심 로직 (매칭/저장)
    refreshJobService.js      일괄 새로고침 잡 큐
    bulkImportService.js      CSV/엑셀 텍스트 파싱
  middleware/
    usageLimit.js         플랜별 일일 사용량 제한
  db/index.js             PostgreSQL 스키마 초기화
  server.js               Express 앱 진입점(로컬/Render용)

api/index.js               Vercel 서버리스 함수 진입점
```

## 기술 스택

- **프론트엔드**: React 18, Vite, Tailwind CSS, Supabase JS, `xlsx-js-style`(엑셀 내보내기), framer-motion, three.js
- **백엔드**: Express, PostgreSQL(`pg`), Supabase Auth, Cheerio(크롤링), Axios, node-cron
- **배포**: Vercel(서버리스, 프론트+API) 또는 Render(상시 구동 서버) — `vercel.json` / `render.yaml` 참고
- **DB**: PostgreSQL (Render PostgreSQL 사용 시 외부 접속은 반드시 **External Database URL**을 사용해야 합니다. Internal URL은 Render 네트워크 밖에서 접속 불가)

## 환경변수

루트 `.env` 또는 `server/.env`에 아래 값을 설정합니다.

```env
# 네이버 검색광고 API
NAVER_API_KEY=
NAVER_SECRET_KEY=
NAVER_CUSTOMER_ID=

# 네이버 개발자 센터 Open API (검색, 데이터랩)
NAVER_OPEN_API_CLIENT_ID=
NAVER_OPEN_API_CLIENT_SECRET=

# 서버
PORT=4000

# 데이터베이스 (순위 추적, 구독, 사용량 제한 등에 필요)
DATABASE_URL=

# Supabase 인증
SUPABASE_URL=
SUPABASE_ANON_KEY=

# LemonSqueezy 결제
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_VARIANT_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=
CLIENT_ORIGIN=

# 관리자(모든 사용량 제한 무제한) 이메일, 콤마로 구분
ADMIN_EMAILS=

# 외부 크론(POST /api/jobs/refresh) 인증 토큰
JOB_SECRET=

# Claude API (챗봇 — 규칙 기반 매칭 실패 시 LLM 폴백에 사용, 없으면 정적 안내 문구로 대체)
ANTHROPIC_API_KEY=
```

`NAVER_OPEN_API_CLIENT_ID/SECRET`은 네이버 개발자 센터에서 애플리케이션을 만들고 `검색`, `데이터랩(검색어트렌드)` API를 추가해야 합니다.

`ANTHROPIC_API_KEY`가 없으면 챗봇은 규칙 기반 FAQ로만 동작하며, 매칭에 실패한 질문은 정적 안내 문구(문의하기 유도)로 응답합니다.

`DATABASE_URL`이 없으면 순위 추적·구독·사용량 제한 등 DB 의존 기능은 자동으로 비활성화되고(콘솔에 경고만 출력), 키워드/블로그 분석 기능은 정상 동작합니다.

## 설치

```bash
npm run install:all
```

## 로컬 실행

```bash
npm run dev
```

- 프론트엔드: `http://localhost:5173`
- 백엔드: `http://localhost:4000`
- 키워드 분석 API: `POST /api/keywords/analyze`
- 키워드 확장 API: `POST /api/keywords/expand`
- 블로그 분석 API: `POST /api/blog/analyze`
- 순위 추적 API: `/api/rank-tracker/*`

## 테스트

서버 쪽 순수 로직(파싱/매칭 등)은 Node 내장 테스트 러너로 검증합니다.

```bash
cd server && npm test
```

## 배포

### Vercel (서버리스)

`vercel.json`이 `client/dist` 정적 빌드와 `api/index.js`(Express 앱 래핑) 서버리스 함수로 배포합니다. Vercel 프로젝트 환경변수에 위 환경변수를 모두 등록하세요. `DATABASE_URL`은 Render 등 외부 PostgreSQL의 **External** 접속 문자열을 사용해야 합니다.

### Render (상시 구동 서버)

```text
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm run start
```

수정사항 반영 흐름: 파일 수정 → Push origin → 자동 배포 (Vercel/Render 모두 GitHub 연동 시 자동 배포)

## 키워드 발굴 로직

키워드 확장은 아래 값을 조합해 `발굴 점수`를 계산합니다.

```text
발굴 점수 =
연관도 35%
+ 검색량 안정성 25%
+ 경쟁도 역점수 20%
+ 의도 적합도 15%
+ 포화도 역점수 5%
```

의도 유형 예시: 창업 의도 · 대리점/매장 · 비용/수익 · 정보 탐색 · 판매/유통 · 수리/중고 · 잡키워드 · 일반 후보

## 블로그 분석 로직

콘텐츠 기회 점수:

```text
콘텐츠 기회 점수 =
검색량 점수 35%
+ 트렌드 점수 20%
+ 블로그 포화도 역점수 30%
+ 키워드 일치도 15%
```

네이버가 공식으로 제공하는 "블로그 지수"는 없기 때문에, 블로그 포화도와 콘텐츠 기회 점수는 API에서 얻을 수 있는 값으로 계산한 내부 운영용 추정 지표입니다.

## 순위 추적 로직

- 네이버 블로그탭 검색 결과를 크롤링해 순위를 확인하며, 공식 API가 아니므로 결과는 참고용입니다.
- 매칭은 `blogId + 포스팅 번호(logNo)` 기준으로, 같은 블로그의 다른 포스팅과 혼동되지 않습니다.
- 상위 5위 이내만 "노출(ranked)"로 집계하고, 6~10위 및 미발견은 "미노출", 크롤링 자체 실패는 "조회실패"로 구분해 저장합니다.
- 일괄 새로고침은 5개씩 청크로 나눠 순차 처리하며, 요청 사이 간격을 둬 네이버 차단 위험을 줄입니다.

## API 호출 제한 / 사용량 한도

`too many request` 오류는 네이버 API 호출 제한에 걸렸다는 의미입니다. 완화 장치: 응답 캐시, 재시도, 요청 간격 조절.

플랜별 일일 사용 한도(기능당):

| 기능 | 베이직 | 프리미엄 |
|---|---|---|
| 키워드 분석 | 10회 | 300회 (분당 15회) |
| 블로그 구조 분석 | 3회 | 50회 |
| 블로그 진단 | 3회 | 20회 |
| 개별 순위 갱신 | 2회 | 10회 |
| 일괄(잡 기반) 순위 갱신 | - | 위 한도와 무관하게 별도 처리 |

`ADMIN_EMAILS`에 등록된 계정은 모든 한도가 무제한입니다.
