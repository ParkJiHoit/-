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

export function calculateBlogSaturationScore({
  totalDocuments,
  recentPublishRatio,
  monthlySearch
}) {
  const documentScore = normalizeBlogDocumentCount(totalDocuments);
  const documentPerSearchScore = calculateDocumentPerSearchScore(totalDocuments, monthlySearch);

  return Math.round(
    clamp(documentScore * 0.45 + clamp(recentPublishRatio) * 0.3 + documentPerSearchScore * 0.25)
  );
}

export function calculateBlogCompetitionScore({
  totalDocuments,
  recentPublishRatio,
  monthlySearch
}) {
  const documentScore = normalizeBlogDocumentCount(totalDocuments);
  const documentPerSearchScore = calculateDocumentPerSearchScore(totalDocuments, monthlySearch);

  return Math.round(
    clamp(documentScore * 0.45 + documentPerSearchScore * 0.3 + clamp(recentPublishRatio) * 0.25)
  );
}

export function calculateTrendMetrics(trendData = []) {
  if (!trendData.length) {
    return {
      trendDirection: '데이터 없음',
      trendChangeRate: 0,
      trendScore: 50
    };
  }

  const firstRatio = Number(trendData[0]?.ratio) || 0;
  const latestRatio = Number(trendData[trendData.length - 1]?.ratio) || 0;
  const previousRatio = Number(trendData[trendData.length - 2]?.ratio) || firstRatio;
  const baseRatio = firstRatio || previousRatio || 1;
  const trendChangeRate = round(((latestRatio - baseRatio) / baseRatio) * 100, 1);
  const recentChangeRate = previousRatio ? round(((latestRatio - previousRatio) / previousRatio) * 100, 1) : 0;

  let trendDirection = '보합';
  if (trendChangeRate >= 15 || recentChangeRate >= 20) trendDirection = '상승';
  if (trendChangeRate <= -15 || recentChangeRate <= -20) trendDirection = '하락';

  return {
    trendDirection,
    trendChangeRate,
    trendScore: clamp(50 + trendChangeRate / 2 + recentChangeRate / 3)
  };
}

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
        clamp(trendScore) * 0.2 +
        saturationReverseScore * 0.3 +
        clamp(keywordMatchRatio) * 0.15
    )
  );
}

export function classifyBlogAction({
  monthlySearch,
  recentPublishRatio,
  blogSaturationScore,
  contentOpportunityScore,
  trendDirection
}) {
  if (contentOpportunityScore >= 75 && blogSaturationScore < 60) return '작성 우선';
  if (blogSaturationScore >= 80) return '과포화 주의';
  if (trendDirection === '상승' && contentOpportunityScore >= 60) return '상승 키워드';
  if (recentPublishRatio >= 70) return '최신성 경쟁';
  if (monthlySearch < 100 && blogSaturationScore >= 60) return '보류';
  return '검토 후보';
}
