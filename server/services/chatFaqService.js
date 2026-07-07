import { CHAT_FAQ, FALLBACK_ANSWER } from '../data/chatFaq.js';

const MATCH_THRESHOLD = 2; // 최소 2개 이상 키워드 토큰이 일치해야 신뢰

function normalize(text) {
  return (text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, '') // 한글 띄어쓰기 편차를 흡수하기 위해 전부 붙여서 비교
    .trim();
}

function scoreEntry(normalizedMessage, entry) {
  let score = 0;
  for (const pattern of entry.patterns) {
    const p = normalize(pattern);
    if (p && normalizedMessage.includes(p)) score += 1;
  }
  return score;
}

// Phase 2 확장 지점: 이 함수가 matched=false를 반환하면 호출부(chat.js)에서
// LLM 폴백을 붙일 수 있다. 이 함수 자체는 절대 외부 API를 호출하지 않는다.
export function matchFaq(rawMessage) {
  const normalizedMessage = normalize(rawMessage);
  if (!normalizedMessage) {
    return { matched: false, answer: FALLBACK_ANSWER, faqId: null, score: 0 };
  }

  let best = null;
  for (const entry of CHAT_FAQ) {
    const score = scoreEntry(normalizedMessage, entry);
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }

  if (best && best.score >= MATCH_THRESHOLD) {
    return { matched: true, answer: best.entry.answer, faqId: best.entry.id, score: best.score };
  }
  return { matched: false, answer: FALLBACK_ANSWER, faqId: null, score: best?.score ?? 0 };
}
