import { ExternalLink } from 'lucide-react';

// ── 도넛 차트 ──────────────────────────────────────────────────────────────
function DonutChart({ segments, size = 120, thickness = 22 }) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (!total) return null;

  let offset = 0;
  const arcs = segments
    .filter(seg => seg.value > 0)
    .map(seg => {
      const pct = seg.value / total;
      const dash = pct * circ;
      const arc = { ...seg, dash, gap: circ - dash, offset: circ - offset };
      offset += dash + 1.5;
      return arc;
    });

  return (
    <svg width={size} height={size} style={{ flexShrink: 0, overflow: 'visible' }}>
      {/* 배경 링 */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
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
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 0.5s ease' }}
        />
      ))}
    </svg>
  );
}

function DonutCard({ title, segments, total }) {
  const filtered = segments.filter(s => s.value > 0);
  const size = 108;
  const thickness = 20;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const arcs = filtered.map(seg => {
    const pct = seg.value / total;
    const dash = pct * circ;
    const arc = { ...seg, dash, gap: circ - dash, offset: circ - offset };
    offset += dash + 1.5;
    return arc;
  });

  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="mac-card" style={{ padding: '18px 20px' }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 16px' }}>
        {title}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* SVG 도넛 */}
        <svg width={size} height={size} style={{ flexShrink: 0, overflow: 'visible' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
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
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 0.5s ease' }}
            />
          ))}
          {/* 중앙 텍스트 */}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="18" fontWeight="800" fontFamily="-apple-system, sans-serif">
            {total}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-tertiary)" fontSize="9" fontWeight="600" fontFamily="-apple-system, sans-serif" letterSpacing="0.05em">
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

function StatCard({ label, value, sub, color }) {
  return (
    <div className="mac-card" style={{ padding: '18px 20px', minWidth: 0 }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: 0, marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: color || 'var(--text-primary)', margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5, marginBottom: 0 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function InsightCard({ insight }) {
  const colors = {
    warning: { bg: 'rgba(255,159,10,0.08)', border: 'rgba(255,159,10,0.25)', title: '#ff9f0a' },
    success:  { bg: 'rgba(48,209,88,0.08)',  border: 'rgba(48,209,88,0.25)',  title: '#30d158' },
    info:     { bg: 'rgba(10,132,255,0.08)', border: 'rgba(10,132,255,0.20)', title: '#0a84ff' },
  };
  const c = colors[insight.type] || colors.info;
  return (
    <div style={{
      padding: '14px 16px',
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
    }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: c.title, margin: 0, marginBottom: 4 }}>
        {insight.icon} {insight.title}
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
        {insight.body}
      </p>
    </div>
  );
}

const POSITION_SEGMENTS = [
  { key: 'front',   label: '앞',   color: '#0a84ff' },
  { key: 'middle',  label: '중간', color: '#5e5ce6' },
  { key: 'back',    label: '뒤',   color: '#bf5af2' },
  { key: 'partial', label: '부분', color: '#ff9f0a' },
  { key: 'none',    label: '없음', color: 'rgba(152,152,157,0.5)' },
];

const RECENCY_SEGMENTS = [
  { key: 'week',    label: '7일 이내',   color: '#30d158' },
  { key: 'month',   label: '30일 이내',  color: '#0a84ff' },
  { key: 'quarter', label: '90일 이내',  color: '#5e5ce6' },
  { key: 'year',    label: '1년 이내',   color: '#ff9f0a' },
  { key: 'old',     label: '1년 초과',   color: '#ff6b6b' },
  { key: 'unknown', label: '알 수 없음', color: 'rgba(152,152,157,0.5)' },
];

const POSITION_LABEL = { front: '앞', middle: '중간', back: '뒤', partial: '부분', none: '없음' };
const POSITION_COLOR = { front: '#0a84ff', middle: '#5e5ce6', back: '#bf5af2', partial: '#ff9f0a', none: 'var(--text-tertiary)' };

export default function BlogStructurePanel({ result, keyword }) {
  if (!result) return null;

  const { posts = [], analysis = {}, insights = [] } = result;
  const {
    titleIncludeRate, positionCounts = {}, recencyCounts = {},
    freshRate, uniqueAuthorCount, diversityRate,
    avgTitleLength, avgDailyVisitors, viewMix = {},
  } = analysis;

  return (
    <div className="flex flex-col gap-5">
      {/* 헤더 */}
      <div className="mac-card" style={{ padding: '16px 20px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: 0 }}>
          블로그 구조 분석
        </p>
        <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)', margin: '4px 0 0' }}>
          "{keyword}"
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
          네이버 블로그 탭 상위 {posts.length}개 게시물 기준
        </p>
      </div>

      {/* 수치 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard
          label="제목 키워드 포함률"
          value={`${titleIncludeRate}%`}
          sub={`상위 ${posts.length}개 중 ${Math.round(titleIncludeRate * posts.length / 100)}개`}
          color={titleIncludeRate >= 70 ? '#ff9f0a' : '#30d158'}
        />
        <StatCard
          label="최신성 (30일 이내)"
          value={`${freshRate}%`}
          sub={`${(recencyCounts.week || 0) + (recencyCounts.month || 0)}개 최근 게시물`}
          color={freshRate >= 70 ? '#ff6b6b' : freshRate >= 40 ? '#ff9f0a' : '#30d158'}
        />
        <StatCard
          label="블로그 다양성"
          value={`${uniqueAuthorCount}개`}
          sub={`${diversityRate}% 서로 다른 블로거`}
          color={diversityRate <= 60 ? '#ff9f0a' : '#30d158'}
        />
        <StatCard
          label="평균 제목 길이"
          value={`${avgTitleLength}자`}
          sub="상위 포스트 기준"
        />
        {avgDailyVisitors != null && (
          <StatCard
            label="평균 방문자/일"
            value={avgDailyVisitors >= 1000 ? `${(avgDailyVisitors / 1000).toFixed(1)}K` : `${avgDailyVisitors}`}
            sub="블로그 탭 공개 데이터 기준"
          />
        )}
        {viewMix.total > 0 && (
          <StatCard
            label="VIEW 카페 비중"
            value={`${Math.round((viewMix.cafe / viewMix.total) * 100)}%`}
            sub={`블로그 ${viewMix.blog} / 카페 ${viewMix.cafe}`}
          />
        )}
      </div>

      {/* 분포 도넛 차트 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <DonutCard
          title="제목 키워드 위치 분포"
          total={posts.length}
          segments={POSITION_SEGMENTS.map(s => ({ ...s, value: positionCounts[s.key] || 0 }))}
        />
        <DonutCard
          title="게시물 최신성 분포"
          total={posts.length}
          segments={RECENCY_SEGMENTS.map(s => ({ ...s, value: recencyCounts[s.key] || 0 }))}
        />
      </div>

      {/* 인사이트 */}
      <div className="mac-card" style={{ padding: '18px 20px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 14px' }}>
          콘텐츠 전략 인사이트
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
        </div>
      </div>

      {/* 상위 블로그 목록 */}
      <div className="mac-card overflow-hidden">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            상위 블로그 상세
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            정확도순 상위 {posts.length}개
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                {[
                  { label: '#',        align: 'center', width: 36 },
                  { label: '블로그명', align: 'left',   width: 100 },
                  { label: '제목',     align: 'left',   width: undefined },
                  { label: '키워드 위치', align: 'left', width: 80 },
                  { label: '발행일',   align: 'right',  width: 80 },
                  { label: '방문자/일', align: 'right', width: 80 },
                ].map(({ label, align, width }) => (
                  <th key={label} style={{
                    padding: '7px 12px', fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: 'var(--text-tertiary)', textAlign: align,
                    whiteSpace: 'nowrap',
                    ...(width ? { width } : {}),
                  }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr
                  key={post.rank}
                  style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 22, height: 22, borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: post.rank <= 3 ? 'rgba(255,214,10,0.12)' : 'var(--bg-overlay)',
                      color: post.rank <= 3 ? '#b8920a' : 'var(--text-tertiary)',
                      border: `1px solid ${post.rank <= 3 ? 'rgba(255,214,10,0.3)' : 'var(--border)'}`,
                    }}>
                      {post.rank}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-secondary)', width: 100, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {post.author || '—'}
                  </td>
                  <td style={{ padding: '9px 12px', maxWidth: 0 }}>
                    <a
                      href={post.postLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--text-primary)', textDecoration: 'none',
                        fontSize: 12, fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: 4,
                        overflow: 'hidden', whiteSpace: 'nowrap',
                      }}
                      title={post.title}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.title}</span>
                      <ExternalLink size={10} style={{ flexShrink: 0, opacity: 0.4 }} />
                    </a>
                    <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                      제목 {post.titleLength}자
                    </p>
                  </td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 7px', borderRadius: 4,
                      fontSize: 10, fontWeight: 700,
                      background: `${POSITION_COLOR[post.keywordPosition] === 'var(--text-tertiary)' ? 'rgba(255,255,255,0.06)' : POSITION_COLOR[post.keywordPosition]}20`,
                      color: POSITION_COLOR[post.keywordPosition],
                      border: `1px solid ${POSITION_COLOR[post.keywordPosition] === 'var(--text-tertiary)' ? 'var(--border)' : `${POSITION_COLOR[post.keywordPosition]}40`}`,
                    }}>
                      {POSITION_LABEL[post.keywordPosition] || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {post.date || '—'}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 11, textAlign: 'right', color: post.dailyVisitors != null ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: post.dailyVisitors != null ? 600 : 400 }}>
                    {post.dailyVisitors != null ? post.dailyVisitors.toLocaleString() : '비공개'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
