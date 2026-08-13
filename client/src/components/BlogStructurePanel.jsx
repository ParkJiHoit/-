import { ExternalLink, CheckCircle2 } from 'lucide-react';
import DonutCard from './DonutCard';

const DONUT_SIZE = 264;

function StatCard({ label, value, sub, color }) {
  const accentColor = color || '#0A84FF';
  return (
    <div className="mac-card-glass" style={{
      padding: '20px 20px 18px', minWidth: 0,
      background: `radial-gradient(ellipse at top left, ${accentColor}10 0%, transparent 60%)`,
      borderTop: `1px solid ${accentColor}30`,
    }}>
      <p style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: 0, marginBottom: 10 }}>
        {label}
      </p>
      <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px', color: color || 'var(--text-primary)', margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, marginBottom: 0 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function InsightRow({ insight, index, isLast }) {
  return (
    <div style={{
      display: 'flex', gap: 18, alignItems: 'flex-start',
      padding: '16px 2px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{
        fontSize: 22, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif",
        color: 'var(--text-tertiary)', opacity: 0.4, lineHeight: 1.25,
        minWidth: 30, flexShrink: 0,
      }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.2px' }}>
          {insight.title}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
          {insight.body}
        </p>
      </div>
    </div>
  );
}

function GuideCard({ text }) {
  return (
    <div style={{
      flex: '1 1 300px',
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '14px 16px',
      borderRadius: 12,
      background: 'var(--bg-overlay)',
      border: '1px solid var(--border)',
    }}>
      <CheckCircle2 size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
        {text}
      </p>
    </div>
  );
}

// counts 객체에서 값이 가장 큰 세그먼트를 찾아 도넛 요약 코멘트에 쓴다.
function topSegment(counts, defs) {
  let best = null;
  for (const def of defs) {
    const value = counts[def.key] || 0;
    if (!best || value > best.value) best = { label: def.label, value };
  }
  return best;
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

// 분석 수치를 바탕으로 실행 가능한 포스팅 작성 가이드 문장을 만든다.
function buildPostingGuide({ titleIncludeRate, positionCounts = {}, freshRate, diversityRate, avgTitleLength }, keyword, totalPosts) {
  const tips = [];

  if (titleIncludeRate >= 50) {
    tips.push(`제목에 "${keyword}"를 꼭 포함하세요 — 상위 ${totalPosts}개 중 ${titleIncludeRate}%가 제목에 키워드를 포함하고 있어요.`);
  } else {
    tips.push(`제목에 키워드를 넣지 않아도 상위 노출이 가능한 키워드예요 — 자연스러운 제목으로 클릭률을 높이는 게 더 유리할 수 있어요.`);
  }

  const topPos = topSegment(positionCounts, POSITION_SEGMENTS);
  if (topPos && topPos.value > 0) {
    if (topPos.label === '앞') {
      tips.push('키워드는 제목 맨 앞부분에 배치하세요 — 상위 글의 다수가 이 패턴을 따르고 있어요.');
    } else if (topPos.label !== '없음') {
      tips.push(`키워드를 제목 ${topPos.label}에 배치한 글이 가장 많아요 — 이 패턴을 참고해 배치를 정해보세요.`);
    }
  }

  if (freshRate >= 70) {
    tips.push('발행 경쟁이 치열한 키워드예요 — 꾸준히 새 글을 올려야 순위를 유지할 수 있어요.');
  } else if (freshRate <= 30) {
    tips.push('오래된 글도 순위를 유지하는 키워드예요 — 발행 속도보다 콘텐츠 완성도에 집중하세요.');
  }

  if (diversityRate <= 60) {
    tips.push('소수 블로그가 상위를 독점하고 있어요 — 신규 블로그라면 차별화된 정보나 후기로 승부하세요.');
  } else {
    tips.push('다양한 블로그가 상위에 노출되는 키워드예요 — 신규 블로그도 충분히 도전해볼 만해요.');
  }

  if (avgTitleLength) {
    tips.push(`제목 길이는 평균 ${avgTitleLength}자 내외로 작성하세요 — 상위 노출 글들의 평균 제목 길이예요.`);
  }

  return tips;
}

export default function BlogStructurePanel({ result, keyword }) {
  if (!result) return null;

  const { posts = [], analysis = {}, insights = [] } = result;
  const {
    titleIncludeRate, positionCounts = {}, recencyCounts = {},
    freshRate, uniqueAuthorCount, diversityRate,
    avgTitleLength, avgDailyVisitors, viewMix = {},
  } = analysis;

  if (!posts.length) {
    return (
      <div className="mac-card-glass" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, opacity: 0.25, marginBottom: 12 }}>📭</div>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
          "{keyword}"의 블로그 게시물을 찾을 수 없습니다
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.7 }}>
          네이버 블로그탭에 노출된 게시물이 없거나 일시적으로 조회에 실패했을 수 있어요.<br />
          다른 키워드로 다시 시도해 보세요.
        </p>
      </div>
    );
  }

  const postingGuide = buildPostingGuide(analysis, keyword, posts.length);

  return (
    <div className="flex flex-col gap-5 mac-stagger">
      {/* 헤더 */}
      <div className="mac-card-glass" style={{
        padding: '20px 24px',
        background: 'radial-gradient(ellipse at top left, rgba(10,132,255,0.09) 0%, transparent 60%)',
        borderTop: '2px solid rgba(10,132,255,0.35)',
      }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent)', margin: 0 }}>
          블로그 구조 분석
        </p>
        <p style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)', margin: '6px 0 0' }}>
          "{keyword}"
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
          네이버 블로그 탭 상위 {posts.length}개 게시물 기준
        </p>
      </div>

      {/* 수치 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
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

      {/* 분포 도넛 차트 + 요약 코멘트 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <DonutCard
          title="제목 키워드 위치 분포"
          total={posts.length}
          segments={POSITION_SEGMENTS.map(s => ({ ...s, value: positionCounts[s.key] || 0 }))}
          size={DONUT_SIZE}
        />
        <DonutCard
          title="게시물 최신성 분포"
          total={posts.length}
          segments={RECENCY_SEGMENTS.map(s => ({ ...s, value: recencyCounts[s.key] || 0 }))}
          size={DONUT_SIZE}
        />
        <div className="mac-card-glass" style={{
          flex: '1 1 260px', minWidth: 260,
          height: DONUT_SIZE,
          padding: '16px 18px 4px',
          borderTop: '1px solid rgba(10,132,255,0.22)',
          display: 'flex', flexDirection: 'column',
        }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 2px' }}>
            콘텐츠 전략 인사이트
          </p>
          <div className="mac-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {insights.map((ins, i) => (
              <InsightRow key={i} insight={ins} index={i} isLast={i === insights.length - 1} />
            ))}
          </div>
        </div>
      </div>

      {/* 포스팅 작성 가이드 */}
      <div className="mac-card-glass" style={{
        padding: '18px 20px 20px',
        borderTop: '1px solid rgba(10,132,255,0.22)',
      }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 12px' }}>
          포스팅 작성 가이드
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {postingGuide.map((tip, i) => (
            <GuideCard key={i} text={tip} />
          ))}
        </div>
      </div>

      {/* 상위 블로그 목록 */}
      <div className="mac-card-glass overflow-hidden" style={{ borderTop: '2px solid rgba(10,132,255,0.35)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent)', margin: 0 }}>
            상위 블로그 상세
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
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
                    padding: '7px 12px', fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                    color: 'var(--text-secondary)', textAlign: align,
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
