import crypto from 'crypto';
import { getPool } from '../db/index.js';
import { listTracked } from './rankTrackerService.js';

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export async function getShareForGroup(userId, groupId) {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT token FROM report_shares WHERE user_id = $1 AND group_id = $2 AND revoked_at IS NULL`,
    [userId, groupId]
  );
  return rows.length ? { token: rows[0].token } : null;
}

export async function createShareForGroup(userId, groupId) {
  const pool = getPool();
  if (!pool) throw Object.assign(new Error('DB가 설정되어 있지 않습니다.'), { status: 500 });

  const { rows: groupRows } = await pool.query(
    `SELECT id FROM tracker_groups WHERE id = $1 AND user_id = $2`,
    [groupId, userId]
  );
  if (!groupRows.length) throw Object.assign(new Error('그룹을 찾을 수 없습니다.'), { status: 404 });

  // 이미 활성 공유 링크가 있으면 그대로 재사용(버튼을 여러 번 눌러도 링크가 안 바뀌게).
  // 예전에 만들었다가 해지한 적이 있으면 새 토큰으로 재발급한다(예전 링크는 계속 무효).
  const existing = await pool.query(
    `SELECT token, revoked_at FROM report_shares WHERE user_id = $1 AND group_id = $2`,
    [userId, groupId]
  );
  if (existing.rows.length && !existing.rows[0].revoked_at) {
    return { token: existing.rows[0].token };
  }

  const token = generateToken();
  if (existing.rows.length) {
    await pool.query(
      `UPDATE report_shares SET token = $1, revoked_at = NULL, created_at = NOW() WHERE user_id = $2 AND group_id = $3`,
      [token, userId, groupId]
    );
  } else {
    await pool.query(
      `INSERT INTO report_shares (token, user_id, group_id) VALUES ($1, $2, $3)`,
      [token, userId, groupId]
    );
  }
  return { token };
}

export async function revokeShareForGroup(userId, groupId) {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `UPDATE report_shares SET revoked_at = NOW() WHERE user_id = $1 AND group_id = $2 AND revoked_at IS NULL`,
    [userId, groupId]
  );
}

// 로그인 없이 공개되는 리포트 — 계정 정보나 다른 그룹은 절대 노출하지 않고,
// 이미 엑셀 내보내기로도 공유 가능한 수준(키워드·블로그·순위)의 데이터만 반환한다.
export async function getPublicReport(token) {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT rs.user_id, rs.group_id, tg.name AS group_name
     FROM report_shares rs
     JOIN tracker_groups tg ON tg.id = rs.group_id
     WHERE rs.token = $1 AND rs.revoked_at IS NULL`,
    [token]
  );
  if (!rows.length) return null;
  const { user_id: userId, group_id: groupId, group_name: groupName } = rows[0];

  const all = await listTracked(userId);
  const items = all
    .filter((i) => i.group_id === groupId)
    .map((i) => ({
      keyword: i.keyword,
      mode: i.mode,
      blog_ids: i.blog_ids,
      latestRanks: i.latestRanks,
      searchVolume: i.searchVolume,
    }));

  return { groupName, items };
}
