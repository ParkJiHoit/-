import Anthropic from '@anthropic-ai/sdk';

// Phase 2 확장: 규칙 기반 매칭(chatFaqService)이 실패했을 때만 호출되는 LLM 폴백.
// ANTHROPIC_API_KEY 미설정 시 null을 반환해 호출부가 정적 폴백 문구로 대체할 수 있게 한다.
const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `당신은 "RANKLET"이라는 네이버 키워드/블로그 분석 SaaS의 고객센터 챗봇입니다.
다음은 서비스가 제공하는 기능입니다:

1. 키워드 분석: 기준 키워드 1개 입력 시 연관 키워드, PC/모바일 검색량, 경쟁도, 포화도, 효율 점수를 분석하고 의도 유형을 자동 분류. 엑셀 다운로드 지원.
2. 블로그 구조 분석: 특정 키워드의 블로그탭+VIEW탭 상위 10개 포스팅을 분석해 어떤 콘텐츠를 써야 이길 수 있는지 인사이트 제공.
3. 블로그 진단: 블로그 URL 1개를 활동성·상위노출 이력·영향력·신뢰도·연차 5개 항목으로 평가해 S~D 등급 산출.
4. 순위 추적: 등록한 키워드×블로그(또는 포스팅)가 네이버 블로그탭에서 몇 위인지 추적. 블로그 추적/전체 순위 두 모드, 그룹 관리, CSV/엑셀 대량 등록, 잡 기반 일괄 새로고침, 엑셀 히트맵 내보내기 지원.
5. 일일 사용 한도: 키워드 분석·블로그 구조 분석·블로그 진단·개별 순위 갱신 등 기능별로 하루 사용 횟수 제한이 있으며 플랜에 따라 다름.

답변 규칙:
- 위 기능 설명과 서비스 이용 방법에 대한 질문에만 답하세요.
- 결제 금액, 환불 절차, 계정 개인정보 등 정확한 확인이 필요한 질문에는 "정확한 안내를 위해 하단 문의하기를 이용해 주세요."라고만 답하세요.
- 서비스와 무관한 질문(잡담, 다른 서비스, 일반 상식 등)에는 "죄송해요, 그 부분은 도와드리기 어려워요. 서비스 이용 방법에 대해 질문해 주세요."라고 답하세요.
- 모르는 내용은 추측하지 마세요.
- 답변은 한국어로, 3문장 이내로 간결하게 작성하세요.`;

let client = null;

function getClient() {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client = new Anthropic();
  return client;
}

export async function getLlmAnswer(userMessage) {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock?.text?.trim() || null;
  } catch (err) {
    console.error('[chat] Claude API 호출 실패:', err.message);
    return null;
  }
}
