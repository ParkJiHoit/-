import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import http from 'http';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();
const pending = new Map();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TAB_CONFIG = {
  blog: { ssc: 'tab.blog.all', domains: ['blog.naver.com'] },
  view: { ssc: 'tab.view.all', domains: ['blog.naver.com', 'cafe.naver.com'] },
  cafe: { ssc: 'tab.cafe.all', domains: ['cafe.naver.com'] },
  // 통합검색(ssc 없이 기본 검색결과) — 노출 여부 O/X 체크 전용, 순위 개념 없음.
  // 블로그 collection 영역도 블로그 탭과 같은 ugcItem 템플릿을 재사용한다고 가정하고
  // 파싱한다. 실제 라이브 페이지에서 구조가 다르면 셀렉터를 다시 맞춰야 한다.
  integrated: { ssc: null, domains: ['blog.naver.com'] },
};

// 공통 cheerio 셀렉터
const SEL = {
  resultItem:  '[data-template-id="ugcItem"]',
  // 블로그 원본 링크
  blogLink:    'a[data-heatmap-target=".nblg"][href*="blog.naver.com"]',
  // 카페 원본 링크 (VIEW/CAFE 탭)
  cafeLink:    'a[data-heatmap-target=".ncfe"][href*="cafe.naver.com"]',
  // 파워컨텐츠/광고성 리다이렉트 링크
  powerTitle:  'a[data-heatmap-target=".tit"]',
  author:      'a[data-heatmap-target="articleSourceJSX_title"]',
  date:        '.sds-comps-profile-info-subtext',
};

function parseDaysAgo(dateStr) {
  if (!dateStr) return null;
  const clean = dateStr.replace(/\.$/, '').trim();
  const parts = clean.split('.');
  if (parts.length >= 3) {
    const y = parseInt(parts[0]), m = parseInt(parts[1]) - 1, d = parseInt(parts[2]);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return Math.floor((Date.now() - new Date(y, m, d).getTime()) / 86400000);
    }
  }
  return null;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  if (/전|방금|어제|오늘/.test(dateStr)) return dateStr.trim();
  const d = parseDaysAgo(dateStr);
  if (d === null) return dateStr;
  if (d === 0) return '오늘';
  if (d === 1) return '어제';
  return `${d}일 전`;
}

// 검색 결과에 표시된 날짜(절대 날짜 또는 "N일 전"/"어제"/"오늘"/"N시간 전" 등 상대 표현)를
// 실제 포스팅 발행일(YYYY-MM-DD, KST 기준)로 환산한다. 해석 불가능하면 null.
function computePublishedDate(dateStr) {
  if (!dateStr) return null;
  const raw = dateStr.trim();

  const abs = raw.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/);
  if (abs) {
    const y = parseInt(abs[1], 10), m = parseInt(abs[2], 10) - 1, d = parseInt(abs[3], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
    }
  }

  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  if (/방금|분\s*전|시간\s*전|오늘/.test(raw)) {
    return nowKST.toISOString().slice(0, 10);
  }
  if (/어제/.test(raw)) {
    return new Date(nowKST.getTime() - 86400000).toISOString().slice(0, 10);
  }
  const daysAgoMatch = raw.match(/(\d+)\s*일\s*전/);
  if (daysAgoMatch) {
    const n = parseInt(daysAgoMatch[1], 10);
    return new Date(nowKST.getTime() - n * 86400000).toISOString().slice(0, 10);
  }
  return null;
}

function detectType(url) {
  if (url.includes('blog.naver.com')) return 'blog';
  if (url.includes('cafe.naver.com')) return 'cafe';
  return 'other';
}

// 블로그/카페 URL인지 검증 (리다이렉트 후 결과 필터)
function isValidNaverUrl(url, domains) {
  const isBlog = /blog\.naver\.com\/[^/?#\s]+\/\d{5,}/.test(url);
  // 카페: /cafeName/articleId 형식 OR 구형 articleid 쿼리 파라미터
  const isCafe = /cafe\.naver\.com\/[^/?#\s]+\/\d+/.test(url) ||
                 (/cafe\.naver\.com/.test(url) && /[?&]articleid=\d+/i.test(url));
  if (!isBlog && !isCafe) return false;
  return domains.some(d => url.includes(d));
}

function followRedirect(url, domains, maxRedirects = 6) {
  return new Promise((resolve) => {
    try {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, { headers: { 'User-Agent': UA }, timeout: 5000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
          const loc = res.headers.location;
          const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
          res.destroy();
          resolve(followRedirect(next, domains, maxRedirects - 1));
        } else {
          res.destroy();
          resolve(isValidNaverUrl(url, domains) ? url : null);
        }
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch {
      resolve(null);
    }
  });
}

async function scrapeNaverTab(keyword, tab = 'blog', limit = 10) {
  const config = TAB_CONFIG[tab] || TAB_CONFIG.blog;
  const url = config.ssc
    ? `https://search.naver.com/search.naver?ssc=${config.ssc}&sm=tab_jum&query=${encodeURIComponent(keyword)}`
    : `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`;

  const res = await axios.get(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      'Referer': 'https://www.naver.com',
    },
    timeout: 10000,
  });

  const $ = cheerio.load(res.data);
  const raw = [];
  const seenUrl = new Set();
  const seenAder = new Set();

  if (tab === 'blog') {
    // 블로그 탭: ugcItem 기반 (기존 방식)
    $(SEL.resultItem).each((_, el) => {
      if (raw.length >= limit) return false;

      const $el = $(el);
      const author  = $el.find(SEL.author).first().text().trim();
      const dateRaw = $el.find(SEL.date).first().text().trim();

      const blogLinkEl = $el.find(SEL.blogLink).first();
      if (blogLinkEl.length) {
        const postLink = blogLinkEl.attr('href');
        if (!postLink || seenUrl.has(postLink)) return;
        seenUrl.add(postLink);
        raw.push({ title: blogLinkEl.text().trim().replace(/\s+/g, ' '), author, dateRaw, postLink, type: 'blog', aderUrl: null });
        return;
      }

      const titEl = $el.find(SEL.powerTitle).first();
      if (titEl.length) {
        const aderUrl = titEl.attr('href');
        if (!aderUrl || seenAder.has(aderUrl)) return;
        seenAder.add(aderUrl);
        raw.push({ title: titEl.text().trim().replace(/\s+/g, ' '), author, dateRaw, postLink: null, type: null, aderUrl });
      }
    });
  } else {
    // VIEW / 카페 탭 / 통합검색: ugcItem에 의존하지 않고 전체 링크 스캔
    // 이 페이지들은 블로그 탭과 달리 ugcItem 외 다른 템플릿(또는 collection 전용 마크업)을
    // 쓰므로, 특정 컨테이너 셀렉터를 추측하는 대신 blog.naver.com 포스트 URL 패턴만으로
    // 넓게 스캔한다 — 통합검색 블로그 collection의 정확한 구조를 라이브로 검증하지 못했기
    // 때문에 가장 깨지기 어려운 방식을 택함.
    const $scope = $('#main_pack').length ? $('#main_pack') : $('body');

    $scope.find('a[href]').each((_, el) => {
      if (raw.length >= limit) return false;
      const $el = $(el);
      const href = $el.attr('href') || '';

      // 대상 도메인 + 게시글 URL 패턴 검증
      if (!config.domains.some(d => href.includes(d))) return;
      if (!isValidNaverUrl(href, config.domains)) return;
      if (seenUrl.has(href)) return;
      seenUrl.add(href);

      // 링크 텍스트가 제목이어야 함 (너무 짧으면 제목이 아님)
      const title = $el.text().trim().replace(/\s+/g, ' ');
      if (title.length < 4) return;

      // 가장 가까운 결과 컨테이너에서 author/date 추출
      const $item = $el.closest('[data-template-id], li, article').first();

      // author: VIEW탭은 articleSourceJSX_title, 카페탭은 카페 홈 링크에서 추출
      let author = $item.find(SEL.author).first().text().trim();
      if (!author) {
        // 카페 홈 링크(게시글 ID가 없는 cafe.naver.com 링크) 에서 카페명 추출
        $item.find('a[href*="cafe.naver.com"]').each((_, a) => {
          if (author) return false;
          const h = $(a).attr('href') || '';
          if (/cafe\.naver\.com\/[^/?#]+\/?$/.test(h)) {
            author = $(a).text().trim();
          }
        });
      }
      const dateRaw = ($item.find(SEL.date).first().text().trim()) || '';

      raw.push({ title, author, dateRaw, postLink: href, type: detectType(href), aderUrl: null });
    });
  }

  // 블로그 탭 파워컨텐츠 리다이렉트 해제
  await Promise.all(
    raw.filter(r => r.aderUrl).map(async r => {
      r.postLink = await followRedirect(r.aderUrl, config.domains);
      if (r.postLink) r.type = detectType(r.postLink);
      delete r.aderUrl;
    })
  );

  return buildRankingList(raw, config.domains);
}

export function buildRankingList(raw, domains) {
  return raw
    .filter(r => r.postLink && isValidNaverUrl(r.postLink, domains))
    .map((r, i) => {
      const m = r.postLink.match(/blog\.naver\.com\/([^/?#\s]+)(?:\/(\d+))?/);
      return {
        rank: i + 1,
        title: r.title,
        author: r.author,
        date: formatDate(r.dateRaw),
        daysAgo: parseDaysAgo(r.dateRaw),
        publishedDate: computePublishedDate(r.dateRaw),
        postLink: r.postLink,
        type: r.type || detectType(r.postLink),
        blogId: m?.[1]?.toLowerCase() || '',
        logNo: m?.[2] || null,
      };
    });
}

async function fetchDailyVisitors(blogId) {
  if (!blogId) return null;
  try {
    const res = await axios.get('https://blog.naver.com/NVisitorgp4Ajax.naver', {
      params: { blogId },
      headers: { 'User-Agent': UA, Referer: `https://blog.naver.com/${blogId}` },
      timeout: 5000,
    });
    const counts = [...String(res.data).matchAll(/cnt="(\d+)"/g)]
      .map(m => parseInt(m[1], 10))
      .filter(v => v >= 0);
    if (!counts.length) return null;
    const base = counts.length > 1 ? counts.slice(0, -1) : counts;
    return Math.round(base.reduce((s, v) => s + v, 0) / base.length);
  } catch {
    return null;
  }
}

export async function fetchBlogRankings(keyword, tab = 'blog', { skipVisitors = false } = {}) {
  // skipVisitors 여부에 따라 캐시를 분리한다 — 순위 추적처럼 방문자 수가 필요 없는 호출이
  // 먼저 캐시를 채우면, 방문자 수가 필요한 다른 화면(블로그 구조 분석 등)이 그 캐시를 재사용해
  // "비공개"로 잘못 표시되는 것을 막기 위함.
  const key = `${tab}:${keyword.toLowerCase().trim()}:${skipVisitors ? 'nv' : 'v'}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  if (pending.has(key)) return pending.get(key);

  // 통합검색은 순위가 아니라 노출 여부(존재 확인)만 보면 되므로, 브로드 스캔이 앞부분에서
  // 놓치지 않도록 스캔 한도를 넉넉히 잡는다.
  const scanLimit = tab === 'integrated' ? 40 : 10;

  const promise = (async () => {
    let scraped = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        scraped = await scrapeNaverTab(keyword, tab, scanLimit);
        if (scraped.length) break;
        console.warn(`[${tab}-rankings] attempt ${attempt}: 0 results for "${keyword}"`);
      } catch (err) {
        console.error(`[${tab}-rankings] attempt ${attempt} failed: ${err.message}`);
        if (attempt === 2) return [];
      }
    }
    if (!scraped.length) return [];

    // 블로그 타입만 방문자 수 조회 (skipVisitors면 건너뛰어 순위 조회 속도를 높인다)
    const result = await Promise.all(
      scraped.map(async item => ({
        ...item,
        dailyVisitors: (!skipVisitors && item.type === 'blog') ? await fetchDailyVisitors(item.blogId) : null,
      }))
    );

    console.log(`[${tab}-rankings] ✓ ${result.length}개`);
    cache.set(key, { data: result, at: Date.now() });
    return result;
  })();

  pending.set(key, promise);
  try {
    return await promise;
  } finally {
    pending.delete(key);
  }
}
