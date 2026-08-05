import { getPool } from '../db/index.js';

const TRIAL_DAYS = 7;

// 구독 상태를 조회한다. 구독 레코드가 아예 없는 유저는(=한 번도 결제/체험 이력이 없음)
// 가입일(createdAt) 기준으로 7일 무료체험 레코드를 자동 생성해 준다. 예전에 가입한
// 유저가 뒤늦게 이 로직을 처음 타더라도 createdAt+7일이 이미 과거라 바로 만료 상태로
// 생성되므로, 신규 가입자만 실질적으로 체험 혜택을 받는다.
export async function getSubscriptionStatus(userId, createdAt) {
  const pool = getPool();
  if (!pool) return { status: 'none', isSubscribed: false };

  let { rows } = await pool.query(
    `SELECT status, current_period_end FROM subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  if (!rows.length) {
    const trialEnd = new Date(new Date(createdAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO subscriptions (user_id, ls_subscription_id, status, current_period_end)
       VALUES ($1, $2, 'trialing', $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, `trial-${userId}`, trialEnd]
    );
    ({ rows } = await pool.query(
      `SELECT status, current_period_end FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [userId]
    ));
  }

  const status = rows[0]?.status || 'none';
  const periodEnd = rows[0]?.current_period_end;
  const isSubscribed = status === 'active' || (status === 'trialing' && periodEnd != null && new Date(periodEnd) > new Date());
  return { status, isSubscribed };
}

// 관리자가 특정 이메일 계정을 결제 없이 프리미엄으로 전환한다(체험판 부여, 지인/
// 초대 유저 등). auth.users는 이 앱의 DB(=Supabase 프로젝트의 Postgres)에 함께
// 있으므로 별도 Admin API 없이 직접 조회한다. status='active'는 만료일과 무관하게
// 항상 프리미엄으로 취급되므로(getSubscriptionStatus 참고) current_period_end는
// 필요 없다.
export async function grantPremiumByEmail(email) {
  const pool = getPool();
  if (!pool) throw Object.assign(new Error('DB가 설정되어 있지 않습니다.'), { status: 503 });
  const trimmed = String(email || '').trim().toLowerCase();
  if (!trimmed) throw Object.assign(new Error('이메일을 입력해 주세요.'), { status: 400 });

  const { rows: userRows } = await pool.query(
    `SELECT id, email FROM auth.users WHERE lower(email) = $1 LIMIT 1`,
    [trimmed]
  );
  if (!userRows.length) {
    throw Object.assign(new Error(`"${trimmed}"로 가입한 계정을 찾을 수 없습니다.`), { status: 404 });
  }
  const { id: userId, email: actualEmail } = userRows[0];

  await pool.query(
    `INSERT INTO subscriptions (user_id, ls_subscription_id, status)
     VALUES ($1, $2, 'active')
     ON CONFLICT (user_id) DO UPDATE SET status = 'active', updated_at = NOW()`,
    [userId, `comp-${userId}`]
  );
  return { userId, email: actualEmail };
}
