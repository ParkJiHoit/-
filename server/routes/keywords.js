import { Router } from 'express';
import { analyzeKeyword, expandKeyword } from '../services/naverKeywordService.js';

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
    res.json(result);
  } catch (error) {
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

export default router;
