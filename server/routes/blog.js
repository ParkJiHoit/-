import express from 'express';
import { analyzeBlogKeyword } from '../services/naverBlogService.js';
import { analyzeBlogStructure } from '../services/blogStructureService.js';

const router = express.Router();

router.post('/analyze', async (req, res, next) => {
  try {
    const { keyword, months } = req.body || {};
    const data = await analyzeBlogKeyword({ keyword, months });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post('/structure-analysis', async (req, res, next) => {
  try {
    const keyword = String(req.body?.keyword || '').trim();
    if (!keyword) return res.status(400).json({ message: '키워드를 입력해 주세요.' });
    console.log(`[blog-structure] → "${keyword}"`);
    const data = await analyzeBlogStructure(keyword);
    console.log(`[blog-structure] ✓ "${keyword}" posts=${data.posts?.length}`);
    res.json(data);
  } catch (error) {
    console.error(`[blog-structure] ✗ ${error.message}`);
    next(error);
  }
});

export default router;
