import axios from 'axios';

const DATALAB_URL = 'https://openapi.naver.com/v1/datalab/search';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const insightCache = new Map();

function pruneCache() {
  const now = Date.now();
  for (const [k, v] of insightCache) {
    if (now - v.createdAt >= CACHE_TTL_MS) insightCache.delete(k);
  }
}

function assertCredentials() {
  const missing = ['NAVER_OPEN_API_CLIENT_ID', 'NAVER_OPEN_API_CLIENT_SECRET'].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    const e = new Error(`DataLab API 환경변수 미설정: ${missing.join(', ')}`);
    e.status = 500;
    throw e;
  }
}

async function datalabPost(body) {
  assertCredentials();
  const { data } = await axios.post(DATALAB_URL, body, {
    headers: {
      'X-Naver-Client-Id': process.env.NAVER_OPEN_API_CLIENT_ID,
      'X-Naver-Client-Secret': process.env.NAVER_OPEN_API_CLIENT_SECRET,
      'Content-Type': 'application/json',
    },
    timeout: 12000,
  });
  return data;
}

function getDateRange(days = 90) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

function avgRatio(results) {
  const data = results?.[0]?.data;
  if (!data?.length) return 0;
  return data.reduce((s, d) => s + (d.ratio || 0), 0) / data.length;
}

function getDow(dateStr) {
  // "YYYY-MM-DD" → 0(Sun)…6(Sat)
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export async function analyzeKeywordInsights(keyword) {
  const cacheKey = keyword.trim().toLowerCase();
  pruneCache();

  const cached = insightCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.data;

  const { startDate, endDate } = getDateRange(90);
  const keywordGroups = [{ groupName: 'kw', keywords: [keyword] }];
  const base = { startDate, endDate, keywordGroups, timeUnit: 'date' };

  // Naver age codes: 2=13~18, 3=19~24, 4=25~29, 5=30~34, 6=35~39, 7=40~44, 8=45~49, 9=50~54, 10=55~59, 11=60+
  const AGE_GROUPS = [
    { label: '10대', ages: ['2'] },
    { label: '20대', ages: ['3', '4'] },
    { label: '30대', ages: ['5', '6'] },
    { label: '40대', ages: ['7', '8'] },
    { label: '50대+', ages: ['9', '10', '11'] },
  ];

  // 8 parallel calls: 1 trend + 2 gender + 5 age
  const [trendRes, maleRes, femaleRes, ...ageRes] = await Promise.all([
    datalabPost(base),
    datalabPost({ ...base, gender: 'm' }),
    datalabPost({ ...base, gender: 'f' }),
    ...AGE_GROUPS.map((g) => datalabPost({ ...base, ages: g.ages })),
  ]);

  // Trend (daily, 90 data points)
  const trend = (trendRes.results?.[0]?.data || []).map((d) => ({
    period: d.period,
    ratio: d.ratio,
  }));

  // Day-of-week: group daily ratios by weekday, Mon-first display order
  const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
  const sums = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  trend.forEach(({ period, ratio }) => {
    const jsDay = getDow(period); // 0=Sun..6=Sat
    const idx = jsDay === 0 ? 6 : jsDay - 1; // Mon=0..Sun=6
    sums[idx] += ratio;
    counts[idx]++;
  });
  const dayOfWeek = DOW_LABELS.map((label, i) => ({
    label,
    value: counts[i] ? sums[i] / counts[i] : 0,
  }));

  // Gender
  const maleAvg = avgRatio(maleRes.results);
  const femaleAvg = avgRatio(femaleRes.results);
  const gTotal = maleAvg + femaleAvg || 1;
  const gender = {
    male: Math.round((maleAvg / gTotal) * 100),
    female: Math.round((femaleAvg / gTotal) * 100),
  };

  // Age
  const ageRatios = ageRes.map((res, i) => ({
    label: AGE_GROUPS[i].label,
    value: avgRatio(res.results),
  }));
  const aTotal = ageRatios.reduce((s, a) => s + a.value, 0) || 1;
  const age = ageRatios.map((a) => ({
    label: a.label,
    pct: Math.round((a.value / aTotal) * 100),
  }));

  const data = { keyword, trend, dayOfWeek, gender, age };
  insightCache.set(cacheKey, { createdAt: Date.now(), data });
  return data;
}
