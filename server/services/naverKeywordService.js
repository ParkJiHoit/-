import axios from 'axios';
import { classifyKeyword } from '../utils/keywordClassifier.js';
import { classifyKeywordIntent } from '../utils/keywordIntent.js';
import { calculateKeywordRelevance } from '../utils/keywordRelevance.js';
import { createNaverSignature } from '../utils/naverSignature.js';
import {
  calculateDiscoveryScore,
  calculateEfficiencyScore,
  calculateSaturationScore,
  parseNaverNumber,
  round
} from '../utils/keywordScoring.js';

const NAVER_API_BASE_URL = 'https://api.searchad.naver.com';
const KEYWORD_TOOL_URI = '/keywordstool';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const keywordToolCache = new Map();

function pruneCache(cache) {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.createdAt >= CACHE_TTL_MS) cache.delete(key);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function assertNaverCredentials() {
  const missing = ['NAVER_API_KEY', 'NAVER_SECRET_KEY', 'NAVER_CUSTOMER_ID'].filter(
    (key) => !process.env[key]
  );

  if (missing.length) {
    const error = new Error(`네이버 API 환경변수가 설정되지 않았습니다: ${missing.join(', ')}`);
    error.status = 500;
    throw error;
  }
}

function buildNaverRequestConfig(hintKeyword) {
  const timestamp = Date.now().toString();
  const method = 'GET';
  const signature = createNaverSignature(
    timestamp,
    method,
    KEYWORD_TOOL_URI,
    process.env.NAVER_SECRET_KEY
  );

  return {
    params: {
      hintKeywords: hintKeyword,
      showDetail: 1
    },
    headers: {
      'X-Timestamp': timestamp,
      'X-API-KEY': process.env.NAVER_API_KEY,
      'X-Customer': process.env.NAVER_CUSTOMER_ID,
      'X-Signature': signature
    },
    timeout: 15000
  };
}

async function fetchNaverKeywordTool(baseKeyword) {
  assertNaverCredentials();

  const hintKeyword = sanitizeNaverHintKeyword(baseKeyword);
  if (!hintKeyword) {
    const error = new Error('네이버 API에 전달할 키워드가 유효하지 않습니다.');
    error.status = 400;
    throw error;
  }

  const cacheKey = hintKeyword.toLowerCase();
  const cached = keywordToolCache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.rows;
  }

  pruneCache(keywordToolCache);

  let response;
  try {
    response = await axios.get(`${NAVER_API_BASE_URL}${KEYWORD_TOOL_URI}`, buildNaverRequestConfig(hintKeyword));
  } catch (error) {
    if (error.response?.status !== 429) throw error;
    await sleep(800);
    response = await axios.get(`${NAVER_API_BASE_URL}${KEYWORD_TOOL_URI}`, buildNaverRequestConfig(hintKeyword));
  }

  const rows = response.data?.keywordList || [];
  keywordToolCache.set(cacheKey, {
    createdAt: Date.now(),
    rows
  });

  return rows;
}

function normalizeCompetition(value) {
  const text = String(value || '').trim().toUpperCase();
  if (text === 'LOW') return '낮음';
  if (text === 'MEDIUM') return '중간';
  if (text === 'HIGH') return '높음';
  return value || '알 수 없음';
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function sanitizeNaverHintKeyword(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function normalizeKeywordRow(rawKeyword, baseKeyword, sourceKeyword = baseKeyword) {
  const keyword = rawKeyword.relKeyword || rawKeyword.keyword || '';
  const monthlyPcSearch = parseNaverNumber(rawKeyword.monthlyPcQcCnt);
  const monthlyMobileSearch = parseNaverNumber(rawKeyword.monthlyMobileQcCnt);
  const totalSearch = monthlyPcSearch + monthlyMobileSearch;
  const mobileRatio = totalSearch > 0 ? round((monthlyMobileSearch / totalSearch) * 100, 1) : 0;
  const monthlyPcCtr = round(parseNaverNumber(rawKeyword.monthlyAvePcCtr), 1);
  const monthlyMobileCtr = round(parseNaverNumber(rawKeyword.monthlyAveMobileCtr), 1);
  const averageCtr = round((monthlyPcCtr + monthlyMobileCtr) / 2, 1);
  const competition = normalizeCompetition(rawKeyword.compIdx);
  const averageDepth = round(parseNaverNumber(rawKeyword.plAvgDepth), 1);
  const relevance = calculateKeywordRelevance(baseKeyword, keyword);
  const intent = classifyKeywordIntent(keyword, baseKeyword);

  const saturationScore = calculateSaturationScore({
    competition,
    averageDepth,
    totalSearch
  });
  const efficiencyScore = calculateEfficiencyScore({
    totalSearch,
    averageCtr,
    competition,
    mobileRatio,
    saturationScore
  });
  const discoveryScore = calculateDiscoveryScore({
    relevanceScore: relevance.relevanceScore,
    totalSearch,
    competition,
    saturationScore,
    intentScore: intent.intentScore
  });

  const keywordData = {
    baseKeyword,
    sourceKeyword,
    keyword,
    monthlyPcSearch,
    monthlyMobileSearch,
    totalSearch,
    mobileRatio,
    monthlyPcCtr,
    monthlyMobileCtr,
    averageCtr,
    competition,
    averageDepth,
    saturationScore,
    efficiencyScore,
    discoveryScore,
    relevanceScore: relevance.relevanceScore,
    relevanceLevel: relevance.relevanceLevel,
    matchedTerms: relevance.matchedTerms,
    intentType: intent.intentType,
    intentScore: intent.intentScore
  };

  return {
    ...keywordData,
    recommendAction: classifyKeyword(keywordData, baseKeyword)
  };
}

function dedupeKeywords(rows) {
  const seen = new Set();

  return rows.filter((row) => {
    const key = normalizeText(row.keyword);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSummary(keywords) {
  const totalKeywords = keywords.length;
  const sumEfficiency = keywords.reduce((sum, row) => sum + row.efficiencyScore, 0);
  const sumSaturation = keywords.reduce((sum, row) => sum + row.saturationScore, 0);

  return {
    totalKeywords,
    priorityCount: keywords.filter((row) => row.recommendAction === '우선 테스트').length,
    opportunityCount: keywords.filter((row) => row.recommendAction === '기회 키워드').length,
    saturatedCount: keywords.filter((row) => row.recommendAction === '과포화 주의').length,
    avgEfficiencyScore: totalKeywords ? Math.round(sumEfficiency / totalKeywords) : 0,
    avgSaturationScore: totalKeywords ? Math.round(sumSaturation / totalKeywords) : 0
  };
}

function buildSearchSuggestions(keywords, baseKeyword) {
  const normalizedBase = normalizeText(baseKeyword);

  return keywords
    .filter((row) => normalizeText(row.keyword) !== normalizedBase)
    .filter((row) => row.relevanceScore >= 55)
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      return b.efficiencyScore - a.efficiencyScore;
    })
    .slice(0, 8)
    .map((row) => ({
      keyword: row.keyword,
      relevanceScore: row.relevanceScore,
      relevanceLevel: row.relevanceLevel
    }));
}

function sortKeywordRows(baseKeyword, rows, sortMode = 'analysis') {
  const baseKey = normalizeText(baseKeyword);

  return rows.sort((a, b) => {
    const aIsBase = normalizeText(a.keyword) === baseKey;
    const bIsBase = normalizeText(b.keyword) === baseKey;
    if (aIsBase !== bIsBase) return aIsBase ? -1 : 1;

    if (sortMode === 'discovery' && b.discoveryScore !== a.discoveryScore) {
      return b.discoveryScore - a.discoveryScore;
    }

    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    if (b.efficiencyScore !== a.efficiencyScore) return b.efficiencyScore - a.efficiencyScore;
    return b.totalSearch - a.totalSearch;
  });
}

/**
 * Derives additional hint keywords for broader API coverage.
 * Uses proportional character-prefix splits — no hardcoded vocabulary.
 *
 * Korean compound keywords form as [entity] + [descriptor]:
 *   "옆커폰창업" → prefix at 60% = "옆커폰" → reveals the entire keyword family
 *   "소자본창업1000만원" → prefix at 60% = "소자본창업" → meaningful unit
 *
 * Searching only at these breakpoints keeps API calls to ≤3 while covering
 * the head morpheme that indexes the broader family.
 */
function deriveAnalysisHints(keyword) {
  const clean = sanitizeNaverHintKeyword(keyword);
  if (!clean) return [];

  const hints = new Set([clean]);
  const len = clean.length;

  if (len >= 4) {
    for (const ratio of [0.6, 0.45]) {
      const prefixLen = Math.round(len * ratio);
      if (prefixLen >= 2 && prefixLen < len) {
        hints.add(clean.slice(0, prefixLen));
      }
    }
  }

  return [...hints];
}

function containsAny(keyword, words) {
  const normalizedKeyword = normalizeText(keyword);
  return words.some((word) => normalizedKeyword.includes(normalizeText(word)));
}

function filterExpandedRows(rows, includeWords, excludeWords, highQuality) {
  const minRelevance = highQuality ? 55 : 35;
  const minSearch = highQuality ? 10 : 0;

  return rows.filter((row) => {
    if (row.relevanceScore < minRelevance) return false;
    if (row.totalSearch < minSearch) return false;
    if (highQuality && row.intentScore < 50) return false;
    if (includeWords.length > 0 && !containsAny(row.keyword, includeWords)) return false;
    if (excludeWords.length > 0 && containsAny(row.keyword, excludeWords)) return false;
    if (highQuality && row.recommendAction === '제외 검토') return false;
    return true;
  });
}

function normalizeWordList(words) {
  return [...new Set((words || []).map((word) => String(word || '').trim()).filter(Boolean))].slice(0, 5);
}

export async function analyzeKeyword(baseKeyword) {
  try {
    const hints = deriveAnalysisHints(baseKeyword);

    const responses = await Promise.all(
      hints.map(async (hint) => ({
        hint,
        rows: await fetchNaverKeywordTool(hint)
      }))
    );

    const rawKeywords = responses.flatMap(({ rows }) => rows);
    const normalizedRows = dedupeKeywords(rawKeywords.map((row) => normalizeKeywordRow(row, baseKeyword)));
    const keywords = sortKeywordRows(baseKeyword, normalizedRows);

    return {
      baseKeyword,
      summary: buildSummary(keywords),
      searchSuggestions: buildSearchSuggestions(keywords, baseKeyword),
      keywords
    };
  } catch (error) {
    const wrappedError = new Error(
      error.response?.data?.title ||
        error.response?.data?.message ||
        error.message ||
        '네이버 키워드 데이터를 조회하지 못했습니다.'
    );
    wrappedError.status = error.status || error.response?.status || 500;
    throw wrappedError;
  }
}

export async function expandKeyword({
  seedKeywords = [],
  baseKeyword = '',
  includeWords = [],
  excludeWords = [],
  highQuality = false
}) {
  try {
    const normalizedSeedKeywords = normalizeWordList(seedKeywords.length ? seedKeywords : [baseKeyword]).slice(0, 3);
    const representativeKeyword = normalizedSeedKeywords[0];
    const normalizedIncludeWords = normalizeWordList(includeWords);
    const normalizedExcludeWords = normalizeWordList(excludeWords);
    const expansionQueries = normalizedSeedKeywords.flatMap((seedKeyword) => [
      seedKeyword,
      ...normalizedIncludeWords.map((word) => `${seedKeyword}${word}`)
    ]);
    const maxExpansionQueries = highQuality ? 4 : 6;
    const uniqueExpansionQueries = [
      ...new Set(expansionQueries.map((seed) => sanitizeNaverHintKeyword(seed)).filter(Boolean))
    ].slice(0, maxExpansionQueries);

    const responses = await Promise.all(
      uniqueExpansionQueries.map(async (sourceKeyword) => ({
        sourceKeyword,
        rows: await fetchNaverKeywordTool(sourceKeyword)
      }))
    );

    const normalizedRows = responses.flatMap(({ sourceKeyword, rows }) =>
      rows.map((row) => normalizeKeywordRow(row, representativeKeyword, sourceKeyword))
    );
    const filteredRows = filterExpandedRows(
      dedupeKeywords(normalizedRows),
      normalizedIncludeWords,
      normalizedExcludeWords,
      highQuality
    );
    const keywords = sortKeywordRows(representativeKeyword, filteredRows, 'discovery').slice(
      0,
      highQuality ? 60 : 120
    );

    return {
      baseKeyword: representativeKeyword,
      seedKeywords: normalizedSeedKeywords,
      includeWords: normalizedIncludeWords,
      excludeWords: normalizedExcludeWords,
      highQuality,
      summary: buildSummary(keywords),
      keywords
    };
  } catch (error) {
    const wrappedError = new Error(
      error.response?.data?.title ||
        error.response?.data?.message ||
        error.message ||
        '키워드 확장 데이터를 조회하지 못했습니다.'
    );
    wrappedError.status = error.status || error.response?.status || 500;
    throw wrappedError;
  }
}
