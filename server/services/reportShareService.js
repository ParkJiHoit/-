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
    `SELECT token FROM report_shares WHERE user_id = $1 AND group_id IS NOT DISTINCT FROM $2 AND revoked_at IS NULL`,
    [userId, groupId]
  );
  return rows.length ? { token: rows[0].token } : null;
}

export async function createShareForGroup(userId, groupId) {
  const pool = getPool();
  if (!pool) throw Object.assign(new Error('DB가 설정되어 있지 않습니다.'), { status: 500 });

  if (groupId != null) {
    const { rows: groupRows } = await pool.query(
      `SELECT id FROM tracker_groups WHERE id = $1 AND user_id = $2`,
      [groupId, userId]
    );
    if (!groupRows.length) throw Object.assign(new Error('그룹을 찾을 수 없습니다.'), { status: 404 });
  }

  // 이미 활성 공유 링크가 있으면 그대로 재사용(버튼을 여러 번 눌러도 링크가 안 바뀌게).
  // 예전에 만들었다가 해지한 적이 있으면 새 토큰으로 재발급한다(예전 링크는 계속 무효).
  const existing = await pool.query(
    `SELECT token, revoked_at FROM report_shares WHERE user_id = $1 AND group_id IS NOT DISTINCT FROM $2`,
    [userId, groupId]
  );
  if (existing.rows.length && !existing.rows[0].revoked_at) {
    return { token: existing.rows[0].token };
  }

  const token = generateToken();
  if (existing.rows.length) {
    await pool.query(
      `UPDATE report_shares SET token = $1, revoked_at = NULL, created_at = NOW()
       WHERE user_id = $2 AND group_id IS NOT DISTINCT FROM $3`,
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
    `UPDATE report_shares SET revoked_at = NOW()
     WHERE user_id = $1 AND group_id IS NOT DISTINCT FROM $2 AND revoked_at IS NULL`,
    [userId, groupId]
  );
}

// 리포트 공유 시점(report_shares.created_at)으로부터 14일 이전에 등록된 링크는
// "이미 안정화된 옛날 항목"으로 보고 공개 리포트에서 뺀다 — 링크(blog_ids)는
// listTracked()가 계산해주는 latestRanks[blogId].addedDate(링크별 실제 등록일)를
// 기준으로 판단하고, all 모드는 링크 개념이 없어 키워드 자체의 created_at을 쓴다.
export function filterItemsByCutoff(items, cutoffDate) {
  const result = [];
  for (const item of items) {
    if (item.mode === 'all') {
      const itemDate = item.created_at ? new Date(item.created_at).toISOString().slice(0, 10) : null;
      if (itemDate && itemDate >= cutoffDate) result.push(item);
      continue;
    }
    const keptBlogIds = (item.blog_ids || []).filter((blogId) => {
      const addedDate = item.latestRanks?.[blogId]?.addedDate;
      return addedDate && addedDate >= cutoffDate;
    });
    if (!keptBlogIds.length) continue;
    const keptLatestRanks = {};
    for (const blogId of keptBlogIds) keptLatestRanks[blogId] = item.latestRanks[blogId];
    result.push({ ...item, blog_ids: keptBlogIds, latestRanks: keptLatestRanks });
  }
  return result;
}

const NEW_TOP5_THRESHOLD = 5;
const IMPROVED_THRESHOLD = 3;
const MAX_CHANGES = 6;

// 리포트에 포함된 각 링크의 "가장 오래된 스냅샷"과 "가장 최신 스냅샷"을 비교해
// 눈에 띄는 변화(신규 5위 이내 진입, 3계단 이상 상승)만 추려낸다. 전부 나열하면
// 오히려 안 읽히므로 의미 있는 변화만 최대 6개까지 반환한다.
export function computeRankChanges(snapshotPairs) {
  const changes = [];
  for (const p of snapshotPairs) {
    const wasRanked = p.fromStatus === 'ranked' && p.fromRank != null;
    const isRanked = p.toStatus === 'ranked' && p.toRank != null;
    if (!isRanked) continue;
    if (!wasRanked && p.toRank <= NEW_TOP5_THRESHOLD) {
      changes.push({ keyword: p.keyword, blogId: p.blogId, fromRank: p.fromRank, toRank: p.toRank, type: 'new_top5' });
    } else if (wasRanked && p.fromRank - p.toRank >= IMPROVED_THRESHOLD) {
      changes.push({ keyword: p.keyword, blogId: p.blogId, fromRank: p.fromRank, toRank: p.toRank, type: 'improved' });
    }
  }
  return changes.slice(0, MAX_CHANGES);
}

async function fetchGroupNames(pool, userId) {
  const { rows } = await pool.query(
    `SELECT id, name FROM tracker_groups WHERE user_id = $1 ORDER BY name ASC`,
    [userId]
  );
  return rows;
}

// 리포트에 포함된(=컷오프를 통과한) 각 링크의 최초/최신 순위를 비교해 변동사항을 만든다.
// items는 filterItemsByCutoff를 통과한 뒤의 목록 — 즉 이미 "이 리포트에 보일" 링크만 담고 있다.
async function fetchChanges(pool, items) {
  const trackedIds = [...new Set(items.map((i) => i.id))];
  if (!trackedIds.length) return [];

  const [{ rows: earliest }, { rows: latest }] = await Promise.all([
    pool.query(
      `SELECT DISTINCT ON (tracked_id, blog_id) tracked_id, blog_id, rank, status
       FROM rank_snapshots WHERE tracked_id = ANY($1)
       ORDER BY tracked_id, blog_id, snapshotted_at ASC`,
      [trackedIds]
    ),
    pool.query(
      `SELECT DISTINCT ON (tracked_id, blog_id) tracked_id, blog_id, rank, status
       FROM rank_snapshots WHERE tracked_id = ANY($1)
       ORDER BY tracked_id, blog_id, snapshotted_at DESC`,
      [trackedIds]
    ),
  ]);

  const earliestByKey = new Map(earliest.map((r) => [`${r.tracked_id}:${r.blog_id}`, r]));
  const latestByKey = new Map(latest.map((r) => [`${r.tracked_id}:${r.blog_id}`, r]));
  const keywordById = new Map(items.map((i) => [i.id, i.keyword]));

  const pairs = [];
  for (const key of latestByKey.keys()) {
    const [trackedIdStr, blogId] = key.split(':');
    const trackedId = Number(trackedIdStr);
    const from = earliestByKey.get(key);
    const to = latestByKey.get(key);
    if (!to) continue;
    pairs.push({
      keyword: keywordById.get(trackedId) ?? '',
      blogId,
      fromRank: from?.rank ?? null,
      fromStatus: from?.status ?? null,
      toRank: to.rank,
      toStatus: to.status,
    });
  }
  return computeRankChanges(pairs);
}

// 로그인 없이 접근 가능한 공개 리포트 — 계정 정보는 절대 노출하지 않고, 이미 엑셀
// 내보내기로도 공유 가능한 수준(키워드·블로그·순위)의 데이터만 반환한다.
// group_id가 NULL인 공유(전체 그룹)는 groups 배열을 채워서 내려주고, 그룹 전용
// 공유는 groups를 빈 배열로 둬서 클라이언트가 다른 그룹의 존재 자체를 모르게 한다.
export async function getPublicReport(token) {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT rs.user_id, rs.group_id, rs.created_at, tg.name AS group_name
     FROM report_shares rs
     LEFT JOIN tracker_groups tg ON tg.id = rs.group_id
     WHERE rs.token = $1 AND rs.revoked_at IS NULL`,
    [token]
  );
  if (!rows.length) return null;
  const { user_id: userId, group_id: groupId, created_at: sharedAt, group_name: groupName } = rows[0];

  const cutoffDate = new Date(new Date(sharedAt).getTime() - 14 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const all = await listTracked(userId);
  const scoped = groupId == null ? all : all.filter((i) => i.group_id === groupId);
  const items = filterItemsByCutoff(scoped, cutoffDate).map((i) => ({
    id: i.id,
    keyword: i.keyword,
    mode: i.mode,
    blog_ids: i.blog_ids,
    group_id: i.group_id,
    latestRanks: i.latestRanks,
    searchVolume: i.searchVolume,
  }));

  const [groups, changes] = await Promise.all([
    groupId == null ? fetchGroupNames(pool, userId) : Promise.resolve([]),
    fetchChanges(pool, items),
  ]);

  return { groupName: groupId == null ? null : groupName, groups, items, changes };
}
