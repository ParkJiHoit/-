export const SORTABLE_COLUMNS = {
  totalSearch: '총 검색량',
  mobileRatio: '모바일 비중',
  averageCtr: '평균 CTR',
  competition: '경쟁도',
  averageDepth: '평균 노출 깊이',
  saturationScore: '포화도 점수',
  efficiencyScore: '효율 점수',
  relevanceScore: '연관도 점수'
};

const competitionRank = {
  낮음: 1,
  중간: 2,
  높음: 3,
  '알 수 없음': 0
};

export function sortKeywords(rows, sortConfig) {
  const { key, direction } = sortConfig;
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const aValue = key === 'competition' ? competitionRank[a[key]] || 0 : Number(a[key]) || 0;
    const bValue = key === 'competition' ? competitionRank[b[key]] || 0 : Number(b[key]) || 0;

    if (aValue === bValue) {
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      return b.efficiencyScore - a.efficiencyScore;
    }

    return (aValue - bValue) * multiplier;
  });
}
