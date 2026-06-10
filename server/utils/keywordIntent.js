// 의도 규칙: 각 타입별로 강도(강/중/약) 단어 목록을 구분
const INTENT_RULES = [
  {
    type: '창업 의도',
    baseScore: 92,
    strong: ['창업', '개업', '가맹', '가맹점', '창업아이템', '창업방법', '창업비용'],
    weak: ['시작', '오픈', '준비', '입문']
  },
  {
    type: '대리점/매장',
    baseScore: 85,
    strong: ['대리점', '판매점', '매장', '점포', '가게', '지점'],
    weak: ['매장창업', '오프라인', '오픈']
  },
  {
    type: '비용/수익',
    baseScore: 80,
    strong: ['비용', '마진', '수익', '순수익', '매출', '견적', '수입'],
    weak: ['투자', '금액', '얼마', '가격', '단가']
  },
  {
    type: '정보 탐색',
    baseScore: 65,
    strong: ['방법', '조건', '절차', '후기', '추천', '비교', '전망', '가이드', '정보'],
    weak: ['어떻게', '뭐가', '무엇', '알아보기', '찾기']
  },
  {
    type: '판매/유통',
    baseScore: 60,
    strong: ['판매', '유통', '도매', '납품', '총판', '공급'],
    weak: ['팔기', '거래', '계약']
  },
  {
    type: '수리/중고',
    baseScore: 30,
    strong: ['수리', '중고', '매입', '액정', '케이스', '부품', '악세사리'],
    weak: ['고장', '교체', '수선']
  },
  {
    type: '잡키워드',
    baseScore: 10,
    strong: ['배너', 'pop', '맛집', '노래방', '호프', '베이커리', '카페', '치킨', '피자', '식당', '클럽'],
    weak: []
  }
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function scoreRule(normalizedKeyword, rule) {
  let strongHits = 0;
  let weakHits = 0;

  for (const word of rule.strong) {
    if (normalizedKeyword.includes(normalizeText(word))) strongHits++;
  }
  for (const word of rule.weak) {
    if (normalizedKeyword.includes(normalizeText(word))) weakHits++;
  }

  if (strongHits === 0 && weakHits === 0) return 0;

  // 강 매칭이 있으면 기본 점수, 약 매칭만 있으면 낮춰줌
  // 강 매칭 2개 이상이면 소폭 보너스
  const multiplier = strongHits >= 2 ? 1.1 : strongHits === 1 ? 1.0 : 0.7;
  return Math.min(100, rule.baseScore * multiplier + weakHits * 3);
}

export function classifyKeywordIntent(keyword, baseKeyword = '') {
  const normalizedKeyword = normalizeText(keyword);
  const normalizedBase = normalizeText(baseKeyword);

  // 각 룰별 점수 계산
  const scored = INTENT_RULES.map((rule) => ({
    type: rule.type,
    score: scoreRule(normalizedKeyword, rule)
  })).filter((entry) => entry.score > 0);

  // 가장 높은 점수의 의도 타입 선택
  if (scored.length > 0) {
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    // 2위 의도가 근소하게 따라오는 경우(10점 이내) 복합 의도이므로 점수 소폭 하향
    const hasCloseSecond = scored.length >= 2 && best.score - scored[1].score < 10;
    const finalScore = Math.round(hasCloseSecond ? best.score * 0.92 : best.score);

    return { intentType: best.type, intentScore: Math.min(100, finalScore) };
  }

  // 매칭 룰 없음: base와 직접 연관이면 '핵심 연관'
  if (normalizedBase && (normalizedKeyword.includes(normalizedBase) || normalizedBase.includes(normalizedKeyword))) {
    return { intentType: '핵심 연관', intentScore: 72 };
  }

  // 아무 시그널도 없으면 일반 후보 (점수 50)
  return { intentType: '일반 후보', intentScore: 50 };
}
