import { useState } from 'react';
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

/* ─── Trend line chart ─── */
function TrendChart({ data, loading }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const W = 560, H = 160;
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
  const minR = Math.min(...ratios);
  const range = maxR - minR || 1;

  const px = (i) => pad.l + (i / (data.length - 1)) * cW;
  const py = (r) => pad.t + cH * (1 - (r - minR) / range);
  const pts = data.map((d, i) => [px(i), py(d.ratio)]);

  const linePath = catmullRom(pts);
  const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${(pad.t + cH).toFixed(1)} L${pad.l},${(pad.t + cH).toFixed(1)}Z`;

  const step = Math.max(1, Math.floor(data.length / 5));
  const xIdxs = [...new Set([0, step, step * 2, step * 3, step * 4, data.length - 1])].filter(i => i < data.length);
  const yTicks = [0, 0.5, 1].map((r) => ({
    py: pad.t + cH * (1 - r),
    label: Math.round(minR + range * r),
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
  const tooltipW = 88;
  const tx = Math.min(Math.max(hx - tooltipW / 2, pad.l + 2), W - pad.r - tooltipW - 2);
  const ty = Math.max(hy - 36, pad.t + 2);

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
      {yTicks.map(({ py: gridY, label }) => (
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
          <rect x={tx} y={ty} width={tooltipW} height={24}
            rx={8} fill="var(--bg-overlay)"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.35))' }}
          />
          <text x={tx + tooltipW / 2} y={ty + 15.5}
            textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--text-primary)">
            {data[hovered].period.slice(5)} · {data[hovered].ratio.toFixed(1)}
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
  const MAX_BAR_W = 52;
  const GAP = 6;

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
    <div style={{
      padding: '12px 18px',
      borderBottom: '1px solid var(--border)',
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

/* ─── Main Panel ─── */
export default function KeywordInsightPanel({ baseKeyword, keywordRow, insights, insightsLoading, insightsError }) {
  const kpis = [
    { label: '월간 총 검색량', value: keywordRow ? formatNumber(keywordRow.totalSearch) : '—' },
    { label: 'PC 검색량',     value: keywordRow ? formatNumber(keywordRow.monthlyPcSearch) : '—' },
    { label: '모바일 검색량',  value: keywordRow ? formatNumber(keywordRow.monthlyMobileSearch) : '—' },
    { label: '모바일 비중',    value: keywordRow ? formatPercent(keywordRow.mobileRatio) : '—' },
    { label: '효율 점수',     value: keywordRow ? formatScore(keywordRow.efficiencyScore) : '—' },
  ];

  const genderItems = insights?.gender != null
    ? [
        { label: '남성', value: insights.gender.male,   color: 'var(--accent)' },
        { label: '여성', value: insights.gender.female, color: '#BF5AF2' },
      ]
    : null;

  const ageItems = insights?.age?.map((a) => ({ label: a.label, value: a.pct })) ?? null;

  return (
    <section className="mac-card mac-fade-in overflow-hidden">
      <style>{`
        @keyframes kip-pulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.80; }
        }
      `}</style>

      {/* KPI strip */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {kpis.map(({ label, value }, i) => (
          <div key={label} style={{
            flex: 1, padding: '16px 18px',
            borderRight: i < kpis.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 5px', fontWeight: 500 }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)', margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {insightsError && !insightsLoading && <InsightsErrorNotice message={insightsError} />}

      {/* Charts row */}
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>

        {/* Left: trend — vertically centered */}
        <div style={{
          flex: '2 1 320px', padding: '20px 22px',
          borderRight: '1px solid var(--border)',
          minWidth: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <Label>검색 트렌드 (최근 30일)</Label>
          <TrendChart data={insights?.trend} loading={insightsLoading} />
        </div>

        {/* Right: demographics */}
        <div style={{
          flex: '1 1 220px', padding: '20px 22px',
          display: 'flex', flexDirection: 'column', gap: 26,
          minWidth: 0,
        }}>

          <div>
            <Label>요일별 검색 분포</Label>
            <VBarChart
              items={insights?.dayOfWeek}
              loading={insightsLoading}
              height={110}
              count={7}
              unit=""
            />
          </div>

          <div>
            <Label>성별 분포</Label>
            <GenderBars gender={insights?.gender} loading={insightsLoading} />
          </div>

          <div>
            <Label>연령별 분포</Label>
            <VBarChart
              items={ageItems}
              loading={insightsLoading}
              height={110}
              count={5}
              unit="%"
            />
          </div>

        </div>
      </div>
    </section>
  );
}
