// 카드/섹션이 순서대로(스태거) 살짝 떠오르며 나타나는 공용 등장 애니메이션.
// custom prop으로 인덱스를 넘기면 delay = index * 0.07초로 계산된다.
export const cardEntranceVariants = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] },
  }),
};
