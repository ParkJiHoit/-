import { Router } from 'express';
import { getPool } from '../db/index.js';

const router = Router();

router.post('/', async (req, res) => {
  const { type, content, email } = req.body || {};
  if (!type || !content?.trim()) {
    return res.status(400).json({ message: '내용을 입력해주세요.' });
  }

  const pool = getPool();
  if (!pool) return res.status(500).json({ message: 'DB 연결 없음' });

  try {
    await pool.query(
      `INSERT INTO feedback (type, content, email, created_at) VALUES ($1, $2, $3, NOW())`,
      [type, content.trim(), email || null]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[feedback] DB 오류:', e.message);
    res.status(500).json({ message: '저장 중 오류가 발생했습니다.' });
  }
});

export default router;
