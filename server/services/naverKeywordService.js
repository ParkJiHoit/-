import axios from 'axios';
import { classifyKeyword } from '../utils/keywordClassifier.js';
import { calculateKeywordRelevance } from '../utils/keywordRelevance.js';
import { createNaverSignature } from '../utils/naverSignature.js';
import {
  calculateEfficiencyScore,
  calculateSaturationScore,
  parseNaverNumber,
  round
} from '../utils/keywordScoring.js';

const NAVER_API_BASE_URL = 'https://api.searchad.naver.com';
const KEYWORD_TOOL_URI = '/keywordstool';

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

async function fetchNaverKeywordTool(baseKeyword) {
  assertNaverCredentials();

  const timestamp = Date.now().toString();
  const method = 'GET';
  const signature = createNaverSignature(
    timestamp,
    method,
    KEYWORD_TOOL_URI,
    process.env.NAVER_SECRET_KEY
  );

  const response = await axios.get(`${NAVER_API_BASE_URL}${KEYWORD_TOOL_URI}`, {
    params: {
      hintKeywords: baseKeyword,
      showDetail: 1
    },
    headers: {
      'X-Timestamp': timestamp,
      'X-API-KEY': process.env.NAVER_API_KEY,
      'X-Customer': process.env.NAVER_CUSTOMER_ID,
      'X-Signature': signature
    },
    timeout: 15000
  });

  return response.data?.keywordList || [];
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
    relevanceScore: relevance.relevanceScore,
    relevanceLevel: relevance.relevanceLevel,
    matchedTerms: relevance.matchedTerms
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

function sortKeywordRows(baseKeyword, rows) {
  const baseKey = normalizeText(baseKeyword);

  return rows.sort((a, b) => {
    const aIsBase = normalizeText(a.keyword) === baseKey;
    const bIsBase = normalizeText(b.keyword) === baseKey;
    if (aIsBase !== bIsBase) return aIsBase ? -1 : 1;
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    if (b.efficiencyScore !== a.efficiencyScore) return b.efficiencyScore - a.efficiencyScore;
    return b.totalSearch - a.totalSearch;
  });
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
    const rawKeywords = await fetchNaverKeywordTool(baseKeyword);
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
      ...normalizedIncludeWords.map((word) => `${seedKeyword} ${word}`)
    ]);
    const uniqueExpansionQueries = [...new Set(expansionQueries.map((seed) => seed.trim()).filter(Boolean))].slice(0, 12);

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
    const keywords = sortKeywordRows(representativeKeyword, filteredRows).slice(0, highQuality ? 60 : 120);

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
