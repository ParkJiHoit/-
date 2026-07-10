import { getPool } from '../db/index.js';
import { fetchBlogRankings, fetchPostPublishedDate } from './blogRankingService.js';
import { fetchKeywordVolume } from './naverKeywordService.js';
import { diffRankChanges, notifyRankChanges } from './notificationService.js';

// 키워드 등록 시 딱 한 번만 월간 검색량을 조회한다 — 이미 저장된 값이 있으면(재등록/URL
// 추가 포함) 다시 조회하지 않는다. 조회 실패는 등록 자체를 막지 않도록 null로 흡수한다.
async function getOrFetchSearchVolume(pool, userId, keyword, mode, groupId) {
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT pc_search, mobile_search FROM tracked_keywords
     WHERE user_id = $1 AND keyword = $2 AND mode = $3 AND group_id IS NOT DISTINCT FROM $4`,
    [userId, keyword, mode, groupId]
  );
  if (rows.length && (rows[0].pc_search != null || rows[0].mobile_search != null)) return null;
  try {
    return await fetchKeywordVolume(keyword);
  } catch (err) {
    console.warn(`[rank-tracker] 검색량 조회 실패 "${keyword}": ${err.message}`);
    return null;
  }
}

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

const BACKFILL_CHUNK_SIZE = 8;

// 검색량이 비어 있는(이 기능 추가 이전에 등록된) 키워드를 한 번 호출에 몇 개씩만 처리한다
// (Vercel 서버리스 30초 제한 안에서 끝나도록). 프론트가 done:false인 동안 반복 호출한다.
// 조회에 실패해도 0으로 채워 다음 호출에서 같은 키워드를 무한정 다시 시도하지 않게 한다.
export async function backfillSearchVolumeChunk(userId) {
  const pool = getPool();
  if (!pool) throw Object.assign(new Error('DB가 설정되지 않았습니다.'), { status: 503 });

  const { rows } = await pool.query(
    `SELECT DISTINCT keyword FROM tracked_keywords
     WHERE user_id = $1 AND deleted_at IS NULL AND pc_search IS NULL AND mobile_search IS NULL
     ORDER BY keyword LIMIT $2`,
    [userId, BACKFILL_CHUNK_SIZE]
  );

  for (const { keyword } of rows) {
    let pcSearch = 0;
    let mobileSearch = 0;
    try {
      const vol = await fetchKeywordVolume(keyword);
      pcSearch = vol?.pcSearch ?? 0;
      mobileSearch = vol?.mobileSearch ?? 0;
    } catch (err) {
      console.warn(`[backfill] "${keyword}" 검색량 조회 실패: ${err.message}`);
    }
    await pool.query(
      `UPDATE tracked_keywords SET pc_search = $1, mobile_search = $2
       WHERE user_id = $3 AND keyword = $4 AND pc_search IS NULL AND mobile_search IS NULL`,
      [pcSearch, mobileSearch, userId, keyword]
    );
  }

  const { rows: remainingRows } = await pool.query(
    `SELECT COUNT(DISTINCT keyword) AS cnt FROM tracked_keywords
     WHERE user_id = $1 AND deleted_at IS NULL AND pc_search IS NULL AND mobile_search IS NULL`,
    [userId]
  );
  const remaining = Number(remainingRows[0]?.cnt || 0);

  return { processed: rows.length, remaining, done: remaining === 0 };
}

export async function listTracked(userId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, keyword, mode, blog_ids, group_id, created_at, last_refreshed_at, pc_search, mobile_search
     FROM tracked_keywords WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userId]
  );
  const result = await Promise.all(rows.map(async (row) => {
    // added_date는 blog_id별 최초 스냅샷일(윈도우 함수로 전체 이력 기준 계산 — LIMIT 20으로
    // 잘리기 전에 집계되므로 정확함) — 별도 등록일 저장 컬럼이 없어 "처음 추적된 날짜"를
    // 등록일의 근사치로 보여준다(등록 직후 아직 한 번도 갱신 안 했다면 null).
    const { rows: snaps } = await pool.query(
      `SELECT blog_id, rank, status, integrated_exposed, TO_CHAR(snapshotted_at, 'YYYY-MM-DD') AS snapshotted_at,
              TO_CHAR(MIN(snapshotted_at) OVER (PARTITION BY blog_id), 'YYYY-MM-DD') AS added_date
       FROM rank_snapshots WHERE tracked_id = $1 ORDER BY snapshotted_at DESC LIMIT 20`,
      [row.id]
    );
    const latestByBlog = {};
    for (const s of snaps) {
      if (!latestByBlog[s.blog_id]) {
        latestByBlog[s.blog_id] = {
          rank: s.rank,
          status: s.status,
          integratedExposed: row.mode === 'blog' ? s.integrated_exposed : null,
          addedDate: s.added_date,
        };
      }
    }
    const searchVolume = (row.pc_search != null || row.mobile_search != null)
      ? (row.pc_search || 0) + (row.mobile_search || 0)
      : null;
    return { ...row, latestRanks: latestByBlog, searchVolume };
  }));
  return result;
}

export async function createTracked(userId, keyword, mode, blogUrls = [], groupId = null) {
  const pool = getPool();
  const trimmedKeyword = keyword.trim();
  const blogIds = blogUrls
    .map(u => { const k = extractPostKey(u); return k ? postKeyToString(k) : null; })
    .filter(Boolean);
  const searchVolume = await getOrFetchSearchVolume(pool, userId, trimmedKeyword, mode, groupId);
  const { rows } = await pool.query(
    `INSERT INTO tracked_keywords (user_id, keyword, mode, blog_ids, group_id, pc_search, mobile_search)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, keyword, mode, (COALESCE(group_id, -1))) DO UPDATE
       SET blog_ids = EXCLUDED.blog_ids,
           deleted_at = NULL,
           pc_search = COALESCE(tracked_keywords.pc_search, EXCLUDED.pc_search),
           mobile_search = COALESCE(tracked_keywords.mobile_search, EXCLUDED.mobile_search)
     RETURNING id, keyword, mode, blog_ids, group_id, created_at`,
    [userId, trimmedKeyword, mode, blogIds, groupId, searchVolume?.pcSearch ?? null, searchVolume?.mobileSearch ?? null]
  );
  return rows[0];
}

export async function mergeTrackedBlogUrls(userId, keyword, mode, newUrls = [], groupId = null) {
  const pool = getPool();
  const trimmedKeyword = keyword.trim();
  const newIds = newUrls
    .map(u => { const k = extractPostKey(u); return k ? postKeyToString(k) : null; })
    .filter(Boolean);
  const searchVolume = await getOrFetchSearchVolume(pool, userId, trimmedKeyword, mode, groupId);
  const { rows } = await pool.query(
    `INSERT INTO tracked_keywords (user_id, keyword, mode, blog_ids, group_id, pc_search, mobile_search)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, keyword, mode, (COALESCE(group_id, -1))) DO UPDATE
       SET blog_ids = CASE
             -- 삭제됐던 항목을 재등록하는 경우는 완전히 새 등록으로 취급해 URL 목록을
             -- 새로 넣은 것으로 교체한다(옛 목록과 합치지 않음). 순위 기록은
             -- rank_snapshots가 tracked_id를 그대로 참조하므로 별도로 보존된다.
             WHEN tracked_keywords.deleted_at IS NOT NULL THEN EXCLUDED.blog_ids
             ELSE ARRAY(SELECT DISTINCT unnest(tracked_keywords.blog_ids || EXCLUDED.blog_ids))
           END,
       deleted_at = NULL,
       pc_search = COALESCE(tracked_keywords.pc_search, EXCLUDED.pc_search),
       mobile_search = COALESCE(tracked_keywords.mobile_search, EXCLUDED.mobile_search)
     RETURNING id, keyword, mode, blog_ids, group_id, created_at`,
    [userId, trimmedKeyword, mode, newIds, groupId, searchVolume?.pcSearch ?? null, searchVolume?.mobileSearch ?? null]
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

// 키워드 전체가 아니라 등록된 블로그 하나만 추적 목록에서 뺀다. 순위 기록은
// rank_snapshots에 그대로 남아 있고 blog_ids 배열에서만 제거된다.
export async function removeTrackedBlogUrl(userId, trackedId, blogId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE tracked_keywords SET blog_ids = array_remove(blog_ids, $1)
     WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
     RETURNING id, keyword, mode, blog_ids, group_id, created_at`,
    [blogId, trackedId, userId]
  );
  if (!rows.length) throw Object.assign(new Error('항목을 찾을 수 없습니다.'), { status: 404 });
  return rows[0];
}

export async function exportSnapshots(userId, trackedIds) {
  const pool = getPool();
  const { rows: tracked } = await pool.query(
    `SELECT tk.id, tk.keyword, tk.mode, tk.blog_ids, tk.pc_search, tk.mobile_search, tg.name AS group_name,
            TO_CHAR(tk.created_at, 'YYYY-MM-DD') AS registered_at
     FROM tracked_keywords tk
     LEFT JOIN tracker_groups tg ON tg.id = tk.group_id
     WHERE tk.id = ANY($1) AND tk.user_id = $2`,
    [trackedIds, userId]
  );
  if (!tracked.length) return [];

  const idToInfo = new Map(tracked.map(t => [t.id, t]));
  const { rows: snaps } = await pool.query(
    `SELECT tracked_id, blog_id, rank, status, post_title, post_link, integrated_exposed,
            TO_CHAR(post_date, 'YYYY-MM-DD') AS post_date,
            TO_CHAR(snapshotted_at, 'YYYY-MM-DD') AS snapshotted_at
     FROM rank_snapshots WHERE tracked_id = ANY($1)
     ORDER BY snapshotted_at ASC, tracked_id ASC, rank ASC NULLS LAST`,
    [tracked.map(t => t.id)]
  );

  // blog 모드는 지금 등록돼 있는 URL만 내보낸다 — 등록을 바꾸면서 더 이상 추적하지
  // 않게 된 blogId의 과거 기록(rank_snapshots에는 계속 남아 있음)까지 딸려 나오지 않게 한다.
  // all 모드는 특정 URL 목록에 매이지 않는 상위 10위 스냅샷이라 그대로 둔다.
  const filtered = snaps.filter(s => {
    const info = idToInfo.get(s.tracked_id);
    if (!info || info.mode !== 'blog') return true;
    return (info.blog_ids || []).includes(s.blog_id);
  });

  // blog_id는 키워드 생성 이후에도 추가될 수 있어(onAddBlog) tracked_keywords.created_at을
  // "이 블로그의 등록일"로 쓰면 부정확하다 — blog_id별 최초 스냅샷 날짜를 실제 등록일
  // 근사치로 따로 구해, 등록 이전 날짜(값 없음)와 등록 이후 진짜 미노출(X)을 구분할 수 있게 한다.
  const firstSeenByKey = new Map();
  for (const s of filtered) {
    const key = `${s.tracked_id}::${s.blog_id}`;
    const prev = firstSeenByKey.get(key);
    if (!prev || s.snapshotted_at < prev) firstSeenByKey.set(key, s.snapshotted_at);
  }

  return filtered.map(s => {
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
      postDate: s.post_date,
      registeredAt: info?.registered_at || null,
      firstSeenDate: firstSeenByKey.get(`${s.tracked_id}::${s.blog_id}`) || null,
      integratedExposed: s.integrated_exposed,
      searchVolume: (info?.pc_search != null || info?.mobile_search != null)
        ? (info.pc_search || 0) + (info.mobile_search || 0)
        : null,
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

// 소프트 삭제 — rank_snapshots는 tracked_id를 그대로 참조하므로 순위 기록이 보존되고,
// 같은 키워드/URL을 다시 등록하면 upsert(ON CONFLICT)가 이 행을 재활성화해 이어진다.
export async function deleteTracked(userId, trackedId) {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE tracked_keywords SET deleted_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [trackedId, userId]
  );
  if (rowCount === 0) throw Object.assign(new Error('항목을 찾을 수 없습니다.'), { status: 404 });
}

export async function deleteTrackedBulk(userId, trackedIds) {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE tracked_keywords SET deleted_at = NOW()
     WHERE id = ANY($1) AND user_id = $2 AND deleted_at IS NULL`,
    [trackedIds, userId]
  );
  return rowCount;
}

export async function getSnapshots(userId, trackedId) {
  const pool = getPool();
  const { rows: own } = await pool.query(
    `SELECT id, keyword, mode, blog_ids FROM tracked_keywords WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [trackedId, userId]
  );
  if (!own.length) throw Object.assign(new Error('항목을 찾을 수 없습니다.'), { status: 404 });

  const { rows: snaps } = await pool.query(
    `SELECT blog_id, rank, status, post_title, post_link, integrated_exposed,
            TO_CHAR(post_date, 'YYYY-MM-DD') AS post_date,
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
    `SELECT id, keyword, mode, blog_ids FROM tracked_keywords WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [trackedId, userId]
  );
  if (!own.length) throw Object.assign(new Error('항목을 찾을 수 없습니다.'), { status: 404 });

  const { keyword, mode, blog_ids } = own[0];

  // 블로그탭 스크래핑과 통합검색 스크래핑은 서로 독립적인 네이버 검색 호출이라
  // 순차로 기다리지 않고 동시에 요청해 왕복 시간을 겹친다. 통합검색은 blog 모드에서만
  // 필요하므로 다른 모드에서는 아예 요청하지 않는다. 블로그탭 조회가 실패하면
  // 통합검색 결과는 그냥 버린다(기존과 동일하게 fetchFailed면 null 처리).
  const [rankings, integratedListRaw] = await Promise.all([
    fetchBlogRankings(keyword, 'blog', { skipVisitors: true }),
    mode === 'blog' ? fetchBlogRankings(keyword, 'integrated', { skipVisitors: true }) : Promise.resolve([]),
  ]);
  const fetchFailed = rankings.length === 0;
  const integratedList = fetchFailed ? [] : integratedListRaw;
  if (mode === 'blog' && !fetchFailed) {
    console.log(`[integrated-exposure] "${keyword}" 스캔 결과 ${integratedList.length}건: ${integratedList.map(r => r.blogId).join(', ')}`);
  }

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const upserts = [];

  if (mode === 'blog') {
    // 순위/통합노출은 이미 받아온 결과에서 바로 계산되므로 먼저 동기적으로 채워두고,
    // 발행일 RSS 보강만(느린 부분) 블로그별로 순차 대기하지 않고 한꺼번에 병렬 조회한다.
    const prelim = blog_ids.map(storedKey => {
      const hit = fetchFailed ? null : findMatchingRank(rankings, storedKey);
      // 상위 5위까지만 "노출 성공"으로 판정 (스펙 2-C) — 6~10위도 매칭은 되지만
      // UI/집계상 순위권 밖으로 취급한다. 실제 순위 값은 rank 컬럼에 그대로 남긴다.
      const isRankedWithinTop5 = !!hit && hit.rank <= 5;
      return { storedKey, hit, isRankedWithinTop5, postDate: hit?.publishedDate || null };
    });

    // 검색결과에서 발행일을 못 얻었으면(상위 10위 밖) 블로그 RSS로 보강한다 —
    // RSS에도 없으면(오래된 글) null로 남고 내보내기 쪽에서 등록일로 대체된다.
    await Promise.all(prelim.map(async (p) => {
      if (p.postDate) return;
      const { blogId, logNo } = parsePostKeyString(p.storedKey);
      p.postDate = await fetchPostPublishedDate(blogId, logNo);
    }));

    for (const p of prelim) {
      upserts.push({
        blog_id: p.storedKey,
        rank: p.hit ? p.hit.rank : null,
        post_title: p.hit?.title || null,
        post_link: p.hit?.postLink || null,
        post_date: p.postDate,
        status: fetchFailed ? 'fetch_failed' : (p.isRankedWithinTop5 ? 'ranked' : 'not_in_top5'),
        integrated_exposed: fetchFailed ? null : !!findMatchingRank(integratedList, p.storedKey),
      });
    }
  } else if (fetchFailed) {
    upserts.push({ blog_id: '__fetch_failed__', rank: null, post_title: null, post_link: null, post_date: null, status: 'fetch_failed', integrated_exposed: null });
  } else {
    for (const r of rankings) {
      if (!r.blogId) continue;
      upserts.push({
        blog_id: r.blogId,
        rank: r.rank,
        post_title: r.title || null,
        post_link: r.postLink || null,
        post_date: r.publishedDate || null,
        status: 'ranked',
        integrated_exposed: null,
      });
    }
  }

  // 순위 변동 알림(Slack)은 "이번 갱신 직전까지의 최신 상태"와 비교해야 하므로,
  // upsert로 오늘 날짜 행을 덮어쓰기 전에 blog_id별 최신 스냅샷을 먼저 읽어둔다.
  let previousByBlog = new Map();
  if (mode === 'blog' && !fetchFailed) {
    const { rows: prevRows } = await pool.query(
      `SELECT DISTINCT ON (blog_id) blog_id, rank, status, integrated_exposed
       FROM rank_snapshots WHERE tracked_id = $1 ORDER BY blog_id, snapshotted_at DESC`,
      [trackedId]
    );
    previousByBlog = new Map(prevRows.map(r => [r.blog_id, r]));
  }

  for (const u of upserts) {
    await pool.query(
      `INSERT INTO rank_snapshots (tracked_id, blog_id, rank, post_title, post_link, post_date, status, integrated_exposed, snapshotted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (tracked_id, blog_id, snapshotted_at)
       DO UPDATE SET rank = EXCLUDED.rank, post_title = EXCLUDED.post_title,
                     post_link = EXCLUDED.post_link, post_date = EXCLUDED.post_date,
                     status = EXCLUDED.status,
                     integrated_exposed = EXCLUDED.integrated_exposed`,
      [trackedId, u.blog_id, u.rank, u.post_title, u.post_link, u.post_date, u.status, u.integrated_exposed, today]
    );
  }

  await pool.query(
    `UPDATE tracked_keywords SET last_refreshed_at = NOW() WHERE id = $1`,
    [trackedId]
  );

  if (mode === 'blog' && !fetchFailed) {
    const changes = diffRankChanges(previousByBlog, upserts);
    await notifyRankChanges(userId, keyword, changes);
  }

  console.log(`[rank-tracker] refresh ${fetchFailed ? '✗ fetch_failed' : '✓'} "${keyword}" mode=${mode} upserted=${upserts.length}`);
  return { refreshed: upserts.length, date: today, fetchFailed };
}

// 홈 대시보드용 요약 — 전체 그룹을 가로질러 현재 상태 집계 + 가장 최근 갱신에서 생긴
// 변화(diffRankChanges와 동일한 판정)를 함께 반환한다. Slack 알림과 달리 여기는 화면에
// 보여줄 목적이라 실제로 알림을 보내지는 않고, 각 링크의 "최근 2개 스냅샷"만 비교한다.
export async function getDashboardSummary(userId) {
  const empty = { totalKeywords: 0, totalLinks: 0, top5LinkCount: 0, integratedCount: 0, recentChanges: [] };
  const pool = getPool();
  if (!pool) return empty;

  const { rows: tracked } = await pool.query(
    `SELECT id, keyword, mode, blog_ids FROM tracked_keywords WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  const totalKeywords = tracked.length;
  const blogTracked = tracked.filter(t => t.mode === 'blog');
  const totalLinks = blogTracked.reduce((sum, t) => sum + (t.blog_ids?.length || 0), 0);
  if (!blogTracked.length) return { ...empty, totalKeywords };

  const trackedIds = blogTracked.map(t => t.id);
  const idToKeyword = new Map(blogTracked.map(t => [t.id, t.keyword]));

  const { rows: snaps } = await pool.query(
    `SELECT tracked_id, blog_id, rank, status, integrated_exposed,
            TO_CHAR(snapshotted_at, 'YYYY-MM-DD') AS snapshotted_at,
            ROW_NUMBER() OVER (PARTITION BY tracked_id, blog_id ORDER BY snapshotted_at DESC) AS rn
     FROM rank_snapshots WHERE tracked_id = ANY($1)`,
    [trackedIds]
  );

  const byPair = new Map();
  for (const s of snaps) {
    const rn = Number(s.rn);
    if (rn > 2) continue;
    const key = `${s.tracked_id}::${s.blog_id}`;
    if (!byPair.has(key)) byPair.set(key, {});
    if (rn === 1) byPair.get(key).latest = s;
    else byPair.get(key).previous = s;
  }

  let top5LinkCount = 0;
  let integratedCount = 0;
  const recentChanges = [];
  for (const { latest, previous } of byPair.values()) {
    if (!latest || latest.status === 'fetch_failed') continue;
    if (latest.status === 'ranked') top5LinkCount++;
    if (latest.integrated_exposed === true) integratedCount++;

    const previousByBlog = previous ? new Map([[latest.blog_id, previous]]) : new Map();
    const changes = diffRankChanges(previousByBlog, [{
      blog_id: latest.blog_id, rank: latest.rank, status: latest.status, integrated_exposed: latest.integrated_exposed,
    }]);
    for (const c of changes) {
      recentChanges.push({ keyword: idToKeyword.get(latest.tracked_id), ...c, date: latest.snapshotted_at });
    }
  }
  recentChanges.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return { totalKeywords, totalLinks, top5LinkCount, integratedCount, recentChanges: recentChanges.slice(0, 12) };
}
