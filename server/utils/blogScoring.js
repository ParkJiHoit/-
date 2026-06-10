import { clamp, normalizeSearchVolume, round } from './keywordScoring.js';

export function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

function normalizeText(value) {
  return stripHtml(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function normalizeBlogDocumentCount(totalDocuments) {
  if (!totalDocuments) return 0;
  return clamp((Math.log10(totalDocuments + 1) / Math.log10(10000000 + 1)) * 100);
}

export function calculateKeywordMatchRatio(items, keyword) {
  if (!items.length) return 0;

  const normalizedKeyword = normalizeText(keyword);
  const matchedCount = items.filter((item) => {
    const title = normalizeText(item.title);
    const description = normalizeText(item.description);
    return title.includes(normalizedKeyword) || description.includes(normalizedKeyword);
  }).length;

  return round((matchedCount / items.length) * 100, 1);
}

export function calculateRecentPublishMetrics(items, now = new Date()) {
  const recentThreshold = new Date(now);
  recentThreshold.setDate(recentThreshold.getDate() - 30);

  const datedItems = items.filter((item) => /^\d{8}$/.test(String(item.postdate || '')));
  const recentCount = datedItems.filter((item) => {
    const postDate = new Date(
      Number(item.postdate.slice(0, 4)),
      Number(item.postdate.slice(4, 6)) - 1,
      Number(item.postdate.slice(6, 8))
    );
    return postDate >= recentThreshold;
  }).length;

  return {
    recentPostCount: recentCount,
    recentPublishRatio: datedItems.length ? round((recentCount / datedItems.length) * 100, 1) : 0
  };
}

export function calculateDocumentPerSearchScore(totalDocuments, monthlySearch) {
  if (!totalDocuments) return 0;
  if (!monthlySearch) return 85;

  const documentPerSearch = totalDocuments / Math.max(monthlySearch, 1);
  return clamp((Math.log10(documentPerSearch + 1) / Math.log10(5000 + 1)) * 100);
}

// 블로그 포화도: 누적 경쟁의 절대적 규모 측정 (총 문서 수 + 검색 대비 문서 비율)
// 높을수록 이 키워드로 이미 많은 글이 쌓여 있음 → 롱테일 기회 낮음
export function calculateBlogSaturationScore({ totalDocuments, recentPublishRatio, monthlySearch }) {
  const documentScore = normalizeBlogDocumentCount(totalDocuments);
  const documentPerSearchScore = calculateDocumentPerSearchScore(totalDocuments, monthlySearch);

  return Math.round(
    clamp(
      documentScore * 0.50 +
        documentPerSearchScore * 0.35 +
        clamp(recentPublishRatio) * 0.15
    )
  );
}

// 블로그 경쟁도: 지금 활발하게 공략 중인 정도 측정 (최근 발행 비중 중심)
// 높을수록 지금 이 순간 많은 블로거가 동일 키워드를 쓰고 있음 → 즉시 경쟁 치열
export function calculateBlogCompetitionScore({ totalDocuments, recentPublishRatio, monthlySearch }) {
  const documentScore = normalizeBlogDocumentCount(totalDocuments);
  const documentPerSearchScore = calculateDocumentPerSearchScore(totalDocuments, monthlySearch);

  return Math.round(
    clamp(
      clamp(recentPublishRatio) * 0.50 +
        documentScore * 0.30 +
        documentPerSearchScore * 0.20
    )
  );
}

export function calculateTrendMetrics(trendData = []) {
  if (!trendData.length) {
    return { trendDirection: '데이터 없음', trendChangeRate: 0, trendScore: 50 };
  }

  const ratios = trendData.map((item) => Number(item?.ratio) || 0);
  const latestRatio = ratios[ratios.length - 1];
  const firstRatio = ratios[0];

  // 전체 기간 변화율 (첫 달 → 마지막 달)
  const baseRatio = firstRatio || 1;
  const trendChangeRate = round(((latestRatio - baseRatio) / baseRatio) * 100, 1);

  // 최근 2달 변화율 (단기 모멘텀)
  const prevRatio = ratios.length >= 2 ? ratios[ratios.length - 2] : firstRatio;
  const recentChangeRate = prevRatio ? round(((latestRatio - prevRatio) / prevRatio) * 100, 1) : 0;

  // 중간 절반 구간 평균 vs 초기 절반 구간 평균 (중기 트렌드)
  const midStart = Math.floor(ratios.length / 2);
  const earlyAvg = ratios.slice(0, midStart).reduce((s, v) => s + v, 0) / Math.max(midStart, 1);
  const lateAvg = ratios.slice(midStart).reduce((s, v) => s + v, 0) / Math.max(ratios.length - midStart, 1);
  const midTermChange = earlyAvg > 0 ? round(((lateAvg - earlyAvg) / earlyAvg) * 100, 1) : 0;

  // 상승/하락 판정: 전체 변화율, 최근 변화율, 중기 변화율을 종합
  let trendDirection = '보합';
  const upSignals = [trendChangeRate >= 15, recentChangeRate >= 20, midTermChange >= 10].filter(Boolean).length;
  const downSignals = [trendChangeRate <= -15, recentChangeRate <= -20, midTermChange <= -10].filter(Boolean).length;

  if (upSignals >= 2) trendDirection = '상승';
  else if (downSignals >= 2) trendDirection = '하락';
  else if (upSignals === 1 && downSignals === 0 && trendChangeRate >= 25) trendDirection = '상승';
  else if (downSignals === 1 && upSignals === 0 && trendChangeRate <= -25) trendDirection = '하락';

  // 트렌드 점수: 장기 변화율과 단기 모멘텀을 7:3으로 합산
  const trendScore = clamp(50 + trendChangeRate * 0.35 + recentChangeRate * 0.2 + midTermChange * 0.15);

  return { trendDirection, trendChangeRate, trendScore };
}

// 콘텐츠 기회 점수: 검색량 35% + 트렌드 20% + 포화도 역점수 30% + 키워드 일치도 15%
// 포화도가 낮고, 검색량이 있고, 상승 트렌드면 기회 점수가 높아짐
export function calculateContentOpportunityScore({
  monthlySearch,
  blogSaturationScore,
  keywordMatchRatio,
  trendScore
}) {
  const searchScore = normalizeSearchVolume(monthlySearch);
  const saturationReverseScore = 100 - blogSaturationScore;

  return Math.round(
    clamp(
      searchScore * 0.35 +
        clamp(trendScore) * 0.20 +
        saturationReverseScore * 0.30 +
        clamp(keywordMatchRatio) * 0.15
    )
  );
}

export function classifyBlogAction({
  monthlySearch,
  recentPublishRatio,
  blogSaturationScore,
  blogCompetitionScore,
  contentOpportunityScore,
  trendDirection
}) {
  // 기회 점수가 높고 포화도 낮음: 콘텐츠 작성 최우선
  if (contentOpportunityScore >= 70 && blogSaturationScore < 55) return '작성 우선';

  // 포화도가 매우 높음: 진입 어려움
  if (blogSaturationScore >= 82) return '과포화 주의';

  // 상승 트렌드이면서 기회 점수도 있음: 지금이 타이밍
  if (trendDirection === '상승' && contentOpportunityScore >= 55) return '상승 키워드';

  // 현재 블로거 경쟁이 치열 (최신성 싸움 중)
  if (blogCompetitionScore >= 65 && recentPublishRatio >= 60) return '최신성 경쟁';

  // 검색량이 너무 적고 포화도도 높음
  if (monthlySearch < 100 && blogSaturationScore >= 60) return '보류';

  return '검토 후보';
}
