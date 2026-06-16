import { getPool } from '../db/index.js';
import { fetchBlogRankings } from './blogRankingService.js';

function extractBlogId(url) {
  const m = String(url).match(/blog\.naver\.com\/([^/?#\s]+)/);
  return m ? m[1].toLowerCase() : null;
}

export async function listTracked(userId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, keyword, mode, blog_ids, created_at, last_refreshed_at FROM tracked_keywords
     WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  const result = await Promise.all(rows.map(async (row) => {
    const { rows: snaps } = await pool.query(
      `SELECT blog_id, rank, TO_CHAR(snapshotted_at, 'YYYY-MM-DD') AS snapshotted_at
       FROM rank_snapshots WHERE tracked_id = $1 ORDER BY snapshotted_at DESC LIMIT 20`,
      [row.id]
    );
    const latestByBlog = {};
    for (const s of snaps) {
      if (!latestByBlog[s.blog_id]) latestByBlog[s.blog_id] = s.rank;
    }
    return { ...row, latestRanks: latestByBlog };
  }));
  return result;
}

export async function createTracked(userId, keyword, mode, blogUrls = []) {
  const pool = getPool();
  const blogIds = blogUrls.map(extractBlogId).filter(Boolean);
  const { rows } = await pool.query(
    `INSERT INTO tracked_keywords (user_id, keyword, mode, blog_ids)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, keyword, mode) DO UPDATE SET blog_ids = EXCLUDED.blog_ids
     RETURNING id, keyword, mode, blog_ids, created_at`,
    [userId, keyword.trim(), mode, blogIds]
  );
  return rows[0];
}

export async function deleteTracked(userId, trackedId) {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM tracked_keywords WHERE id = $1 AND user_id = $2`,
    [trackedId, userId]
  );
  if (rowCount === 0) throw Object.assign(new Error('항목을 찾을 수 없습니다.'), { status: 404 });
}

export async function getSnapshots(userId, trackedId) {
  const pool = getPool();
  const { rows: own } = await pool.query(
    `SELECT id, keyword, mode, blog_ids FROM tracked_keywords WHERE id = $1 AND user_id = $2`,
    [trackedId, userId]
  );
  if (!own.length) throw Object.assign(new Error('항목을 찾을 수 없습니다.'), { status: 404 });

  const { rows: snaps } = await pool.query(
    `SELECT blog_id, rank, post_title, post_link,
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

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const upserts = [];

  if (mode === 'blog') {
    for (const blogId of blog_ids) {
      const hit = rankings.find(r => r.blogId?.toLowerCase() === blogId.toLowerCase());
      upserts.push({
        blog_id: blogId,
        rank: hit ? hit.rank : null,
        post_title: hit?.title || null,
        post_link: hit?.postLink || null,
      });
    }
  } else {
    for (const r of rankings) {
      if (!r.blogId) continue;
      upserts.push({
        blog_id: r.blogId,
        rank: r.rank,
        post_title: r.title || null,
        post_link: r.postLink || null,
      });
    }
  }

  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

  for (const u of upserts) {
    await pool.query(
      `INSERT INTO rank_snapshots (tracked_id, blog_id, rank, post_title, post_link, snapshotted_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tracked_id, blog_id, snapshotted_at)
       DO UPDATE SET rank = EXCLUDED.rank, post_title = EXCLUDED.post_title, post_link = EXCLUDED.post_link`,
      [trackedId, u.blog_id, u.rank, u.post_title, u.post_link, today]
    );
  }

  await pool.query(
    `UPDATE tracked_keywords SET last_refreshed_at = NOW() WHERE id = $1`,
    [trackedId]
  );

  console.log(`[rank-tracker] refresh ✓ "${keyword}" mode=${mode} upserted=${upserts.length}`);
  return { refreshed: upserts.length, date: today };
}
