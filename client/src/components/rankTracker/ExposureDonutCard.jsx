import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8,
      padding: '6px 10px', fontSize: 11, color: 'var(--text-secondary)', boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
      whiteSpace: 'nowrap',
    }}>
      <b style={{ color: 'var(--text-primary)' }}>{d.label}</b>: {d.value}건 ({Math.round((d.value / d.total) * 100)}%)
    </div>
  );
}

// KPI 카드 자리(TrackerStatCards의 "추적 키워드" 슬롯)에 들어가는 노출 현황
// 미니 도넛 — recharts로 그려서 부드러운 호버 상호작용을 제공한다.
export default function ExposureDonutCard({ total, segments, compact = true }) {
  const filtered = segments.filter(s => s.value > 0);
  const data = filtered.map(s => ({ ...s, total }));

  return (
    <article className="mac-card" style={{
      padding: compact ? '12px 14px' : '18px 20px', minHeight: compact ? 96 : 154,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6,
      background: 'radial-gradient(ellipse at top left, rgba(10,132,255,0.07) 0%, transparent 60%)',
      borderTop: '1px solid rgba(10,132,255,0.25)',
    }}>
      <span style={{ fontSize: compact ? 10.5 : 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        노출 현황
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minHeight: 0 }}>
        <div style={{ width: compact ? 56 : 76, height: compact ? 56 : 76, flexShrink: 0, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data} dataKey="value" nameKey="label"
                innerRadius="58%" outerRadius="100%" paddingAngle={data.length > 1 ? 3 : 0}
                stroke="none" startAngle={90} endAngle={-270} isAnimationActive={false}
              >
                {data.map((s, i) => <Cell key={s.key ?? i} fill={s.color} />)}
              </Pie>
              <Tooltip content={<DonutTooltip />} wrapperStyle={{ zIndex: 20 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: compact ? 13 : 17, fontWeight: 800, color: 'var(--text-primary)', pointerEvents: 'none',
          }}>
            {total}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          {filtered.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: compact ? 10.5 : 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-tertiary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, flexShrink: 0 }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
