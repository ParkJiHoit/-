import { Router } from 'express';
import { analyzeKeywordInsights } from '../services/naverDatalabService.js';
import { analyzeKeyword, expandKeyword } from '../services/naverKeywordService.js';
import { getSearchHistory, recordMonthlySearch } from '../services/keywordHistoryService.js';
import { fetchContentCounts } from '../services/naverSearchService.js';
import { fetchBlogRankings } from '../services/blogRankingService.js';

const router = Router();

function normalizeWordArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((word) => String(word || '').trim()).filter(Boolean).slice(0, 5);
}

router.post('/analyze', async (req, res, next) => {
  try {
    const keyword = String(req.body?.keyword || '').trim();

    if (!keyword) {
      return res.status(400).json({ message: '분석할 키워드를 입력해 주세요.' });
    }

    const result = await analyzeKeyword(keyword);
    console.log(`[analyze] ✓ "${keyword}" → ${result.keywords?.length} keywords`);

    // 베이스 키워드 행 찾아서 이달 검색량 DB에 기록 (비동기, 응답 블락 안 함)
    const baseRow = result.keywords?.find(
      (r) => r.keyword?.toLowerCase().replace(/\s+/g, '') === keyword.toLowerCase().replace(/\s+/g, '')
    ) || result.keywords?.[0];
    if (baseRow) {
      recordMonthlySearch(keyword, baseRow.monthlyPcSearch, baseRow.monthlyMobileSearch);
    }

    res.json(result);
  } catch (error) {
    console.error(`[analyze] ✗ "${req.body?.keyword}" → ${error.status || 500}: ${error.message}`);
    next(error);
  }
});

router.post('/expand', async (req, res, next) => {
  try {
    const seedKeywords = normalizeWordArray(req.body?.seedKeywords);
    const legacyBaseKeyword = String(req.body?.baseKeyword || '').trim();
    const normalizedSeedKeywords = seedKeywords.length ? seedKeywords : [legacyBaseKeyword].filter(Boolean);

    if (!normalizedSeedKeywords.length) {
      return res.status(400).json({ message: '확장할 시드 키워드를 입력해 주세요.' });
    }

    const result = await expandKeyword({
      seedKeywords: normalizedSeedKeywords.slice(0, 3),
      includeWords: normalizeWordArray(req.body?.includeWords),
      excludeWords: normalizeWordArray(req.body?.excludeWords),
      highQuality: Boolean(req.body?.highQuality)
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/insights', async (req, res, next) => {
  try {
    const keyword = String(req.query?.keyword || '').trim();
    if (!keyword) return res.status(400).json({ message: '키워드를 입력해 주세요.' });
    console.log(`[insights] → "${keyword}"`);
    const [result, searchHistory, contentCounts] = await Promise.all([
      analyzeKeywordInsights(keyword),
      getSearchHistory(keyword),
      fetchContentCounts(keyword),
    ]);
    console.log(`[insights] ✓ trend=${result.trend?.length}pts history=${searchHistory.length}개월 blog=${contentCounts.blog}`);
    res.json({ ...result, searchHistory, contentCounts });
  } catch (error) {
    console.error(`[insights] ✗ ${error.status || 500}: ${error.message}`);
    next(error);
  }
});

router.get('/blog-rankings', async (req, res, next) => {
  try {
    const keyword = String(req.query?.keyword || '').trim();
    if (!keyword) return res.status(400).json({ message: '키워드를 입력해 주세요.' });
    console.log(`[blog-rankings] → "${keyword}"`);
    const rankings = await fetchBlogRankings(keyword);
    console.log(`[blog-rankings] ✓ ${rankings.length}개`);
    res.json(rankings);
  } catch (error) {
    console.error(`[blog-rankings] ✗ ${error.message}`);
    next(error);
  }
});

export default router;
