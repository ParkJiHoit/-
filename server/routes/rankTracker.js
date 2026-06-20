import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  listTracked, createTracked, deleteTracked,
  getSnapshots, refreshRanks,
} from '../services/rankTrackerService.js';
import { checkDailyLimit, ADMIN_EMAILS } from '../middleware/usageLimit.js';
import { getPool } from '../db/index.js';

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
    req.isAdmin = ADMIN_EMAILS.includes(user.email);
    if (!req.isAdmin) {
      const pool = getPool();
      if (pool) {
        const { rows } = await pool.query(
          `SELECT status FROM subscriptions WHERE user_id = $1 LIMIT 1`,
          [user.id]
        );
        const s = rows[0]?.status;
        req.isSubscribed = s === 'active' || s === 'trialing';
      }
    }
    next();
  } catch {
    res.status(401).json({ message: '인증에 실패했습니다.' });
  }
}

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  if (!req.isAdmin && !req.isSubscribed) {
    return res.status(403).json({ message: '순위 추적은 프리미엄 플랜 전용 기능입니다.', premiumOnly: true });
  }
  try {
    const data = await listTracked(req.userId);
    res.json(data);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { keyword, mode, blogUrls } = req.body || {};
    if (!keyword?.trim()) return res.status(400).json({ message: '키워드를 입력해 주세요.' });
    if (!['blog', 'all'].includes(mode)) return res.status(400).json({ message: 'mode는 blog 또는 all이어야 합니다.' });
    if (mode === 'blog' && (!Array.isArray(blogUrls) || !blogUrls.length))
      return res.status(400).json({ message: '블로그 URL을 1개 이상 입력해 주세요.' });

    // 프리미엄: 최대 30개 키워드 제한
    if (!req.isAdmin) {
      const pool = getPool();
      if (pool) {
        const { rows } = await pool.query(
          `SELECT COUNT(*) AS cnt FROM rank_tracked WHERE user_id = $1`,
          [req.userId]
        );
        const maxKeywords = req.isSubscribed ? 30 : 0;
        if (Number(rows[0]?.cnt) >= maxKeywords) {
          const msg = req.isSubscribed
            ? '프리미엄 플랜은 최대 30개의 키워드를 추적할 수 있습니다.'
            : '순위 추적은 프리미엄 플랜 전용 기능입니다.';
          return res.status(403).json({ message: msg, limitExceeded: true });
        }
      }
    }

    const data = await createTracked(req.userId, keyword, mode, blogUrls || []);
    res.status(201).json(data);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteTracked(req.userId, Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/refresh', checkDailyLimit('rank_refresh'), async (req, res, next) => {
  try {
    const data = await refreshRanks(req.userId, Number(req.params.id));
    res.json(data);
  } catch (e) { next(e); }
});

router.get('/:id/snapshots', async (req, res, next) => {
  try {
    const data = await getSnapshots(req.userId, Number(req.params.id));
    res.json(data);
  } catch (e) { next(e); }
});

export default router;
