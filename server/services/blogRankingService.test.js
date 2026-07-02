import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRankingList } from './blogRankingService.js';

test('blogId와 logNo를 함께 추출한다', () => {
  const raw = [
    { title: 'A', author: 'author1', dateRaw: '2026.07.01.', postLink: 'https://blog.naver.com/myblog123/223456789', type: 'blog' },
  ];
  const result = buildRankingList(raw, ['blog.naver.com']);
  assert.equal(result.length, 1);
  assert.equal(result[0].blogId, 'myblog123');
  assert.equal(result[0].logNo, '223456789');
  assert.equal(result[0].rank, 1);
});

test('도메인이 일치하지 않는 링크는 걸러낸다', () => {
  const raw = [
    { title: 'C', author: '', dateRaw: '', postLink: 'https://cafe.naver.com/x/1', type: 'cafe' },
  ];
  const result = buildRankingList(raw, ['blog.naver.com']);
  assert.equal(result.length, 0);
});
