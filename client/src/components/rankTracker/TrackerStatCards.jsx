function StatCard({ label, value, total, color, icon, sub }) {
  const pct = total ? Math.round((value / total) * 100) : null;
  return (
    <article className="mac-card" style={{
      padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10,
      background: `radial-gradient(ellipse at top left, ${color}12 0%, transparent 60%)`,
      borderTop: `1px solid ${color}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          {label}
        </span>
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: color + '18', border: `1px solid ${color}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
        }}>
          {icon}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-1px', fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
        {total != null && <span style={{ fontSize: 15, color: 'var(--text-tertiary)', fontWeight: 600 }}>/{total}</span>}
      </p>
      {pct !== null ? (
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.7s cubic-bezier(0.34,1.2,0.64,1)' }} />
        </div>
      ) : sub != null && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{sub}</p>
      )}
    </article>
  );
}

export default function TrackerStatCards({ mode, filteredItems }) {
  const keywordCount = filteredItems.length;

  if (mode === 'all') {
    const top5KeywordCount = filteredItems.filter(item =>
      Object.values(item.latestRanks || {}).some(r => r.rank != null && r.rank <= 5)
    ).length;
    return (
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <StatCard label="추적 키워드" value={keywordCount} total={null} color="#8E8E93" icon="🎯" sub="키워드 블로그탭 상위 10개 스냅샷" />
        <StatCard label="5위 내 노출" value={top5KeywordCount} total={keywordCount} color="#30D158" icon="🏆" sub={null} />
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
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
      <StatCard label="추적 키워드" value={keywordCount} total={null} color="#8E8E93" icon="🎯"
        sub={distinctGroups.size > 0 ? `그룹 ${distinctGroups.size}개에 분산` : '그룹 미지정'} />
      <StatCard label="추적 링크" value={linkCount} total={null} color="#0A84FF" icon="🔗"
        sub={`키워드당 평균 ${avgLinks}개`} />
      <StatCard label="5위 내 노출" value={top5LinkCount} total={linkCount} color="#30D158" icon="🏆" sub={null} />
      <StatCard label="통검 노출 중" value={integratedCount} total={linkCount} color="#5E5CE6" icon="📡" sub={null} />
    </section>
  );
}
