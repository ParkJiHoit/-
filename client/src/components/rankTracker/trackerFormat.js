export function formatKSTDateTime(isoString) {
  const d = new Date(new Date(isoString).getTime() + 9 * 60 * 60 * 1000);
  const date = d.toISOString().slice(0, 10);
  const hm = d.toISOString().slice(11, 16);
  return `${date} ${hm}`;
}

// status는 이미 상위 5위 판정을 반영한다(백엔드 refreshRanks) — 'ranked'일 때만 숫자를 보여준다.
// status가 null/undefined면 한 번도 갱신을 안 돌려서 스냅샷 자체가 없는 것 — 실제로
// 순위권 밖으로 "확인된" 미노출과는 다른 상태라 구분해서 보여준다.
export function formatRankStatus(rank, status) {
  if (status == null) return { label: '미확인', color: 'var(--text-tertiary)', unchecked: true };
  if (status === 'fetch_failed') return { label: '⚠ 조회 실패', color: '#FF9F0A' };
  if (status === 'ranked' && rank != null) {
    return { label: `${rank}위`, color: rank <= 3 ? '#30D158' : '#FF9F0A' };
  }
  return { label: '미노출', color: 'var(--text-tertiary)' };
}
