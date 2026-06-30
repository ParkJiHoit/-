import cron from 'node-cron';
import { runRefresh } from './jobs/refreshKeywordHistory.js';
import app from './app.js';

const port = process.env.PORT || 4000;

// 매달 1일 자정 — DB에 저장된 모든 키워드 검색량 갱신
cron.schedule('0 0 1 * *', () => {
  console.log('[cron] 월간 키워드 히스토리 갱신 시작');
  runRefresh().catch((err) => console.error('[cron] 갱신 실패:', err.message));
});

app.listen(port, () => {
  console.log(`Keyword dashboard server listening on port ${port}`);
});
