import { Router } from 'express';
import { getPublicReport } from '../services/reportShareService.js';

const router = Router();

// 로그인 없이 접근 가능한 읽기전용 그룹 리포트 — 클라이언트 공유용.
router.get('/:token', async (req, res, next) => {
  try {
    const report = await getPublicReport(req.params.token);
    if (!report) return res.status(404).json({ message: '존재하지 않거나 만료된 링크입니다.' });
    res.json(report);
  } catch (e) { next(e); }
});

export default router;
