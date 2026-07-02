import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBulkImportText, groupParsedRows } from './bulkImportService.js';

test('헤더가 있는 CSV(콤마 구분)를 파싱한다', () => {
  const text = '키워드,url\n강남맛집,https://blog.naver.com/abc/111\n강남맛집,https://blog.naver.com/def/222';
  const { rows, errors } = parseBulkImportText(text);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].keyword, '강남맛집');
  assert.equal(rows[0].url, 'https://blog.naver.com/abc/111');
});

test('엑셀에서 복사한 탭 구분 텍스트를 파싱한다', () => {
  const text = 'keyword\turl\n부산여행\thttps://blog.naver.com/xyz/333';
  const { rows } = parseBulkImportText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].keyword, '부산여행');
});

test('헤더 없이 키워드,URL 두 열만 있어도 첫 열=키워드, 둘째 열=URL로 인식한다', () => {
  const text = '제주맛집,https://blog.naver.com/jeju/444\n서울카페,https://blog.naver.com/seoul/555';
  const { rows, errors } = parseBulkImportText(text);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].keyword, '제주맛집');
  assert.equal(rows[1].keyword, '서울카페');
});

test('URL 열이 먼저 오고 헤더가 인식되면 컬럼 순서를 따른다', () => {
  const text = 'url,키워드\nhttps://blog.naver.com/foo/1,강릉여행';
  const { rows } = parseBulkImportText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].keyword, '강릉여행');
  assert.equal(rows[0].url, 'https://blog.naver.com/foo/1');
});

test('blog.naver.com이 아닌 URL은 오류로 분류된다', () => {
  const text = '키워드,url\n테스트,https://example.com/1';
  const { rows, errors } = parseBulkImportText(text);
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].reason, /blog\.naver\.com/);
});

test('키워드가 비어 있는 행은 오류로 분류된다', () => {
  const text = '키워드,url\n,https://blog.naver.com/foo/1';
  const { rows, errors } = parseBulkImportText(text);
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].reason, /키워드/);
});

test('빈 줄은 무시한다', () => {
  const text = '키워드,url\n\n강남맛집,https://blog.naver.com/abc/111\n\n';
  const { rows, errors } = parseBulkImportText(text);
  assert.equal(rows.length, 1);
  assert.equal(errors.length, 0);
});

test('groupParsedRows: 같은 키워드의 URL을 하나로 묶고 신규 여부를 표시한다', () => {
  const rows = [
    { rowNumber: 2, keyword: '강남맛집', url: 'https://blog.naver.com/abc/111' },
    { rowNumber: 3, keyword: '강남맛집', url: 'https://blog.naver.com/def/222' },
    { rowNumber: 4, keyword: '부산여행', url: 'https://blog.naver.com/xyz/333' },
  ];
  const groups = groupParsedRows(rows, new Set(['부산여행']));
  const gangnam = groups.find(g => g.keyword === '강남맛집');
  const busan = groups.find(g => g.keyword === '부산여행');
  assert.equal(gangnam.urls.length, 2);
  assert.equal(gangnam.isNew, true);
  assert.equal(busan.isNew, false);
});

test('groupParsedRows: 같은 URL이 중복되면 하나로 합친다', () => {
  const rows = [
    { rowNumber: 2, keyword: '강남맛집', url: 'https://blog.naver.com/abc/111' },
    { rowNumber: 3, keyword: '강남맛집', url: 'https://blog.naver.com/abc/111' },
  ];
  const groups = groupParsedRows(rows, new Set());
  assert.equal(groups[0].urls.length, 1);
});
