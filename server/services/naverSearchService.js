import axios from 'axios';

const SEARCH_API_BASE = 'https://openapi.naver.com/v1/search';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map();

function buildHeaders() {
  return {
    'X-Naver-Client-Id': process.env.NAVER_OPEN_API_CLIENT_ID,
    'X-Naver-Client-Secret': process.env.NAVER_OPEN_API_CLIENT_SECRET,
  };
}

async function fetchTotal(type, keyword) {
  const cacheKey = `${type}:${keyword}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.total;

  const res = await axios.get(`${SEARCH_API_BASE}/${type}.json`, {
    params: { query: keyword, display: 1 },
    headers: buildHeaders(),
    timeout: 8000,
  });

  const total = res.data?.total ?? 0;
  cache.set(cacheKey, { total, createdAt: Date.now() });
  return total;
}

export async function fetchContentCounts(keyword) {
  const [blog, cafe] = await Promise.allSettled([
    fetchTotal('blog', keyword),
    fetchTotal('cafearticle', keyword),
  ]);

  return {
    blog: blog.status === 'fulfilled' ? blog.value : null,
    cafe: cafe.status === 'fulfilled' ? cafe.value : null,
  };
}
