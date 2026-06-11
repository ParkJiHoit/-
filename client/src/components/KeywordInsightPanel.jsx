import { formatNumber, formatPercent, formatScore } from '../utils/formatters';

/* ─── Skeleton ─── */
function Skeleton({ width = '100%', height = 8, radius = 4 }) {
  return (
    <div style={{
      width, height,
      background: 'var(--bg-overlay)',
      borderRadius: radius,
      animation: 'kip-pulse 1.6s ease-in-out infinite',
    }} />
  );
}

/* ─── Label ─── */
function Label({ children }) {
  return (
    <p style={{
      margin: '0 0 10px',
      fontSize: 10, fontWeight: 700,
      letterSpacing: '0.10em', textTransform: 'uppercase',
      color: 'var(--text-tertiary)',
    }}>
      {children}
    </p>
  );
}

/* ─── Trend line chart ─── */
function TrendChart({ data, loading }) {
  const W = 560, H = 160;
  const pad = { t: 10, r: 8, b: 30, l: 34 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;

  if (loading) {
    return (
      <div style={{ height: H, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, padding: '0 4px' }}>
        <Skeleton height={2} />
        <Skeleton height={2} width="80%" />
        <Skeleton height={2} width="60%" />
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

  const x = (i) => pad.l + (i / (data.length - 1)) * cW;
  const y = (r) => pad.t + cH * (1 - (r - minR) / range);
  const pts = data.map((d, i) => [x(i), y(d.ratio)]);
  const linePath = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${(pad.t + cH).toFixed(1)} L${pad.l},${(pad.t + cH).toFixed(1)}Z`;

  const step = Math.max(1, Math.floor(data.length / 4));
  const xIdxs = [...new Set([0, step, step * 2, step * 3, data.length - 1])];
  const yTicks = [0, 0.5, 1].map((r) => ({
    py: pad.t + cH * (1 - r),
    label: Math.round(minR + range * r),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="kip-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(10,132,255,0.22)" />
          <stop offset="100%" stopColor="rgba(10,132,255,0.00)" />
        </linearGradient>
      </defs>
      {yTicks.map(({ py, label }) => (
        <g key={py}>
          <line x1={pad.l} y1={py} x2={pad.l + cW} y2={py} stroke="var(--border)" strokeWidth="1" />
          <text x={pad.l - 5} y={py + 3.5} textAnchor="end" fontSize="9" fill="var(--text-tertiary)">{label}</text>
        </g>
      ))}
      <path d={areaPath} fill="url(#kip-grad)" />
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {xIdxs.map((i) => (
        <text key={i} x={x(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-tertiary)">
          {data[i].period.slice(5)}
        </text>
      ))}
    </svg>
  );
}

/* ─── Vertical bar chart — used for day-of-week, gender, age ─── */
function VBarChart({ items, loading, height = 110, count = 7 }) {
  const LABEL_H = 18;
  const BAR_AREA = height - LABEL_H;
  // Max bar width so bars never become wide horizontal blocks
  const MAX_BAR_W = 52;
  const GAP = 6;

  if (loading) {
    const placeholders = [72, 100, 85, 55, 78, 45, 60].slice(0, count);
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: GAP, height, justifyContent: 'center' }}>
        {placeholders.map((h, i) => (
          <div key={i} style={{
            width: MAX_BAR_W, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, justifyContent: 'flex-end',
          }}>
            <Skeleton height={Math.round((h / 100) * BAR_AREA)} radius={3} />
            <Skeleton height={8} width="70%" radius={2} />
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
        const barH = Math.max(3, Math.round((v / max) * BAR_AREA));
        const isMax = v === max;
        const barColor = color ?? 'var(--accent)';
        return (
          <div key={label} style={{
            width: MAX_BAR_W, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 4,
            height: '100%',
          }}>
            <div style={{ flex: 1 }} />
            <div style={{
              width: '100%',
              height: barH,
              background: barColor,
              opacity: isMax ? 1 : 0.42,
              borderRadius: '3px 3px 0 0',
              transition: 'height 0.4s cubic-bezier(0.4,0,0.2,1)',
            }} />
            <span style={{
              fontSize: 10, color: 'var(--text-tertiary)',
              lineHeight: 1, textAlign: 'center',
              height: LABEL_H, display: 'flex', alignItems: 'center',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {label}
            </span>
          </div>
        );
      })}
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

  // Gender as vertical bar items
  const genderItems = insights?.gender != null
    ? [
        { label: '남성', value: insights.gender.male,   color: 'var(--accent)' },
        { label: '여성', value: insights.gender.female, color: '#BF5AF2' },
      ]
    : null;

  // Age as vertical bar items
  const ageItems = insights?.age?.map((a) => ({ label: a.label, value: a.pct })) ?? null;

  return (
    <section className="mac-card mac-fade-in overflow-hidden">
      <style>{`
        @keyframes kip-pulse {
          0%, 100% { opacity: 0.40; }
          50%       { opacity: 0.85; }
        }
      `}</style>

      {/* KPI strip */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {kpis.map(({ label, value }, i) => (
          <div key={label} style={{
            flex: 1, padding: '16px 18px',
            borderRight: i < kpis.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 5px', fontWeight: 500 }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)', margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {insightsError && !insightsLoading && <InsightsErrorNotice message={insightsError} />}

      {/* Charts row */}
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>

        {/* Left: trend */}
        <div style={{
          flex: '2 1 320px', padding: '18px 20px',
          borderRight: '1px solid var(--border)',
          minWidth: 0,
        }}>
          <Label>검색 트렌드 (최근 90일)</Label>
          <TrendChart data={insights?.trend} loading={insightsLoading} />
        </div>

        {/* Right: demographics — all vertical bar charts */}
        <div style={{
          flex: '1 1 220px', padding: '18px 20px',
          display: 'flex', flexDirection: 'column', gap: 24,
          minWidth: 0,
        }}>

          <div>
            <Label>요일별 검색 분포</Label>
            <VBarChart
              items={insights?.dayOfWeek}
              loading={insightsLoading}
              height={110}
              count={7}
            />
          </div>

          <div>
            <Label>성별 분포</Label>
            <VBarChart
              items={genderItems}
              loading={insightsLoading}
              height={110}
              count={2}
            />
          </div>

          <div>
            <Label>연령별 분포</Label>
            <VBarChart
              items={ageItems}
              loading={insightsLoading}
              height={110}
              count={5}
            />
          </div>

        </div>
      </div>
    </section>
  );
}
