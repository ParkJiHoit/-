import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  listTracked, createTracked, deleteTracked, deleteTrackedBulk, removeTrackedBlogUrl,
  getSnapshots, refreshRanks, mergeTrackedBlogUrls, updateTrackedGroup,
  listGroups, createGroup, renameGroup, deleteGroup, exportSnapshots,
} from '../services/rankTrackerService.js';
import { parseBulkImportText, groupParsedRows } from '../services/bulkImportService.js';
import { checkDailyLimit, ADMIN_EMAILS } from '../middleware/usageLimit.js';
import { getPool } from '../db/index.js';
import { createRefreshJob, processNextChunk, getJobStatus, retryFailedItems } from '../services/refreshJobService.js';

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

function requirePremium(req, res, next) {
  if (!req.isAdmin && !req.isSubscribed) {
    return res.status(403).json({ message: '순위 추적은 프리미엄 플랜 전용 기능입니다.', premiumOnly: true });
  }
  next();
}

async function assertKeywordCapacity(req, additionalCount) {
  if (req.isAdmin) return;
  const pool = getPool();
  if (!pool) return;
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM tracked_keywords WHERE user_id = $1 AND deleted_at IS NULL`,
    [req.userId]
  );
  const current = Number(rows[0]?.cnt || 0);
  const maxKeywords = req.isSubscribed ? 30 : 0;
  if (current + additionalCount > maxKeywords) {
    const err = new Error(
      req.isSubscribed
        ? `프리미엄 플랜은 최대 ${maxKeywords}개의 키워드를 추적할 수 있습니다. (현재 ${current}개)`
        : '순위 추적은 프리미엄 플랜 전용 기능입니다.'
    );
    err.status = 403;
    err.limitExceeded = true;
    throw err;
  }
}

router.get('/', requirePremium, async (req, res, next) => {
  try {
    const data = await listTracked(req.userId);
    res.json(data);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { keyword, mode, blogUrls, groupId } = req.body || {};
    if (!keyword?.trim()) return res.status(400).json({ message: '키워드를 입력해 주세요.' });
    if (!['blog', 'all'].includes(mode)) return res.status(400).json({ message: 'mode는 blog 또는 all이어야 합니다.' });
    if (mode === 'blog' && (!Array.isArray(blogUrls) || !blogUrls.length))
      return res.status(400).json({ message: '블로그 URL을 1개 이상 입력해 주세요.' });

    await assertKeywordCapacity(req, 1);

    const data = await createTracked(req.userId, keyword, mode, blogUrls || [], groupId || null);
    res.status(201).json(data);
  } catch (e) {
    if (e.limitExceeded) return res.status(e.status).json({ message: e.message, limitExceeded: true });
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteTracked(req.userId, Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/bulk-delete', async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: '삭제할 항목을 선택해 주세요.' });
    }
    const deleted = await deleteTrackedBulk(req.userId, ids.map(Number));
    res.json({ deleted });
  } catch (e) { next(e); }
});

router.post('/:id/remove-blog', async (req, res, next) => {
  try {
    const { blogId } = req.body || {};
    if (!blogId) return res.status(400).json({ message: '삭제할 블로그를 선택해 주세요.' });
    const data = await removeTrackedBlogUrl(req.userId, Number(req.params.id), blogId);
    res.json(data);
  } catch (e) { next(e); }
});

router.post('/export', requirePremium, async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: '내보낼 항목을 선택해 주세요.' });
    }
    const rows = await exportSnapshots(req.userId, ids.map(Number));
    res.json(rows);
  } catch (e) { next(e); }
});

router.patch('/:id/group', requirePremium, async (req, res, next) => {
  try {
    const { groupId } = req.body || {};
    const data = await updateTrackedGroup(req.userId, Number(req.params.id), groupId || null);
    res.json(data);
  } catch (e) { next(e); }
});

router.get('/groups', requirePremium, async (req, res, next) => {
  try {
    const data = await listGroups(req.userId);
    res.json(data);
  } catch (e) { next(e); }
});

router.post('/groups', requirePremium, async (req, res, next) => {
  try {
    const data = await createGroup(req.userId, req.body?.name);
    res.status(201).json(data);
  } catch (e) { next(e); }
});

router.patch('/groups/:id', requirePremium, async (req, res, next) => {
  try {
    const data = await renameGroup(req.userId, Number(req.params.id), req.body?.name);
    res.json(data);
  } catch (e) { next(e); }
});

router.delete('/groups/:id', requirePremium, async (req, res, next) => {
  try {
    await deleteGroup(req.userId, Number(req.params.id));
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

router.post('/bulk-import/preview', requirePremium, async (req, res, next) => {
  try {
    const { text, groupId } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ message: '업로드할 내용이 없습니다.' });

    const { rows, errors } = parseBulkImportText(text);

    // 그룹은 서로 독립적으로 추적되므로, "이미 있는 키워드" 판정도 등록 대상 그룹
    // 안에서만 확인한다 — 다른 그룹에 같은 이름의 키워드가 있어도 신규로 취급한다.
    let existingKeywords = new Set();
    const pool = getPool();
    if (pool) {
      const { rows: existing } = await pool.query(
        `SELECT keyword FROM tracked_keywords
         WHERE user_id = $1 AND mode = 'blog' AND group_id IS NOT DISTINCT FROM $2 AND deleted_at IS NULL`,
        [req.userId, groupId || null]
      );
      existingKeywords = new Set(existing.map(r => r.keyword));
    }

    const groups = groupParsedRows(rows, existingKeywords);
    res.json({ groups, errors, newKeywordCount: groups.filter(g => g.isNew).length });
  } catch (e) { next(e); }
});

router.post('/bulk-import/confirm', requirePremium, async (req, res, next) => {
  try {
    const { groups, groupId } = req.body || {};
    if (!Array.isArray(groups) || !groups.length) {
      return res.status(400).json({ message: '등록할 항목이 없습니다.' });
    }

    const pool = getPool();
    if (pool) {
      const { rows: existing } = await pool.query(
        `SELECT keyword FROM tracked_keywords
         WHERE user_id = $1 AND mode = 'blog' AND group_id IS NOT DISTINCT FROM $2 AND deleted_at IS NULL`,
        [req.userId, groupId || null]
      );
      const existingSet = new Set(existing.map(r => r.keyword));
      const newCount = groups.filter(g => !existingSet.has(g.keyword)).length;
      await assertKeywordCapacity(req, newCount);
    }

    let created = 0;
    for (const g of groups) {
      if (!g.keyword?.trim() || !Array.isArray(g.urls) || !g.urls.length) continue;
      await mergeTrackedBlogUrls(req.userId, g.keyword, 'blog', g.urls, groupId || null);
      created++;
    }
    res.status(201).json({ created });
  } catch (e) {
    if (e.limitExceeded) return res.status(e.status).json({ message: e.message, limitExceeded: true });
    next(e);
  }
});

router.post('/refresh-jobs', requirePremium, async (req, res, next) => {
  try {
    const { trackedIds } = req.body || {};
    const job = await createRefreshJob(req.userId, Array.isArray(trackedIds) ? trackedIds : null);
    res.status(201).json(job);
  } catch (e) { next(e); }
});

router.post('/refresh-jobs/:id/process-chunk', requirePremium, async (req, res, next) => {
  try {
    const job = await processNextChunk(req.userId, Number(req.params.id));
    res.json(job);
  } catch (e) { next(e); }
});

router.get('/refresh-jobs/:id', requirePremium, async (req, res, next) => {
  try {
    const job = await getJobStatus(req.userId, Number(req.params.id));
    res.json(job);
  } catch (e) { next(e); }
});

router.post('/refresh-jobs/:id/retry-failed', requirePremium, async (req, res, next) => {
  try {
    const job = await retryFailedItems(req.userId, Number(req.params.id));
    res.status(201).json(job);
  } catch (e) { next(e); }
});

export default router;
