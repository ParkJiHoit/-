// 신규 포스팅은 통상 1~2주 안에 순위가 크게 출렁이다 안정되는 편이라, 등록 14일이
// 지나면 "안정화됨"으로 보고 화면 정리 및 전체 갱신 대상에서 제외한다.
export const STABILIZED_AFTER_DAYS = 14;

function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// "안정화됨" 분류는 링크 단위 등록일 기준으로 판단한다 — 키워드 자체는 오래됐어도
// 그 안에 방금 추가한 링크가 하나라도 있으면(=가장 최근 링크가 기준일 이내면)
// 아직 안정화되지 않은 것으로 취급해 접히지 않게 한다.
export function mostRecentAddedDate(item) {
  const dates = Object.values(item.latestRanks || {}).map(r => r.addedDate).filter(Boolean);
  return dates.length ? dates.sort().at(-1) : null;
}

export function itemAgeDays(item, mode) {
  if (mode === 'blog') {
    const latest = mostRecentAddedDate(item);
    if (latest) return daysSince(latest);
  }
  return daysSince(item.created_at);
}

// stabilization_manual이 true면(=사람이 안정화/해제 버튼을 눌러본 적 있음) 나이와
// 무관하게 is_stabilized 값을 그대로 신뢰한다 — 그렇지 않으면 "해제"를 눌러도
// 14일 지난 항목은 나이 조건 때문에 곧바로 다시 안정화됨으로 되돌아가 버린다.
// 한 번도 안 건드린 항목만 등록 후 14일 경과 여부로 자동 판정한다.
export function isEffectivelyStabilized(item, mode) {
  if (item.stabilization_manual) return !!item.is_stabilized;
  return itemAgeDays(item, mode) >= STABILIZED_AFTER_DAYS;
}
