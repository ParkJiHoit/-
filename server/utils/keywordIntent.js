const INTENT_RULES = [
  {
    type: '창업 의도',
    score: 95,
    words: ['창업', '개업', '가맹', '가맹점', '창업아이템', '창업방법']
  },
  {
    type: '대리점/매장',
    score: 88,
    words: ['대리점', '판매점', '매장', '매장창업', '점포', '가게']
  },
  {
    type: '비용/수익',
    score: 82,
    words: ['비용', '창업비용', '마진', '수익', '순수익', '매출', '견적']
  },
  {
    type: '정보 탐색',
    score: 68,
    words: ['방법', '조건', '절차', '후기', '추천', '비교', '전망']
  },
  {
    type: '판매/유통',
    score: 58,
    words: ['판매', '유통', '도매', '납품', '총판']
  },
  {
    type: '수리/중고',
    score: 28,
    words: ['수리', '중고', '매입', '액정', '케이스', '악세사리', '부품']
  },
  {
    type: '잡키워드',
    score: 12,
    words: ['배너', 'pop', '맛집', '노래방', '호프', '베이커리', '카페', '치킨', '피자']
  }
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function classifyKeywordIntent(keyword, baseKeyword = '') {
  const normalizedKeyword = normalizeText(keyword);
  const normalizedBase = normalizeText(baseKeyword);

  for (const rule of INTENT_RULES) {
    if (rule.words.some((word) => normalizedKeyword.includes(normalizeText(word)))) {
      return {
        intentType: rule.type,
        intentScore: rule.score
      };
    }
  }

  if (normalizedBase && (normalizedKeyword.includes(normalizedBase) || normalizedBase.includes(normalizedKeyword))) {
    return {
      intentType: '핵심 연관',
      intentScore: 75
    };
  }

  return {
    intentType: '일반 후보',
    intentScore: 50
  };
}
