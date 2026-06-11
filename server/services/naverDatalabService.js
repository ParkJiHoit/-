import axios from 'axios';

const DATALAB_URL = 'https://openapi.naver.com/v1/datalab/search';
const NAVER_SEARCH_URL = 'https://openapi.naver.com/v1/search';
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
  try {
    const { data } = await axios.post(DATALAB_URL, body, {
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_OPEN_API_CLIENT_ID,
        'X-Naver-Client-Secret': process.env.NAVER_OPEN_API_CLIENT_SECRET,
        'Content-Type': 'application/json',
      },
      timeout: 12000,
    });
    return data;
  } catch (err) {
    console.error(
      '[DataLab] API 오류',
      err.response?.status,
      JSON.stringify(err.response?.data ?? err.message)
    );
    throw err;
  }
}

function getDateRange(days = 90) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

function getRatioMap(settled) {
  if (settled.status !== 'fulfilled') return new Map();
  const data = settled.value?.results?.[0]?.data || [];
  return new Map(data.map((d) => [d.period, d.ratio || 0]));
}

// OLS regression: find k ≥ 0 such that Σ k_i * X_i ≈ y (overall trend).
// Each gender/age DataLab series is independently normalised 0–100, so their
// averages are not directly comparable. OLS with the combined series as target
// recovers the implied scale factor for each group, letting us compute true
// proportions from k_i * mean(X_i).
function solveOLS(y, predictors) {
  const m = predictors.length;
  if (m === 0) return [];

  // Augmented matrix [XᵀX | Xᵀy] for the normal equations
  const A = Array.from({ length: m }, (_, i) =>
    Array.from({ length: m + 1 }, (_, j) =>
      j < m
        ? predictors[i].reduce((s, v, t) => s + v * predictors[j][t], 0)
        : predictors[i].reduce((s, v, t) => s + v * y[t], 0)
    )
  );

  // Gauss-Jordan elimination with partial pivoting
  for (let col = 0; col < m; col++) {
    let maxRow = col;
    for (let row = col + 1; row < m; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    }
    if (maxRow !== col) [A[col], A[maxRow]] = [A[maxRow], A[col]];
    if (Math.abs(A[col][col]) < 1e-10) continue;
    for (let row = 0; row < m; row++) {
      if (row === col) continue;
      const f = A[row][col] / A[col][col];
      for (let c = col; c <= m; c++) A[row][c] -= f * A[col][c];
    }
  }

  return A.map((row, i) => Math.max(0, Math.abs(A[i][i]) > 1e-10 ? row[m] / A[i][i] : 0));
}

// Compute proportions for each series relative to the overall trend using OLS.
// overallMap: Map<period, ratio> from the no-filter DataLab call
// seriesList: [{ label, map: Map<period, ratio> }, ...]
// Days missing in a series are filled with 0 (series had no searches that day).
function olsProportions(overallMap, seriesList) {
  const dates = [...overallMap.keys()];
  if (dates.length < seriesList.length + 1) return null;

  const y = dates.map((p) => overallMap.get(p));
  const predictors = seriesList.map(({ map }) => dates.map((p) => map.get(p) ?? 0));

  const k = solveOLS(y, predictors);

  const scores = seriesList.map(({ map }, i) => {
    const avg = dates.reduce((s, p) => s + (map.get(p) ?? 0), 0) / dates.length;
    return k[i] * avg;
  });

  const total = scores.reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  return seriesList.map(({ label }, i) => ({ label, proportion: scores[i] / total }));
}

function relativeTime(pubDateStr) {
  try {
    const diffMs = Date.now() - new Date(pubDateStr).getTime();
    const m = Math.floor(diffMs / 60000);
    if (m < 60) return `${Math.max(1, m)}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  } catch { return ''; }
}

function extractDomain(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host.split('.').slice(-2, -1)[0] || host.split('.')[0];
  } catch { return ''; }
}

async function fetchNaverNews(keyword) {
  try {
    const headers = {
      'X-Naver-Client-Id': process.env.NAVER_OPEN_API_CLIENT_ID,
      'X-Naver-Client-Secret': process.env.NAVER_OPEN_API_CLIENT_SECRET,
    };
    const [newsRes, blogRes] = await Promise.allSettled([
      axios.get(`${NAVER_SEARCH_URL}/news.json`, { headers, params: { query: keyword, display: 4, sort: 'date' }, timeout: 8000 }),
      axios.get(`${NAVER_SEARCH_URL}/blog.json`, { headers, params: { query: keyword, display: 3, sort: 'date' }, timeout: 8000 }),
    ]);
    if (newsRes.status === 'rejected') console.error('[News] news API error:', newsRes.reason?.response?.status, newsRes.reason?.response?.data ?? newsRes.reason?.message);
    if (blogRes.status === 'rejected') console.error('[News] blog API error:', blogRes.reason?.response?.status, blogRes.reason?.response?.data ?? blogRes.reason?.message);
    const stripHtml = (s) => String(s || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .trim();
    const newsItems = newsRes.status === 'fulfilled'
      ? (newsRes.value.data.items || []).map((it) => ({
          title: stripHtml(it.title),
          link: it.originallink || it.link,
          source: extractDomain(it.originallink || it.link),
          time: relativeTime(it.pubDate),
          type: 'news',
        }))
      : [];
    const blogItems = blogRes.status === 'fulfilled'
      ? (blogRes.value.data.items || []).map((it) => ({
          title: stripHtml(it.title),
          link: it.link,
          source: stripHtml(it.bloggername) || extractDomain(it.link),
          time: relativeTime(it.postdate ? `${it.postdate.slice(0,4)}-${it.postdate.slice(4,6)}-${it.postdate.slice(6,8)}` : ''),
          type: 'blog',
        }))
      : [];
    return [...newsItems, ...blogItems];
  } catch {
    return [];
  }
}

function getDow(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat
}

export async function analyzeKeywordInsights(keyword) {
  const cacheKey = keyword.trim().toLowerCase();
  pruneCache();

  const cached = insightCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.data;

  const PERIOD_DAYS = 90;
  const { startDate, endDate } = getDateRange(PERIOD_DAYS);
  const keywordGroups = [{ groupName: 'kw', keywords: [keyword] }];
  const base = { startDate, endDate, keywordGroups, timeUnit: 'date', device: '' };

  // Monthly (2 years) and yearly base (5 years, monthly granularity → aggregated client-side)
  const { startDate: startM, endDate: endM } = getDateRange(730);
  const { startDate: startY, endDate: endY } = getDateRange(1826);
  const baseMonthly = { startDate: startM, endDate: endM, keywordGroups, timeUnit: 'month', device: '' };
  const baseYearly  = { startDate: startY, endDate: endY, keywordGroups, timeUnit: 'month', device: '' };

  const AGE_GROUPS = [
    { label: '10대', ages: ['2'] },
    { label: '20대', ages: ['3', '4'] },
    { label: '30대', ages: ['5', '6'] },
    { label: '40대', ages: ['7', '8'] },
    { label: '50대+', ages: ['9', '10', '11'] },
  ];

  // allSettled: partial failures don't kill the whole response
  const settled = await Promise.allSettled([
    datalabPost(base),
    datalabPost({ ...base, gender: 'm' }),
    datalabPost({ ...base, gender: 'f' }),
    ...AGE_GROUPS.map((g) => datalabPost({ ...base, ages: g.ages })),
    fetchNaverNews(keyword),
    datalabPost(baseMonthly),
    datalabPost(baseYearly),
  ]);

  const [trendSettled, maleSettled, femaleSettled, ...rest] = settled;
  const ageSettled         = rest.slice(0, AGE_GROUPS.length);
  const newsSettled        = rest[AGE_GROUPS.length];
  const monthlyTrendSettled = rest[AGE_GROUPS.length + 1];
  const yearlyTrendSettled  = rest[AGE_GROUPS.length + 2];

  const news = newsSettled?.status === 'fulfilled' ? newsSettled.value : [];
  const toPoints = (s) => s?.status === 'fulfilled'
    ? (s.value?.results?.[0]?.data || []).map((d) => ({ period: d.period, ratio: d.ratio }))
    : [];
  const trendMonthly = toPoints(monthlyTrendSettled);
  const trendYearly  = toPoints(yearlyTrendSettled);

  // Trend (daily)
  const rawTrend = trendSettled.status === 'fulfilled'
    ? (trendSettled.value?.results?.[0]?.data || [])
    : [];
  const trend = rawTrend.map((d) => ({ period: d.period, ratio: d.ratio }));

  // Day-of-week (Mon=0..Sun=6 for display)
  const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
  const sums = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  trend.forEach(({ period, ratio }) => {
    const jsDay = getDow(period);
    const idx = jsDay === 0 ? 6 : jsDay - 1;
    sums[idx] += ratio;
    counts[idx]++;
  });
  const dayOfWeek = DOW_LABELS.map((label, i) => ({
    label,
    value: counts[i] ? sums[i] / counts[i] : 0,
  }));

  // Build ratio maps for OLS (overall trend is the regression target)
  const overallMap = getRatioMap(trendSettled);
  const maleMap    = getRatioMap(maleSettled);
  const femaleMap  = getRatioMap(femaleSettled);
  const ageMaps    = ageSettled.map(getRatioMap);

  // Gender — OLS recovers true proportion by fitting male+female series to overall trend
  const genderAvailable = maleSettled.status === 'fulfilled' && femaleSettled.status === 'fulfilled';
  const genderProps = genderAvailable
    ? olsProportions(overallMap, [
        { label: 'male',   map: maleMap },
        { label: 'female', map: femaleMap },
      ])
    : null;
  const gender = genderProps
    ? {
        male:   Math.round(genderProps.find((g) => g.label === 'male').proportion   * 100),
        female: Math.round(genderProps.find((g) => g.label === 'female').proportion * 100),
      }
    : null;

  // Age — same OLS approach for all 5 age groups simultaneously
  const ageAvailable = ageSettled.some((s) => s.status === 'fulfilled');
  const ageProps = ageAvailable
    ? olsProportions(overallMap, AGE_GROUPS.map((g, i) => ({ label: g.label, map: ageMaps[i] })))
    : null;
  const age = ageProps
    ? ageProps.map(({ label, proportion }) => ({ label, pct: Math.round(proportion * 100) }))
    : null;

  const ageDebug = ageProps
    ? ageProps.map((a) => `${a.label}=${(a.proportion * 100).toFixed(1)}%`).join(' ')
    : 'unavailable';
  console.log(`[DataLab] "${keyword}" → trend:${trend.length}pts gender:${JSON.stringify(gender)} age:[${ageDebug}]`);

  // If every DataLab call failed, propagate a clear error
  const datalabSettled = [trendSettled, maleSettled, femaleSettled, ...ageSettled];
  const allFailed = datalabSettled.every((s) => s.status === 'rejected');
  if (allFailed) {
    const firstError = datalabSettled[0]?.reason;
    const msg = firstError?.response?.data?.errorMessage
      || firstError?.message
      || 'DataLab API 오류';
    const e = new Error(msg);
    e.status = firstError?.response?.status || 500;
    throw e;
  }

  const data = { keyword, trend, dayOfWeek, gender, age, news, trendMonthly, trendYearly };
  insightCache.set(cacheKey, { createdAt: Date.now(), data });
  return data;
}
