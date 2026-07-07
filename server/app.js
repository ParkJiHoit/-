import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db/index.js';
import blogRoutes from './routes/blog.js';
import rankTrackerRoutes from './routes/rankTracker.js';
import jobRoutes from './routes/jobs.js';
import keywordRoutes from './routes/keywords.js';
import webhookRoutes from './routes/webhooks.js';
import billingRoutes from './routes/billing.js';
import feedbackRoutes from './routes/feedback.js';
import chatRoutes from './routes/chat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

const app = express();
const clientOrigin = process.env.CLIENT_ORIGIN;

if (clientOrigin) {
  app.use(cors({ origin: clientOrigin }));
} else if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173' }));
} else {
  app.use(cors());
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
app.use('/api/feedback', feedbackRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/rank-tracker', rankTrackerRoutes);
app.use('/api/jobs', jobRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: '존재하지 않는 API 경로입니다.' });
});

app.use((error, _req, res, _next) => {
  const naverStatus = error.response?.status;

  if (naverStatus === 429 || error.message?.includes('429')) {
    return res.status(503).json({ message: '네이버 API 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.' });
  }
  if (naverStatus === 401 || naverStatus === 403) {
    return res.status(503).json({ message: '네이버 API 인증 오류가 발생했습니다. 관리자에게 문의해 주세요.' });
  }
  if (naverStatus >= 500 || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return res.status(503).json({ message: '네이버 서버가 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요.' });
  }

  const status = error.status || 500;
  res.status(status).json({
    message: error.message || '키워드 분석 중 오류가 발생했습니다.'
  });
});

initDb().catch((err) => console.error('[DB] 초기화 실패:', err.message));

export default app;
