import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterItemsByCutoff, computeRankChanges, computeIntegratedChanges } from './reportShareService.js';

test('filterItemsByCutoff: blog 모드는 링크별 addedDate 기준으로 컷오프 이전 링크를 제외한다', () => {
  const items = [
    {
      keyword: 'A', mode: 'blog', created_at: '2026-07-01T00:00:00Z',
      blog_ids: ['blog1/1', 'blog2/2'],
      latestRanks: {
        'blog1/1': { rank: 3, status: 'ranked', addedDate: '2026-07-20' },
        'blog2/2': { rank: null, status: null, addedDate: '2026-07-01' },
      },
    },
  ];
  const result = filterItemsByCutoff(items, '2026-07-10');
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].blog_ids, ['blog1/1']);
  assert.deepEqual(Object.keys(result[0].latestRanks), ['blog1/1']);
});

test('filterItemsByCutoff: 남는 링크가 하나도 없으면 아이템 자체를 제외한다', () => {
  const items = [
    {
      keyword: 'B', mode: 'blog', created_at: '2026-07-01T00:00:00Z',
      blog_ids: ['blog1/1'],
      latestRanks: { 'blog1/1': { rank: 5, status: 'ranked', addedDate: '2026-07-01' } },
    },
  ];
  const result = filterItemsByCutoff(items, '2026-07-10');
  assert.equal(result.length, 0);
});

test('filterItemsByCutoff: all 모드는 created_at으로 판단한다', () => {
  const items = [
    { keyword: 'C', mode: 'all', created_at: '2026-07-20T00:00:00Z', blog_ids: [], latestRanks: {} },
    { keyword: 'D', mode: 'all', created_at: '2026-07-01T00:00:00Z', blog_ids: [], latestRanks: {} },
  ];
  const result = filterItemsByCutoff(items, '2026-07-10');
  assert.equal(result.length, 1);
  assert.equal(result[0].keyword, 'C');
});

test('computeRankChanges: 미노출/미확인 상태에서 5위 이내 신규 진입하면 new_top5로 표시', () => {
  const pairs = [
    { keyword: 'A', blogId: 'blog1/1', fromRank: null, fromStatus: 'not_in_top5', toRank: 4, toStatus: 'ranked' },
  ];
  const result = computeRankChanges(pairs);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'new_top5');
});

test('computeRankChanges: 3계단 이상 상승하면 improved로 표시, 2계단 이하는 제외', () => {
  const pairs = [
    { keyword: 'A', blogId: 'blog1/1', fromRank: 8, fromStatus: 'ranked', toRank: 5, toStatus: 'ranked' }, // 3계단, 포함
    { keyword: 'B', blogId: 'blog2/2', fromRank: 5, fromStatus: 'ranked', toRank: 4, toStatus: 'ranked' }, // 1계단, 제외
  ];
  const result = computeRankChanges(pairs);
  assert.equal(result.length, 1);
  assert.equal(result[0].keyword, 'A');
  assert.equal(result[0].type, 'improved');
});

test('computeRankChanges: 최신 상태가 순위권 밖이면 변동사항에서 제외한다', () => {
  const pairs = [
    { keyword: 'A', blogId: 'blog1/1', fromRank: 2, fromStatus: 'ranked', toRank: null, toStatus: 'not_in_top5' },
  ];
  assert.equal(computeRankChanges(pairs).length, 0);
});

test('computeRankChanges: 최대 6개까지만 반환한다', () => {
  const pairs = Array.from({ length: 10 }, (_, i) => ({
    keyword: `K${i}`, blogId: `b${i}/1`, fromRank: null, fromStatus: 'not_in_top5', toRank: 3, toStatus: 'ranked',
  }));
  assert.equal(computeRankChanges(pairs).length, 6);
});

test('computeRankChanges: id(트래킹 항목 id)를 그대로 통과시킨다', () => {
  const pairs = [
    { id: 42, keyword: 'A', blogId: 'blog1/1', fromRank: null, fromStatus: 'not_in_top5', toRank: 4, toStatus: 'ranked' },
  ];
  const result = computeRankChanges(pairs);
  assert.equal(result[0].id, 42);
});

test('computeIntegratedChanges: 통검 미노출 -> 노출이면 gained로 표시', () => {
  const pairs = [
    { id: 1, keyword: 'A', blogId: 'blog1/1', fromIntegratedExposed: false, toIntegratedExposed: true },
  ];
  const result = computeIntegratedChanges(pairs);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'gained');
});

test('computeIntegratedChanges: 통검 노출 -> 미노출이면 lost로 표시', () => {
  const pairs = [
    { id: 1, keyword: 'A', blogId: 'blog1/1', fromIntegratedExposed: true, toIntegratedExposed: false },
  ];
  const result = computeIntegratedChanges(pairs);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'lost');
});

test('computeIntegratedChanges: 노출 여부가 그대로면 변동사항에서 제외한다', () => {
  const pairs = [
    { id: 1, keyword: 'A', blogId: 'blog1/1', fromIntegratedExposed: true, toIntegratedExposed: true },
    { id: 2, keyword: 'B', blogId: 'blog2/1', fromIntegratedExposed: null, toIntegratedExposed: null },
  ];
  assert.equal(computeIntegratedChanges(pairs).length, 0);
});

test('computeIntegratedChanges: 최대 6개까지만 반환한다', () => {
  const pairs = Array.from({ length: 10 }, (_, i) => ({
    id: i, keyword: `K${i}`, blogId: `b${i}/1`, fromIntegratedExposed: false, toIntegratedExposed: true,
  }));
  assert.equal(computeIntegratedChanges(pairs).length, 6);
});
