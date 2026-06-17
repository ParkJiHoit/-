import { Router } from 'express';
import crypto from 'crypto';
import { getPool } from '../db/index.js';

const router = Router();

// LemonSqueezy 웹훅 — raw body 필요
router.post('/lemonsqueezy', async (req, res) => {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const signature = req.headers['x-signature'];

  if (secret && signature) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(req.rawBody || '');
    const digest = hmac.digest('hex');
    if (digest !== signature) {
      return res.status(401).json({ message: '서명 불일치' });
    }
  }

  const event = req.headers['x-event-name'];
  const data = req.body?.data;
  const meta = req.body?.meta;

  if (!data) return res.status(400).json({ message: 'body 없음' });

  const userId = meta?.custom_data?.user_id;
  if (!userId) {
    console.warn('[webhook] user_id 없음:', meta);
    return res.status(200).json({ ok: true });
  }

  const attrs = data.attributes || {};
  const lsSubscriptionId = String(data.id);
  const lsCustomerId = String(attrs.customer_id || '');
  const status = attrs.status || 'active';
  const variantId = String(attrs.variant_id || '');
  const currentPeriodEnd = attrs.renews_at ? new Date(attrs.renews_at) : null;

  const pool = getPool();
  if (!pool) return res.status(200).json({ ok: true });

  try {
    if (event === 'subscription_created' || event === 'subscription_updated') {
      await pool.query(
        `INSERT INTO subscriptions (user_id, ls_subscription_id, ls_customer_id, status, variant_id, current_period_end, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET
           ls_subscription_id = EXCLUDED.ls_subscription_id,
           ls_customer_id     = EXCLUDED.ls_customer_id,
           status             = EXCLUDED.status,
           variant_id         = EXCLUDED.variant_id,
           current_period_end = EXCLUDED.current_period_end,
           updated_at         = NOW()`,
        [userId, lsSubscriptionId, lsCustomerId, status, variantId, currentPeriodEnd]
      );
      console.log(`[webhook] 구독 ${event} — user: ${userId}, status: ${status}`);
    } else if (event === 'subscription_cancelled') {
      await pool.query(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE user_id = $1`,
        [userId]
      );
      console.log(`[webhook] 구독 취소 — user: ${userId}`);
    }
  } catch (e) {
    console.error('[webhook] DB 오류:', e.message);
  }

  res.status(200).json({ ok: true });
});

export default router;
