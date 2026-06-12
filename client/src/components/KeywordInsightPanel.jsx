import { useState, useEffect } from 'react';
import { formatNumber, formatPercent, formatScore } from '../utils/formatters';

/* ─── Skeleton ─── */
function Skeleton({ width = '100%', height = 8, radius = 6 }) {
  return (
    <div style={{
      width, height,
      background: 'var(--bg-overlay)',
      borderRadius: radius,
      animation: 'kip-pulse 1.6s ease-in-out infinite',
    }} />
  );
}

/* ─── Section label ─── */
function Label({ children }) {
  return (
    <p style={{
      margin: '0 0 14px',
      fontSize: 11, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--text-secondary)',
    }}>
      {children}
    </p>
  );
}

/* ─── Smooth path helpers ─── */
function catmullRom(pts, tension = 0.4) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/* ─── Weekly aggregate helper (90 daily points → ~13 weekly) ─── */
function weeklyAggregate(trend) {
  if (!trend?.length) return [];
  const result = [];
  for (let i = 0; i < trend.length; i += 7) {
    const week = trend.slice(i, Math.min(i + 7, trend.length));
    const avg = week.reduce((s, d) => s + d.ratio, 0) / week.length;
    result.push({ period: week[0].period, ratio: avg });
  }
  return result;
}

/* ─── Yearly aggregate helper (monthly data → per-year average + sum) ─── */
function aggregateByYear(monthlyData) {
  if (!monthlyData?.length) return [];
  const map = new Map();
  monthlyData.forEach((d) => {
    const yr = d.period.slice(0, 4);
    if (!map.has(yr)) map.set(yr, { sum: 0, n: 0 });
    const e = map.get(yr); e.sum += d.ratio; e.n++;
  });
  return Array.from(map.entries())
    .map(([period, { sum, n }]) => ({ period, ratio: sum / n, sum }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

/* ─── Mini sparkline for KPI cards ─── */
function MiniSparkline({ data }) {
  if (!data?.length) return <div style={{ width: 80, height: 52 }} />;
  const W = 80, H = 52;
  const ratios = data.map((d) => d.ratio);
  const max = Math.max(...ratios) || 1;
  const min = Math.min(...ratios);
  const range = max - min || 1;
  const pts = data.map((d, i) => [
    (i / (data.length - 1)) * W,
    H - 4 - ((d.ratio - min) / range) * (H - 8),
  ]);
  const path = catmullRom(pts, 0.2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H, flexShrink: 0 }}>
      <path d={path} fill="none" stroke="rgba(120,120,128,0.5)" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Trend stats helper ─── */
function computeTrendStats(trend) {
  if (!trend?.length) return {};

  // True MoM: last 30 days vs previous 30 days (requires 60+ days of data)
  const last30 = trend.slice(-30);
  const prev30 = trend.slice(-60, -30);
  let changePercent = null;
  if (prev30.length >= 15) {
    const prevAvg = prev30.reduce((s, d) => s + d.ratio, 0) / prev30.length;
    const currAvg = last30.reduce((s, d) => s + d.ratio, 0) / last30.length;
    changePercent = prevAvg > 0 ? ((currAvg - prevAvg) / prevAvg) * 100 : null;
  }

  // Weekly: prevWeek vs prevPrevWeek — both complete periods, avoids partial-week distortion
  const thisWeek     = trend.slice(-7);
  const prevWeek     = trend.slice(-14, -7);
  const prevPrevWeek = trend.slice(-21, -14);
  const weekSum      = thisWeek.reduce((s, d) => s + d.ratio, 0);
  const prevWeekSum  = prevWeek.reduce((s, d) => s + d.ratio, 0);
  const prevPrevWeekSum = prevPrevWeek.reduce((s, d) => s + d.ratio, 0);
  const weekChange = prevPrevWeekSum > 0 ? ((prevWeekSum - prevPrevWeekSum) / prevPrevWeekSum) * 100 : null;

  return { changePercent, weekSum, prevWeekSum, weekChange };
}

/* ─── Trend line chart ─── */
function TrendChart({ data, loading, keyword = '' }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const W = 560, H = 240;
  const pad = { t: 14, r: 10, b: 32, l: 34 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;

  if (loading) {
    return (
      <div style={{ height: H, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, padding: '0 4px' }}>
        <Skeleton height={2} radius={2} />
        <Skeleton height={2} width="75%" radius={2} />
        <Skeleton height={2} width="55%" radius={2} />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>데이터를 불러올 수 없습니다</span>
      </div>
    );
  }

  const ratios = data.map((d) => d.ratio);
  const maxR = Math.max(...ratios) || 1;

  // Y-axis always starts at 0 so visual scale is accurate
  const px = (i) => pad.l + (i / (data.length - 1)) * cW;
  const py = (r) => pad.t + cH * (1 - r / maxR);
  const pts = data.map((d, i) => [px(i), py(d.ratio)]);

  const linePath = catmullRom(pts, 0.18);
  const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${(pad.t + cH).toFixed(1)} L${pad.l},${(pad.t + cH).toFixed(1)}Z`;

  const step = Math.max(1, Math.floor(data.length / 5));
  const xIdxs = [...new Set([0, step, step * 2, step * 3, step * 4, data.length - 1])].filter(i => i < data.length);
  const yTicks = [0, 0.5, 1].map((r) => ({
    gridY: pad.t + cH * (1 - r),
    label: Math.round(maxR * r),
  }));

  const handleMouseMove = (e) => {
    const svgEl = e.currentTarget.ownerSVGElement;
    const rect = svgEl.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) * (W / rect.width);
    let closest = 0, minDist = Infinity;
    pts.forEach(([px], i) => {
      const d = Math.abs(px - svgX);
      if (d < minDist) { minDist = d; closest = i; }
    });
    setHoveredIdx(closest);
  };

  const hovered = hoveredIdx !== null ? hoveredIdx : null;
  const [hx, hy] = hovered !== null ? pts[hovered] : [0, 0];
  const tooltipLabel = keyword || '검색량';
  const tooltipW = Math.max(110, tooltipLabel.length * 10 + 64);
  const tooltipH = 44;
  const tx = Math.min(Math.max(hx - tooltipW / 2, pad.l + 2), W - pad.r - tooltipW - 2);
  const ty = Math.max(hy - tooltipH - 10, pad.t + 2);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="kip-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(10,132,255,0.28)" />
          <stop offset="100%" stopColor="rgba(10,132,255,0.00)" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map(({ gridY, label }) => (
        <g key={gridY}>
          <line x1={pad.l} y1={gridY} x2={pad.l + cW} y2={gridY}
            stroke="var(--border)" strokeWidth="1" />
          <text x={pad.l - 6} y={gridY + 4}
            textAnchor="end" fontSize="9" fill="var(--text-tertiary)">{label}</text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#kip-grad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke="var(--accent)"
        strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* X-axis labels */}
      {xIdxs.map((i) => (
        <text key={i} x={pts[i][0]} y={H - 5}
          textAnchor="middle" fontSize="9" fill="var(--text-tertiary)">
          {data[i].period.slice(5)}
        </text>
      ))}

      {/* Hover overlay */}
      <rect
        x={pad.l} y={pad.t} width={cW} height={cH}
        fill="transparent" style={{ cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
      />

      {/* Hover indicator */}
      {hovered !== null && (
        <g>
          <line x1={hx} y1={pad.t} x2={hx} y2={pad.t + cH}
            stroke="var(--border)" strokeWidth="1" strokeDasharray="4,3" />
          <circle cx={hx} cy={hy} r={5}
            fill="var(--accent)" stroke="var(--bg-base)" strokeWidth="2.5" />
          <rect x={tx} y={ty} width={tooltipW} height={tooltipH}
            rx={9} fill="var(--bg-overlay)"
            style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.4))' }}
          />
          {/* Date line */}
          <text x={tx + 11} y={ty + 14}
            fontSize="10" fill="var(--text-tertiary)" fontWeight="500">
            {data[hovered].period.slice(5)}
          </text>
          {/* Dot + keyword: value */}
          <circle cx={tx + 14} cy={ty + 29} r={4} fill="var(--accent)" />
          <text x={tx + 23} y={ty + 33}
            fontSize="10.5" fontWeight="700" fill="var(--text-primary)">
            {tooltipLabel}: {Math.round(data[hovered].ratio)}회
          </text>
        </g>
      )}
    </svg>
  );
}

/* ─── Vertical bar chart ─── */
function VBarChart({ items, loading, height = 110, count = 7, unit = '' }) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const LABEL_H = 20;
  const BAR_AREA = height - LABEL_H;
  const MAX_BAR_W = 24;
  const GAP = 3;

  if (loading) {
    const placeholders = [72, 100, 85, 55, 78, 45, 60].slice(0, count);
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: GAP, height, justifyContent: 'center' }}>
        {placeholders.map((h, i) => (
          <div key={i} style={{
            width: MAX_BAR_W, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, justifyContent: 'flex-end',
          }}>
            <Skeleton height={Math.round((h / 100) * BAR_AREA)} radius={8} />
            <Skeleton height={8} width="65%" radius={3} />
          </div>
        ))}
      </div>
    );
  }

  if (!items?.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>데이터 없음</span>
      </div>
    );
  }

  const max = Math.max(...items.map((it) => it.value ?? 0), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: GAP, height, justifyContent: 'center' }}>
      {items.map(({ label, value, color }) => {
        const v = value ?? 0;
        const barH = Math.max(4, Math.round((v / max) * BAR_AREA));
        const isMax = v === max;
        const isHovered = hoveredKey === label;
        const barColor = color ?? 'var(--accent)';
        const tooltipVal = unit === '%' ? `${Math.round(v)}%` : v.toFixed(1);

        return (
          <div
            key={label}
            style={{
              width: MAX_BAR_W, flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'flex-end',
              height: '100%',
              position: 'relative',
              cursor: 'default',
            }}
            onMouseEnter={() => setHoveredKey(label)}
            onMouseLeave={() => setHoveredKey(null)}
          >
            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Tooltip */}
            {isHovered && (
              <div style={{
                position: 'absolute',
                bottom: LABEL_H + barH + 8,
                left: '50%', transform: 'translateX(-50%)',
                background: 'var(--bg-overlay)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '4px 9px',
                fontSize: 11, fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 20,
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              }}>
                {tooltipVal}
              </div>
            )}

            {/* Bar */}
            <div style={{
              width: '78%',
              height: barH,
              background: barColor,
              opacity: isHovered ? 1 : (isMax ? 0.9 : 0.42),
              borderRadius: '8px 8px 0 0',
              transition: 'opacity 0.15s, height 0.45s cubic-bezier(0.34,1.56,0.64,1)',
              boxShadow: isHovered ? `0 0 12px ${barColor}55` : 'none',
            }} />

            {/* Label */}
            <span style={{
              fontSize: 10.5, color: isHovered ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              lineHeight: 1, textAlign: 'center',
              height: LABEL_H, display: 'flex', alignItems: 'center',
              whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'color 0.15s',
            }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── News / Blog section ─── */
const SOURCE_COLORS = ['#0A84FF', '#30D158', '#FF9F0A', '#BF5AF2', '#FF375F', '#32ADE6'];
function sourceColor(source) {
  let h = 0;
  for (let i = 0; i < source.length; i++) h = (h * 31 + source.charCodeAt(i)) & 0xffff;
  return SOURCE_COLORS[h % SOURCE_COLORS.length];
}

function NewsSection({ items, loading }) {
  const newsOnly = items?.filter((it) => it.type !== 'blog');
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[90, 75, 85, 70].map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Skeleton width={28} height={28} radius={8} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Skeleton height={10} width={`${w}%`} radius={4} />
              <Skeleton height={8} width="35%" radius={4} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!newsOnly?.length) {
    return (
      <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
        관련 기사를 불러올 수 없습니다
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {newsOnly.map((item, i) => {
        const color = sourceColor(item.source || String(i));
        const initial = (item.source || '?')[0].toUpperCase();
        return (
          <a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 8, transition: 'background 0.12s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-overlay)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 7, flexShrink: 0,
              background: color + '22', border: `1px solid ${color}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color,
            }}>
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: 12, fontWeight: 500,
                color: 'var(--text-primary)', lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {item.title}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                {item.time}{item.time && item.source ? ' · ' : ''}{item.source}
                {item.type === 'blog' && <span style={{ marginLeft: 4, fontSize: 9.5, color: '#30D158', fontWeight: 600 }}>블로그</span>}
              </p>
            </div>
          </a>
        );
      })}
    </div>
  );
}

/* ─── Horizontal gender bars ─── */
function GenderBars({ gender, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[['남성', '65%'], ['여성', '45%']].map(([label, w]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 26, textAlign: 'right' }}>{label}</span>
            <Skeleton height={14} width={w} radius={6} />
          </div>
        ))}
      </div>
    );
  }

  if (!gender) {
    return (
      <div style={{ height: 44, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>데이터 없음</span>
      </div>
    );
  }

  const rows = [
    { label: '남성', pct: gender.male,   color: 'var(--accent)' },
    { label: '여성', pct: gender.female, color: '#BF5AF2' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {rows.map(({ label, pct, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 26, textAlign: 'right', flexShrink: 0 }}>
            {label}
          </span>
          <div style={{ flex: 1, height: 14, background: 'var(--bg-overlay)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`, height: '100%',
              background: color, borderRadius: 6,
              transition: 'width 0.55s cubic-bezier(0.34,1.2,0.64,1)',
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', width: 32, textAlign: 'right', flexShrink: 0 }}>
            {pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Error notice ─── */
function InsightsErrorNotice({ message }) {
  const isAuth = /401|403|권한|인증/i.test(message ?? '');
  return (
    <div className="mac-card" style={{
      padding: '12px 18px',
      background: 'rgba(255,149,0,0.06)',
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠️</span>
      <div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          트렌드 데이터를 불러올 수 없습니다
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          {isAuth
            ? '네이버 개발자 센터 → 내 애플리케이션 → 사용 API에서 "데이터랩(검색어트렌드)"를 추가해 주세요.'
            : message}
        </p>
      </div>
    </div>
  );
}

/* ─── Blog ranking table ─── */
function BlogRankingSection({ rankings, loading }) {
  const rankColor = (r) => r === 1 ? '#FFD60A' : r === 2 ? '#A1A1A6' : r === 3 ? '#C96B2E' : 'var(--text-tertiary)';

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 48px 52px', gap: '0 8px', padding: '0 4px 7px', borderBottom: '1px solid var(--border)', marginBottom: 3 }}>
          {['#', '제목 · 작성자', '발행일', '방문자/일'].map((h, i) => (
            <span key={h} style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: i > 1 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        {[92, 78, 85, 70, 88, 75, 82].map((w, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 48px 52px', gap: '0 8px', padding: '7px 4px', alignItems: 'center' }}>
            <Skeleton width={16} height={14} radius={3} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Skeleton height={10} width={`${w}%`} radius={3} />
              <Skeleton height={8} width="38%" radius={3} />
            </div>
            <Skeleton height={9} width="90%" radius={3} />
            <Skeleton height={9} width="80%" radius={3} />
          </div>
        ))}
      </div>
    );
  }

  if (!rankings?.length) {
    return <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '12px 0' }}>데이터를 불러올 수 없습니다</div>;
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 48px 52px', gap: '0 8px', padding: '0 4px 7px', borderBottom: '1px solid var(--border)', marginBottom: 3 }}>
        {['#', '제목 · 작성자', '발행일', '방문자/일'].map((h, i) => (
          <span key={h} style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: i > 1 ? 'right' : 'left' }}>{h}</span>
        ))}
      </div>
      {rankings.map((item) => (
        <a
          key={item.rank}
          href={item.postLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: '20px 1fr 48px 52px', gap: '0 8px', padding: '6px 4px', borderRadius: 6, alignItems: 'center', transition: 'background 0.12s' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-overlay)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: rankColor(item.rank), textAlign: 'center', lineHeight: 1 }}>{item.rank}</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11.5, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
            <p style={{ margin: '2px 0 0', fontSize: 9.5, color: 'var(--text-tertiary)', lineHeight: 1 }}>{item.author}</p>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'right' }}>{item.date}</span>
          <span style={{ fontSize: 11, fontWeight: item.dailyVisitors ? 600 : 400, color: item.dailyVisitors ? 'var(--text-primary)' : 'var(--text-tertiary)', textAlign: 'right' }}>
            {item.dailyVisitors != null ? formatNumber(item.dailyVisitors) : '—'}
          </span>
        </a>
      ))}
    </div>
  );
}

/* ─── Main Panel ─── */
export default function KeywordInsightPanel({ baseKeyword, keywordRow, insights, insightsLoading, insightsError }) {
  const [trendPeriod, setTrendPeriod] = useState('daily');
  const [blogRankings, setBlogRankings] = useState(null);
  const [blogRankingsLoading, setBlogRankingsLoading] = useState(false);

  useEffect(() => {
    if (!baseKeyword) return;
    setBlogRankings(null);
    setBlogRankingsLoading(true);
    const controller = new AbortController();
    fetch(`/api/keywords/blog-rankings?keyword=${encodeURIComponent(baseKeyword)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { setBlogRankings(data); setBlogRankingsLoading(false); })
      .catch((e) => { if (e?.name !== 'AbortError') setBlogRankingsLoading(false); });
    return () => controller.abort();
  }, [baseKeyword]);

  // changePercent reflects MoM search trend index — only meaningful for "총 검색량"
  const kpis = [
    { label: '총 검색량',   value: keywordRow ? formatNumber(keywordRow.totalSearch) : '—', showChange: true },
    { label: '모바일 비중', value: keywordRow ? formatPercent(keywordRow.mobileRatio) : '—',  showChange: false },
    { label: '평균 CTR',   value: keywordRow ? formatPercent(keywordRow.averageCtr) : '—',   showChange: false },
    { label: '효율 점수',  value: keywordRow ? formatScore(keywordRow.efficiencyScore) : '—', showChange: false },
  ];

  const { changePercent, weekSum, prevWeekSum, weekChange } = computeTrendStats(insights?.trend);

  // Weekly-aggregated sparkline data (90 daily → ~13 weekly points, much smoother)
  const sparklineData = weeklyAggregate(insights?.trend);

  // Period-based chart data
  const yearlyData = aggregateByYear(insights?.trendYearly);
  const PERIOD_OPTIONS = [
    { key: 'daily',   label: '일간', title: '일별 트렌드 추이',  data: insights?.trend },
    { key: 'monthly', label: '월간', title: '월별 트렌드 추이',  data: insights?.trendMonthly },
    { key: 'yearly',  label: '연간', title: '연간 트렌드 추이',  data: yearlyData },
  ];
  const activePeriod = PERIOD_OPTIONS.find((p) => p.key === trendPeriod) || PERIOD_OPTIONS[0];

  // Scale DataLab ratios → actual search counts using Search Ad API monthly total as anchor.
  // dailyScale: totalSearch ÷ prev-month daily ratio sum  (for weekly/monthly stats)
  // monthlyScale: totalSearch ÷ prev-month trendMonthly ratio  (for yearly stats)
  const { dailyScale, monthlyScale } = (() => {
    const actual = keywordRow?.totalSearch;
    if (!actual || !insights?.trend?.length) return {};
    const now = new Date();
    const prevM     = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevMYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const prevDailySum = insights.trend
      .filter((pt) => { const d = new Date(pt.period); return d.getFullYear() === prevMYear && d.getMonth() === prevM; })
      .reduce((s, pt) => s + pt.ratio, 0);
    const dailyScale = prevDailySum > 0 ? actual / prevDailySum : null;

    const prevMonthStr = `${prevMYear}-${String(prevM + 1).padStart(2, '0')}`;
    const prevMonthEntry = insights.trendMonthly?.find((d) => d.period.startsWith(prevMonthStr));
    const monthlyScale = prevMonthEntry?.ratio > 0 ? actual / prevMonthEntry.ratio : null;

    return { dailyScale, monthlyScale };
  })();

  // searchHistory: [{year, month, pc_search, mobile_search, total_search}] — actual DB data
  const history = insights?.searchHistory || [];
  const historyGet = (year, month) => history.find((h) => h.year === year && h.month === month);

  // Dynamic right-side stats — DB 실수치 우선, 없으면 DataLab 스케일링 폴백
  const periodStats = (() => {
    if (trendPeriod === 'daily') {
      if (!prevWeekSum) return null;
      const value = dailyScale
        ? formatNumber(Math.round(prevWeekSum * dailyScale))
        : Math.round(prevWeekSum).toString();
      // 주간은 항상 DataLab 스케일링 (Search Ad API가 주간 단위 미제공)
      return { label: '전주 검색량', value, change: weekChange, isEstimate: true };
    }
    if (trendPeriod === 'monthly') {
      const now = new Date();
      const prevM     = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const prevMYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const prevPrevM     = prevM === 0 ? 11 : prevM - 1;
      const prevPrevMYear = prevM === 0 ? prevMYear - 1 : prevMYear;

      // DB 실수치 우선
      const dbPrev     = historyGet(prevMYear, prevM + 1);
      const dbPrevPrev = historyGet(prevPrevMYear, prevPrevM + 1);
      if (dbPrev) {
        const prevTotal     = dbPrev.total_search;
        const prevPrevTotal = dbPrevPrev?.total_search ?? 0;
        const change = prevPrevTotal > 0 ? ((prevTotal - prevPrevTotal) / prevPrevTotal) * 100 : null;
        return { label: '전월 검색량', value: formatNumber(prevTotal), change, isEstimate: false };
      }

      // 폴백: DataLab 스케일링
      const d = insights?.trend;
      if (!d?.length) return null;
      const prevData     = d.filter((pt) => { const dt = new Date(pt.period); return dt.getFullYear() === prevMYear && dt.getMonth() === prevM; });
      const prevPrevData = d.filter((pt) => { const dt = new Date(pt.period); return dt.getFullYear() === prevPrevMYear && dt.getMonth() === prevPrevM; });
      if (!prevData.length) return null;
      const prevSum     = prevData.reduce((s, pt) => s + pt.ratio, 0);
      const prevPrevSum = prevPrevData.reduce((s, pt) => s + pt.ratio, 0);
      const change = prevPrevSum > 0 ? ((prevSum - prevPrevSum) / prevPrevSum) * 100 : null;
      const value = dailyScale ? formatNumber(Math.round(prevSum * dailyScale)) : Math.round(prevSum).toString();
      return { label: '전월 검색량', value, change, isEstimate: true };
    }
    if (trendPeriod === 'yearly') {
      const now = new Date();
      const prevYear     = now.getFullYear() - 1;
      const prevPrevYear = now.getFullYear() - 2;

      // DB 실수치 우선 — 해당 연도 월별 합산
      const dbPrevYear     = history.filter((h) => h.year === prevYear);
      const dbPrevPrevYear = history.filter((h) => h.year === prevPrevYear);
      if (dbPrevYear.length > 0) {
        const prevTotal     = dbPrevYear.reduce((s, h) => s + h.total_search, 0);
        const prevPrevTotal = dbPrevPrevYear.reduce((s, h) => s + h.total_search, 0);
        const change = prevPrevTotal > 0 ? ((prevTotal - prevPrevTotal) / prevPrevTotal) * 100 : null;
        return { label: '전년 검색량', value: formatNumber(prevTotal), change, isEstimate: false };
      }

      // 폴백: DataLab 스케일링
      if (!yearlyData.length) return null;
      const prevEntry     = yearlyData.find((d) => d.period === prevYear.toString());
      const prevPrevEntry = yearlyData.find((d) => d.period === prevPrevYear.toString());
      if (!prevEntry) return null;
      const prevRawSum     = prevEntry.sum ?? 0;
      const prevPrevRawSum = prevPrevEntry?.sum ?? 0;
      const change = prevPrevRawSum > 0 ? ((prevRawSum - prevPrevRawSum) / prevPrevRawSum) * 100 : null;
      const value = monthlyScale ? formatNumber(Math.round(prevRawSum * monthlyScale)) : Math.round(prevRawSum).toString();
      return { label: '전년 검색량', value, change, isEstimate: true };
    }
    return null;
  })();

  return (
    <div className="mac-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`
        @keyframes kip-pulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.80; }
        }
      `}</style>

      {/* Row 1: KPI — 4 independent floating cards with sparkline */}
      <div style={{ display: 'flex', gap: 10 }}>
        {kpis.map(({ label, value, showChange }) => {
          const isUp = showChange && changePercent != null ? changePercent >= 0 : null;
          return (
            <div key={label} className="mac-card" style={{
              flex: 1, padding: '16px 18px', minWidth: 0,
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <p style={{
                fontSize: 10.5, color: 'var(--text-secondary)', margin: '0 0 12px',
                fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>{label}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)', margin: '0 0 6px' }}>{value}</p>
                  {showChange && isUp !== null ? (
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: isUp ? '#30D158' : '#FF375F' }}>
                      {isUp ? '▲' : '▼'} {Math.abs(changePercent).toFixed(1)}% 전월 대비
                    </p>
                  ) : showChange && insightsLoading ? (
                    <Skeleton height={10} width="65%" radius={4} />
                  ) : null}
                </div>
                <MiniSparkline data={sparklineData} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {insightsError && !insightsLoading && <InsightsErrorNotice message={insightsError} />}

      {/* Row 2: trend | news | demographics — each its own floating card */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>

        {/* Trend chart card */}
        <div className="mac-card" style={{
          flex: '2 1 300px', padding: '24px 28px',
          minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          {/* Header: title + period buttons + weekly stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                {activePeriod.title}
              </p>
              {/* Period toggle buttons */}
              <div style={{ display: 'flex', gap: 3, background: 'var(--bg-overlay)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
                {PERIOD_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTrendPeriod(key)}
                    style={{
                      padding: '3px 10px', fontSize: 10.5, fontWeight: 600, borderRadius: 5,
                      border: 'none', cursor: 'pointer',
                      background: trendPeriod === key ? 'var(--accent)' : 'transparent',
                      color: trendPeriod === key ? '#fff' : 'var(--text-tertiary)',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Period-aware right stats */}
            {periodStats ? (
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
                  {periodStats.label} {periodStats.value}
                  {periodStats.isEstimate && (
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>(추정)</span>
                  )}
                </p>
                {periodStats.change != null && (
                  <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 600, color: periodStats.change >= 0 ? '#30D158' : '#FF375F' }}>
                    {periodStats.change >= 0 ? '▲' : '▼'} {Math.abs(periodStats.change).toFixed(1)}%
                  </p>
                )}
              </div>
            ) : insightsLoading ? (
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
                <Skeleton height={14} width={110} radius={4} />
                <Skeleton height={10} width={75} radius={4} />
              </div>
            ) : null}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <TrendChart data={activePeriod.data} loading={insightsLoading} keyword={baseKeyword} />
          </div>
        </div>

        {/* News card */}
        <div className="mac-card" style={{
          flex: '1 1 180px', padding: '20px 18px', minWidth: 0,
        }}>
          <Label>관련 기사</Label>
          <NewsSection items={insights?.news} loading={insightsLoading} />
        </div>

        {/* Blog ranking card */}
        <div className="mac-card" style={{
          flex: '1.6 1 240px', padding: '20px 18px', minWidth: 0, overflow: 'hidden',
        }}>
          <Label>블로그 탭 순위</Label>
          <BlogRankingSection rankings={blogRankings} loading={blogRankingsLoading} />
        </div>

      </div>
    </div>
  );
}
