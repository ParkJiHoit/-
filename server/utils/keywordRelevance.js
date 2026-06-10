const SYNONYM_GROUPS = [
  ['휴대폰', '핸드폰', '스마트폰', '휴대전화', '폰', '모바일'],
  ['창업', '개업', '사업', '가맹', '가맹점', '대리점', '매장', '판매점'],
  ['소자본', '무자본', '저자본', '1인', '무인', '부업'],
  ['여성', '여자', '주부', '맘'],
  ['배달', '프랜차이즈', '체인', '창업비용', '창업아이템']
];

const UNRELATED_BUSINESS_HINTS = [
  '베이커리',
  '노래방',
  '호프',
  '호프집',
  '맛집',
  '카페',
  '치킨',
  '피자',
  '술집',
  '식당',
  '배너',
  'pop'
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function splitBaseTokens(baseKeyword) {
  const spacedTokens = String(baseKeyword || '')
    .toLowerCase()
    .split(/\s+/)
    .map((token) => normalizeText(token))
    .filter((token) => token.length >= 2);

  const compactBase = normalizeText(baseKeyword);
  const knownTokens = SYNONYM_GROUPS.flat().filter((token) => compactBase.includes(normalizeText(token)));

  return [...new Set([...spacedTokens, ...knownTokens, compactBase].filter((token) => token.length >= 2))];
}

function expandTokens(tokens) {
  const expanded = new Set(tokens);

  tokens.forEach((token) => {
    SYNONYM_GROUPS.forEach((group) => {
      if (group.some((synonym) => normalizeText(synonym) === token || token.includes(normalizeText(synonym)))) {
        group.forEach((synonym) => expanded.add(normalizeText(synonym)));
      }
    });
  });

  return [...expanded];
}

function getNgrams(text, size = 2) {
  if (text.length <= size) return [text].filter(Boolean);

  return Array.from({ length: text.length - size + 1 }, (_value, index) => text.slice(index, index + size));
}

function getJaccardScore(a, b) {
  const aSet = new Set(a);
  const bSet = new Set(b);
  const intersection = [...aSet].filter((item) => bSet.has(item)).length;
  const union = new Set([...aSet, ...bSet]).size;

  return union ? intersection / union : 0;
}

function hasUnrelatedBusinessHint(candidate) {
  const normalizedCandidate = normalizeText(candidate);
  return UNRELATED_BUSINESS_HINTS.some((hint) => normalizedCandidate.includes(normalizeText(hint)));
}

export function getRelevanceLevel(score) {
  if (score >= 55) return '높음';
  if (score >= 35) return '중간';
  return '낮음';
}

export function calculateKeywordRelevance(baseKeyword, candidateKeyword) {
  const normalizedBase = normalizeText(baseKeyword);
  const normalizedCandidate = normalizeText(candidateKeyword);

  if (!normalizedBase || !normalizedCandidate) {
    return {
      relevanceScore: 0,
      relevanceLevel: '낮음',
      matchedTerms: []
    };
  }

  if (normalizedBase === normalizedCandidate) {
    return {
      relevanceScore: 100,
      relevanceLevel: '높음',
      matchedTerms: [baseKeyword]
    };
  }

  const baseTokens = splitBaseTokens(baseKeyword);
  const expandedBaseTokens = expandTokens(baseTokens);
  const matchedTerms = expandedBaseTokens.filter((token) => normalizedCandidate.includes(token));
  const coreTokenMatches = baseTokens.filter((token) => normalizedCandidate.includes(token)).length;

  const directScore = normalizedCandidate.includes(normalizedBase) ? 45 : 0;
  const reverseDirectScore = normalizedBase.includes(normalizedCandidate) && normalizedCandidate.length >= 2 ? 24 : 0;
  const tokenScore = Math.min(35, (matchedTerms.length / Math.max(baseTokens.length, 1)) * 35);
  const coreTokenBonus = Math.min(10, coreTokenMatches * 5);
  const ngramScore = getJaccardScore(getNgrams(normalizedBase), getNgrams(normalizedCandidate)) * 20;
  const sameCategoryBonus = matchedTerms.length >= 2 ? 8 : 0;
  const unrelatedPenalty = hasUnrelatedBusinessHint(candidateKeyword) && matchedTerms.length === 0 ? 35 : 0;

  const relevanceScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        directScore +
          reverseDirectScore +
          tokenScore +
          coreTokenBonus +
          ngramScore +
          sameCategoryBonus -
          unrelatedPenalty
      )
    )
  );

  return {
    relevanceScore,
    relevanceLevel: getRelevanceLevel(relevanceScore),
    matchedTerms: [...new Set(matchedTerms)]
  };
}
