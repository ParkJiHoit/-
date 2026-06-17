import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  listTracked, createTracked, deleteTracked,
  getSnapshots, refreshRanks,
} from '../services/rankTrackerService.js';
import { checkDailyLimit, ADMIN_EMAILS } from '../middleware/usageLimit.js';

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
    next();
  } catch {
    res.status(401).json({ message: '인증에 실패했습니다.' });
  }
}

router.use(requireAuth);

router.get('/', async (req, res, next) => {
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
