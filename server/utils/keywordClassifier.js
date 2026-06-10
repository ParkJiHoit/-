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

export function classifyKeyword(keywordData, baseKeyword) {
  const keyword = String(keywordData.keyword || '');
  const normalizedKeyword = keyword.replace(/\s+/g, '').toLowerCase();
  const normalizedBase = String(baseKeyword || '').replace(/\s+/g, '').toLowerCase();
  const competitionScore = getCompetitionScore(keywordData.competition);
  const isDirectlyRelated =
    normalizedKeyword === normalizedBase ||
    normalizedKeyword.includes(normalizedBase) ||
    normalizedBase.includes(normalizedKeyword);

  if (isDirectlyRelated || keywordData.relevanceScore >= 82) return ACTIONS.CORE;
  if (keywordData.relevanceScore < 30 || keywordData.intentScore < 25) return ACTIONS.EXCLUDE;
  if (keywordData.efficiencyScore >= 75 && keywordData.saturationScore < 60) return ACTIONS.PRIORITY;
  if (keywordData.totalSearch >= 1000 && competitionScore >= 80 && keywordData.saturationScore >= 75) {
    return ACTIONS.SATURATED;
  }
  if (keywordData.totalSearch >= 300 && competitionScore <= 60 && keywordData.averageCtr >= 1.5) {
    return ACTIONS.OPPORTUNITY;
  }
  if (keywordData.mobileRatio >= 70) return ACTIONS.MOBILE;
  if (keywordData.totalSearch < 100 && keywordData.averageCtr < 1) return ACTIONS.EXCLUDE;

  return ACTIONS.MONITORING;
}
