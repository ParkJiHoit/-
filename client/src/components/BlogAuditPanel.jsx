import { ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import ScoreRadarCard from './ScoreRadarCard';
import InfoTip from './InfoTip';

const GRADE_CONFIG = {
  S: { color: 'var(--success)', bg: 'rgba(48,209,88,0.12)',  border: 'rgba(48,209,88,0.30)',  label: '최우수' },
  A: { color: '#0A84FF',        bg: 'rgba(10,132,255,0.12)', border: 'rgba(10,132,255,0.30)', label: '우수' },
  B: { color: 'var(--warning)', bg: 'rgba(255,159,10,0.12)', border: 'rgba(255,159,10,0.30)', label: '보통' },
  C: { color: '#FF6B35',        bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', label: '미흡' },
  D: { color: 'var(--destructive)', bg: 'rgba(255,69,58,0.12)', border: 'rgba(255,69,58,0.30)', label: '부적합' },
};

const SCORE_LABELS = {
  activity: '활동성',
  exposure: '상위 노출 이력',
  influence: '블로그 영향력',
  trust: '신뢰도',
  age: '블로그 연차',
};

const SCORE_MAX = {
  activity: 30,
  exposure: 30,
  influence: 20,
  trust: 10,
  age: 10,
};

function StatChip({ label, value, color, sub, tip }) {
  return (
    <div className="mac-card-glass" style={{
      display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 16px',
      borderRadius: 12,
      background: `radial-gradient(ellipse at top left, ${color || '#0A84FF'}10 0%, transparent 60%)`,
      borderTop: `1px solid ${color || '#0A84FF'}28`,
      border: `1px solid var(--border)`,
    }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
        {label}{tip && <InfoTip text={tip} />}
      </span>
      <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: value === null || value === undefined ? 'var(--text-tertiary)' : (color || 'var(--text-primary)'), letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value === null || value === undefined ? '비공개' : value}
      </span>
      {sub && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{sub}</span>}
    </div>
  );
}

export default function BlogAuditPanel({ result }) {
  if (!result) return null;
  const { blogId, blogUrl, blogName, score, verdict, warnings, stats, recentPosts } = result;
  const gc = GRADE_CONFIG[score.grade] || GRADE_CONFIG.C;

  return (
    <div className="mac-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* 헤더 — 블로그 정보 + 종합 등급 */}
      <div className="mac-card-glass" style={{
        padding: '24px 28px',
        background: `radial-gradient(ellipse at top left, ${gc.color}10 0%, transparent 55%)`,
        borderTop: `2px solid ${gc.color}55`,
        display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
      }}>
        {/* 등급 원형 */}
        <div style={{
          width: 88, height: 88, borderRadius: '50%', flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: gc.bg, border: `2px solid ${gc.border}`,
        }}>
          <span style={{ fontSize: 36, fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", color: gc.color, lineHeight: 1 }}>{score.grade}</span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: gc.color, opacity: 0.8, marginTop: 2 }}>{gc.label}</span>
        </div>

        {/* 블로그 정보 */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
              {blogName || blogId}
            </p>
            <a href={blogUrl} target="_blank" rel="noreferrer"
              style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center' }}>
              <ExternalLink size={14} />
            </a>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 12px' }}>blog.naver.com/{blogId}</p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{verdict}</p>
        </div>

        {/* 종합 점수 */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <p style={{ fontSize: 52, fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", color: gc.color, margin: 0, lineHeight: 1, letterSpacing: '-2px' }}>
            {score.total}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0', fontWeight: 600, letterSpacing: '0.04em' }}>
            / 100점
          </p>
        </div>
      </div>

      {/* 경고 메시지 */}
      {warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {warnings.map((w, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 16px', borderRadius: 10,
              background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.22)',
            }}>
              <AlertTriangle size={14} style={{ color: '#FF9F0A', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* 항목별 점수 + KPI 가로 배치 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>

        {/* 항목별 점수 — 레이더 차트 */}
        <div className="mac-card-glass" style={{
          padding: '20px 24px',
          borderTop: '1px solid rgba(10,132,255,0.22)',
          background: 'radial-gradient(ellipse at top left, rgba(10,132,255,0.06) 0%, transparent 55%)',
          flex: '1 1 0',
          minWidth: 0,
          display: 'flex', flexDirection: 'column',
        }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 4px' }}>
            항목별 점수
          </p>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ScoreRadarCard breakdown={score.breakdown} labels={SCORE_LABELS} max={SCORE_MAX} color={gc.color} height="100%" />
          </div>
        </div>

        {/* 핵심 지표 칩 — 2열 4행 */}
        <div style={{ flex: '1 1 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'repeat(4, 1fr)', gap: 8 }}>
          <StatChip label="월 포스팅" value={stats.postsLast30} sub="최근 30일" color="#0A84FF" tip="최근 30일 동안 발행된 포스팅 수입니다. 꾸준한 활동성은 네이버 검색 노출에 긍정적입니다." />
          <StatChip
            label="포스팅 주기"
            value={stats.avgIntervalDays != null ? `${stats.avgIntervalDays}일` : null}
            sub="평균 간격"
            color={stats.avgIntervalDays != null && stats.avgIntervalDays <= 7 ? '#30D158' : stats.avgIntervalDays <= 21 ? '#FF9F0A' : '#FF453A'}
            tip="최근 포스팅 사이의 평균 발행 간격입니다. 짧을수록 활동이 잦은 블로그입니다."
          />
          <StatChip label="상위 노출률" value={`${stats.exposureRate}%`} sub={`${stats.checkedCount}개 확인`} color="#30D158" tip="분석한 키워드 중 블로그탭 상위 10위 안에 실제로 노출된 비율입니다." />
          <StatChip label="일 방문자" value={stats.dailyVisitors != null ? stats.dailyVisitors.toLocaleString() : null} sub="오늘 방문자" color="#34C1FF" tip="오늘 기준 블로그 방문자 수입니다. 네이버 블로그 위젯에서 공개한 경우에만 수집됩니다." />
          <StatChip label="누적 방문자" value={stats.totalVisitors != null ? stats.totalVisitors.toLocaleString() : null} sub="전체 누적" color="#0A84FF" tip="블로그 개설 이후 누적된 총 방문자 수입니다. 블로그 영향력을 가늠하는 대표 지표입니다." />
          <StatChip label="이웃 수" value={stats.neighborCount != null ? stats.neighborCount.toLocaleString() : null} sub="구독자" color="#BF5AF2" tip="이 블로그를 이웃으로 추가한 구독자 수입니다. 많을수록 고정 독자층이 두텁다는 의미입니다." />
          <StatChip label="광고 비중" value={`${stats.adRatio}%`} sub="협찬·제공 포함" color={stats.adRatio > 50 ? '#FF453A' : stats.adRatio > 25 ? '#FF9F0A' : '#30D158'} tip="최근 포스팅 중 협찬·제공·광고 표기가 포함된 비율입니다. 높을수록 광고성 블로그로 판단할 수 있습니다." />
          <StatChip label="블로그 연차" value={stats.blogAgeYears != null ? `${stats.blogAgeYears}년+` : null} sub="RSS 기준" color="#FF9F0A" tip="RSS 피드에 기록된 가장 오래된 포스팅 날짜를 기준으로 산정한 블로그 운영 기간입니다. 오래될수록 네이버 신뢰도 점수에 유리합니다." />
        </div>

      </div>

      {/* 최근 포스트 */}
      {recentPosts.length > 0 && (
        <div className="mac-card-glass overflow-hidden" style={{ borderTop: '2px solid rgba(10,132,255,0.35)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent)', margin: 0 }}>
              최근 포스트
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>RSS 기준 최근 {recentPosts.length}개</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['제목', '날짜', '광고 여부'].map(h => (
                    <th key={h} style={{
                      padding: '8px 16px', fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: 'var(--text-tertiary)', textAlign: 'left',
                      background: 'var(--bg-elevated)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentPosts.map((post, i) => (
                  <tr key={i}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 16px', maxWidth: 400 }}>
                      {post.link ? (
                        <a href={post.link} target="_blank" rel="noreferrer"
                          style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</span>
                          <ExternalLink size={10} style={{ flexShrink: 0, opacity: 0.4 }} />
                        </a>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{post.title}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {post.date ? new Date(post.date).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {post.isAd ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#FF9F0A', background: 'rgba(255,159,10,0.12)', border: '1px solid rgba(255,159,10,0.25)', borderRadius: 5, padding: '2px 7px' }}>
                          <AlertTriangle size={10} /> 광고성
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--success)', background: 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.20)', borderRadius: 5, padding: '2px 7px' }}>
                          <CheckCircle2 size={10} /> 일반
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
