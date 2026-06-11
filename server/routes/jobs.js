import { Router } from 'express';
import { runRefresh } from '../jobs/refreshKeywordHistory.js';

const router = Router();

// POST /api/jobs/refresh
// Authorization: Bearer {JOB_SECRET}
// → Render Cron, GitHub Actions, cron-job.org 등 어디서든 호출 가능
router.post('/refresh', async (req, res) => {
  const secret = process.env.JOB_SECRET;
  const auth   = req.headers.authorization?.replace('Bearer ', '');

  if (!secret || auth !== secret) {
    return res.status(401).json({ message: '인증 실패' });
  }

  // 즉시 응답 후 백그라운드 실행 (타임아웃 방지)
  res.json({ message: '갱신 시작됨' });

  try {
    const result = await runRefresh();
    console.log('[jobs/refresh] 결과:', result);
  } catch (err) {
    console.error('[jobs/refresh] 오류:', err.message);
  }
});

export default router;
