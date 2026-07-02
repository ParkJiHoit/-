import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractPostKey, postKeyToString, parsePostKeyString, findMatchingRank } from './rankTrackerService.js';

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
