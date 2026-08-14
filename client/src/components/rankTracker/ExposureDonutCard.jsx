import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import useCountUp from '../../hooks/useCountUp';
import { cardEntranceVariants } from '../../utils/motionVariants';

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

function LegendValue({ value }) {
  return <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{useCountUp(value)}</span>;
}

// KPI 카드 자리(TrackerStatCards의 "추적 키워드" 슬롯)에 들어가는 노출 현황
// 도넛 — recharts로 그려서 부드러운 호버 상호작용을 제공한다. 다른 KPI 카드와
// 같은 높이(compact minHeight 200)를 채우도록 도넛을 가운데에 크게 배치하고
// 범례는 아래에 한 줄로 감싼다. paddingAngle을 0으로 둬서 링이 중간에 끊겨
// 보이지 않고 완전히 이어지도록 한다 — 색이 서로 다르므로 구분에는 문제없다.
export default function ExposureDonutCard({ total, segments, compact = true, index = 0, glass = false }) {
  const filtered = segments.filter(s => s.value > 0);
  const data = filtered.map(s => ({ ...s, total }));
  const donutSize = compact ? 108 : 76;
  const animatedTotal = useCountUp(total);

  return (
    <motion.article
      className={glass ? 'report-glass-card' : 'mac-card'}
      custom={index} variants={cardEntranceVariants} initial="hidden" animate="show"
      style={{
        padding: compact ? '16px 18px' : '18px 20px', minHeight: compact ? 200 : 154,
        display: 'flex', flexDirection: 'column', gap: 10,
        background: 'radial-gradient(ellipse at top left, rgba(10,132,255,0.07) 0%, transparent 60%)',
        borderTop: '1px solid rgba(10,132,255,0.25)',
      }}
    >
      <span style={glass ? {
        fontSize: compact ? 12 : 13, fontWeight: 600, letterSpacing: '-0.1px', color: 'var(--text-secondary)',
      } : {
        fontSize: compact ? 11 : 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)',
      }}>
        노출 현황
      </span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <div style={{ width: donutSize, height: donutSize, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data} dataKey="value" nameKey="label"
                innerRadius="62%" outerRadius="100%" paddingAngle={0}
                stroke="none" startAngle={90} endAngle={-270}
                isAnimationActive animationDuration={800} animationEasing="ease-out"
              >
                {data.map((s, i) => <Cell key={s.key ?? i} fill={s.color} />)}
              </Pie>
              <Tooltip content={<DonutTooltip />} wrapperStyle={{ zIndex: 20 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: compact ? 20 : 17, fontWeight: 800, color: 'var(--text-primary)', pointerEvents: 'none',
          }}>
            {animatedTotal}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '3px 12px' }}>
        {filtered.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 + i * 0.05 }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: compact ? 11 : 12 }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-tertiary)' }}>{s.label}</span>
            <LegendValue value={s.value} />
          </motion.div>
        ))}
      </div>
    </motion.article>
  );
}
