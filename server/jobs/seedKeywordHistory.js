/**
 * 인기 키워드 초기 씨딩 스크립트
 * 실행: node server/jobs/seedKeywordHistory.js
 *
 * 한 번만 실행하면 됨. 이미 있는 키워드는 UPSERT로 덮어씀.
 * 네이버 API 레이트리밋 방지를 위해 키워드 간 딜레이 포함.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

import { initDb } from '../db/index.js';
import { recordMonthlySearch } from '../services/keywordHistoryService.js';
import { fetchKeywordVolume } from '../services/naverKeywordService.js';

// ─── 씨딩할 키워드 목록 ───────────────────────────────────────────
// 필요한 키워드 추가/제거 자유롭게 편집하세요
const SEED_KEYWORDS = [
  // 전자기기
  '갤럭시', '아이폰', '노트북', '에어팟', '애플워치', '아이패드', '삼성TV',
  '무선이어폰', '기계식키보드', '모니터', '스마트폰', '태블릿',

  // 쇼핑 플랫폼
  '쿠팡', '무신사', '올리브영', '마켓컬리', '지그재그', '에이블리', '29CM',
  '스마트스토어', '당근마켓', '번개장터',

  // 뷰티/건강
  '다이어트', '피부과', '비타민', '콜라겐', '선크림', '앰플', '에센스',
  '헬스장', '필라테스', '요가', '단백질보충제', '탈모샴푸',

  // 부동산
  '아파트', '전세', '월세', '오피스텔', '빌라', '부동산', '청약',
  '신축아파트', '역세권', '갭투자',

  // 금융/재테크
  '주식', '코인', '비트코인', '적금', '펀드', 'ETF', '연금저축',
  '청년도약계좌', '토스', '카카오뱅크',

  // 여행
  '제주도', '일본여행', '유럽여행', '동남아여행', '호텔', '에어비앤비',
  '항공권', '부산여행', '강원도', '경주여행',

  // 음식/배달
  '치킨', '피자', '배달음식', '삼겹살', '초밥', '마라탕', '편의점도시락',
  '배달의민족', '요기요', '쿠팡이츠',

  // 교육/자기계발
  '코딩', '영어학원', '토익', '자격증', '유튜브', '온라인강의',
  '프리랜서', '부업', '재테크', '독서',

  // 창업/비즈니스
  '스마트스토어창업', '카페창업', '식당창업', '프랜차이즈', '사업자등록',
  '온라인쇼핑몰', '드롭쉬핑', '위탁판매',

  // 자동차
  '아반떼', '그랜저', '테슬라', '전기차', '중고차', '자동차보험',
  '카니발', '팰리세이드',

  // 생활/인테리어
  '이케아', '한샘', '인테리어', '에어컨', '공기청정기', '로봇청소기',
  '냉장고', '세탁기', '식기세척기',

  // 의료/병원
  '성형외과', '치과', '라식', '라섹', '도수치료', '한의원', '정형외과',

  // 반려동물
  '강아지사료', '고양이사료', '펫샵', '동물병원', '강아지미용',

  // 취업/HR
  '취업', '이력서', '자소서', '면접', '채용', '사람인', '잡코리아',
  '공무원시험', '인적성',

  // 엔터테인먼트
  '넷플릭스', '유튜브프리미엄', '게임', '웹툰', '드라마', '영화',
].map((kw) => kw.trim()).filter(Boolean);

// ─── 메인 ─────────────────────────────────────────────────────────
const DELAY_MS = 400;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function seed() {
  await initDb();

  const total   = SEED_KEYWORDS.length;
  let success = 0;
  let failed  = 0;

  console.log(`\n키워드 ${total}개 씨딩 시작...\n`);

  for (let i = 0; i < SEED_KEYWORDS.length; i++) {
    const keyword = SEED_KEYWORDS[i];
    const prefix  = `[${String(i + 1).padStart(3, '0')}/${total}]`;

    try {
      const vol = await fetchKeywordVolume(keyword);
      if (vol && (vol.pcSearch + vol.mobileSearch) > 0) {
        await recordMonthlySearch(keyword, vol.pcSearch, vol.mobileSearch);
        console.log(`${prefix} ✓ ${keyword.padEnd(20)} PC:${String(vol.pcSearch).padStart(8)}  M:${String(vol.mobileSearch).padStart(8)}`);
        success++;
      } else {
        console.log(`${prefix} - ${keyword.padEnd(20)} 데이터 없음`);
        failed++;
      }
    } catch (err) {
      console.error(`${prefix} ✗ ${keyword.padEnd(20)} ${err.message}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n완료 — 성공: ${success}개 / 실패: ${failed}개 / 전체: ${total}개\n`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('씨딩 실패:', err.message);
  process.exit(1);
});
