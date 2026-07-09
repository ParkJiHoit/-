import { useEffect } from 'react';
import { X, RefreshCw, ExternalLink } from 'lucide-react';
import RankChart from '../RankChart';
import RankCalendar from '../RankCalendar';
import { formatRankStatus, formatKSTDateTime } from './trackerFormat';

export default function TrackerDetailDrawer({ open, onClose, mode, selected, snapshots, refreshing, onRefresh }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open || !selected) return null;

  const blogIds = selected.blog_ids || [];
  const latestRanks = selected.latestRanks || {};
  const latestDate = snapshots.length ? snapshots[0].snapshotted_at : null;
  const latestSnapshot = mode === 'all'
    ? snapshots.filter(s => s.snapshotted_at === latestDate).sort((a, b) => (a.rank || 99) - (b.rank || 99))
    : [];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 2001,
        width: 'min(560px, 45vw)', minWidth: 380,
        background: 'var(--bg-elevated)', borderLeft: '1px solid var(--border-strong)',
        boxShadow: '-16px 0 48px rgba(0,0,0,0.4)',
        overflowY: 'auto', padding: 22,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div className="mac-card" style={{ padding: '0 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>
                {selected.keyword}
                {mode === 'blog' && blogIds.length > 0 && (
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 10 }}>블로그 {blogIds.length}개 추적</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {selected.last_refreshed_at
                  ? `마지막 갱신: ${formatKSTDateTime(selected.last_refreshed_at)}`
                  : latestDate ? `마지막 갱신: ${latestDate}` : '아직 갱신 내역 없음'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={onRefresh}
                disabled={refreshing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-strong)',
                  color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                {refreshing ? '갱신 중…' : '순위 갱신'}
              </button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {mode === 'blog' && blogIds.length > 0 && (() => {
            const firstBlog = blogIds[0];
            const firstEntry = latestRanks[firstBlog] ?? null;
            const curRank = firstEntry?.rank ?? null;
            const curStatus = firstEntry?.status ?? null;
            const allRanks = snapshots.filter(s => s.blog_id === firstBlog && s.rank != null).map(s => s.rank);
            const bestRankVal = allRanks.length ? Math.min(...allRanks) : null;
            const trackDays = selected.created_at
              ? Math.max(1, Math.round((Date.now() - new Date(selected.created_at)) / 86400000))
              : 0;
            const curFormatted = formatRankStatus(curRank, curStatus);
            return (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 0' }}>
                {[
                  { label: '현재 순위', value: curFormatted.label, color: curFormatted.color },
                  { label: '최고 순위', value: bestRankVal != null ? `${bestRankVal}위` : '—', color: '#30D158' },
                  { label: '추적 기간', value: `${trackDays}일`, color: 'var(--text-primary)' },
                  { label: '총 기록', value: `${snapshots.filter(s => s.blog_id === firstBlog).length}회`, color: 'var(--text-primary)' },
                ].map(chip => (
                  <div key={chip.label} style={{
                    padding: '8px 14px', borderRadius: 10, minWidth: 80,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{chip.label}</span>
                    <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: chip.color, lineHeight: 1 }}>{chip.value}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        <div className="mac-card" style={{ padding: '18px 22px', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
            일별 노출 순위 — 캘린더
          </div>
          <RankCalendar
            snapshots={snapshots}
            blogIds={mode === 'blog' ? blogIds : [...new Set(snapshots.map(s => s.blog_id))]}
          />
        </div>

        {mode === 'blog' && (
          <div className="mac-card" style={{ padding: '18px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
              순위 추이
            </div>
            <RankChart snapshots={snapshots} blogIds={blogIds} />
          </div>
        )}

        {mode === 'all' && latestSnapshot.length > 0 && (
          <div className="mac-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                현재 블로그탭 상위 10위 ({latestDate})
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                  {['순위', '포스팅 제목', '블로그'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {latestSnapshot.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: s.rank <= 3 ? '#30D158' : 'var(--text-primary)' }}>{s.rank}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', maxWidth: 360 }}>
                      {s.post_link ? (
                        <a href={s.post_link} target="_blank" rel="noreferrer"
                          style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.post_title || '(제목 없음)'}</span>
                          <ExternalLink size={10} style={{ flexShrink: 0, opacity: 0.4 }} />
                        </a>
                      ) : (s.post_title || '(제목 없음)')}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--accent)' }}>{s.blog_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
