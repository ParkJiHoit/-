import { getCompetitionScore } from './keywordScoring.js';

export const ACTIONS = {
  PRIORITY: '우선 테스트',
  SATURATED: '과포화 주의',
  OPPORTUNITY: '기회 키워드',
  MOBILE: '모바일 집중',
  EXCLUDE: '제외 검토',
  CORE: '핵심 후보',
  MONITORING: '모니터링'
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function isDirectlyRelated(normalizedKeyword, normalizedBase) {
  if (normalizedKeyword === normalizedBase) return true;
  if (normalizedKeyword.includes(normalizedBase)) return true;

  // base가 keyword를 포함하는 경우: keyword가 base의 절반 이상 길이여야 핵심으로 봄
  // 예: base=창업프랜차이즈(7) keyword=창업(2) → 2/7=28% → 제외
  //     base=휴대폰창업(5) keyword=창업(2) → 2/5=40% → 제외
  //     base=소자본창업(5) keyword=소자본창업(5) → 100% → 포함 (위에서 이미 처리)
  //     base=창업(2) keyword=창업방법(4) → keyword.includes(base)로 위에서 처리
  if (normalizedBase.includes(normalizedKeyword)) {
    const lengthRatio = normalizedKeyword.length / normalizedBase.length;
    return lengthRatio >= 0.6;
  }

  return false;
}

export function classifyKeyword(keywordData, baseKeyword) {
  const normalizedKeyword = normalizeText(keywordData.keyword);
  const normalizedBase = normalizeText(baseKeyword);
  const competitionScore = getCompetitionScore(keywordData.competition);

  // 1. 핵심 후보: base와 직접 연관이거나 연관도 점수가 매우 높음
  if (isDirectlyRelated(normalizedKeyword, normalizedBase) || keywordData.relevanceScore >= 82) {
    return ACTIONS.CORE;
  }

  // 2. 제외 검토: 연관도나 의도가 너무 낮거나, 검색량도 거의 없음
  if (keywordData.relevanceScore < 28 || keywordData.intentScore < 20) return ACTIONS.EXCLUDE;
  if (keywordData.totalSearch < 50 && keywordData.averageCtr < 0.5) return ACTIONS.EXCLUDE;

  // 3. 우선 테스트: 효율 높고 포화도 낮음
  if (keywordData.efficiencyScore >= 70 && keywordData.saturationScore < 55) return ACTIONS.PRIORITY;

  // 4. 과포화 주의: 경쟁이 치열하고 이미 포화 상태
  if (competitionScore >= 80 && keywordData.saturationScore >= 70 && keywordData.totalSearch >= 500) {
    return ACTIONS.SATURATED;
  }

  // 5. 기회 키워드: 경쟁 낮고 검색량 있고 CTR도 충분
  if (keywordData.totalSearch >= 200 && competitionScore <= 60 && keywordData.averageCtr >= 1.0) {
    return ACTIONS.OPPORTUNITY;
  }

  // 6. 모바일 집중: 모바일 비중이 높되, 다른 강한 신호가 없는 경우
  if (keywordData.mobileRatio >= 75 && keywordData.efficiencyScore >= 40) return ACTIONS.MOBILE;

  return ACTIONS.MONITORING;
}
