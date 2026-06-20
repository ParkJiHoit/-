import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_EMAILS } from '../middleware/usageLimit.js';
import { getPool } from '../db/index.js';

const router = Router();

async function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ message: '로그인이 필요합니다.' });
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ message: '인증에 실패했습니다.' });
    req.userId = user.id;
    req.userEmail = user.email;
    req.isAdmin = ADMIN_EMAILS.includes(user.email);
    next();
  } catch {
    res.status(401).json({ message: '인증에 실패했습니다.' });
  }
}

// 체크아웃 URL 생성
router.post('/checkout', requireAuth, async (req, res) => {
  const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;

  if (!variantId || !apiKey) {
    return res.status(500).json({ message: '결제 설정이 누락되었습니다.' });
  }

  try {
    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              email: req.userEmail,
              custom: {
                user_id: req.userId,
              },
            },
            product_options: {
              redirect_url: `${process.env.CLIENT_ORIGIN || 'https://kiweodeu-bunseog-tul.onrender.com'}/payment-success`,
            },
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: String(process.env.LEMONSQUEEZY_STORE_ID),
              },
            },
            variant: {
              data: {
                type: 'variants',
                id: String(variantId),
              },
            },
          },
        },
      }),
    });

    const json = await response.json();
    const checkoutUrl = json?.data?.attributes?.url;

    if (!checkoutUrl) {
      console.error('[billing] 체크아웃 URL 없음:', JSON.stringify(json));
      return res.status(500).json({ message: '결제 URL 생성에 실패했습니다.' });
    }

    res.json({ url: checkoutUrl });
  } catch (e) {
    console.error('[billing] 오류:', e.message);
    res.status(500).json({ message: '결제 요청 중 오류가 발생했습니다.' });
  }
});

// 구독 상태 조회
router.get('/status', requireAuth, async (req, res) => {
  if (req.isAdmin) return res.json({ status: 'admin', isSubscribed: true });
  try {
    const pool = getPool();
    if (!pool) return res.json({ status: 'none', isSubscribed: false });
    const { rows } = await pool.query(
      `SELECT status FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [req.userId]
    );
    const status = rows[0]?.status || 'none';
    const isSubscribed = status === 'active' || status === 'trialing';
    res.json({ status, isSubscribed });
  } catch (e) {
    console.error('[billing/status] 오류:', e.message);
    res.json({ status: 'none', isSubscribed: false });
  }
});

export default router;
