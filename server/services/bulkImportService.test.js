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

test('groupParsedRows: 띄어쓰기만 다른 키워드는 동일 키워드로 병합한다', () => {
  const rows = [
    { rowNumber: 2, keyword: '휴대폰 성지 창업', url: 'https://blog.naver.com/abc/111' },
    { rowNumber: 3, keyword: '휴대폰성지창업', url: 'https://blog.naver.com/def/222' },
  ];
  const groups = groupParsedRows(rows, new Set());
  assert.equal(groups.length, 1);
  assert.equal(groups[0].urls.length, 2);
  assert.equal(groups[0].keyword, '휴대폰 성지 창업'); // 먼저 등장한 표기를 대표 키워드로 사용
});

test('groupParsedRows: 기존 키워드와 띄어쓰기가 달라도 신규로 취급하지 않는다', () => {
  const rows = [
    { rowNumber: 2, keyword: '초보휴대폰성지창업', url: 'https://blog.naver.com/abc/111' },
  ];
  const groups = groupParsedRows(rows, new Set(['초보 휴대폰 성지 창업']));
  assert.equal(groups[0].isNew, false);
});

test('groupParsedRows: 같은 URL이 중복되면 하나로 합친다', () => {
  const rows = [
    { rowNumber: 2, keyword: '강남맛집', url: 'https://blog.naver.com/abc/111' },
    { rowNumber: 3, keyword: '강남맛집', url: 'https://blog.naver.com/abc/111' },
  ];
  const groups = groupParsedRows(rows, new Set());
  assert.equal(groups[0].urls.length, 1);
});

test('헤더 없는 입력에서 첫 행의 URL이 잘못돼도 조용히 사라지지 않고 오류로 남는다', () => {
  const text = '강남맛집,https://example.com/1\n서울카페,https://blog.naver.com/seoul/555';
  const { rows, errors } = parseBulkImportText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].keyword, '서울카페');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].rowNumber, 1);
  assert.match(errors[0].reason, /blog\.naver\.com/);
});

test('헤더 중 하나만 인식돼도 나머지 컬럼 위치를 올바르게 채운다', () => {
  const text = 'url,검색 키워드\nhttps://blog.naver.com/foo/1,강릉여행';
  const { rows, errors } = parseBulkImportText(text);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].keyword, '강릉여행');
  assert.equal(rows[0].url, 'https://blog.naver.com/foo/1');
});

test('키워드와 URL이 줄바꿈으로 나뉘고 사이에 발행일시 줄이 끼어 있어도 파싱한다', () => {
  const text = [
    '핸드폰가게창업',
    'https://m.blog.naver.com/hot2337233/224335607600',
    '',
    '핸드폰매장창업',
    '7/4 오전 12:20',
    'https://m.blog.naver.com/dmsql1490',
    '',
    '휴대폰판매점창업',
    '7/4 오전 2:40',
    'https://m.blog.naver.com/dmsql1490',
    '',
    '핸드폰판매점창업  https://blog.naver.com/yelimmam/224335612334',
  ].join('\n');
  const { rows, errors } = parseBulkImportText(text);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(r => r.keyword), ['핸드폰가게창업', '핸드폰매장창업', '휴대폰판매점창업', '핸드폰판매점창업']);
  assert.equal(rows[0].url, 'https://m.blog.naver.com/hot2337233/224335607600');
  assert.equal(rows[1].url, 'https://m.blog.naver.com/dmsql1490');
  assert.equal(rows[3].url, 'https://blog.naver.com/yelimmam/224335612334');
});

test('짝을 찾지 못한 키워드 줄은 오류로 남는다', () => {
  const text = '핸드폰가게창업\n핸드폰매장창업\nhttps://m.blog.naver.com/dmsql1490';
  const { rows, errors } = parseBulkImportText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].keyword, '핸드폰매장창업');
  assert.equal(errors.length, 1);
  assert.match(errors[0].reason, /URL/);
  assert.equal(errors[0].raw, '핸드폰가게창업');
});
