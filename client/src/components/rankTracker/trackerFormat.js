export function formatKSTDateTime(isoString) {
  const d = new Date(new Date(isoString).getTime() + 9 * 60 * 60 * 1000);
  const date = d.toISOString().slice(0, 10);
  const hm = d.toISOString().slice(11, 16);
  return `${date} ${hm}`;
}

// status는 이미 상위 5위 판정을 반영한다(백엔드 refreshRanks) — 'ranked'일 때만 숫자를 보여준다.
export function formatRankStatus(rank, status) {
  if (status === 'fetch_failed') return { label: '⚠ 조회 실패', color: '#FF9F0A' };
  if (status === 'ranked' && rank != null) {
    return { label: `${rank}위`, color: rank <= 3 ? '#30D158' : '#FF9F0A' };
  }
  return { label: '미노출', color: 'var(--text-tertiary)' };
}
