import { useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import TrackerStatCards from '../components/rankTracker/TrackerStatCards';
import { formatRankStatus } from '../components/rankTracker/trackerFormat';
import logoLight from '../assets/logo-light.png';
import logoDark from '../assets/logo-dark.png';

// 사이트 전체에서 쓰는 뱃지 팔레트(client/src/styles.css의 .mac-badge-*)를 그대로
// 재사용한다 — 리포트 페이지만을 위한 새 색상 체계를 만들지 않는다.
function rankBadgeClass(status, rank) {
  if (status === 'fetch_failed') return 'mac-badge mac-badge-orange';
  if (status === 'ranked' && rank != null) return rank <= 3 ? 'mac-badge mac-badge-green' : 'mac-badge mac-badge-orange';
  return 'mac-badge mac-badge-gray';
}

function earliestAddedDate(item) {
  const dates = Object.values(item.latestRanks || {}).map(r => r.addedDate).filter(Boolean);
  return dates.length ? dates.sort().at(-1) : null; // 링크 여러 개면 "가장 최근에 추가된 링크" 기준으로 정렬
}

export default function SharedReportPage({ token }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(''); // '' = 전체

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public-reports/${encodeURIComponent(token)}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || '리포트를 불러오지 못했습니다.');
        if (!cancelled) setReport(body);
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const filteredItems = useMemo(() => {
    if (!report) return [];
    const scoped = !selectedGroupId
      ? report.items
      : report.items.filter(i => String(i.group_id ?? '') === selectedGroupId);
    return [...scoped].sort((a, b) => {
      const ad = earliestAddedDate(a) || '';
      const bd = earliestAddedDate(b) || '';
      return bd.localeCompare(ad); // 최신이 위로
    });
  }, [report, selectedGroupId]);

  const filteredChanges = useMemo(() => {
    if (!report) return [];
    if (!selectedGroupId) return report.changes;
    const keywordsInScope = new Set(filteredItems.map(i => i.keyword));
    return report.changes.filter(c => keywordsInScope.has(c.keyword));
  }, [report, selectedGroupId, filteredItems]);

  const mode = filteredItems[0]?.mode || 'blog';
  const showGroupSwitcher = !!report && report.groups.length > 0;
  const headerTitle = selectedGroupId
    ? report?.groups.find(g => String(g.id) === selectedGroupId)?.name
    : (report?.groupName || '전체 그룹');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={logoDark} alt="RANKLET" style={{ height: 22, width: 'auto' }} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>순위 추적 공유 리포트</span>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)', fontSize: 13 }}>불러오는 중…</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <div style={{ fontSize: 40, opacity: 0.25, marginBottom: 12 }}>🔒</div>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0 }}>{error}</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>{headerTitle}</h1>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                  추적 키워드 {filteredItems.length}개 · 최근 14일 이내 등록된 링크만 표시 · 읽기 전용 공유 리포트
                </p>
              </div>
              {showGroupSwitcher && (
                <select
                  value={selectedGroupId}
                  onChange={e => setSelectedGroupId(e.target.value)}
                  style={{
                    height: 34, padding: '0 10px', borderRadius: 8,
                    background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
                    color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="">전체 그룹</option>
                  {report.groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                </select>
              )}
            </div>

            <div style={{ margin: '20px 0' }}>
              <TrackerStatCards mode={mode} filteredItems={filteredItems} compact />
            </div>

            {filteredChanges.length > 0 && (
              <div className="mac-card" style={{ padding: '16px 20px', margin: '0 0 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  <TrendingUp size={15} style={{ color: '#30D158' }} />
                  주요 변동사항
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredChanges.map((c, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {c.type === 'new_top5' ? '📈 5위 이내 신규 진입: ' : '📈 '}
                      <b style={{ color: 'var(--text-primary)' }}>{c.keyword}</b>
                      {c.type === 'improved' && <> {c.fromRank}위 → <b style={{ color: '#30D158' }}>{c.toRank}위</b></>}
                      {c.type === 'new_top5' && <> (<b style={{ color: '#30D158' }}>{c.toRank}위</b>)</>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {filteredItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)', fontSize: 13 }}>
                최근 14일 이내 등록된 추적 항목이 없습니다.
              </div>
            ) : (
              <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table className="mac-table" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '10%' }}>등록일</th>
                      <th style={{ width: '22%' }}>키워드</th>
                      <th style={{ width: '28%' }}>블로그</th>
                      <th style={{ width: '12%' }}>검색량</th>
                      <th style={{ width: '12%' }}>순위</th>
                      <th style={{ width: '16%' }}>통검</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.flatMap((item, idx) => {
                      const blogIds = item.mode === 'blog' ? (item.blog_ids || []) : [];
                      const rows = blogIds.length ? blogIds : [null];
                      return rows.map((blogId, i) => {
                        const entry = blogId ? item.latestRanks?.[blogId] : null;
                        const { label } = formatRankStatus(entry?.rank ?? null, entry?.status ?? null);
                        return (
                          <tr key={`${idx}-${blogId ?? 'x'}-${i}`} style={{ borderTop: i === 0 ? '2px solid var(--border-strong)' : undefined }}>
                            <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{i === 0 ? (entry?.addedDate || '—') : ''}</td>
                            <td style={{ fontWeight: i === 0 ? 700 : 400, color: i === 0 ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                              {i === 0 ? item.keyword : '↳'}
                            </td>
                            <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{blogId || '—'}</td>
                            <td>{i === 0 ? (item.searchVolume ?? '—') : ''}</td>
                            <td>{blogId ? <span className={rankBadgeClass(entry?.status ?? null, entry?.rank ?? null)}>{label}</span> : '—'}</td>
                            <td style={{ color: entry?.integratedExposed ? '#0A84FF' : 'var(--text-tertiary)', fontWeight: 700 }}>
                              {entry?.integratedExposed == null ? '—' : (entry.integratedExposed ? 'O' : 'X')}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
