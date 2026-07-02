const KEYWORD_HEADERS = ['키워드', 'keyword', '검색어', 'kw'];
const URL_HEADERS = ['url', '링크', 'link', '블로그주소', '포스팅주소', '블로그url'];

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase();
}

function isNaverBlogUrl(str) {
  return /blog\.naver\.com\//.test(String(str || ''));
}

function splitLine(line) {
  if (line.includes('\t')) return line.split('\t').map(c => c.trim());
  return line.split(',').map(c => c.trim());
}

export function parseBulkImportText(text) {
  const lines = String(text || '')
    .split(/\r\n|\n|\r/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (!lines.length) return { rows: [], errors: [] };

  const firstCells = splitLine(lines[0]);
  let keywordIdx = firstCells.findIndex(c => KEYWORD_HEADERS.includes(normalizeHeader(c)));
  let urlIdx = firstCells.findIndex(c => URL_HEADERS.includes(normalizeHeader(c)));

  let startIdx;
  if (keywordIdx !== -1 && urlIdx !== -1) {
    startIdx = 1;
  } else {
    keywordIdx = 0;
    urlIdx = 1;
    const looksLikeHeader = firstCells.length >= 2 &&
      !isNaverBlogUrl(firstCells[0]) && !isNaverBlogUrl(firstCells[1]);
    startIdx = looksLikeHeader ? 1 : 0;
  }

  const rows = [];
  const errors = [];

  for (let i = startIdx; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const keyword = (cells[keywordIdx] || '').trim();
    const url = (cells[urlIdx] || '').trim();
    const rowNumber = i + 1;

    if (!keyword && !url) continue;
    if (!keyword) {
      errors.push({ rowNumber, reason: '키워드가 비어 있습니다.', raw: lines[i] });
      continue;
    }
    if (!isNaverBlogUrl(url)) {
      errors.push({ rowNumber, reason: 'blog.naver.com 형식의 URL이 아닙니다.', raw: lines[i] });
      continue;
    }
    rows.push({ rowNumber, keyword, url });
  }

  return { rows, errors };
}

export function groupParsedRows(rows, existingKeywordSet) {
  const groups = new Map();
  for (const { keyword, url } of rows) {
    if (!groups.has(keyword)) groups.set(keyword, new Set());
    groups.get(keyword).add(url);
  }

  return Array.from(groups.entries()).map(([keyword, urlSet]) => ({
    keyword,
    urls: Array.from(urlSet),
    isNew: !existingKeywordSet.has(keyword),
  }));
}
