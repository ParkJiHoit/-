export function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Number(value) || 0);
}

export function formatPercent(value) {
  return `${(Number(value) || 0).toFixed(1)}%`;
}

export function formatScore(value) {
  return `${Math.round(Number(value) || 0)}점`;
}

export function getDownloadFileName() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `naver_keyword_recommendation_${yyyy}${mm}${dd}.xlsx`;
}
