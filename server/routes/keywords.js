import { Router } from 'express';
import { analyzeKeyword } from '../services/naverKeywordService.js';

const router = Router();

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

export default router;
