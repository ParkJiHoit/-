function rankClass(rank) {
  if (rank == null) return 'out';
  if (rank === 1) return 'r1';
  if (rank <= 2) return 'r2';
  if (rank <= 3) return 'r3';
  if (rank <= 5) return 'r5';
  if (rank <= 7) return 'r7';
  return 'r10';
}

function getDates(days) {
  const dates = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export default function RankCalendar({ snapshots = [], blogIds = [], days = 30 }) {
  const dates = getDates(days);

  const byBlogDate = {};
  for (const s of snapshots) {
    if (!byBlogDate[s.blog_id]) byBlogDate[s.blog_id] = {};
    byBlogDate[s.blog_id][s.snapshotted_at] = { rank: s.rank, title: s.post_title };
  }

  const displayBlogIds = blogIds.length ? blogIds : [...new Set(snapshots.map(s => s.blog_id))];

  const cellStyle = {
    base: {
      width: '100%', aspectRatio: '1', borderRadius: 3,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 8, fontWeight: 700, cursor: 'pointer',
      transition: 'transform 0.1s', border: '1px solid transparent',
      color: 'transparent', position: 'relative',
    },
  };

  const colorMap = {
    r1:  { bg: 'rgba(48,209,88,0.85)',  border: 'rgba(48,209,88,0.4)' },
    r2:  { bg: 'rgba(48,209,88,0.65)',  border: 'rgba(48,209,88,0.3)' },
    r3:  { bg: 'rgba(48,209,88,0.45)',  border: 'rgba(48,209,88,0.2)' },
    r5:  { bg: 'rgba(255,159,10,0.50)', border: 'rgba(255,159,10,0.3)' },
    r7:  { bg: 'rgba(255,159,10,0.32)', border: 'rgba(255,159,10,0.15)' },
    r10: { bg: 'rgba(255,69,58,0.35)',  border: 'rgba(255,69,58,0.2)' },
    out: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.06)' },
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `56px repeat(${dates.length}, minmax(18px, 1fr))`,
        gap: 3, minWidth: 480, marginBottom: 4,
      }}>
        <div />
        {dates.map(d => (
          <div key={d} style={{
            fontSize: 9, color: 'var(--text-tertiary)',
            textAlign: 'center', letterSpacing: '0.02em',
          }}>
            {d.slice(5).replace('-', '/')}
          </div>
        ))}
      </div>

      {displayBlogIds.map(blogId => (
        <div key={blogId} style={{
          display: 'grid',
          gridTemplateColumns: `56px repeat(${dates.length}, minmax(18px, 1fr))`,
          gap: 3, minWidth: 480, marginBottom: 3,
        }}>
          <div style={{
            fontSize: 10, color: 'var(--text-tertiary)',
            textAlign: 'right', paddingRight: 6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            lineHeight: '18px',
          }} title={blogId}>
            {blogId.length > 8 ? blogId.slice(0, 8) + '…' : blogId}
          </div>
          {dates.map(date => {
            const snap = byBlogDate[blogId]?.[date];
            const rank = snap?.rank ?? null;
            const cls = rankClass(rank);
            const { bg, border } = colorMap[cls];
            const label = rank != null ? `${rank}위` : '미노출';
            return (
              <div
                key={date}
                title={`${blogId} · ${date} · ${label}${snap?.title ? '\n' + snap.title : ''}`}
                style={{
                  ...cellStyle.base,
                  background: bg,
                  borderColor: border,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.4)';
                  e.currentTarget.style.zIndex = '10';
                  e.currentTarget.style.color = rank != null ? '#fff' : 'rgba(255,255,255,0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.zIndex = '1';
                  e.currentTarget.style.color = 'transparent';
                }}
              >
                {rank != null ? rank : '–'}
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>순위:</span>
        {[
          { cls: 'r1', label: '1위' }, { cls: 'r2', label: '2위' },
          { cls: 'r3', label: '3위' }, { cls: 'r5', label: '5위' },
          { cls: 'r7', label: '7위' }, { cls: 'r10', label: '10위' },
          { cls: 'out', label: '미노출' },
        ].map(({ cls, label }) => (
          <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 12, height: 12, borderRadius: 3,
              background: colorMap[cls].bg,
              border: `1px solid ${colorMap[cls].border}`,
            }} />
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
