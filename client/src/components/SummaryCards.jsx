import { Lightbulb, ShieldAlert, Target, Trophy } from 'lucide-react';

const CARDS = [
  {
    key: 'totalKeywords',    label: '전체 키워드',  icon: Target,
    color: '#8E8E93',
    sub: (s) => `분석된 연관 키워드`,
  },
  {
    key: 'priorityCount',    label: '우선 테스트',  icon: Trophy,
    color: '#0A84FF',
    sub: (s) => s.totalKeywords ? `전체의 ${Math.round(s.priorityCount / s.totalKeywords * 100)}%` : '—',
  },
  {
    key: 'opportunityCount', label: '기회 키워드',  icon: Lightbulb,
    color: '#30D158',
    sub: (s) => s.totalKeywords ? `전체의 ${Math.round(s.opportunityCount / s.totalKeywords * 100)}%` : '—',
  },
  {
    key: 'saturatedCount',   label: '과포화 주의',  icon: ShieldAlert,
    color: '#FF9F0A',
    sub: (s) => s.totalKeywords ? `전체의 ${Math.round(s.saturatedCount / s.totalKeywords * 100)}%` : '—',
  },
];

export default function SummaryCards({ summary }) {
  return (
    <section className="mac-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon, color, sub }) => {
        const value = summary?.[key] ?? 0;
        const total = summary?.totalKeywords || 1;
        const pct = key !== 'totalKeywords' ? Math.round(value / total * 100) : null;
        return (
          <article
            key={key}
            className="mac-card"
            style={{
              padding: '22px 22px 20px',
              display: 'flex', flexDirection: 'column', gap: 14,
              background: `radial-gradient(ellipse at top left, ${color}12 0%, transparent 60%)`,
              borderTop: `1px solid ${color}30`,
            }}
          >
            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontSize: 13, fontWeight: 600, letterSpacing: '0.07em',
                textTransform: 'uppercase', color: 'var(--text-tertiary)',
              }}>
                {label}
              </span>
              <div style={{
                width: 30, height: 30, borderRadius: 9,
                background: color + '18', border: `1px solid ${color}35`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon style={{ width: 14, height: 14, color }} />
              </div>
            </div>

            {/* 숫자 */}
            <p style={{
              fontSize: 36, fontWeight: 800, letterSpacing: '-1.5px',
              fontFamily: "'Space Grotesk', sans-serif",
              color: 'var(--text-primary)', margin: 0, lineHeight: 1,
            }}>
              {value}
            </p>

            {/* 바 */}
            {pct !== null && (
              <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{
                  width: '100%', height: '100%',
                  background: color,
                  borderRadius: 2, transformOrigin: 'left',
                  transform: `scaleX(${pct / 100})`,
                  transition: 'transform 0.7s cubic-bezier(0.34,1.2,0.64,1)',
                }} />
              </div>
            )}

            {/* 보조 텍스트 */}
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
              {sub(summary ?? {})}
            </p>
          </article>
        );
      })}
    </section>
  );
}
