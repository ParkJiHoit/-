import { Activity, BarChart3, FileText, Gauge, Target, TrendingUp } from 'lucide-react';
import { formatNumber, formatPercent } from '../utils/formatters';

const actionStyles = {
  '작성 우선': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  '상승 키워드': 'border-blue-200 bg-blue-50 text-blue-700',
  '최신성 경쟁': 'border-violet-200 bg-violet-50 text-violet-700',
  '과포화 주의': 'border-rose-200 bg-rose-50 text-rose-700',
  보류: 'border-slate-200 bg-slate-100 text-slate-600',
  '검토 후보': 'border-amber-200 bg-amber-50 text-amber-700'
};

export default function BlogSummaryCards({ metrics }) {
  if (!metrics) return null;

  const cards = [
    {
      label: '월 검색량',
      value: formatNumber(metrics.monthlySearch),
      icon: BarChart3,
      note: metrics.searchAdAvailable ? '검색광고 기준' : '검색광고 미연동'
    },
    {
      label: '블로그 문서 수',
      value: formatNumber(metrics.totalBlogDocuments),
      icon: FileText,
      note: '네이버 블로그 검색 total'
    },
    {
      label: '최근 30일 샘플',
      value: formatNumber(metrics.recentPostCount),
      icon: Activity,
      note: `최근 비중 ${formatPercent(metrics.recentPublishRatio)}`
    },
    {
      label: '블로그 포화도',
      value: Math.round(metrics.blogSaturationScore),
      icon: Gauge,
      note: '높을수록 경쟁 과열'
    },
    {
      label: '콘텐츠 기회 점수',
      value: Math.round(metrics.contentOpportunityScore),
      icon: Target,
      note: metrics.recommendAction
    },
    {
      label: '검색 트렌드',
      value: metrics.trendAvailable ? metrics.trendDirection : '미제공',
      icon: TrendingUp,
      note: metrics.trendAvailable ? `${formatPercent(metrics.trendChangeRate)} 변화` : '데이터랩 설정 필요'
    }
  ];

  return (
    <section className="stagger-children grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article className="apple-card animate-fade-in-up p-4" key={card.label}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-bold uppercase leading-4 tracking-wider text-slate-400">{card.label}</span>
              <Icon className="h-4 w-4 shrink-0 text-slate-300" />
            </div>
            <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{card.value}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">{card.note}</p>
          </article>
        );
      })}

      <div
        className={`animate-fade-in-up rounded-xl border p-4 xl:col-span-6 ${
          actionStyles[metrics.recommendAction] || actionStyles['검토 후보']
        }`}
      >
        <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">추천 액션</p>
        <p className="mt-1 text-xl font-black">{metrics.recommendAction}</p>
      </div>
    </section>
  );
}
