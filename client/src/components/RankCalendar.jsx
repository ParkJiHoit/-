import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

function getMonthDates(year, month) {
  const todayStr = getKSTDateString(0);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dates = [];
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (dateStr > todayStr) break;
    dates.push(dateStr);
  }
  return dates;
}

export default function RankCalendar({ snapshots = [], blogIds = [] }) {
  const todayStr = getKSTDateString(0);
  const [todayYear, todayMonth] = todayStr.split('-').map(Number);

  const [viewYear, setViewYear] = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(todayMonth);

  const isCurrentMonth = viewYear === todayYear && viewMonth === todayMonth;

  const goPrevMonth = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  };
  const goNextMonth = () => {
    if (isCurrentMonth) return;
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  };

  const dates = getMonthDates(viewYear, viewMonth);
  const isDark = document.documentElement.dataset.theme !== 'light';

  const byBlogDate = {};
  for (const s of snapshots) {
    if (!byBlogDate[s.blog_id]) byBlogDate[s.blog_id] = {};
    byBlogDate[s.blog_id][s.snapshotted_at] = { rank: s.rank, title: s.post_title };
  }

  const displayBlogIds = blogIds.length ? blogIds : [...new Set(snapshots.map(s => s.blog_id))];

  const cellStyle = {
    base: {
      width: 36, height: 36, borderRadius: 6,
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
    out: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.32)' },
  } : {
    r1:  { bg: 'rgba(22,163,74,0.85)',   border: 'rgba(22,163,74,0.5)',   text: '#fff' },
    r2:  { bg: 'rgba(22,163,74,0.65)',   border: 'rgba(22,163,74,0.35)',  text: '#fff' },
    r3:  { bg: 'rgba(22,163,74,0.45)',   border: 'rgba(22,163,74,0.25)',  text: 'rgba(0,0,0,0.7)' },
    r5:  { bg: 'rgba(217,119,6,0.55)',   border: 'rgba(217,119,6,0.35)',  text: '#fff' },
    r7:  { bg: 'rgba(217,119,6,0.35)',   border: 'rgba(217,119,6,0.2)',   text: 'rgba(0,0,0,0.6)' },
    r10: { bg: 'rgba(220,38,38,0.40)',   border: 'rgba(220,38,38,0.25)',  text: '#fff' },
    out: { bg: 'rgba(0,0,0,0.06)',       border: 'rgba(0,0,0,0.12)',      text: 'rgba(0,0,0,0.3)' },
  };

  const CELL = 36;
  const GAP = 4;
  const LABEL_W = 60;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button
          onClick={goPrevMonth}
          title="이전 달"
          style={{
            display: 'flex', background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
            borderRadius: 7, padding: 5, cursor: 'pointer', color: 'var(--text-secondary)',
          }}
        >
          <ChevronLeft size={14} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', minWidth: 90, textAlign: 'center' }}>
          {viewYear}년 {viewMonth}월
        </span>
        <button
          onClick={goNextMonth}
          disabled={isCurrentMonth}
          title="다음 달"
          style={{
            display: 'flex', background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
            borderRadius: 7, padding: 5, cursor: isCurrentMonth ? 'not-allowed' : 'pointer',
            color: 'var(--text-secondary)', opacity: isCurrentMonth ? 0.4 : 1,
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `${LABEL_W}px repeat(${dates.length}, ${CELL}px)`,
        gap: GAP, marginBottom: 4,
        width: 'max-content',
      }}>
        <div />
        {dates.map(d => (
          <div key={d} style={{
            fontSize: 11, color: 'var(--text-tertiary)',
            textAlign: 'center', letterSpacing: '0.01em',
            width: CELL,
          }}>
            {d.slice(5).replace('-', '/')}
          </div>
        ))}
      </div>

      {displayBlogIds.map(blogId => (
        <div key={blogId} style={{
          display: 'grid',
          gridTemplateColumns: `${LABEL_W}px repeat(${dates.length}, ${CELL}px)`,
          gap: GAP, marginBottom: GAP,
          width: 'max-content',
        }}>
          <div style={{
            fontSize: 12, color: 'var(--text-tertiary)',
            textAlign: 'right', paddingRight: 6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            lineHeight: '44px',
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
                {rank != null ? rank : 'X'}
              </div>
            );
          })}
        </div>
      ))}
      </div>

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
