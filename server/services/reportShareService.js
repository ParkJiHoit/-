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
const MAX_CHANGES = 30;
const MAX_INTEGRATED_CHANGES = 12;

// 리포트에 포함된 각 링크의 "컷오프 시작 직전 스냅샷"과 "가장 최신 스냅샷"을 비교해
// 눈에 띄는 변화(신규 5위 이내 진입, 3계단 이상 상승)를 추려낸다. 컷오프 이전 기록이
// 아예 없는(=이번 리포트 기간에 새로 등록된) 링크는 "개선폭"을 계산할 수 없지만,
// 처음 확인된 순위 자체가 중요한 정보라 임계값과 무관하게 항상 포함한다(new_ranked).
// 정렬/컷오프는 "임팩트"(신규 5위 진입 > 상승폭)가 아니라 키워드 검색량 내림차순으로
// 한다 — 클라이언트가 보여주는 순서와 동일한 기준이어야, 검색량 낮은 변화 때문에
// 검색량 높은 실제 키워드의 변화가 상한(MAX_CHANGES)에 밀려 누락되는 일이 없다.
// id(트래킹 항목 id)는 클라이언트가 검색량 등 items 쪽 정보와 다시 매칭할 수 있도록
// 그대로 통과시킨다.
export function computeRankChanges(snapshotPairs) {
  const changes = [];
  for (const p of snapshotPairs) {
    const wasRanked = p.fromStatus === 'ranked' && p.fromRank != null;
    const isRanked = p.toStatus === 'ranked' && p.toRank != null;
    if (!isRanked) continue;
    if (!wasRanked) {
      const type = p.toRank <= NEW_TOP5_THRESHOLD ? 'new_top5' : 'new_ranked';
      changes.push({ id: p.id, keyword: p.keyword, blogId: p.blogId, fromRank: p.fromRank, toRank: p.toRank, type, searchVolume: p.searchVolume ?? 0 });
    } else if (p.fromRank - p.toRank >= IMPROVED_THRESHOLD) {
      changes.push({ id: p.id, keyword: p.keyword, blogId: p.blogId, fromRank: p.fromRank, toRank: p.toRank, type: 'improved', searchVolume: p.searchVolume ?? 0 });
    }
  }
  changes.sort((a, b) => b.searchVolume - a.searchVolume);
  return changes.slice(0, MAX_CHANGES);
}

// 순위와 별개로 "통합검색(블로그 collection) 노출 여부"를 보여준다. 이건 순위 변화와
// 달리 "역대 최초 스냅샷" 대비가 아니라 "바로 직전 스냅샷" 대비여야 한다 — 역대
// 최초 기준으로 비교하면 한 번 노출이 시작된 링크는 그 뒤로 계속 노출 중이어도
// 매 리포트마다 "미노출 → 노출"이 다시 나타나서(이미 며칠 전에 일어난 일인데 오늘도
// 방금 바뀐 것처럼 보임), 실제로는 아무 변화가 없는데도 변화로 오인하게 만든다.
// 그래서 previousByKey(직전 스냅샷)를 기준으로 "gained"(방금 노출 시작)/"lost"(방금
// 노출 중단)/"ongoing"(계속 노출 중 — 좋은 소식이라 같이 보여줄 가치가 있음)을
// 구분한다. 계속 미노출인 경우는 보여줄 정보가 없어 제외한다.
// all 모드는 integrated_exposed가 항상 null이라 자연히 제외된다.
export function computeIntegratedChanges(snapshotPairs) {
  const changes = [];
  for (const p of snapshotPairs) {
    if (!p.hasPreviousSnapshot) continue;
    const wasExposed = p.fromIntegratedExposed === true;
    const isExposed = p.toIntegratedExposed === true;
    if (!wasExposed && !isExposed) continue;
    const type = wasExposed && isExposed ? 'ongoing' : (isExposed ? 'gained' : 'lost');
    changes.push({ id: p.id, keyword: p.keyword, blogId: p.blogId, type });
  }
  const order = { gained: 0, ongoing: 1, lost: 2 };
  changes.sort((a, b) => order[a.type] - order[b.type]);
  return changes.slice(0, MAX_INTEGRATED_CHANGES);
}

async function fetchGroupNames(pool, userId) {
  const { rows } = await pool.query(
    `SELECT id, name FROM tracker_groups WHERE user_id = $1 ORDER BY name ASC`,
    [userId]
  );
  return rows;
}

function sameSnapshotDate(a, b) {
  if (!a || !b) return false;
  const ta = a instanceof Date ? a.getTime() : new Date(a).getTime();
  const tb = b instanceof Date ? b.getTime() : new Date(b).getTime();
  return ta === tb;
}

// 리포트에 포함된(=컷오프를 통과한) 각 링크의 순위·통합검색 노출 여부 변동사항을 만든다.
// items는 filterItemsByCutoff를 통과한 뒤의 목록 — 즉 이미 "이 리포트에 보일"(=최근
// 14일 이내 등록된) 링크만 담고 있다. 그래서 비교 기준(from)은 "리포트 기간 시작
// 이전 스냅샷"이 아니라 "역대 최초 스냅샷"이어야 한다 — filterItemsByCutoff를 통과한
// 링크는 등록 자체가 14일 이내라 그보다 이전 스냅샷이 애초에 존재할 수 없고(등록 전엔
// 순위를 잴 수 없으므로), "이전 스냅샷"을 기준으로 삼으면 리포트에 보이는 모든 링크가
// 예외 없이 항상 "미확인 → 현재순위"로만 나오고 실제 순위 개선("8위 → 3위" 같은)이
// 하나도 드러나지 않는다. 다만 스냅샷이 딱 하나뿐인(오늘 등록+오늘 처음이자 유일하게
// 확인) 링크는 "역대 최초"와 "최신"이 같은 날짜의 같은 행이라 개선폭이 0으로 계산돼
// 버리므로, 이 경우는 이전 상태를 "미확인"으로 취급한다(hasPriorSnapshot).
async function fetchChanges(pool, items) {
  const trackedIds = [...new Set(items.map((i) => i.id))];
  if (!trackedIds.length) return { changes: [], integratedChanges: [] };

  const [{ rows: earliest }, { rows: latest }, { rows: previous }] = await Promise.all([
    pool.query(
      `SELECT DISTINCT ON (tracked_id, blog_id) tracked_id, blog_id, rank, status, integrated_exposed, snapshotted_at
       FROM rank_snapshots WHERE tracked_id = ANY($1)
       ORDER BY tracked_id, blog_id, snapshotted_at ASC`,
      [trackedIds]
    ),
    pool.query(
      `SELECT DISTINCT ON (tracked_id, blog_id) tracked_id, blog_id, rank, status, integrated_exposed, snapshotted_at
       FROM rank_snapshots WHERE tracked_id = ANY($1)
       ORDER BY tracked_id, blog_id, snapshotted_at DESC`,
      [trackedIds]
    ),
    // 통합검색 노출 변동은 "역대 최초" 대비가 아니라 "바로 직전" 대비여야 하므로
    // 각 tracked_id/blog_id별로 최신에서 두 번째로 최근인 스냅샷을 따로 가져온다.
    pool.query(
      `SELECT tracked_id, blog_id, integrated_exposed, snapshotted_at FROM (
         SELECT tracked_id, blog_id, integrated_exposed, snapshotted_at,
                ROW_NUMBER() OVER (PARTITION BY tracked_id, blog_id ORDER BY snapshotted_at DESC) AS rn
         FROM rank_snapshots WHERE tracked_id = ANY($1)
       ) t WHERE rn = 2`,
      [trackedIds]
    ),
  ]);

  const earliestByKey = new Map(earliest.map((r) => [`${r.tracked_id}:${r.blog_id}`, r]));
  const latestByKey = new Map(latest.map((r) => [`${r.tracked_id}:${r.blog_id}`, r]));
  const previousByKey = new Map(previous.map((r) => [`${r.tracked_id}:${r.blog_id}`, r]));
  const keywordById = new Map(items.map((i) => [i.id, i.keyword]));
  const searchVolumeById = new Map(items.map((i) => [i.id, i.searchVolume]));

  const pairs = [];
  for (const key of latestByKey.keys()) {
    const [trackedIdStr, blogId] = key.split(':');
    const trackedId = Number(trackedIdStr);
    const from = earliestByKey.get(key);
    const prev = previousByKey.get(key);
    const to = latestByKey.get(key);
    if (!to) continue;
    const hasPriorSnapshot = !!from && !sameSnapshotDate(from.snapshotted_at, to.snapshotted_at);
    const hasPreviousSnapshot = !!prev && !sameSnapshotDate(prev.snapshotted_at, to.snapshotted_at);
    pairs.push({
      id: trackedId,
      keyword: keywordById.get(trackedId) ?? '',
      blogId,
      searchVolume: searchVolumeById.get(trackedId) ?? 0,
      fromRank: hasPriorSnapshot ? from.rank : null,
      fromStatus: hasPriorSnapshot ? from.status : null,
      toRank: to.rank,
      toStatus: to.status,
      hasPreviousSnapshot,
      fromIntegratedExposed: hasPreviousSnapshot ? prev.integrated_exposed : null,
      toIntegratedExposed: to.integrated_exposed,
    });
  }
  return { changes: computeRankChanges(pairs), integratedChanges: computeIntegratedChanges(pairs) };
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
    averageCtr: i.averageCtr,
  }));

  const [groups, { changes, integratedChanges }] = await Promise.all([
    groupId == null ? fetchGroupNames(pool, userId) : Promise.resolve([]),
    fetchChanges(pool, items),
  ]);

  return { groupName: groupId == null ? null : groupName, groups, items, changes, integratedChanges };
}
