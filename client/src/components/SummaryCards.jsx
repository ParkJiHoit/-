import { Activity, Gauge, Lightbulb, ShieldAlert, Target, Trophy } from 'lucide-react';

const cardConfig = [
  { key: 'totalKeywords', label: '전체 추천 키워드 수', icon: Target },
  { key: 'priorityCount', label: '우선 테스트 키워드 수', icon: Trophy },
  { key: 'opportunityCount', label: '기회 키워드 수', icon: Lightbulb },
  { key: 'saturatedCount', label: '과포화 주의 키워드 수', icon: ShieldAlert },
  { key: 'avgEfficiencyScore', label: '평균 효율 점수', icon: Activity, suffix: '점' },
  { key: 'avgSaturationScore', label: '평균 포화도 점수', icon: Gauge, suffix: '점' }
];

export default function SummaryCards({ summary }) {
  return (
    <section className="stagger-children grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cardConfig.map(({ key, label, icon: Icon, suffix = '' }) => (
        <article className="apple-card animate-fade-in-up p-4" key={key}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-bold uppercase leading-4 tracking-wider text-slate-400">{label}</p>
            <Icon className="h-4 w-4 shrink-0 text-slate-300" />
          </div>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            {summary?.[key] ?? 0}
            {suffix && <span className="ml-0.5 text-base">{suffix}</span>}
          </p>
        </article>
      ))}
    </section>
  );
}
