import { createClient } from '@supabase/supabase-js';
import { getPool } from '../db/index.js';

// 베이직 플랜 일별 한도
const BASIC_LIMITS = {
  keyword_analyze:  10,
  blog_audit:        3,
  rank_refresh:      2,
};

export const ADMIN_EMAILS = ['qkrwlgh52660724@gmail.com'];

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
          req.isSubscribed = rows[0]?.status === 'active';
        }
      }
    }
  } catch { /* 인증 실패해도 non-blocking */ }
  next();
}

// 로그인한 베이직 사용자의 오늘 사용량 체크 + 카운트 증가
// action: 'keyword_analyze' | 'blog_audit' | 'rank_refresh'
export function checkDailyLimit(action) {
  return async (req, res, next) => {
    const userId = req.userId;
    if (!userId) return next();
    if (req.isAdmin) return next(); // 관리자 무제한
    if (req.isSubscribed) return next(); // 스탠다드 구독자 무제한

    const pool = getPool();
    if (!pool) return next(); // DB 없으면 skip

    const max = BASIC_LIMITS[action];
    if (!max) return next();

    // KST 기준 오늘 날짜
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

    try {
      // 현재 카운트 조회
      const { rows } = await pool.query(
        `SELECT count FROM daily_usage WHERE user_id = $1 AND action = $2 AND used_date = $3`,
        [userId, action, today]
      );
      const current = rows[0]?.count ?? 0;

      if (current >= max) {
        return res.status(429).json({
          message: `베이직 플랜의 오늘 ${actionLabel(action)} 한도(${max}회)를 초과했습니다. 스탠다드 플랜으로 업그레이드하면 무제한으로 이용할 수 있습니다.`,
          limitExceeded: true,
          action,
          used: current,
          max,
        });
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
  if (action === 'blog_audit') return '블로그 분석';
  if (action === 'rank_refresh') return '순위 추적 갱신';
  return '요청';
}
