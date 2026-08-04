import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractPostKey, postKeyToString, parsePostKeyString, findMatchingRank, computeAverageCtr, normalizeKeywordSpacing, mostRecentSortDate } from './rankTrackerService.js';

test('blog.naver.com/{id}/{logNo} 형식에서 blogId와 logNo를 추출한다', () => {
  const key = extractPostKey('https://blog.naver.com/myblog123/223456789');
  assert.deepEqual(key, { blogId: 'myblog123', logNo: '223456789' });
});

test('m.blog.naver.com 모바일 URL도 지원한다', () => {
  const key = extractPostKey('https://m.blog.naver.com/myblog123/223456789?a=1');
  assert.deepEqual(key, { blogId: 'myblog123', logNo: '223456789' });
});

test('PostView.naver?blogId=&logNo= 쿼리 형식도 지원한다', () => {
  const key = extractPostKey('https://blog.naver.com/PostView.naver?blogId=myblog123&logNo=223456789');
  assert.deepEqual(key, { blogId: 'myblog123', logNo: '223456789' });
});

test('포스팅 번호 없이 블로그 URL만 있으면 logNo는 null', () => {
  const key = extractPostKey('https://blog.naver.com/myblog123');
  assert.deepEqual(key, { blogId: 'myblog123', logNo: null });
});

test('네이버 블로그 URL이 아니면 null을 반환한다', () => {
  assert.equal(extractPostKey('https://example.com/foo'), null);
});

test('postKeyToString / parsePostKeyString은 서로 역변환된다', () => {
  const key = { blogId: 'myblog123', logNo: '223456789' };
  const str = postKeyToString(key);
  assert.equal(str, 'myblog123/223456789');
  assert.deepEqual(parsePostKeyString(str), key);

  const blogOnly = { blogId: 'myblog123', logNo: null };
  assert.equal(postKeyToString(blogOnly), 'myblog123');
  assert.deepEqual(parsePostKeyString('myblog123'), { blogId: 'myblog123', logNo: null });
});

test('findMatchingRank: logNo가 저장돼 있으면 blogId+logNo 정확히 일치해야 매칭', () => {
  const rankings = [
    { rank: 1, blogId: 'myblog123', logNo: '111' },
    { rank: 2, blogId: 'myblog123', logNo: '222' },
  ];
  assert.equal(findMatchingRank(rankings, 'myblog123/222').rank, 2);
  assert.equal(findMatchingRank(rankings, 'myblog123/999'), null);
});

test('findMatchingRank: logNo가 없으면(레거시) blogId만으로 첫 매칭을 반환', () => {
  const rankings = [
    { rank: 1, blogId: 'myblog123', logNo: '111' },
    { rank: 2, blogId: 'myblog123', logNo: '222' },
  ];
  assert.equal(findMatchingRank(rankings, 'myblog123').rank, 1);
});

test('computeAverageCtr: PC/모바일 둘 다 있으면 단순 평균', () => {
  assert.equal(computeAverageCtr(2, 4), 3);
});

test('computeAverageCtr: 한쪽만 있으면 그 값을 그대로 반환', () => {
  assert.equal(computeAverageCtr(null, 4), 4);
  assert.equal(computeAverageCtr(2, null), 2);
});

test('computeAverageCtr: 둘 다 없으면 null', () => {
  assert.equal(computeAverageCtr(null, null), null);
});

test('normalizeKeywordSpacing: 앞뒤 공백을 제거한다', () => {
  assert.equal(normalizeKeywordSpacing('  핸드폰대리점 창업  '), '핸드폰대리점 창업');
});

test('normalizeKeywordSpacing: 연속된 공백을 하나로 줄인다', () => {
  assert.equal(normalizeKeywordSpacing('핸드폰대리점   창업'), '핸드폰대리점 창업');
});

test('normalizeKeywordSpacing: 한 칸짜리 내부 공백은 그대로 보존한다(네이버가 다른 검색어로 취급하므로)', () => {
  assert.equal(normalizeKeywordSpacing('핸드폰대리점 창업'), '핸드폰대리점 창업');
  assert.equal(normalizeKeywordSpacing('핸드폰대리점창업'), '핸드폰대리점창업');
});

test('mostRecentSortDate: 여러 링크 중 가장 최근에 추가된 링크의 날짜를 반환한다', () => {
  const item = {
    created_at: '2026-07-01T00:00:00Z',
    latestRanks: {
      blog1: { addedDate: '2026-07-01' },
      blog2: { addedDate: '2026-08-02' },
    },
  };
  assert.equal(mostRecentSortDate(item), '2026-08-02');
});

test('mostRecentSortDate: 링크 등록일이 없으면 키워드 자체의 created_at으로 대체한다', () => {
  const item = { created_at: '2026-07-15T00:00:00Z', latestRanks: {} };
  assert.equal(mostRecentSortDate(item), '2026-07-15');
});
