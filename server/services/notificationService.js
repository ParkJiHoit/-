import { getPool } from '../db/index.js';

function isValidSlackWebhookUrl(url) {
  return typeof url === 'string' && /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+$/.test(url.trim());
}

export async function getNotificationSettings(userId) {
  const pool = getPool();
  if (!pool) return { slackWebhookUrl: null, slackEnabled: true };
  const { rows } = await pool.query(
    `SELECT slack_webhook_url, slack_enabled FROM notification_settings WHERE user_id = $1`,
    [userId]
  );
  if (!rows.length) return { slackWebhookUrl: null, slackEnabled: true };
  return { slackWebhookUrl: rows[0].slack_webhook_url, slackEnabled: rows[0].slack_enabled };
}

export async function saveNotificationSettings(userId, { slackWebhookUrl, slackEnabled }) {
  const pool = getPool();
  if (!pool) throw Object.assign(new Error('DB가 설정되어 있지 않습니다.'), { status: 500 });

  const trimmed = (slackWebhookUrl || '').trim();
  if (trimmed && !isValidSlackWebhookUrl(trimmed)) {
    throw Object.assign(
      new Error('올바른 Slack Incoming Webhook URL이 아닙니다. (https://hooks.slack.com/services/... 형식)'),
      { status: 400 }
    );
  }

  await pool.query(
    `INSERT INTO notification_settings (user_id, slack_webhook_url, slack_enabled, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       slack_webhook_url = EXCLUDED.slack_webhook_url,
       slack_enabled = EXCLUDED.slack_enabled,
       updated_at = NOW()`,
    [userId, trimmed || null, slackEnabled !== false]
  );
  return getNotificationSettings(userId);
}

async function sendSlackMessage(webhookUrl, text) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw Object.assign(new Error(`Slack 전송 실패 (${res.status}) ${body}`), { status: 502 });
  }
}

// overrideWebhookUrl이 있으면(저장 전 입력값 테스트) 그 값을 우선 사용하고,
// 없으면 이미 저장된 웹훅으로 테스트한다.
export async function sendTestSlackMessage(userId, overrideWebhookUrl) {
  const trimmed = (overrideWebhookUrl || '').trim();
  let webhookUrl = trimmed;
  if (webhookUrl && !isValidSlackWebhookUrl(webhookUrl)) {
    throw Object.assign(
      new Error('올바른 Slack Incoming Webhook URL이 아닙니다. (https://hooks.slack.com/services/... 형식)'),
      { status: 400 }
    );
  }
  if (!webhookUrl) {
    const settings = await getNotificationSettings(userId);
    webhookUrl = settings.slackWebhookUrl;
  }
  if (!webhookUrl) {
    throw Object.assign(new Error('먼저 Slack 웹훅 URL을 입력해 주세요.'), { status: 400 });
  }
  await sendSlackMessage(
    webhookUrl,
    '✅ RANKLET 순위 변동 알림 테스트입니다. 이 메시지가 보이면 연동이 정상 작동합니다.'
  );
}

// 갱신 전/후 스냅샷을 비교해 "5위 진입/이탈", "통합검색 노출 시작/종료" 변화만 뽑아낸다.
// previousByBlog는 이번 갱신 직전(직전 스냅샷) 상태, upserts는 이번에 새로 저장하는 값이다.
export function diffRankChanges(previousByBlog, upserts) {
  const changes = [];
  for (const u of upserts) {
    if (u.status === 'fetch_failed') continue;
    const prev = previousByBlog.get(u.blog_id);
    const wasRanked = prev?.status === 'ranked';
    const isRanked = u.status === 'ranked';
    if (!wasRanked && isRanked) changes.push({ blogId: u.blog_id, kind: 'rank_in', rank: u.rank });
    else if (wasRanked && !isRanked) changes.push({ blogId: u.blog_id, kind: 'rank_out' });

    const wasExposed = prev?.integrated_exposed === true;
    const isExposed = u.integrated_exposed === true;
    if (!wasExposed && isExposed) changes.push({ blogId: u.blog_id, kind: 'integrated_in' });
    else if (wasExposed && !isExposed) changes.push({ blogId: u.blog_id, kind: 'integrated_out' });
  }
  return changes;
}

export function formatChangeMessage(keyword, changes, isFavorite) {
  const lines = changes.map((c) => {
    if (c.kind === 'rank_in') return `🟢 *${c.blogId}* 가 *${c.rank}위*로 5위 안에 진입했습니다.`;
    if (c.kind === 'rank_out') return `🔴 *${c.blogId}* 가 5위 밖으로 이탈했습니다.`;
    if (c.kind === 'integrated_in') return `🔵 *${c.blogId}* 통합검색 노출이 시작됐습니다.`;
    if (c.kind === 'integrated_out') return `⚪ *${c.blogId}* 통합검색 노출이 사라졌습니다.`;
    return '';
  }).filter(Boolean);
  // 즐겨찾기(핵심 키워드)는 별 이모지 + "핵심 키워드" 라벨로 다른 알림과 구분되게 강조한다.
  const title = isFavorite
    ? `⭐ *[${keyword}]* 핵심 키워드 순위 변동 알림 ⭐`
    : `*[${keyword}]* 순위 변동 알림`;
  return `${title}\n${lines.join('\n')}`;
}

// refreshRanks가 갱신을 마친 뒤 호출한다 — 웹훅 실패가 갱신 자체를 실패시키지 않도록
// 내부에서 에러를 삼키고 로그만 남긴다.
export async function notifyRankChanges(userId, keyword, changes, isFavorite = false) {
  if (!changes.length) return;
  try {
    const settings = await getNotificationSettings(userId);
    if (!settings.slackEnabled || !settings.slackWebhookUrl) return;
    await sendSlackMessage(settings.slackWebhookUrl, formatChangeMessage(keyword, changes, isFavorite));
  } catch (e) {
    console.error('[notification] Slack 전송 실패:', e.message);
  }
}
