const badgeStyles = {
  '우선 테스트': 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  '기회 키워드': 'bg-sky-100 text-sky-700 ring-sky-200',
  '모바일 집중': 'bg-violet-100 text-violet-700 ring-violet-200',
  '과포화 주의': 'bg-rose-100 text-rose-700 ring-rose-200',
  '제외 검토': 'bg-slate-100 text-slate-600 ring-slate-200',
  모니터링: 'bg-amber-100 text-amber-700 ring-amber-200',
  '핵심 후보': 'bg-slate-900 text-white ring-slate-900'
};

export function getActionRowClass(row) {
  if (row.saturationScore >= 80) return 'bg-rose-50/80';
  if (row.efficiencyScore >= 80) return 'bg-emerald-50/80';
  if (row.mobileRatio >= 80) return 'bg-violet-50/80';
  return 'bg-white';
}

export default function KeywordBadge({ action }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
        badgeStyles[action] || badgeStyles.모니터링
      }`}
    >
      {action}
    </span>
  );
}
