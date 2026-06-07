import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import keywordRoutes from './routes/keywords.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.resolve(__dirname, '..', 'client', 'dist');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/keywords', keywordRoutes);

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    message: error.message || '키워드 분석 중 오류가 발생했습니다.'
  });
});

app.listen(port, () => {
  console.log(`Keyword dashboard server listening on port ${port}`);
});
