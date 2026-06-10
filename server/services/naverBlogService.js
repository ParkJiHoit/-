import axios from 'axios';
import { analyzeKeyword } from './naverKeywordService.js';
import {
  calculateBlogCompetitionScore,
  calculateBlogSaturationScore,
  calculateContentOpportunityScore,
  calculateKeywordMatchRatio,
  calculateRecentPublishMetrics,
  calculateTrendMetrics,
  classifyBlogAction,
  stripHtml
} from '../utils/blogScoring.js';

const NAVER_OPEN_API_BASE_URL = 'https://openapi.naver.com';
const BLOG_SEARCH_PATH = '/v1/search/blog.json';
const DATALAB_SEARCH_PATH = '/v1/datalab/search';
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const blogCache = new Map();
const trendCache = new Map();

function getOpenApiCredentials() {
  return {
    clientId: process.env.NAVER_OPEN_API_CLIENT_ID || process.env.NAVER_CLIENT_ID,
    clientSecret: process.env.NAVER_OPEN_API_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET
  };
}

function assertOpenApiCredentials() {
  const { clientId, clientSecret } = getOpenApiCredentials();

  if (!clientId || !clientSecret) {
    const error = new Error(
      '네이버 블로그 분석을 사용하려면 NAVER_OPEN_API_CLIENT_ID, NAVER_OPEN_API_CLIENT_SECRET 환경변수가 필요합니다.'
    );
    error.status = 500;
    throw error;
  }
}

function getOpenApiHeaders() {
  const { clientId, clientSecret } = getOpenApiCredentials();

  return {
    'X-Naver-Client-Id': clientId,
    'X-Naver-Client-Secret': clientSecret
  };
}

function getCached(cache, key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.data;
  return null;
}

function setCached(cache, key, data) {
  cache.set(key, {
    createdAt: Date.now(),
    data
  });
}

function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getTrendPeriod(months = 12) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);

  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - Math.max(1, months - 1));
  startDate.setDate(1);

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  };
}

async function fetchBlogSearch(keyword, sort = 'sim') {
  assertOpenApiCredentials();

  const cacheKey = `blog:${sort}:${keyword}`;
  const cached = getCached(blogCache, cacheKey);
  if (cached) return cached;

  const response = await axios.get(`${NAVER_OPEN_API_BASE_URL}${BLOG_SEARCH_PATH}`, {
    params: {
      query: keyword,
      display: 100,
      start: 1,
      sort
    },
    headers: getOpenApiHeaders(),
    timeout: 15000
  });

  setCached(blogCache, cacheKey, response.data);
  return response.data;
}

async function fetchSearchTrend(keyword, months) {
  assertOpenApiCredentials();

  const { startDate, endDate } = getTrendPeriod(months);
  const cacheKey = `trend:${keyword}:${startDate}:${endDate}`;
  const cached = getCached(trendCache, cacheKey);
  if (cached) return cached;

  const response = await axios.post(
    `${NAVER_OPEN_API_BASE_URL}${DATALAB_SEARCH_PATH}`,
    {
      startDate,
      endDate,
      timeUnit: 'month',
      keywordGroups: [
        {
          groupName: keyword,
          keywords: [keyword]
        }
      ]
    },
    {
      headers: {
        ...getOpenApiHeaders(),
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  );

  const data = {
    startDate,
    endDate,
    trend: response.data?.results?.[0]?.data || []
  };

  setCached(trendCache, cacheKey, data);
  return data;
}

async function fetchMonthlySearch(keyword) {
  try {
    const keywordAnalysis = await analyzeKeyword(keyword);
    const normalizedKeyword = keyword.replace(/\s+/g, '').toLowerCase();
    const exactRow =
      keywordAnalysis.keywords.find((row) => row.keyword.replace(/\s+/g, '').toLowerCase() === normalizedKeyword) ||
      keywordAnalysis.keywords[0];

    return {
      monthlySearch: exactRow?.totalSearch || 0,
      searchAdAvailable: true
    };
  } catch {
    return {
      monthlySearch: 0,
      searchAdAvailable: false
    };
  }
}

function normalizePost(item, keyword) {
  const cleanTitle = stripHtml(item.title);
  const cleanDescription = stripHtml(item.description);
  const normalizedKeyword = keyword.replace(/\s+/g, '').toLowerCase();
  const matchText = `${cleanTitle} ${cleanDescription}`.replace(/\s+/g, '').toLowerCase();

  return {
    title: cleanTitle,
    description: cleanDescription,
    link: item.link,
    bloggerName: item.bloggername,
    bloggerLink: item.bloggerlink,
    postDate: item.postdate,
    keywordMatched: matchText.includes(normalizedKeyword)
  };
}

export async function analyzeBlogKeyword({ keyword, months = 12 }) {
  const trimmedKeyword = String(keyword || '').trim();

  if (!trimmedKeyword) {
    const error = new Error('분석할 블로그 키워드를 입력해 주세요.');
    error.status = 400;
    throw error;
  }

  try {
    const [similarBlogData, recentBlogData, trendResult, searchResult] = await Promise.all([
      fetchBlogSearch(trimmedKeyword, 'sim'),
      fetchBlogSearch(trimmedKeyword, 'date'),
      fetchSearchTrend(trimmedKeyword, months).catch(() => null),
      fetchMonthlySearch(trimmedKeyword)
    ]);

    const similarItems = similarBlogData.items || [];
    const recentItems = recentBlogData.items || [];
    const totalBlogDocuments = Number(similarBlogData.total) || 0;
    const { recentPostCount, recentPublishRatio } = calculateRecentPublishMetrics(recentItems);
    const keywordMatchRatio = calculateKeywordMatchRatio(similarItems, trimmedKeyword);
    const trendMetrics = calculateTrendMetrics(trendResult?.trend || []);
    const blogSaturationScore = calculateBlogSaturationScore({
      totalDocuments: totalBlogDocuments,
      recentPublishRatio,
      monthlySearch: searchResult.monthlySearch
    });
    const blogCompetitionScore = calculateBlogCompetitionScore({
      totalDocuments: totalBlogDocuments,
      recentPublishRatio,
      monthlySearch: searchResult.monthlySearch
    });
    const contentOpportunityScore = calculateContentOpportunityScore({
      monthlySearch: searchResult.monthlySearch,
      blogSaturationScore,
      keywordMatchRatio,
      trendScore: trendMetrics.trendScore
    });
    const recommendAction = classifyBlogAction({
      monthlySearch: searchResult.monthlySearch,
      recentPublishRatio,
      blogSaturationScore,
      contentOpportunityScore,
      trendDirection: trendMetrics.trendDirection
    });

    return {
      keyword: trimmedKeyword,
      metrics: {
        keyword: trimmedKeyword,
        monthlySearch: searchResult.monthlySearch,
        searchAdAvailable: searchResult.searchAdAvailable,
        totalBlogDocuments,
        recentPostCount,
        recentPublishRatio,
        keywordMatchRatio,
        blogCompetitionScore,
        blogSaturationScore,
        contentOpportunityScore,
        recommendAction,
        trendDirection: trendMetrics.trendDirection,
        trendChangeRate: trendMetrics.trendChangeRate,
        trendAvailable: Boolean(trendResult),
        trendStartDate: trendResult?.startDate || null,
        trendEndDate: trendResult?.endDate || null
      },
      trend: trendResult?.trend || [],
      posts: similarItems.slice(0, 20).map((item) => normalizePost(item, trimmedKeyword))
    };
  } catch (error) {
    const wrappedError = new Error(
      error.response?.data?.errorMessage ||
        error.response?.data?.message ||
        error.message ||
        '블로그 키워드 데이터를 조회하지 못했습니다.'
    );
    wrappedError.status = error.status || error.response?.status || 500;
    throw wrappedError;
  }
}
