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
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cardConfig.map(({ key, label, icon: Icon, suffix = '' }) => (
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={key}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <Icon className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-3 text-2xl font-black text-slate-950">
            {summary?.[key] ?? 0}
            {suffix}
          </p>
        </article>
      ))}
    </section>
  );
}
