import { useState } from 'react';
import { BarChart3 } from 'lucide-react';

const MAX_BARS = 20;
const LABEL_WIDTH = 150;

// 순위 구간별 색상 — mac-badge/기존 순위 뱃지와 같은 팔레트를 재사용한다.
function rankTier(rank) {
  if (rank <= 3) return { color: '#30D158', label: '상위 3위' };
  if (rank <= 5) return { color: '#FF9F0A', label: '4~5위' };
  return { color: '#8E8E93', label: '6~10위' };
}

// 링크별 순위를 가로 막대로 보여준다 — 순위표를 한 줄씩 읽는 대신 한눈에
// "누가 잘하고 있는지" 스캔할 수 있게 한다. 순위 데이터가 없는 링크(미노출·
// 조회실패)는 막대로 표현할 magnitude가 없으므로 여기서 제외하고 표에서만 보여준다.
export default function RankBarChart({ items }) {
  const [hoveredKey, setHoveredKey] = useState(null);

  const rows = [];
  for (const item of items) {
    for (const blogId of item.blog_ids || []) {
      const entry = item.latestRanks?.[blogId];
      if (!entry || entry.rank == null) continue;
      rows.push({ key: `${item.id}:${blogId}`, keyword: item.keyword, blogId, rank: entry.rank });
    }
  }
  rows.sort((a, b) => a.rank - b.rank);
  if (!rows.length) return null;

  const shown = rows.slice(0, MAX_BARS);
  const hiddenCount = rows.length - shown.length;

  return (
    <div className="mac-card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
        <BarChart3 size={15} style={{ color: '#0A84FF' }} />
        키워드별 순위
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {shown.map(row => {
          const tier = rankTier(row.rank);
          const pct = ((11 - row.rank) / 10) * 100;
          const hovered = hoveredKey === row.key;
          return (
            <div
              key={row.key}
              onMouseEnter={() => setHoveredKey(row.key)}
              onMouseLeave={() => setHoveredKey(null)}
              onFocus={() => setHoveredKey(row.key)}
              onBlur={() => setHoveredKey(null)}
              tabIndex={0}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, position: 'relative',
                padding: '3px 4px', borderRadius: 6, outline: 'none',
                background: hovered ? 'var(--bg-overlay)' : 'transparent', transition: 'background 0.15s',
              }}
            >
              <span style={{
                width: LABEL_WIDTH, flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {row.keyword}
              </span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-overlay)', overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%', borderRadius: 4, background: tier.color,
                  transition: 'width 0.6s cubic-bezier(0.34,1.2,0.64,1)',
                }} />
              </div>
              <span style={{ width: 34, flexShrink: 0, textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: tier.color }}>
                {row.rank}위
              </span>
              {hovered && (
                <div style={{
                  position: 'absolute', left: LABEL_WIDTH + 10, bottom: '100%', marginBottom: 6,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8,
                  padding: '6px 10px', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.35)', zIndex: 10, pointerEvents: 'none',
                }}>
                  <b style={{ color: 'var(--text-primary)' }}>{row.blogId}</b> · <span style={{ color: tier.color, fontWeight: 700 }}>{row.rank}위</span> ({tier.label})
                </div>
              )}
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
          외 {hiddenCount}개 링크는 아래 표에서 확인하세요.
        </p>
      )}
    </div>
  );
}
