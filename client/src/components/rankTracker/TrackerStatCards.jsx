import { Target, Link2, Trophy, Radio } from 'lucide-react';

function StatCard({ label, value, total, color, icon: Icon, sub, compact }) {
  const pct = total ? Math.round((value / total) * 100) : null;
  return (
    <article className="mac-card" style={{
      padding: compact ? '16px 18px' : '20px 22px 20px', minHeight: compact ? 200 : 154,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14,
      background: `radial-gradient(ellipse at top left, ${color}14 0%, transparent 60%)`,
      borderTop: `1px solid ${color}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: compact ? 11 : 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <div style={{
          width: compact ? 30 : 34, height: compact ? 30 : 34, borderRadius: compact ? 9 : 10, flexShrink: 0,
          background: color + '18', border: `1px solid ${color}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={compact ? 15 : 17} style={{ color }} />
        </div>
      </div>
      <p style={{ margin: 0, fontSize: compact ? 34 : 38, fontWeight: 800, letterSpacing: '-1px', fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
        {total != null && <span style={{ fontSize: compact ? 15 : 17, color: 'var(--text-tertiary)', fontWeight: 600 }}>/{total}</span>}
        {pct !== null && <span style={{ fontSize: compact ? 15 : 16, color, fontWeight: 700, marginLeft: 9 }}>{pct}%</span>}
      </p>
      {pct !== null ? (
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.7s cubic-bezier(0.34,1.2,0.64,1)' }} />
        </div>
      ) : sub != null && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>{sub}</p>
      )}
    </article>
  );
}

export default function TrackerStatCards({ mode, filteredItems, compact = false, donutSlot = null }) {
  const keywordCount = filteredItems.length;

  if (mode === 'all') {
    const top5KeywordCount = filteredItems.filter(item =>
      Object.values(item.latestRanks || {}).some(r => r.rank != null && r.rank <= 5)
    ).length;
    return (
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: compact ? 8 : 10 }}>
        <StatCard label="추적 키워드" value={keywordCount} total={null} color="#8E8E93" icon={Target} sub="키워드 블로그탭 상위 10개 스냅샷" compact={compact} />
        <StatCard label="5위 내 노출" value={top5KeywordCount} total={keywordCount} color="#30D158" icon={Trophy} sub={null} compact={compact} />
      </section>
    );
  }

  const allLinks = filteredItems.flatMap(item => (item.blog_ids || []).map(blogId => ({
    entry: item.latestRanks?.[blogId] ?? null,
  })));
  const linkCount = allLinks.length;
  const top5LinkCount = allLinks.filter(l => l.entry?.status === 'ranked').length;
  const integratedCount = allLinks.filter(l => l.entry?.integratedExposed === true).length;
  const distinctGroups = new Set(filteredItems.map(i => i.group_id).filter(id => id != null));
  const avgLinks = keywordCount > 0 ? (linkCount / keywordCount).toFixed(1) : '0';

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: compact ? 8 : 10 }}>
      {donutSlot ?? (
        <StatCard label="추적 키워드" value={keywordCount} total={null} color="#8E8E93" icon={Target}
          sub={distinctGroups.size > 0 ? `그룹 ${distinctGroups.size}개에 분산` : '그룹 미지정'} compact={compact} />
      )}
      <StatCard label="추적 링크" value={linkCount} total={null} color="#0A84FF" icon={Link2}
        sub={`키워드당 평균 ${avgLinks}개`} compact={compact} />
      <StatCard label="5위 내 노출" value={top5LinkCount} total={linkCount} color="#30D158" icon={Trophy} sub={null} compact={compact} />
      <StatCard label="통검 노출 중" value={integratedCount} total={linkCount} color="#5E5CE6" icon={Radio} sub={null} compact={compact} />
    </section>
  );
}
