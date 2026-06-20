import { createClient } from '@supabase/supabase-js';
import { getPool } from '../db/index.js';

// 베이직 플랜 일별 한도
const BASIC_LIMITS = {
  keyword_analyze:  10,
  blog_structure:    3,
  blog_audit:        3,
  rank_refresh:      2,
};

// 프리미엄 플랜 일별 한도
const PREMIUM_LIMITS = {
  keyword_analyze:  300,
  blog_structure:    50,
  blog_audit:        20,
  rank_refresh:      10,
};

export const ADMIN_EMAILS = ['qkrwlgh52660724@gmail.com'];

// 분당 15회 rate limit (프리미엄 전용, 인메모리)
// { userId: [timestamp, ...] }
const minuteWindows = new Map();

function checkMinuteRate(userId) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxPerMinute = 15;

  const timestamps = (minuteWindows.get(userId) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxPerMinute) return false;
  timestamps.push(now);
  minuteWindows.set(userId, timestamps);
  return true;
}

// 토큰이 있으면 userId 세팅, 없으면 그냥 통과 (비로그인 허용)
export async function optionalAuth(req, _res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return next();
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
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
    }
  } catch { /* 인증 실패해도 non-blocking */ }
  next();
}

// 사용량 체크 + 카운트 증가
// action: 'keyword_analyze' | 'blog_structure' | 'blog_audit' | 'rank_refresh'
export function checkDailyLimit(action) {
  return async (req, res, next) => {
    const userId = req.userId;
    if (!userId) return next();
    if (req.isAdmin) return next();

    const pool = getPool();
    if (!pool) return next();

    // KST 기준 오늘 날짜
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

    try {
      if (req.isSubscribed) {
        // 프리미엄: 분당 15회 체크
        if (action === 'keyword_analyze') {
          if (!checkMinuteRate(userId)) {
            return res.status(429).json({
              message: '분당 최대 15회까지 요청할 수 있습니다. 잠시 후 다시 시도해 주세요.',
              limitExceeded: true,
              action,
              rateLimitType: 'perMinute',
            });
          }
        }

        // 프리미엄: 일별 한도 체크
        const max = PREMIUM_LIMITS[action];
        if (max) {
          const { rows } = await pool.query(
            `SELECT count FROM daily_usage WHERE user_id = $1 AND action = $2 AND used_date = $3`,
            [userId, action, today]
          );
          const current = rows[0]?.count ?? 0;
          if (current >= max) {
            return res.status(429).json({
              message: `오늘 ${actionLabel(action)} 한도(${max}회)를 초과했습니다. 내일 다시 이용해 주세요.`,
              limitExceeded: true,
              action,
              used: current,
              max,
            });
          }
        }
      } else {
        // 베이직: 일별 한도 체크
        const max = BASIC_LIMITS[action];
        if (!max) return next();

        const { rows } = await pool.query(
          `SELECT count FROM daily_usage WHERE user_id = $1 AND action = $2 AND used_date = $3`,
          [userId, action, today]
        );
        const current = rows[0]?.count ?? 0;

        if (current >= max) {
          return res.status(429).json({
            message: `베이직 플랜의 오늘 ${actionLabel(action)} 한도(${max}회)를 초과했습니다. 프리미엄 플랜으로 업그레이드하면 더 많이 이용할 수 있습니다.`,
            limitExceeded: true,
            action,
            used: current,
            max,
          });
        }
      }

      // 카운트 증가 (upsert)
      await pool.query(
        `INSERT INTO daily_usage (user_id, action, used_date, count)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (user_id, action, used_date)
         DO UPDATE SET count = daily_usage.count + 1`,
        [userId, action, today]
      );

      next();
    } catch (e) {
      console.error('[usageLimit] DB 오류:', e.message);
      next(); // DB 오류 시 막지 않음
    }
  };
}

function actionLabel(action) {
  if (action === 'keyword_analyze') return '키워드 분석';
  if (action === 'blog_structure') return '블로그 구조 분석';
  if (action === 'blog_audit') return '블로그 진단';
  if (action === 'rank_refresh') return '순위 추적 갱신';
  return '요청';
}
