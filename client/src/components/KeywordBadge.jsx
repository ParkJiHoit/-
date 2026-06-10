const badgeStyles = {
  '우선 테스트': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '기회 키워드': 'bg-sky-50 text-sky-700 border-sky-200',
  '모바일 집중': 'bg-violet-50 text-violet-700 border-violet-200',
  '과포화 주의': 'bg-rose-50 text-rose-600 border-rose-200',
  '제외 검토': 'bg-slate-100 text-slate-500 border-slate-200',
  모니터링: 'bg-amber-50 text-amber-700 border-amber-200',
  '핵심 후보': 'bg-slate-900 text-white border-transparent'
};

export function getActionRowClass(row) {
  if (row.saturationScore >= 80) return 'bg-rose-50/60';
  if (row.discoveryScore >= 80 || row.efficiencyScore >= 80) return 'bg-emerald-50/60';
  if (row.mobileRatio >= 80) return 'bg-violet-50/60';
  return 'bg-white';
}

export default function KeywordBadge({ action }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-bold ${
        badgeStyles[action] || badgeStyles.모니터링
      }`}
    >
      {action}
    </span>
  );
}
