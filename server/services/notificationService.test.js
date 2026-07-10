import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffRankChanges } from './notificationService.js';

test('처음 순위권에 진입하면 rank_in 변화를 반환한다', () => {
  const previous = new Map();
  const upserts = [{ blog_id: 'a', rank: 3, status: 'ranked', integrated_exposed: false }];
  const changes = diffRankChanges(previous, upserts);
  assert.deepEqual(changes, [{ blogId: 'a', kind: 'rank_in', rank: 3 }]);
});

test('순위권에 있다가 이탈하면 rank_out 변화를 반환한다', () => {
  const previous = new Map([['a', { rank: 2, status: 'ranked', integrated_exposed: false }]]);
  const upserts = [{ blog_id: 'a', rank: null, status: 'not_in_top5', integrated_exposed: false }];
  const changes = diffRankChanges(previous, upserts);
  assert.deepEqual(changes, [{ blogId: 'a', kind: 'rank_out' }]);
});

test('순위 변화가 없으면(계속 순위권) 아무 변화도 반환하지 않는다', () => {
  const previous = new Map([['a', { rank: 3, status: 'ranked', integrated_exposed: false }]]);
  const upserts = [{ blog_id: 'a', rank: 2, status: 'ranked', integrated_exposed: false }];
  const changes = diffRankChanges(previous, upserts);
  assert.deepEqual(changes, []);
});

test('통합검색 노출이 새로 생기면 integrated_in을 반환한다', () => {
  const previous = new Map([['a', { rank: 3, status: 'ranked', integrated_exposed: false }]]);
  const upserts = [{ blog_id: 'a', rank: 3, status: 'ranked', integrated_exposed: true }];
  const changes = diffRankChanges(previous, upserts);
  assert.deepEqual(changes, [{ blogId: 'a', kind: 'integrated_in' }]);
});

test('통합검색 노출이 사라지면 integrated_out을 반환한다', () => {
  const previous = new Map([['a', { rank: 3, status: 'ranked', integrated_exposed: true }]]);
  const upserts = [{ blog_id: 'a', rank: 3, status: 'ranked', integrated_exposed: false }];
  const changes = diffRankChanges(previous, upserts);
  assert.deepEqual(changes, [{ blogId: 'a', kind: 'integrated_out' }]);
});

test('순위 진입과 통합검색 노출이 동시에 일어나면 둘 다 반환한다', () => {
  const previous = new Map();
  const upserts = [{ blog_id: 'a', rank: 1, status: 'ranked', integrated_exposed: true }];
  const changes = diffRankChanges(previous, upserts);
  assert.deepEqual(changes, [
    { blogId: 'a', kind: 'rank_in', rank: 1 },
    { blogId: 'a', kind: 'integrated_in' },
  ]);
});

test('조회 실패(fetch_failed) 행은 변화 계산에서 제외한다', () => {
  const previous = new Map([['a', { rank: 2, status: 'ranked', integrated_exposed: true }]]);
  const upserts = [{ blog_id: 'a', rank: null, status: 'fetch_failed', integrated_exposed: null }];
  const changes = diffRankChanges(previous, upserts);
  assert.deepEqual(changes, []);
});
