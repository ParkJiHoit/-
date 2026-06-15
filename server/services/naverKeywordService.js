import axios from 'axios';
import * as cheerio from 'cheerio';
import { classifyKeyword } from '../utils/keywordClassifier.js';
import { classifyKeywordIntent } from '../utils/keywordIntent.js';
const detectIntent = classifyKeywordIntent;
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
const AUTOCOMPLETE_URL = 'https://ac.search.naver.com/nx/ac';
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

function buildNaverRequestConfig(hintKeyword, useKeywordParam = false) {
  const timestamp = Date.now().toString();
  const method = 'GET';
  const signature = createNaverSignature(
    timestamp,
    method,
    KEYWORD_TOOL_URI,
    process.env.NAVER_SECRET_KEY
  );

  return {
    params: useKeywordParam
      ? { keyword: hintKeyword, showDetail: 1 }
      : { hintKeywords: hintKeyword, showDetail: 1 },
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
    console.error(`[kwTool] "${hintKeyword}" → ${error.response?.status || 'ERR'}: ${error.message}`);
    if (error.response?.status !== 429) throw error;
    await sleep(800);
    response = await axios.get(`${NAVER_API_BASE_URL}${KEYWORD_TOOL_URI}`, buildNaverRequestConfig(hintKeyword));
  }

  const rows = response.data?.keywordList || [];
  console.log(`[kwTool] "${hintKeyword}" → ${rows.length} rows`);
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

// 의도 타입별 맞춤 접미어 — 의도에 맞는 롱테일 탐색용
const INTENT_SUFFIX_MAP = {
  '창업 의도':    ['비용', '방법', '준비', '절차', '성공사례'],
  '대리점/매장':  ['비용', '조건', '계약', '수익', '문의'],
  '비용/수익':    ['평균', '비교', '절약', '견적', '수익률'],
  '정보 탐색':    ['후기', '추천', '비교', '장단점', '방법'],
  '판매/유통':    ['방법', '조건', '단가', '플랫폼', '마진'],
  '수리/중고':    ['가격', '비용', '후기', '추천', '방법'],
  '일반 후보':    ['방법', '후기', '추천', '비용', '뜻'],
};

const SERP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const SERP_RELATED_SELECTORS = [
  '.sds-comps-grid-layout-column.columnSize50 a._slog_visible',
  '.columnSize50 a._slog_visible',
  'a._slog_visible',
  '.related_srch .lst_related_srch a',
  '.related_srch a',
  '[class*="RelatedKeyword"] a',
];

// Naver SERP 연관검색어 스크래핑
async function fetchNaverRelatedSearches(keyword) {
  try {
    const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`;
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': SERP_UA,
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.naver.com',
      },
      timeout: 8000,
    });
    const $ = cheerio.load(data);
    const results = new Set();

    for (const sel of SERP_RELATED_SELECTORS) {
      $(sel).each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text && text.length >= 2 && text.length <= 30) results.add(text);
      });
      if (results.size >= 3) break;
    }

    const found = [...results].slice(0, 10);
    if (found.length) console.log(`[relatedSearch] "${keyword}" → ${found.length}개:`, found.slice(0, 4));
    return found;
  } catch (err) {
    console.warn(`[relatedSearch] "${keyword}" 실패:`, err.message);
    return [];
  }
}

async function fetchNaverRelKwdStat() {
  return [];
}

// SERP 키워드에 API 지표 매핑 (검색량/경쟁도 등)
function extractSerpKeywords(allRows, serpSignals, baseKeyword) {
  const baseNorm = normalizeText(baseKeyword);

  if (serpSignals?.length) {
    // SERP 자동완성/연관검색어가 있으면 해당 키워드 우선 사용
    const rowMap = new Map(allRows.map(r => [normalizeText(r.keyword), r]));
    const seen = new Set();
    const result = [];
    for (const s of serpSignals) {
      if (!s) continue;
      const norm = normalizeText(s);
      if (seen.has(norm) || norm === baseNorm) continue;
      seen.add(norm);
      const apiRow = rowMap.get(norm);
      if (apiRow) {
        result.push(apiRow);
      } else {
        const relevance = calculateKeywordRelevance(baseKeyword, s);
        result.push({
          keyword: s, totalSearch: 0, monthlyPcSearch: 0, monthlyMobileSearch: 0,
          competition: null, efficiencyScore: 0, saturationScore: 0,
          relevanceScore: relevance.relevanceScore, relevanceLevel: relevance.relevanceLevel,
        });
      }
    }
    return result;
  }

  // 자동완성/SERP 연관검색어를 못 가져온 경우:
  // 키워드 도구 API 결과에서 베이스 키워드로 시작하거나 연관도 높은 키워드를 대신 표시
  return allRows
    .filter(r => {
      const kNorm = normalizeText(r.keyword);
      if (kNorm === baseNorm) return false;
      return kNorm.startsWith(baseNorm) || r.relevanceScore >= 70;
    })
    .sort((a, b) => {
      const aStarts = normalizeText(a.keyword).startsWith(baseNorm);
      const bStarts = normalizeText(b.keyword).startsWith(baseNorm);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return b.relevanceScore - a.relevanceScore;
    })
    .slice(0, 10);
}

// SERP 신호로 관련 추천 검색어 chips 생성
function buildSerpChips(serpSignals, baseKeyword) {
  const baseNorm = normalizeText(baseKeyword);
  return [...new Set(serpSignals)]
    .filter(s => s && normalizeText(s) !== baseNorm)
    .map(s => {
      const relevance = calculateKeywordRelevance(baseKeyword, s);
      return { keyword: s, relevanceScore: relevance.relevanceScore, relevanceLevel: relevance.relevanceLevel };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 8);
}

/**
 * 힌트 도출 전략 (원래대로):
 *  1순위: 네이버 자동완성 + SERP 연관검색어 (병렬)
 *  2순위: 접두어 분리 폴백 (SERP 시그널 < 4개일 때)
 *  3순위: 인텐트 접미어 폴백 (최후 수단)
 *  상한: MAX_HINTS = 8
 *
 *  반환: { hints, serpSignals }
 *   - hints: 키워드 API 조회용
 *   - serpSignals: 관련 추천 검색어 chips용 (SERP 원본 그대로)
 */
async function deriveAnalysisHints(keyword) {
  const clean = sanitizeNaverHintKeyword(keyword);
  if (!clean) return { hints: [], serpSignals: [] };

  const seen = new Set([clean]);
  const hints = [clean];

  // 1. 자동완성 + SERP 연관검색어 병렬 수집
  const [acResult, relatedResult] = await Promise.allSettled([
    fetchNaverAutoComplete(keyword),
    fetchNaverRelatedSearches(keyword),
  ]);
  const acSuggestions = acResult.status === 'fulfilled' ? acResult.value : [];
  const relatedSearches = relatedResult.status === 'fulfilled' ? relatedResult.value : [];
  const serpSignals = [...acSuggestions, ...relatedSearches];

  // 2. 자동완성 상위 3개 → 롱테일 탐색 힌트
  for (const kw of acSuggestions.slice(0, 3)) {
    const s = sanitizeNaverHintKeyword(kw);
    if (s && !seen.has(s)) { seen.add(s); hints.push(kw); }
  }

  // 3. 의도 파악 → 의도에 맞는 접미어 2개로 롱테일 힌트
  const { intentType } = detectIntent(keyword, keyword);
  const suffixes = INTENT_SUFFIX_MAP[intentType] || INTENT_SUFFIX_MAP['일반 후보'];
  for (const suffix of suffixes.slice(0, 2)) {
    const combined = clean + suffix;
    if (!seen.has(combined)) { seen.add(combined); hints.push(combined); }
  }

  // 4. SERP 연관검색어 상위 2개 → 유사/함께 검색된 키워드 힌트
  for (const kw of relatedSearches.slice(0, 2)) {
    if (hints.length >= 8) break;
    const s = sanitizeNaverHintKeyword(kw);
    if (s && !seen.has(s)) { seen.add(s); hints.push(kw); }
  }

  console.log(`[hints] "${keyword}" (의도: ${intentType}) → ${hints.length}개:`, hints);
  return { hints, serpSignals };
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

async function fetchNaverAutoComplete(keyword) {
  try {
    const { data } = await axios.get(AUTOCOMPLETE_URL, {
      params: {
        q: keyword, con: 1, frm: 'nv', ans: 2,
        r_format: 'json', r_enc: 'UTF-8', r_unicode: 0,
        t_koreng: 1, run: 2, rev: 4, q_enc: 'UTF-8',
      },
      headers: { 'User-Agent': SERP_UA, 'Referer': 'https://www.naver.com' },
      timeout: 5000,
    });
    // Naver autocomplete: 실제 데이터는 items[0]에 있음 (answer는 항상 빈 배열)
    const list = data?.items?.[0] || data?.answer || [];
    const result = list.map(([kw]) => String(kw || '').trim()).filter(Boolean);
    console.log(`[autoComplete] "${keyword}" → ${result.length}개:`, result);
    return result;
  } catch (err) {
    console.warn(`[autoComplete] "${keyword}" 실패:`, err.message);
    return [];
  }
}

// DB 갱신 job용 — 단일 키워드의 이번달 검색량만 가져옴
export async function fetchKeywordVolume(keyword) {
  const rows = await fetchNaverKeywordTool(keyword);
  const clean = normalizeText(keyword);
  const row = rows.find((r) => normalizeText(r.relKeyword || '') === clean) || rows[0];
  if (!row) return null;
  return {
    pcSearch:     parseNaverNumber(row.monthlyPcQcCnt),
    mobileSearch: parseNaverNumber(row.monthlyMobileQcCnt),
  };
}

export async function analyzeKeyword(baseKeyword) {
  try {
    const { hints, serpSignals } = await deriveAnalysisHints(baseKeyword);

    const settled = await Promise.allSettled(
      hints.map(async (hint) => ({
        hint,
        rows: await fetchNaverKeywordTool(hint)
      }))
    );
    const responses = settled
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);

    // SERP 신호 정규화 세트 — 부스트 판별용
    const serpSignalSet = new Set(serpSignals.map(s => normalizeText(s)));

    const allNormalized = dedupeKeywords(
      responses.flatMap(({ hint, rows }) =>
        rows.map((row) => {
          const normalized = normalizeKeywordRow(row, baseKeyword, hint);
          // SERP 신호(자동완성/연관검색어)에 포함된 키워드는 연관도 부스트
          if (serpSignalSet.has(normalizeText(normalized.keyword))) {
            normalized.relevanceScore = Math.min(100, normalized.relevanceScore + 15);
          }
          return normalized;
        })
      )
    );

    const keywords = sortKeywordRows(baseKeyword, allNormalized);

    // chips: SERP 신호 기반 (자동완성 + 연관검색어)
    const searchSuggestions = serpSignals.length > 0
      ? buildSerpChips(serpSignals, baseKeyword)
      : buildSearchSuggestions(keywords, baseKeyword);

    // SERP 키워드 테이블 — 실제 SERP 신호 기반, 없으면 API 결과에서 base 시작 키워드 폴백
    const serpKeywords = extractSerpKeywords(allNormalized, serpSignals, baseKeyword);

    return {
      baseKeyword,
      summary: buildSummary(keywords),
      searchSuggestions,
      serpKeywords,
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

    // Autocomplete for each seed — discovers intent-suffix variants
    const acSettled = await Promise.allSettled(normalizedSeedKeywords.map(fetchNaverAutoComplete));
    const acSuggestions = acSettled.flatMap((r) => r.status === 'fulfilled' ? r.value : []);

    // If autocomplete is blocked, fall back to intent-suffix combinations on each seed
    const intentHints = acSuggestions.length === 0
      ? normalizedSeedKeywords.flatMap((seed) => {
          const clean = sanitizeNaverHintKeyword(seed);
          return INTENT_SUFFIXES.slice(0, 4).map((suffix) => clean + suffix);
        })
      : acSuggestions;

    const maxExpansionQueries = highQuality ? 6 : 8;
    const uniqueExpansionQueries = [
      ...new Set([
        ...expansionQueries.map((seed) => sanitizeNaverHintKeyword(seed)).filter(Boolean),
        ...intentHints.map((kw) => sanitizeNaverHintKeyword(kw)).filter(Boolean),
      ])
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
