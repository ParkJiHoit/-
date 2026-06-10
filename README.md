# 네이버 키워드 추천 대시보드

네이버 검색광고 API, 네이버 검색 Open API, 네이버 데이터랩 API를 활용해 검색광고 키워드와 블로그 콘텐츠 키워드를 분석하는 내부 운영용 대시보드입니다.

## 주요 기능

- 키워드 분석: 기준 키워드 1개를 입력해 연관 키워드, 검색량, 경쟁도, 포화도, 효율 점수 분석
- 키워드 확장: 시드 키워드 최대 3개와 포함/제외 단어를 기반으로 확장 키워드 발굴
- 블로그 분석: 블로그 문서 수, 최근 발행량, 검색 트렌드, 블로그 포화도, 콘텐츠 기회 점수 분석
- 추천 액션 자동 분류
- 컬럼 표시 설정, 필터, 정렬, 엑셀 다운로드
- API 키는 프론트엔드에 노출하지 않고 Express 백엔드에서만 사용
- 반복 조회를 줄이기 위한 서버 캐시 적용

## 프로젝트 구조

```text
client/
  src/components/
  src/utils/
  src/App.jsx

server/
  routes/
    keywords.js
    blog.js
  services/
    naverKeywordService.js
    naverBlogService.js
  utils/
  server.js
```

## 환경변수

루트 `.env` 또는 `server/.env`에 아래 값을 설정합니다.

```env
NAVER_API_KEY=
NAVER_SECRET_KEY=
NAVER_CUSTOMER_ID=
NAVER_OPEN_API_CLIENT_ID=
NAVER_OPEN_API_CLIENT_SECRET=
PORT=4000
```

`NAVER_API_KEY`, `NAVER_SECRET_KEY`, `NAVER_CUSTOMER_ID`는 네이버 검색광고 API용입니다.

`NAVER_OPEN_API_CLIENT_ID`, `NAVER_OPEN_API_CLIENT_SECRET`는 네이버 개발자 센터 Open API용입니다. 블로그 분석 탭을 사용하려면 네이버 개발자 센터에서 애플리케이션을 만들고 `검색`, `데이터랩(검색어트렌드)` API를 추가해야 합니다.

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

## Render 배포

Render Web Service 설정:

```text
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm run start
Instance Type: Free
```

Render 환경변수:

```env
NAVER_API_KEY=네이버 검색광고 액세스 라이선스
NAVER_SECRET_KEY=네이버 검색광고 비밀키
NAVER_CUSTOMER_ID=4407096
NAVER_OPEN_API_CLIENT_ID=네이버 개발자 센터 Client ID
NAVER_OPEN_API_CLIENT_SECRET=네이버 개발자 센터 Client Secret
NODE_ENV=production
```

수정사항 반영 흐름:

```text
파일 수정
→ GitHub Desktop에서 Commit
→ Push origin
→ Render 자동 배포
```

## 키워드 발굴 로직

키워드 확장 탭은 아래 값을 조합해 `발굴 점수`를 계산합니다.

```text
발굴 점수 =
연관도 35%
+ 검색량 안정성 25%
+ 경쟁도 역점수 20%
+ 의도 적합도 15%
+ 포화도 역점수 5%
```

의도 유형 예시:

- 창업 의도
- 대리점/매장
- 비용/수익
- 정보 탐색
- 판매/유통
- 수리/중고
- 잡키워드
- 일반 후보

## 블로그 분석 로직

블로그 분석 탭은 네이버 블로그 검색 API와 데이터랩 API를 사용합니다.

분석 항목:

- 월 검색량
- 블로그 문서 수
- 최근 30일 발행 샘플 수
- 최근 발행 비중
- 키워드 일치도
- 블로그 경쟁도
- 블로그 포화도
- 콘텐츠 기회 점수
- 검색 트렌드
- 추천 액션

콘텐츠 기회 점수:

```text
콘텐츠 기회 점수 =
검색량 점수 35%
+ 트렌드 점수 20%
+ 블로그 포화도 역점수 30%
+ 키워드 일치도 15%
```

네이버가 공식으로 제공하는 “블로그 지수”는 없기 때문에, 블로그 포화도와 콘텐츠 기회 점수는 API에서 얻을 수 있는 값으로 계산한 내부 운영용 추정 지표입니다.

## API 호출 제한

`too many request` 오류는 네이버 API 호출 제한에 걸렸다는 의미입니다.

현재 완화 장치:

- 같은 키워드 API 응답 캐시
- 키워드 확장 조회 쿼리 수 제한
- 네이버 검색광고 429 응답 시 1회 재시도
- 블로그 검색/트렌드 응답 3시간 캐시

호출 제한이 걸리면 잠시 기다린 뒤 다시 조회하면 됩니다.
