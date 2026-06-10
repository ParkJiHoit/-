# 네이버 키워드 추천 대시보드

네이버 검색광고 `keywordstool` API로 연관 키워드를 조회하고, 검색량/경쟁도/CTR/평균 노출 깊이 기반으로 포화도, 효율, 발굴 점수를 계산하는 내부 운영용 대시보드입니다.

## 주요 기능

- 키워드 분석 탭: 기준 키워드 1개 입력 후 연관 키워드 분석
- 키워드 확장 탭: 시드 키워드 최대 3개 기반 키워드 발굴
- 포함할 단어 최대 5개, 제외할 단어 최대 5개 조건 적용
- 고성능 확장 옵션으로 연관도와 발굴 가치가 높은 후보 우선 추출
- 네이버 검색광고 API 호출은 Express 백엔드에서만 처리
- 연관도 점수, 의도 유형, 의도 점수, 발굴 점수 계산
- 포화도 점수와 효율 점수 자동 계산
- 추천 액션 자동 분류: 우선 테스트, 기회 키워드, 모바일 집중, 과포화 주의, 제외 검토, 핵심 후보, 모니터링
- 컬럼별 정렬, 컬럼 표시 설정, 엑셀 다운로드
- 같은 키워드 API 응답 6시간 캐시로 호출 제한 완화

## 프로젝트 구조

```text
client/
  src/components/
  src/utils/
  src/App.jsx

server/
  routes/keywords.js
  services/naverKeywordService.js
  utils/
  server.js
```

## 환경변수

루트 `.env` 또는 `server/.env`에 아래 값을 설정합니다.

```env
NAVER_API_KEY=
NAVER_SECRET_KEY=
NAVER_CUSTOMER_ID=
PORT=4000
```

API 키는 프론트엔드에 포함되지 않고 서버에서만 읽습니다.

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
- 분석 API: `POST /api/keywords/analyze`
- 확장 API: `POST /api/keywords/expand`

## Render 배포

Render Web Service 설정값:

```text
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm run start
Instance Type: Free
```

Render 환경변수:

```env
NAVER_API_KEY=네이버_엑세스_라이선스
NAVER_SECRET_KEY=네이버_비밀키
NAVER_CUSTOMER_ID=4407096
NODE_ENV=production
```

수정사항 반영 흐름:

```text
파일 수정
→ GitHub Desktop에서 Commit
→ Push origin
→ Render 자동 재배포
```

## 키워드 발굴 로직

확장 탭은 아래 값을 조합해 `발굴 점수`를 계산합니다.

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

고성능 확장은 낮은 연관도, 낮은 의도 적합도, 제외 검토 후보를 더 강하게 걸러냅니다.

## 네이버 API 호출 제한

`too many request` 오류는 네이버 검색광고 API 호출 제한에 걸렸다는 뜻입니다. 확장 탭은 여러 시드 키워드와 포함 단어 조합을 조회하기 때문에 분석 탭보다 API 호출량이 많습니다.

현재 완화 장치:

- 같은 키워드 API 응답을 6시간 캐시
- 고성능 확장: 최대 4개 조회 쿼리만 사용
- 일반 확장: 최대 6개 조회 쿼리만 사용
- API 요청을 동시에 보내지 않고 순차 요청
- 429 응답 시 1회 짧은 대기 후 재시도

그래도 제한이 뜨면 잠시 기다렸다가 다시 조회하세요.
