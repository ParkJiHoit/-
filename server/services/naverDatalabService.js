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

// periodDays: total days in the query window (not just days with data).
// The DataLab API omits days with ratio=0, so dividing by data.length
// inflates sparse segments (e.g. a single spike → avg 100 for 10대).
// Dividing by the full period normalises correctly across all age groups.
function safeAvgRatio(settled, periodDays = null) {
  if (settled.status !== 'fulfilled') return 0;
  const data = settled.value?.results?.[0]?.data;
  if (!data?.length) return 0;
  const sum = data.reduce((s, d) => s + (d.ratio || 0), 0);
  return sum / (periodDays ?? data.length);
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
    const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, '').trim();
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

  const PERIOD_DAYS = 30;
  const { startDate, endDate } = getDateRange(PERIOD_DAYS);
  const keywordGroups = [{ groupName: 'kw', keywords: [keyword] }];
  const base = { startDate, endDate, keywordGroups, timeUnit: 'date', device: '' };

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
  ]);

  const [trendSettled, maleSettled, femaleSettled, ...rest] = settled;
  const ageSettled = rest.slice(0, AGE_GROUPS.length);
  const newsSettled = rest[AGE_GROUPS.length];
  const news = newsSettled?.status === 'fulfilled' ? newsSettled.value : [];

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

  // Gender — null when either call failed so UI can show "no data" clearly
  const genderAvailable = maleSettled.status === 'fulfilled' && femaleSettled.status === 'fulfilled';
  const maleAvg   = safeAvgRatio(maleSettled, PERIOD_DAYS);
  const femaleAvg = safeAvgRatio(femaleSettled, PERIOD_DAYS);
  const gTotal = maleAvg + femaleAvg || 1;
  const gender = genderAvailable
    ? { male: Math.round((maleAvg / gTotal) * 100), female: Math.round((femaleAvg / gTotal) * 100) }
    : null;

  // Age — null when all calls failed
  const ageAvailable = ageSettled.some((s) => s.status === 'fulfilled');
  const ageRatios = ageSettled.map((s, i) => ({
    label: AGE_GROUPS[i].label,
    value: safeAvgRatio(s, PERIOD_DAYS),
  }));
  const aTotal = ageRatios.reduce((s, a) => s + a.value, 0) || 1;
  const age = ageAvailable
    ? ageRatios.map((a) => ({ label: a.label, pct: Math.round((a.value / aTotal) * 100) }))
    : null;

  const ageDebug = ageRatios.map(a => `${a.label}=${a.value.toFixed(1)}`).join(' ');
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

  const data = { keyword, trend, dayOfWeek, gender, age, news };
  insightCache.set(cacheKey, { createdAt: Date.now(), data });
  return data;
}
