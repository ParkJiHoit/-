const ACTION_CLASS = {
  '우선 테스트': 'mac-badge-green',
  '기회 키워드': 'mac-badge-blue',
  '모바일 집중': 'mac-badge-purple',
  '과포화 주의': 'mac-badge-red',
  '제외 검토':   'mac-badge-gray',
  '모니터링':    'mac-badge-orange',
  '핵심 후보':   'mac-badge-accent'
};

export function getActionRowClass(row) {
  if (row.saturationScore >= 80) return 'mac-row-red';
  if (row.discoveryScore >= 80 || row.efficiencyScore >= 80) return 'mac-row-green';
  if (row.mobileRatio >= 80) return 'mac-row-purple';
  return '';
}

export default function KeywordBadge({ action }) {
  return (
    <span className={`mac-badge ${ACTION_CLASS[action] || 'mac-badge-gray'}`}>
      {action}
    </span>
  );
}
