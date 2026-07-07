import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchFaq } from './chatFaqService.js';

test('키워드가 2개 이상 겹치면 해당 FAQ로 매칭한다', () => {
  const result = matchFaq('블로그 진단 등급이 뭔가요?');
  assert.equal(result.matched, true);
  assert.equal(result.faqId, 'blog-audit-howto');
});

test('무관한 입력은 매칭되지 않고 폴백 답변을 반환한다', () => {
  const result = matchFaq('오늘 점심 뭐 먹지');
  assert.equal(result.matched, false);
  assert.equal(result.faqId, null);
});

test('빈 문자열/공백만 있는 입력은 매칭되지 않는다', () => {
  assert.equal(matchFaq('').matched, false);
  assert.equal(matchFaq('   ').matched, false);
});

test('띄어쓰기가 달라도 정규화되어 매칭된다', () => {
  const result = matchFaq('블로그   진단     등급');
  assert.equal(result.matched, true);
  assert.equal(result.faqId, 'blog-audit-howto');
});

test('키워드가 1개만 겹치면 임계치 미달로 매칭되지 않는다', () => {
  const result = matchFaq('등급');
  assert.equal(result.matched, false);
});
