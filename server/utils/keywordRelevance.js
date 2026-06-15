const SYNONYM_GROUPS = [
  ['휴대폰', '핸드폰', '스마트폰', '휴대전화', '폰', '모바일'],
  ['창업', '개업', '사업', '가맹', '가맹점', '대리점', '매장', '판매점'],
  ['소자본', '무자본', '저자본', '1인', '무인', '부업'],
  ['여성', '여자', '주부', '맘'],
  ['배달', '프랜차이즈', '체인', '창업비용', '창업아이템'],
  ['온라인', '인터넷', '쇼핑몰', '전자상거래', 'e커머스'],
  ['임대', '분양', '부동산', '상가', '오피스텔'],
  ['교육', '학원', '과외', '강의', '레슨'],
  ['배송', '물류', '택배', '운송'],
  ['인테리어', '리모델링', '시공', '설치']
];

const UNRELATED_BUSINESS_HINTS = [
  '베이커리', '노래방', '호프', '호프집', '맛집', '카페', '치킨',
  '피자', '술집', '식당', '배너', 'pop', '클럽', '바', '레스토랑'
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
  return Array.from({ length: text.length - size + 1 }, (_v, i) => text.slice(i, i + size));
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
  if (score >= 65) return '높음';
  if (score >= 45) return '중간';
  return '낮음';
}

export function calculateKeywordRelevance(baseKeyword, candidateKeyword) {
  const normalizedBase = normalizeText(baseKeyword);
  const normalizedCandidate = normalizeText(candidateKeyword);

  if (!normalizedBase || !normalizedCandidate) {
    return { relevanceScore: 0, relevanceLevel: '낮음', matchedTerms: [] };
  }

  if (normalizedBase === normalizedCandidate) {
    return { relevanceScore: 100, relevanceLevel: '높음', matchedTerms: [baseKeyword] };
  }

  const baseTokens = splitBaseTokens(baseKeyword);
  const expandedBaseTokens = expandTokens(baseTokens);
  const matchedTerms = expandedBaseTokens.filter((token) => normalizedCandidate.includes(token));
  const coreTokenMatches = baseTokens.filter((token) => normalizedCandidate.includes(token)).length;

  // candidate가 base를 포함: 직접 연관 (높은 점수)
  const directScore = normalizedCandidate.includes(normalizedBase) ? 45 : 0;

  // base가 candidate를 포함: candidate가 base 길이의 55% 이상이어야 의미 있는 연관으로 봄
  // 예: base=창업프랜차이즈(7), candidate=창업(2) → 2/7=28% → 점수 없음
  //     base=창업(2), candidate=창(1) → 길이 1 → 최소 2자 조건에서 이미 제외됨
  const reverseRatio = normalizedBase.length > 0 ? normalizedCandidate.length / normalizedBase.length : 0;
  const reverseDirectScore =
    normalizedBase.includes(normalizedCandidate) && normalizedCandidate.length >= 2 && reverseRatio >= 0.55 ? 22 : 0;

  // 토큰 매칭 점수: 매칭된 토큰 비율 기반
  const tokenScore = Math.min(38, (matchedTerms.length / Math.max(baseTokens.length, 1)) * 38);

  // 핵심 토큰 보너스
  const coreTokenBonus = Math.min(12, coreTokenMatches * 6);

  // bigram Jaccard (한국어에서는 보조 신호로만 사용, 가중치 낮춤)
  const ngramScore = getJaccardScore(getNgrams(normalizedBase), getNgrams(normalizedCandidate)) * 15;

  // 동의어 그룹 두 개 이상 매칭 시 보너스
  const sameCategoryBonus = matchedTerms.length >= 2 ? 8 : 0;

  // 비연관 업종 패널티 (매칭 토큰이 없을 때만 적용)
  const unrelatedPenalty = hasUnrelatedBusinessHint(candidateKeyword) && matchedTerms.length === 0 ? 35 : 0;

  // 후보가 매우 짧고(2자 이하) base보다 훨씬 짧으면 소폭 패널티
  const shortCandidatePenalty =
    normalizedCandidate.length <= 2 && normalizedBase.length > normalizedCandidate.length * 2 ? 8 : 0;

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
          unrelatedPenalty -
          shortCandidatePenalty
      )
    )
  );

  return {
    relevanceScore,
    relevanceLevel: getRelevanceLevel(relevanceScore),
    matchedTerms: [...new Set(matchedTerms)]
  };
}
