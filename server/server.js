import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { initDb } from './db/index.js';
import { runRefresh } from './jobs/refreshKeywordHistory.js';
import blogRoutes from './routes/blog.js';
import rankTrackerRoutes from './routes/rankTracker.js';
import jobRoutes from './routes/jobs.js';
import keywordRoutes from './routes/keywords.js';
import webhookRoutes from './routes/webhooks.js';
import billingRoutes from './routes/billing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.resolve(__dirname, '..', 'client', 'dist');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

const app = express();
const port = process.env.PORT || 4000;
const clientOrigin = process.env.CLIENT_ORIGIN;

if (clientOrigin) {
  app.use(cors({ origin: clientOrigin }));
} else if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173' }));
}
// 웹훅용 raw body 보존
app.use((req, _res, next) => {
  express.json({
    verify: (req, _res, buf) => { req.rawBody = buf.toString(); }
  })(req, _res, next);
});

app.use('/api/webhooks', webhookRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/keywords', keywordRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/rank-tracker', rankTrackerRoutes);
app.use('/api/jobs', jobRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: '존재하지 않는 API 경로입니다.' });
});

if (fs.existsSync(clientDistPath)) {
  app.use(
    '/assets',
    express.static(path.join(clientDistPath, 'assets'), {
      immutable: true,
      maxAge: '1y'
    })
  );

  app.get('*', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    message: error.message || '키워드 분석 중 오류가 발생했습니다.'
  });
});

initDb().catch((err) => console.error('[DB] 초기화 실패:', err.message));

// 매달 1일 자정 — DB에 저장된 모든 키워드 검색량 갱신
cron.schedule('0 0 1 * *', () => {
  console.log('[cron] 월간 키워드 히스토리 갱신 시작');
  runRefresh().catch((err) => console.error('[cron] 갱신 실패:', err.message));
});

app.listen(port, () => {
  console.log(`Keyword dashboard server listening on port ${port}`);
});
