import express from 'express';
import { analyzeBlogKeyword } from '../services/naverBlogService.js';
import { analyzeBlogStructure } from '../services/blogStructureService.js';
import { auditBlog } from '../services/blogAuditService.js';
import { optionalAuth, checkDailyLimit } from '../middleware/usageLimit.js';

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

router.post('/structure-analysis', optionalAuth, checkDailyLimit('blog_audit'), async (req, res, next) => {
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

router.post('/audit', optionalAuth, checkDailyLimit('blog_audit'), async (req, res, next) => {
  try {
    const url = String(req.body?.url || '').trim();
    if (!url) return res.status(400).json({ message: '블로그 URL을 입력해 주세요.' });
    console.log(`[blog-audit] → "${url}"`);
    const data = await auditBlog(url);
    console.log(`[blog-audit] ✓ "${data.blogId}" score=${data.score.total} grade=${data.score.grade}`);
    res.json(data);
  } catch (error) {
    console.error(`[blog-audit] ✗ ${error.message}`);
    next(error);
  }
});

export default router;
