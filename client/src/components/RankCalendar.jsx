function rankClass(rank) {
  if (rank == null) return 'out';
  if (rank === 1) return 'r1';
  if (rank <= 2) return 'r2';
  if (rank <= 3) return 'r3';
  if (rank <= 5) return 'r5';
  if (rank <= 7) return 'r7';
  return 'r10';
}

function getKSTDateString(offsetDays = 0) {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000 - offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

function getDates(days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(getKSTDateString(i));
  }
  return dates;
}

export default function RankCalendar({ snapshots = [], blogIds = [], days = 30 }) {
  const dates = getDates(days);
  const isDark = document.documentElement.dataset.theme !== 'light';

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
      fontSize: 10, fontWeight: 800, cursor: 'pointer',
      transition: 'transform 0.1s', border: '1px solid transparent',
      position: 'relative',
    },
  };

  const colorMap = isDark ? {
    r1:  { bg: 'rgba(48,209,88,0.85)',   border: 'rgba(48,209,88,0.5)',   text: '#fff' },
    r2:  { bg: 'rgba(48,209,88,0.65)',   border: 'rgba(48,209,88,0.35)',  text: '#fff' },
    r3:  { bg: 'rgba(48,209,88,0.45)',   border: 'rgba(48,209,88,0.25)',  text: '#fff' },
    r5:  { bg: 'rgba(255,159,10,0.55)',  border: 'rgba(255,159,10,0.35)', text: '#fff' },
    r7:  { bg: 'rgba(255,159,10,0.35)',  border: 'rgba(255,159,10,0.2)',  text: 'rgba(255,255,255,0.8)' },
    r10: { bg: 'rgba(255,69,58,0.40)',   border: 'rgba(255,69,58,0.25)',  text: '#fff' },
    out: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.08)', text: 'transparent' },
  } : {
    r1:  { bg: 'rgba(22,163,74,0.85)',   border: 'rgba(22,163,74,0.5)',   text: '#fff' },
    r2:  { bg: 'rgba(22,163,74,0.65)',   border: 'rgba(22,163,74,0.35)',  text: '#fff' },
    r3:  { bg: 'rgba(22,163,74,0.45)',   border: 'rgba(22,163,74,0.25)',  text: 'rgba(0,0,0,0.7)' },
    r5:  { bg: 'rgba(217,119,6,0.55)',   border: 'rgba(217,119,6,0.35)',  text: '#fff' },
    r7:  { bg: 'rgba(217,119,6,0.35)',   border: 'rgba(217,119,6,0.2)',   text: 'rgba(0,0,0,0.6)' },
    r10: { bg: 'rgba(220,38,38,0.40)',   border: 'rgba(220,38,38,0.25)',  text: '#fff' },
    out: { bg: 'rgba(0,0,0,0.06)',       border: 'rgba(0,0,0,0.12)',      text: 'transparent' },
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
            fontSize: 11, color: 'var(--text-tertiary)',
            textAlign: 'center', letterSpacing: '0.01em',
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
            fontSize: 12, color: 'var(--text-tertiary)',
            textAlign: 'right', paddingRight: 6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            lineHeight: '20px',
          }} title={blogId}>
            {blogId.length > 8 ? blogId.slice(0, 8) + '…' : blogId}
          </div>
          {dates.map(date => {
            const snap = byBlogDate[blogId]?.[date];
            const rank = snap?.rank ?? null;
            const cls = rankClass(rank);
            const { bg, border, text } = colorMap[cls];
            const label = rank != null ? `${rank}위` : '미노출';
            return (
              <div
                key={date}
                title={`${blogId} · ${date} · ${label}${snap?.title ? '\n' + snap.title : ''}`}
                style={{
                  ...cellStyle.base,
                  background: bg,
                  borderColor: border,
                  color: text,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.5)';
                  e.currentTarget.style.zIndex = '10';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.zIndex = '1';
                }}
              >
                {rank != null ? rank : ''}
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>순위:</span>
        {[
          { cls: 'r1', label: '1위' }, { cls: 'r2', label: '2위' },
          { cls: 'r3', label: '3위' }, { cls: 'r5', label: '5위' },
          { cls: 'r7', label: '7위' }, { cls: 'r10', label: '10위' },
          { cls: 'out', label: '미노출' },
        ].map(({ cls, label }) => (
          <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 14, height: 14, borderRadius: 3,
              background: colorMap[cls].bg,
              border: `1px solid ${colorMap[cls].border}`,
            }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
