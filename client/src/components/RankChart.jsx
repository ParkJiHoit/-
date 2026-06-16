import { useState } from 'react';

const CHART_COLORS = [
  '#30D158', '#0A84FF', '#FF9F0A', '#BF5AF2',
  '#FF453A', '#34C1FF', '#FF6B35', '#5E5CE6',
];

function getDates(days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() + 9 * 60 * 60 * 1000 - i * 86400000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export default function RankChart({ snapshots = [], blogIds = [] }) {
  const [days, setDays] = useState(7);
  const dates = getDates(days);
  const W = 700, H = 140, PAD_L = 28, PAD_R = 50, PAD_T = 14, PAD_B = 10;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const MAX_RANK = 10;

  const byBlogDate = {};
  for (const s of snapshots) {
    if (!byBlogDate[s.blog_id]) byBlogDate[s.blog_id] = {};
    if (s.rank != null) byBlogDate[s.blog_id][s.snapshotted_at] = s.rank;
  }

  const displayBlogIds = blogIds.length ? blogIds : [...new Set(snapshots.map(s => s.blog_id))];

  const rankToY = (rank) => PAD_T + ((rank - 1) / (MAX_RANK - 1)) * chartH;
  const idxToX = (i) => PAD_L + (i / (dates.length - 1)) * chartW;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 10 }}>
        {[7, 30].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              padding: '4px 12px', borderRadius: 7, border: '1px solid',
              borderColor: days === d ? 'rgba(10,132,255,0.4)' : 'var(--border-strong)',
              background: days === d ? 'rgba(10,132,255,0.12)' : 'rgba(255,255,255,0.05)',
              color: days === d ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {d}일
          </button>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          {[1, 3, 5, 7, 10].map(rank => {
            const y = rankToY(rank);
            return (
              <g key={rank}>
                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                  stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <text x={PAD_L - 4} y={y + 3} fontSize="9"
                  fill="rgba(255,255,255,0.25)" textAnchor="end">{rank}위</text>
              </g>
            );
          })}

          {displayBlogIds.map((blogId, colorIdx) => {
            const color = CHART_COLORS[colorIdx % CHART_COLORS.length];
            const points = dates
              .map((date, i) => {
                const rank = byBlogDate[blogId]?.[date];
                return rank != null ? { x: idxToX(i), y: rankToY(rank), rank } : null;
              })
              .filter(Boolean);

            if (points.length < 1) return null;

            const segments = [];
            let seg = [points[0]];
            for (let i = 1; i < points.length; i++) {
              seg.push(points[i]);
            }
            if (seg.length) segments.push(seg);

            return (
              <g key={blogId}>
                {segments.map((s, si) => (
                  <polyline
                    key={si}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={s.map(p => `${p.x},${p.y}`).join(' ')}
                  />
                ))}
                {points.length > 0 && (() => {
                  const last = points[points.length - 1];
                  return (
                    <g>
                      <circle cx={last.x} cy={last.y} r="4" fill={color} />
                      <text x={last.x + 7} y={last.y + 4} fontSize="9"
                        fill={color} fontWeight="700">{last.rank}위</text>
                    </g>
                  );
                })()}
              </g>
            );
          })}
        </svg>

        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: PAD_L, paddingRight: PAD_R, marginTop: 4 }}>
          {dates.filter((_, i) => i === 0 || i === Math.floor(dates.length / 2) || i === dates.length - 1).map(d => (
            <span key={d} style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              {d.slice(5).replace('-', '/')}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
        {displayBlogIds.map((blogId, i) => (
          <div key={blogId} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 20, height: 2, background: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 1 }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{blogId}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
