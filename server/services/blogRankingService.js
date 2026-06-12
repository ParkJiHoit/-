import axios from 'axios';

const SEARCH_API_BASE = 'https://openapi.naver.com/v1/search';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

function buildSearchHeaders() {
  return {
    'X-Naver-Client-Id': process.env.NAVER_OPEN_API_CLIENT_ID,
    'X-Naver-Client-Secret': process.env.NAVER_OPEN_API_CLIENT_SECRET,
  };
}

const CRAWL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

function stripHtml(str) {
  return String(str || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function formatDaysAgo(postdate) {
  if (!postdate || postdate.length !== 8) return '';
  const y = parseInt(postdate.slice(0, 4));
  const m = parseInt(postdate.slice(4, 6)) - 1;
  const d = parseInt(postdate.slice(6, 8));
  const diff = Math.floor((Date.now() - new Date(y, m, d).getTime()) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  return `${diff}일 전`;
}

function extractBlogId(bloggerlink) {
  const match = String(bloggerlink || '').match(/blog\.naver\.com\/([^/?#\s]+)/);
  return match?.[1] || null;
}

// NVisitorgp4Ajax: 최근 5일치 일별 방문자 수 반환 (오늘은 당일 부분값)
async function fetchDailyVisitors(bloggerlink) {
  const blogId = extractBlogId(bloggerlink);
  if (!blogId) return null;

  try {
    const res = await axios.get('https://blog.naver.com/NVisitorgp4Ajax.naver', {
      params: { blogId },
      headers: { ...CRAWL_HEADERS, Referer: `https://blog.naver.com/${blogId}` },
      timeout: 6000,
    });

    // XML: <visitorcnt id="20260608" cnt="27013" />
    const counts = [...String(res.data).matchAll(/cnt="(\d+)"/g)]
      .map((m) => parseInt(m[1], 10))
      .filter((v) => v >= 0);

    if (!counts.length) return null;
    // 마지막은 오늘(부분값)이므로 제외, 나머지 최대 4일 평균
    const complete = counts.slice(0, -1);
    const base = complete.length ? complete : counts;
    return Math.round(base.reduce((s, v) => s + v, 0) / base.length);
  } catch {
    return null;
  }
}

export async function fetchBlogRankings(keyword) {
  const cacheKey = keyword.toLowerCase().trim();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.data;

  const searchRes = await axios.get(`${SEARCH_API_BASE}/blog.json`, {
    params: { query: keyword, display: 10, sort: 'sim' },
    headers: buildSearchHeaders(),
    timeout: 8000,
  });

  const items = searchRes.data?.items || [];

  const rankings = await Promise.all(
    items.map(async (item, i) => {
      const dailyVisitors = await fetchDailyVisitors(item.bloggerlink);
      return {
        rank: i + 1,
        title: stripHtml(item.title),
        author: stripHtml(item.bloggername),
        authorLink: item.bloggerlink,
        postLink: item.link,
        date: formatDaysAgo(item.postdate),
        dailyVisitors,
      };
    })
  );

  cache.set(cacheKey, { data: rankings, createdAt: Date.now() });
  return rankings;
}
