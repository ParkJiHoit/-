function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// 카드/섹션이 순서대로(스태거) 살짝 떠오르며 나타나는 공용 등장 애니메이션.
// custom prop으로 인덱스를 넘기면 delay = index * 0.07초로 계산된다.
// 이 변수 하나가 여러 화면에서 재사용되므로, reduced-motion 대응을 호출부마다
// 반복하지 않고 여기 한 곳에서 처리한다.
export const cardEntranceVariants = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => {
    if (prefersReducedMotion()) return { opacity: 1, y: 0, transition: { duration: 0 } };
    return {
      opacity: 1, y: 0,
      transition: { duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] },
    };
  },
};
