import { Activity, BarChart3, FileText, Gauge, Target, TrendingUp } from 'lucide-react';
import { formatNumber, formatPercent } from '../utils/formatters';

const ACTION_STYLE = {
  '작성 우선':   { bg: 'rgba(48,209,88,0.12)',   color: 'var(--success)',     border: 'rgba(48,209,88,0.22)' },
  '상승 키워드': { bg: 'rgba(10,132,255,0.12)',  color: 'var(--accent)',      border: 'rgba(10,132,255,0.22)' },
  '최신성 경쟁': { bg: 'rgba(94,92,230,0.12)',   color: '#5E5CE6',            border: 'rgba(94,92,230,0.22)' },
  '과포화 주의': { bg: 'rgba(255,69,58,0.12)',   color: 'var(--destructive)', border: 'rgba(255,69,58,0.22)' },
  '보류':        { bg: 'var(--bg-overlay)',       color: 'var(--text-secondary)', border: 'var(--border)' },
  '검토 후보':   { bg: 'rgba(255,159,10,0.12)',  color: 'var(--warning)',     border: 'rgba(255,159,10,0.22)' }
};

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
      {cards.map(({ label, value, icon: Icon, note }) => (
        <article className="mac-card px-4 py-4" key={label}>
          <div className="flex items-start justify-between gap-2">
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
              {label}
            </span>
            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)', marginTop: 10 }}>
            {value}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{note}</p>
        </article>
      ))}

      <div
        className="rounded-[14px] px-5 py-4 xl:col-span-6"
        style={{ background: actionSt.bg, border: `1px solid ${actionSt.border}` }}
      >
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, color: actionSt.color, margin: 0 }}>
          추천 액션
        </p>
        <p style={{ fontSize: 18, fontWeight: 700, color: actionSt.color, marginTop: 4 }}>
          {metrics.recommendAction}
        </p>
      </div>
    </section>
  );
}
