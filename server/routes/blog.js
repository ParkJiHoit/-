import express from 'express';
import { analyzeBlogKeyword } from '../services/naverBlogService.js';

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

export default router;
