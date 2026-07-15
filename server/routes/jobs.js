import { Router } from 'express';
import { runRefresh } from '../jobs/refreshKeywordHistory.js';
import { runScheduledRankRefresh } from '../jobs/refreshTrackedRanks.js';

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

// GET /api/jobs/refresh-ranks
// Vercel Cron이 이 경로를 GET으로 호출하며, CRON_SECRET 환경변수가 설정돼 있으면
// Authorization: Bearer {CRON_SECRET} 헤더를 자동으로 붙여준다. JOB_SECRET으로도
// (외부 스케줄러 등에서) 수동 호출 가능하도록 둘 다 허용한다.
// Vercel 서버리스에서는 응답 후 백그라운드 실행이 보장되지 않으므로, 시간 예산 안에서
// 끝까지 처리한 뒤에 응답한다(runScheduledRankRefresh 자체가 예산을 넘기지 않게 멈춘다).
router.get('/refresh-ranks', async (req, res, next) => {
  const auth = req.headers.authorization?.replace('Bearer ', '');
  const authorized = (process.env.CRON_SECRET && auth === process.env.CRON_SECRET)
    || (process.env.JOB_SECRET && auth === process.env.JOB_SECRET);

  if (!authorized) {
    return res.status(401).json({ message: '인증 실패' });
  }

  try {
    const result = await runScheduledRankRefresh();
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
