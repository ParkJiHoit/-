import { getPool } from '../db/index.js';
import { fetchBlogRankings } from './blogRankingService.js';

export function extractPostKey(url) {
  const str = String(url || '').trim();

  let m = str.match(/(?:m\.)?blog\.naver\.com\/([^/?#\s]+)\/(\d+)/);
  if (m) return { blogId: m[1].toLowerCase(), logNo: m[2] };

  if (/blog\.naver\.com\/PostView\.naver\?/.test(str)) {
    const blogIdMatch = str.match(/[?&]blogId=([^&]+)/);
    const logNoMatch = str.match(/[?&]logNo=([^&]+)/);
    if (blogIdMatch && logNoMatch) {
      return { blogId: decodeURIComponent(blogIdMatch[1]).toLowerCase(), logNo: logNoMatch[1] };
    }
  }

  m = str.match(/blog\.naver\.com\/([^/?#\s]+)/);
  if (m) return { blogId: m[1].toLowerCase(), logNo: null };

  return null;
}

export function postKeyToString({ blogId, logNo }) {
  return logNo ? `${blogId}/${logNo}` : blogId;
}

export function parsePostKeyString(stored) {
  const [blogId, logNo] = String(stored).split('/');
  return { blogId, logNo: logNo || null };
}

export function findMatchingRank(rankings, storedKey) {
  const { blogId, logNo } = parsePostKeyString(storedKey);
  if (logNo) {
    return rankings.find(r => r.blogId?.toLowerCase() === blogId && r.logNo === logNo) || null;
  }
  return rankings.find(r => r.blogId?.toLowerCase() === blogId) || null;
}

export async function listTracked(userId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, keyword, mode, blog_ids, group_id, created_at, last_refreshed_at FROM tracked_keywords
     WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  const result = await Promise.all(rows.map(async (row) => {
    const { rows: snaps } = await pool.query(
      `SELECT blog_id, rank, status, TO_CHAR(snapshotted_at, 'YYYY-MM-DD') AS snapshotted_at
       FROM rank_snapshots WHERE tracked_id = $1 ORDER BY snapshotted_at DESC LIMIT 20`,
      [row.id]
    );
    const latestByBlog = {};
    for (const s of snaps) {
      if (!latestByBlog[s.blog_id]) latestByBlog[s.blog_id] = { rank: s.rank, status: s.status };
    }
    return { ...row, latestRanks: latestByBlog };
  }));
  return result;
}

export async function createTracked(userId, keyword, mode, blogUrls = [], groupId = null) {
  const pool = getPool();
  const blogIds = blogUrls
    .map(u => { const k = extractPostKey(u); return k ? postKeyToString(k) : null; })
    .filter(Boolean);
  const { rows } = await pool.query(
    `INSERT INTO tracked_keywords (user_id, keyword, mode, blog_ids, group_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, keyword, mode) DO UPDATE
       SET blog_ids = EXCLUDED.blog_ids,
           group_id = COALESCE(EXCLUDED.group_id, tracked_keywords.group_id)
     RETURNING id, keyword, mode, blog_ids, group_id, created_at`,
    [userId, keyword.trim(), mode, blogIds, groupId]
  );
  return rows[0];
}

export async function mergeTrackedBlogUrls(userId, keyword, mode, newUrls = [], groupId = null) {
  const pool = getPool();
  const newIds = newUrls
    .map(u => { const k = extractPostKey(u); return k ? postKeyToString(k) : null; })
    .filter(Boolean);
  const { rows } = await pool.query(
    `INSERT INTO tracked_keywords (user_id, keyword, mode, blog_ids, group_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, keyword, mode) DO UPDATE
       SET blog_ids = ARRAY(
         SELECT DISTINCT unnest(tracked_keywords.blog_ids || EXCLUDED.blog_ids)
       ),
       group_id = COALESCE(EXCLUDED.group_id, tracked_keywords.group_id)
     RETURNING id, keyword, mode, blog_ids, group_id, created_at`,
    [userId, keyword.trim(), mode, newIds, groupId]
  );
  return rows[0];
}

export async function updateTrackedGroup(userId, trackedId, groupId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE tracked_keywords SET group_id = $1 WHERE id = $2 AND user_id = $3
     RETURNING id, keyword, mode, blog_ids, group_id, created_at`,
    [groupId, trackedId, userId]
  );
  if (!rows.length) throw Object.assign(new Error('항목을 찾을 수 없습니다.'), { status: 404 });
  return rows[0];
}

export async function exportSnapshots(userId, trackedIds) {
  const pool = getPool();
  const { rows: tracked } = await pool.query(
    `SELECT tk.id, tk.keyword, tk.mode, tg.name AS group_name
     FROM tracked_keywords tk
     LEFT JOIN tracker_groups tg ON tg.id = tk.group_id
     WHERE tk.id = ANY($1) AND tk.user_id = $2`,
    [trackedIds, userId]
  );
  if (!tracked.length) return [];

  const idToInfo = new Map(tracked.map(t => [t.id, t]));
  const { rows: snaps } = await pool.query(
    `SELECT tracked_id, blog_id, rank, status, post_title, post_link,
            TO_CHAR(snapshotted_at, 'YYYY-MM-DD') AS snapshotted_at
     FROM rank_snapshots WHERE tracked_id = ANY($1)
     ORDER BY snapshotted_at ASC, tracked_id ASC, rank ASC NULLS LAST`,
    [tracked.map(t => t.id)]
  );

  return snaps.map(s => {
    const info = idToInfo.get(s.tracked_id);
    return {
      group: info?.group_name || '',
      keyword: info?.keyword || '',
      mode: info?.mode || '',
      blogId: s.blog_id,
      date: s.snapshotted_at,
      rank: s.rank,
      status: s.status,
      postTitle: s.post_title,
      postLink: s.post_link,
    };
  });
}

export async function listGroups(userId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, name, created_at FROM tracker_groups WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  return rows;
}

export async function createGroup(userId, name) {
  const pool = getPool();
  const trimmed = String(name || '').trim();
  if (!trimmed) throw Object.assign(new Error('그룹 이름을 입력해 주세요.'), { status: 400 });
  const { rows } = await pool.query(
    `INSERT INTO tracker_groups (user_id, name) VALUES ($1, $2)
     ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name, created_at`,
    [userId, trimmed]
  );
  return rows[0];
}

export async function renameGroup(userId, groupId, name) {
  const pool = getPool();
  const trimmed = String(name || '').trim();
  if (!trimmed) throw Object.assign(new Error('그룹 이름을 입력해 주세요.'), { status: 400 });
  const { rows } = await pool.query(
    `UPDATE tracker_groups SET name = $1 WHERE id = $2 AND user_id = $3
     RETURNING id, name, created_at`,
    [trimmed, groupId, userId]
  );
  if (!rows.length) throw Object.assign(new Error('그룹을 찾을 수 없습니다.'), { status: 404 });
  return rows[0];
}

export async function deleteGroup(userId, groupId) {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM tracker_groups WHERE id = $1 AND user_id = $2`,
    [groupId, userId]
  );
  if (rowCount === 0) throw Object.assign(new Error('그룹을 찾을 수 없습니다.'), { status: 404 });
}

export async function deleteTracked(userId, trackedId) {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM tracked_keywords WHERE id = $1 AND user_id = $2`,
    [trackedId, userId]
  );
  if (rowCount === 0) throw Object.assign(new Error('항목을 찾을 수 없습니다.'), { status: 404 });
}

export async function deleteTrackedBulk(userId, trackedIds) {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM tracked_keywords WHERE id = ANY($1) AND user_id = $2`,
    [trackedIds, userId]
  );
  return rowCount;
}

export async function getSnapshots(userId, trackedId) {
  const pool = getPool();
  const { rows: own } = await pool.query(
    `SELECT id, keyword, mode, blog_ids FROM tracked_keywords WHERE id = $1 AND user_id = $2`,
    [trackedId, userId]
  );
  if (!own.length) throw Object.assign(new Error('항목을 찾을 수 없습니다.'), { status: 404 });

  const { rows: snaps } = await pool.query(
    `SELECT blog_id, rank, status, post_title, post_link,
            TO_CHAR(snapshotted_at, 'YYYY-MM-DD') AS snapshotted_at
     FROM rank_snapshots WHERE tracked_id = $1
     ORDER BY snapshotted_at DESC, rank ASC NULLS LAST`,
    [trackedId]
  );
  return { tracked: own[0], snapshots: snaps };
}

export async function refreshRanks(userId, trackedId) {
  const pool = getPool();
  const { rows: own } = await pool.query(
    `SELECT id, keyword, mode, blog_ids FROM tracked_keywords WHERE id = $1 AND user_id = $2`,
    [trackedId, userId]
  );
  if (!own.length) throw Object.assign(new Error('항목을 찾을 수 없습니다.'), { status: 404 });

  const { keyword, mode, blog_ids } = own[0];
  const rankings = await fetchBlogRankings(keyword, 'blog');
  const fetchFailed = rankings.length === 0;

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const upserts = [];

  if (mode === 'blog') {
    for (const storedKey of blog_ids) {
      const hit = fetchFailed ? null : findMatchingRank(rankings, storedKey);
      // 상위 5위까지만 "노출 성공"으로 판정 (스펙 2-C) — 6~10위도 매칭은 되지만
      // UI/집계상 순위권 밖으로 취급한다. 실제 순위 값은 rank 컬럼에 그대로 남긴다.
      const isRankedWithinTop5 = !!hit && hit.rank <= 5;
      upserts.push({
        blog_id: storedKey,
        rank: hit ? hit.rank : null,
        post_title: hit?.title || null,
        post_link: hit?.postLink || null,
        status: fetchFailed ? 'fetch_failed' : (isRankedWithinTop5 ? 'ranked' : 'not_in_top5'),
      });
    }
  } else if (fetchFailed) {
    upserts.push({ blog_id: '__fetch_failed__', rank: null, post_title: null, post_link: null, status: 'fetch_failed' });
  } else {
    for (const r of rankings) {
      if (!r.blogId) continue;
      upserts.push({
        blog_id: r.blogId,
        rank: r.rank,
        post_title: r.title || null,
        post_link: r.postLink || null,
        status: 'ranked',
      });
    }
  }

  for (const u of upserts) {
    await pool.query(
      `INSERT INTO rank_snapshots (tracked_id, blog_id, rank, post_title, post_link, status, snapshotted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tracked_id, blog_id, snapshotted_at)
       DO UPDATE SET rank = EXCLUDED.rank, post_title = EXCLUDED.post_title,
                     post_link = EXCLUDED.post_link, status = EXCLUDED.status`,
      [trackedId, u.blog_id, u.rank, u.post_title, u.post_link, u.status, today]
    );
  }

  await pool.query(
    `UPDATE tracked_keywords SET last_refreshed_at = NOW() WHERE id = $1`,
    [trackedId]
  );

  console.log(`[rank-tracker] refresh ${fetchFailed ? '✗ fetch_failed' : '✓'} "${keyword}" mode=${mode} upserted=${upserts.length}`);
  return { refreshed: upserts.length, date: today, fetchFailed };
}
