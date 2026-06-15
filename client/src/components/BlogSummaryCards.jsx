import { Activity, BarChart3, FileText, Gauge, Target, TrendingUp } from 'lucide-react';
import { formatNumber, formatPercent } from '../utils/formatters';

const ACTION_STYLE = {
  '작성 우선':   { bg: 'rgba(48,209,88,0.12)',   color: 'var(--success)',     border: 'rgba(48,209,88,0.22)',  tint: 'rgba(48,209,88,0.08)',  accent: '#30D158' },
  '상승 키워드': { bg: 'rgba(10,132,255,0.12)',  color: 'var(--accent)',      border: 'rgba(10,132,255,0.22)', tint: 'rgba(10,132,255,0.08)', accent: '#0A84FF' },
  '최신성 경쟁': { bg: 'rgba(94,92,230,0.12)',   color: '#5E5CE6',            border: 'rgba(94,92,230,0.22)',  tint: 'rgba(94,92,230,0.08)',  accent: '#5E5CE6' },
  '과포화 주의': { bg: 'rgba(255,69,58,0.12)',   color: 'var(--destructive)', border: 'rgba(255,69,58,0.22)',  tint: 'rgba(255,69,58,0.08)',  accent: '#FF453A' },
  '보류':        { bg: 'var(--bg-overlay)',       color: 'var(--text-secondary)', border: 'var(--border)',      tint: 'transparent',            accent: 'var(--text-secondary)' },
  '검토 후보':   { bg: 'rgba(255,159,10,0.12)',  color: 'var(--warning)',     border: 'rgba(255,159,10,0.22)', tint: 'rgba(255,159,10,0.08)', accent: '#FF9F0A' }
};

const CARD_COLORS = ['#0A84FF', '#30D158', '#5E5CE6', '#FF9F0A', '#30D158', '#34C1FF'];

export default function BlogSummaryCards({ metrics }) {
  if (!metrics) return null;

  const cards = [
    { label: '월 검색량',       value: formatNumber(metrics.monthlySearch),    icon: BarChart3,  note: metrics.searchAdAvailable ? '검색광고 기준' : '검색광고 미연동' },
    { label: '블로그 문서 수',   value: formatNumber(metrics.totalBlogDocuments), icon: FileText, note: '네이버 블로그 검색 total' },
    { label: '최근 30일 샘플',  value: formatNumber(metrics.recentPostCount),  icon: Activity,   note: `최근 비중 ${formatPercent(metrics.recentPublishRatio)}` },
    { label: '블로그 포화도',    value: Math.round(metrics.blogSaturationScore), icon: Gauge,     note: '높을수록 경쟁 과열' },
    { label: '콘텐츠 기회 점수', value: Math.round(metrics.contentOpportunityScore), icon: Target, note: metrics.recommendAction },
    { label: '검색 트렌드',      value: metrics.trendAvailable ? metrics.trendDirection : '미제공', icon: TrendingUp,
      note: metrics.trendAvailable ? `${formatPercent(metrics.trendChangeRate)} 변화` : '데이터랩 설정 필요' }
  ];

  const actionSt = ACTION_STYLE[metrics.recommendAction] || ACTION_STYLE['검토 후보'];

  return (
    <section className="mac-stagger grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      {cards.map(({ label, value, icon: Icon, note }, i) => {
        const color = CARD_COLORS[i % CARD_COLORS.length];
        return (
          <article
            key={label}
            className="mac-card"
            style={{
              padding: '22px 22px 20px',
              display: 'flex', flexDirection: 'column', gap: 14,
              background: `radial-gradient(ellipse at top left, ${color}12 0%, transparent 60%)`,
              borderTop: `1px solid ${color}30`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--text-tertiary)', lineHeight: 1.4,
              }}>
                {label}
              </span>
              <Icon style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--text-tertiary)', marginTop: 1 }} />
            </div>
            <p style={{
              fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px',
              color: 'var(--text-primary)', margin: 0, lineHeight: 1,
            }}>
              {value}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ height: 3, borderRadius: 2, background: color, opacity: 0.7, width: '40%' }} />
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>{note}</p>
            </div>
          </article>
        );
      })}

      <div
        className="rounded-[14px] px-5 py-4 xl:col-span-6"
        style={{
          background: `radial-gradient(ellipse at top left, ${actionSt.tint} 0%, transparent 60%)`,
          border: `1px solid ${actionSt.border}`,
          borderTop: `2px solid ${actionSt.accent}`,
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, color: actionSt.color, margin: 0 }}>
          추천 액션
        </p>
        <p style={{ fontSize: 18, fontWeight: 700, color: actionSt.color, marginTop: 4, marginBottom: 0 }}>
          {metrics.recommendAction}
        </p>
      </div>
    </section>
  );
}
