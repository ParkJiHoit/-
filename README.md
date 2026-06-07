# 네이버 키워드 추천 대시보드

네이버 검색광고 `keywordstool` API로 연관 키워드를 조회하고, 검색량/경쟁도/CTR/평균 노출 깊이 기반으로 포화도 점수와 효율 점수를 계산하는 내부 운영용 MVP 대시보드입니다.

## 주요 기능

- 기준 키워드 1개 입력 후 연관 키워드 분석
- 네이버 검색광고 API 호출은 Express 백엔드에서만 처리
- 검색량, 모바일 비중, CTR, 경쟁도, 평균 노출 깊이 기반 분석 컬럼 제공
- 포화도 점수와 효율 점수 자동 계산
- 기준 키워드와 추천 키워드 간 연관도 점수/등급 계산
- 조회 후 고정 예시 대신 연관도 높은 추천 검색어 버튼 제공
- 추천 액션 자동 분류: 우선 테스트, 기회 키워드, 모바일 집중, 과포화 주의, 제외 검토, 핵심 후보, 모니터링
- 컬럼별 정렬, 컬럼 표시 설정, 프론트엔드 필터
- 현재 필터링된 결과 엑셀 다운로드

## 프로젝트 구조

```text
client/
  src/components/
    KeywordSearchForm.jsx
    SummaryCards.jsx
    KeywordTable.jsx
    KeywordFilters.jsx
    KeywordBadge.jsx
  src/utils/
    formatters.js
    tableSort.js
  src/App.jsx

server/
  routes/keywords.js
  services/naverKeywordService.js
  utils/naverSignature.js
  utils/keywordScoring.js
  utils/keywordClassifier.js
  server.js
```

## 환경변수

루트의 `.env.example`을 참고해 `server/.env` 파일을 생성합니다.

```env
NAVER_API_KEY=
NAVER_SECRET_KEY=
NAVER_CUSTOMER_ID=
PORT=4000
```

API 키는 프론트엔드에 포함되지 않으며, 서버에서만 `.env`로 읽습니다.

## 설치

```bash
npm run install:all
```

개별 설치가 필요하면 아래처럼 실행할 수 있습니다.

```bash
npm install
npm --prefix client install
npm --prefix server install
```

## 실행

```bash
npm run dev
```

- 프론트엔드: `http://localhost:5173`
- 백엔드: `http://localhost:4000`
- 분석 API: `POST /api/keywords/analyze`

요청 예시:

```json
{
  "keyword": "휴대폰창업"
}
```

## Render 무료 배포

팀원들이 터미널을 실행하지 않고 하나의 웹 URL로 접속하게 하려면 Render에 배포하면 됩니다. 이 프로젝트는 Render에서 Express 서버가 React 빌드 파일까지 같이 서빙하도록 구성되어 있습니다.

### 1. GitHub 계정 만들기

1. [GitHub](https://github.com)에 접속합니다.
2. `Sign up`을 눌러 계정을 만듭니다.
3. 이메일 인증까지 완료합니다.

### 2. GitHub Desktop 설치하기

터미널이 익숙하지 않다면 GitHub Desktop을 쓰는 것이 가장 쉽습니다.

1. [GitHub Desktop](https://desktop.github.com)을 설치합니다.
2. 실행 후 GitHub 계정으로 로그인합니다.
3. `File > Add local repository`를 클릭합니다.
4. 이 프로젝트 폴더를 선택합니다.

```text
C:\Users\박지호\Documents\키워드 분석 툴
```

5. 아직 Git 저장소로 인식되지 않으면 `create a repository` 안내를 따라 생성합니다.

### 3. GitHub에 올리기

1. GitHub Desktop 왼쪽 하단의 `Summary`에 변경 내용 설명을 적습니다.
   - 예: `Initial Render deployment setup`
2. `Commit to main` 버튼을 누릅니다.
3. 상단 또는 우측의 `Publish repository`를 누릅니다.
4. `Keep this code private`를 켜는 것을 권장합니다.
5. `Publish Repository`를 누릅니다.

주의: `.env`와 `server/.env`는 `.gitignore`로 제외되어 GitHub에 올라가지 않습니다. 네이버 API 키는 GitHub에 올리지 말고 Render 환경변수에만 넣습니다.

### 4. Render 계정 만들기

1. [Render](https://render.com)에 접속합니다.
2. `Get Started` 또는 `Sign up`을 눌러 가입합니다.
3. GitHub 계정으로 로그인하면 연결이 쉽습니다.

### 5. Render에서 새 Web Service 만들기

1. Render Dashboard에서 `New +`를 클릭합니다.
2. `Web Service`를 선택합니다.
3. 방금 GitHub에 올린 저장소를 선택합니다.
4. 설정값을 아래처럼 입력합니다.

```text
Name: naver-keyword-dashboard
Runtime: Node
Branch: main
Build Command: npm install && npm run build
Start Command: npm run start
Instance Type: Free
```

또는 저장소에 포함된 `render.yaml`을 사용해 Blueprint로 생성할 수도 있습니다. 처음에는 Web Service 방식이 더 이해하기 쉽습니다.

### 6. Render 환경변수 입력하기

Render 서비스 생성 화면 또는 생성 후 `Environment` 메뉴에서 아래 값을 추가합니다.

```env
NAVER_API_KEY=네이버_엑세스_라이선스
NAVER_SECRET_KEY=네이버_비밀키
NAVER_CUSTOMER_ID=4407096
NODE_ENV=production
```

절대 GitHub 코드에 API 키를 직접 넣지 마세요.

### 7. 배포하기

1. `Create Web Service`를 누릅니다.
2. Render가 자동으로 설치, 빌드, 실행을 진행합니다.
3. 배포가 끝나면 아래와 비슷한 URL이 생깁니다.

```text
https://naver-keyword-dashboard.onrender.com
```

이 URL을 마케팅 팀원에게 공유하면 됩니다.

### 8. 수정사항을 GitHub와 Render에 반영하는 방법

Render는 GitHub에 새 commit이 올라오면 자동으로 다시 배포할 수 있습니다. Render 서비스의 `Settings`에서 `Auto-Deploy`가 켜져 있는지 확인하세요.

수정 후 반영 흐름은 아래와 같습니다.

1. Codex 또는 에디터에서 파일을 수정합니다.
2. GitHub Desktop을 엽니다.
3. 변경된 파일 목록을 확인합니다.
4. 왼쪽 아래 `Summary`에 수정 내용을 적습니다.
   - 예: `Add relevance filter controls`
5. `Commit to main`을 누릅니다.
6. `Push origin`을 누릅니다.
7. Render가 자동으로 새 버전을 배포합니다.

즉, 팀원들이 보는 웹 URL은 그대로이고 내용만 최신 버전으로 바뀝니다.

### 9. 무료 플랜 주의사항

Render 무료 Web Service는 일정 시간 접속이 없으면 잠들 수 있습니다. 팀원이 오랜만에 접속하면 첫 화면이 뜨기까지 30초~1분 정도 걸릴 수 있습니다. 내부 MVP 용도라면 보통 충분하지만, 매일 빠르게 써야 하면 유료 플랜을 검토하면 됩니다.

## 분석 로직

네이버 API에서 직접 제공되는 키워드 관련 컬럼만 원천 데이터로 사용합니다.

- `relKeyword`
- `monthlyPcQcCnt`
- `monthlyMobileQcCnt`
- `monthlyAvePcCtr`
- `monthlyAveMobileCtr`
- `compIdx`
- `plAvgDepth`

서버에서 아래 파생값을 계산합니다.

- 총 검색량
- 모바일 비중
- 평균 CTR
- 연관도 점수
- 연관도 등급
- 포화도 점수
- 효율 점수
- 추천 액션

점수 계산식은 `server/utils/keywordScoring.js`, 검색어 연관도 계산은 `server/utils/keywordRelevance.js`, 추천 액션 분류는 `server/utils/keywordClassifier.js`에 분리되어 있어 추후 캠페인 성과 데이터, 키워드 그룹 자동 분류, 히스토리 저장 등을 붙이기 쉽습니다.
