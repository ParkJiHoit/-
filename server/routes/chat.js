import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { matchFaq } from '../services/chatFaqService.js';

const router = Router();

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ message: '로그인이 필요합니다.' });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ message: '인증에 실패했습니다.' });
    req.userId = user.id;
    next();
  } catch {
    res.status(401).json({ message: '인증에 실패했습니다.' });
  }
}

router.use(requireAuth);

// 남용 방지용 인메모리 슬라이딩 윈도우(DB 미사용, 서버 재시작 시 리셋).
const MAX_MESSAGES_PER_MINUTE = 30;
const recentTimestamps = new Map();

function checkMessageRate(userId) {
  const now = Date.now();
  const timestamps = (recentTimestamps.get(userId) || []).filter(t => now - t < 60_000);
  if (timestamps.length >= MAX_MESSAGES_PER_MINUTE) return false;
  timestamps.push(now);
  recentTimestamps.set(userId, timestamps);
  return true;
}

router.post('/message', (req, res) => {
  const { message } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ message: '메시지를 입력해 주세요.' });
  }
  if (message.length > 500) {
    return res.status(400).json({ message: '메시지가 너무 깁니다.' });
  }
  if (!checkMessageRate(req.userId)) {
    return res.status(429).json({ message: '잠시 후 다시 시도해 주세요.' });
  }

  const result = matchFaq(message);
  res.json({ answer: result.answer, matched: result.matched, faqId: result.faqId });
});

export default router;
