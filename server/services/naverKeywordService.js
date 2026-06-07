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

function normalizeKeywordRow(rawKeyword, baseKeyword) {
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
    const key = row.keyword.replace(/\s+/g, '').toLowerCase();
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
  const normalizedBase = baseKeyword.replace(/\s+/g, '').toLowerCase();

  return keywords
    .filter((row) => row.keyword.replace(/\s+/g, '').toLowerCase() !== normalizedBase)
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

export async function analyzeKeyword(baseKeyword) {
  try {
    const rawKeywords = await fetchNaverKeywordTool(baseKeyword);
    const normalizedRows = dedupeKeywords(rawKeywords.map((row) => normalizeKeywordRow(row, baseKeyword)));
    const baseKey = baseKeyword.replace(/\s+/g, '').toLowerCase();

    const keywords = normalizedRows.sort((a, b) => {
      const aIsBase = a.keyword.replace(/\s+/g, '').toLowerCase() === baseKey;
      const bIsBase = b.keyword.replace(/\s+/g, '').toLowerCase() === baseKey;
      if (aIsBase !== bIsBase) return aIsBase ? -1 : 1;
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      return b.efficiencyScore - a.efficiencyScore;
    });

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
