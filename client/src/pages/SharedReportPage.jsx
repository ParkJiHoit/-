import { useEffect, useState } from 'react';
import { formatRankStatus } from '../components/rankTracker/trackerFormat';
import logoLight from '../assets/logo-light.png';
import logoDark from '../assets/logo-dark.png';

export default function SharedReportPage({ token }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 4px' }}>{report.groupName}</h1>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 24px' }}>
              추적 키워드 {report.items.length}개 · 읽기 전용 공유 리포트
            </p>

            {report.items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)', fontSize: 13 }}>
                이 그룹에는 아직 추적 중인 키워드가 없습니다.
              </div>
            ) : (
              <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table className="mac-table" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '24%' }}>키워드</th>
                      <th style={{ width: '32%' }}>블로그</th>
                      <th style={{ width: '14%' }}>검색량</th>
                      <th style={{ width: '14%' }}>순위</th>
                      <th style={{ width: '16%' }}>통검</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.items.flatMap((item, idx) => {
                      const blogIds = item.mode === 'blog' ? (item.blog_ids || []) : [];
                      const rows = blogIds.length ? blogIds : [null];
                      return rows.map((blogId, i) => {
                        const entry = blogId ? item.latestRanks?.[blogId] : null;
                        const { label, color } = formatRankStatus(entry?.rank ?? null, entry?.status ?? null);
                        return (
                          <tr key={`${idx}-${blogId ?? 'x'}-${i}`} style={{ borderTop: i === 0 ? '2px solid var(--border-strong)' : undefined }}>
                            <td style={{ fontWeight: i === 0 ? 700 : 400, color: i === 0 ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                              {i === 0 ? item.keyword : '↳'}
                            </td>
                            <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{blogId || '—'}</td>
                            <td>{i === 0 ? (item.searchVolume ?? '—') : ''}</td>
                            <td style={{ color, fontWeight: 700 }}>{blogId ? label : '—'}</td>
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
