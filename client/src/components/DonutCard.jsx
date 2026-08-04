import { useEffect, useState } from 'react';

// 도넛 차트 카드 — 여러 화면(블로그 구조 분석, 공유 리포트 등)에서 재사용하는
// 분포 시각화. segments: [{ key, label, color, value }]
export default function DonutCard({ title, segments, total }) {
  const filtered = segments.filter(s => s.value > 0);
  const size = 108;
  const thickness = 20;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;

  // 처음 마운트될 때 0에서 시작해서 실제 값으로 스윕인한다 — 다음 프레임에 목표 값으로
  // 바꿔서 아래 stroke-dasharray CSS transition이 0 -> 값 성장을 애니메이션하게 만든다.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  let offset = 0;
  const arcs = filtered.map(seg => {
    const pct = seg.value / total;
    const dash = mounted ? pct * circ : 0;
    const arc = { ...seg, dash, gap: circ - dash, offset: circ - offset };
    offset += dash + 1.5;
    return arc;
  });

  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="mac-card" style={{
      padding: '18px 20px',
      background: 'radial-gradient(ellipse at top left, rgba(10,132,255,0.07) 0%, transparent 55%)',
      borderTop: '1px solid rgba(10,132,255,0.25)',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 16px' }}>
        {title}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* SVG 도넛 */}
        <svg width={size} height={size} style={{ flexShrink: 0, overflow: 'visible' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={thickness}
              strokeDasharray={`${arc.dash - 1.5} ${arc.gap + 1.5}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="butt"
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              <title>{`${arc.label}: ${arc.value}건 (${Math.round((arc.value / total) * 100)}%)`}</title>
            </circle>
          ))}
          {/* 중앙 텍스트 */}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="18" fontWeight="800" fontFamily="'Pretendard Variable', 'Pretendard', -apple-system, sans-serif">
            {total}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-tertiary)" fontSize="9" fontWeight="600" fontFamily="'Pretendard Variable', 'Pretendard', -apple-system, sans-serif" letterSpacing="0.05em">
            TOTAL
          </text>
        </svg>
        {/* 범례 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 0 }}>
          {filtered.map(({ key, label, color, value }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                {value}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0, minWidth: 30, textAlign: 'right' }}>
                {Math.round((value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
