import { normalizeKeywordSpacing } from './rankTrackerService.js';

const KEYWORD_HEADER_HINTS = ['키워드', 'keyword', '검색어', 'kw'];
const URL_HEADER_HINTS = ['url', '링크', 'link', '주소'];

// 한 줄 안에서 URL 토큰을 찾을 때 사용 — 공백/콤마 앞에서 멈춰서
// "키워드,url" 처럼 붙어 있거나 "키워드   url" 처럼 띄어 있어도 URL만 뽑아낸다.
const URL_TOKEN_RE = /(https?:\/\/[^\s,]+)/;

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase();
}

function looksLikeUrl(str) {
  return /^https?:\/\//.test(String(str || '').trim());
}

function isNaverBlogUrl(str) {
  return /blog\.naver\.com\//.test(String(str || ''));
}

// "7/4 오전 12:20" 처럼 발행 시각만 적힌 줄 — 키워드/URL이 아니므로 건너뛴다.
function isDateTimeLine(line) {
  return /\d/.test(line) && /^[\d\s./:]*(오전|오후)?[\d\s./:]*$/.test(line);
}

function splitLine(line) {
  if (line.includes('\t')) return line.split('\t').map(c => c.trim());
  return line.split(',').map(c => c.trim());
}

// 두 컬럼 이상이고, 그중 하나는 키워드 헤더 이름을, 다른 하나는 URL 헤더 이름을
// 포함(부분 일치)하면 헤더 행으로 본다. 실제 URL처럼 생긴 셀은 헤더 이름 검사에서 제외해
// blogId에 우연히 "url" 같은 글자가 들어간 실제 데이터 행을 헤더로 오인하지 않게 한다.
function isHeaderRow(cells) {
  if (cells.length < 2) return false;
  const keywordIdx = cells.findIndex(c => !looksLikeUrl(c) && KEYWORD_HEADER_HINTS.some(h => normalizeHeader(c).includes(h)));
  const urlIdx = cells.findIndex(c => !looksLikeUrl(c) && URL_HEADER_HINTS.some(h => normalizeHeader(c).includes(h)));
  return keywordIdx !== -1 && urlIdx !== -1;
}

export function parseBulkImportText(text) {
  const lines = String(text || '')
    .split(/\r\n|\n|\r/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (!lines.length) return { rows: [], errors: [] };

  const startIdx = isHeaderRow(splitLine(lines[0])) ? 1 : 0;

  const rows = [];
  const errors = [];

  // 키워드와 URL이 서로 다른 줄에 나뉘어 있는 경우(예: 키워드 → 발행일시 → URL 순으로
  // 붙여넣는 경우)를 지원하기 위해, URL이 없는 텍스트 줄을 만나면 "짝을 기다리는 키워드"로
  // 잠시 들고 있다가 다음 URL 줄과 묶는다.
  let pendingKeyword = null;
  let pendingRowNumber = null;

  const flushPending = () => {
    if (pendingKeyword != null) {
      errors.push({ rowNumber: pendingRowNumber, reason: '키워드에 매칭되는 URL을 찾지 못했습니다.', raw: pendingKeyword });
    }
    pendingKeyword = null;
    pendingRowNumber = null;
  };

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const rowNumber = i + 1;

    const urlMatch = line.match(URL_TOKEN_RE);
    if (urlMatch) {
      const urlToken = urlMatch[1];
      const remainder = line
        .replace(urlToken, '')
        .replace(/^[,\t]+|[,\t]+$/g, '')
        .trim();

      if (!isNaverBlogUrl(urlToken)) {
        errors.push({ rowNumber, reason: 'blog.naver.com 형식의 URL이 아닙니다.', raw: line });
        pendingKeyword = null;
        pendingRowNumber = null;
        continue;
      }

      // 같은 줄에 키워드가 함께 있으면 그 키워드를 쓰고, 없으면 이전 줄에서
      // 대기 중이던 키워드와 짝을 맞춘다(별도 줄 형식).
      if (remainder) {
        rows.push({ rowNumber, keyword: normalizeKeywordSpacing(remainder), url: urlToken });
      } else if (pendingKeyword) {
        rows.push({ rowNumber: pendingRowNumber, keyword: normalizeKeywordSpacing(pendingKeyword), url: urlToken });
      } else {
        errors.push({ rowNumber, reason: '키워드가 비어 있습니다.', raw: line });
      }
      pendingKeyword = null;
      pendingRowNumber = null;
      continue;
    }

    if (isDateTimeLine(line)) continue;

    flushPending();
    pendingKeyword = line.replace(/[,\t]+$/, '').trim();
    pendingRowNumber = rowNumber;
  }

  flushPending();

  return { rows, errors };
}

// 대량 등록 시 키워드의 띄어쓰기 차이는 무시하고 동일 키워드로 판정한다.
// 예: "휴대폰 성지 창업" === "휴대폰성지창업"
export function normalizeKeyword(keyword) {
  return String(keyword || '').replace(/\s+/g, '');
}

export function groupParsedRows(rows, existingKeywordSet) {
  const normalizedExisting = new Set(Array.from(existingKeywordSet, normalizeKeyword));
  const groups = new Map(); // normalizeKeyword(keyword) -> { keyword, urls: Set }

  for (const { keyword, url } of rows) {
    const norm = normalizeKeyword(keyword);
    if (!groups.has(norm)) groups.set(norm, { keyword, urls: new Set() });
    groups.get(norm).urls.add(url);
  }

  return Array.from(groups.values()).map(({ keyword, urls }) => ({
    keyword,
    urls: Array.from(urls),
    isNew: !normalizedExisting.has(normalizeKeyword(keyword)),
  }));
}
