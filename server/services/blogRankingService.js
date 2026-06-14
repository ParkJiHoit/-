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

function detectType(url) {
  if (url.includes('blog.naver.com')) return 'blog';
  if (url.includes('cafe.naver.com')) return 'cafe';
  return 'other';
}

// 블로그/카페 URL인지 검증 (리다이렉트 후 결과 필터)
function isValidNaverUrl(url, domains) {
  const isBlog = /blog\.naver\.com\/[^/?#\s]+\/\d{5,}/.test(url);
  const isCafe = /cafe\.naver\.com\/[^/?#\s]+\/\d+/.test(url);
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
  const url = `https://search.naver.com/search.naver?ssc=${config.ssc}&sm=tab_jum&query=${encodeURIComponent(keyword)}`;

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

  $(SEL.resultItem).each((_, el) => {
    if (raw.length >= limit) return false;

    const $el = $(el);
    const author  = $el.find(SEL.author).first().text().trim();
    const dateRaw = $el.find(SEL.date).first().text().trim();

    // 블로그 원본 링크 (blog/view 탭)
    const blogLinkEl = $el.find(SEL.blogLink).first();
    if (blogLinkEl.length) {
      const postLink = blogLinkEl.attr('href');
      if (!postLink || seenUrl.has(postLink)) return;
      seenUrl.add(postLink);
      raw.push({ title: blogLinkEl.text().trim().replace(/\s+/g, ' '), author, dateRaw, postLink, type: 'blog', aderUrl: null });
      return;
    }

    // 카페 원본 링크 (cafe/view 탭)
    const cafeLinkEl = $el.find(SEL.cafeLink).first();
    if (cafeLinkEl.length) {
      const postLink = cafeLinkEl.attr('href');
      if (!postLink || seenUrl.has(postLink)) return;
      seenUrl.add(postLink);
      raw.push({ title: cafeLinkEl.text().trim().replace(/\s+/g, ' '), author, dateRaw, postLink, type: 'cafe', aderUrl: null });
      return;
    }

    // 카페 폴백 셀렉터 (heatmap target 없는 경우)
    if (tab === 'cafe' || tab === 'view') {
      const cafeFallback = $el.find('a[href*="cafe.naver.com"]').filter((_, a) => {
        const href = $(a).attr('href') || '';
        return /cafe\.naver\.com\/[^/?#]+\/\d+/.test(href);
      }).first();
      if (cafeFallback.length) {
        const postLink = cafeFallback.attr('href');
        if (!postLink || seenUrl.has(postLink)) return;
        seenUrl.add(postLink);
        raw.push({ title: cafeFallback.text().trim().replace(/\s+/g, ' '), author, dateRaw, postLink, type: 'cafe', aderUrl: null });
        return;
      }
    }

    // 파워컨텐츠 리다이렉트 링크
    const titEl = $el.find(SEL.powerTitle).first();
    if (titEl.length) {
      const aderUrl = titEl.attr('href');
      if (!aderUrl || seenAder.has(aderUrl)) return;
      seenAder.add(aderUrl);
      raw.push({ title: titEl.text().trim().replace(/\s+/g, ' '), author, dateRaw, postLink: null, type: null, aderUrl });
    }
  });

  // 리다이렉트 해제
  await Promise.all(
    raw.filter(r => r.aderUrl).map(async r => {
      r.postLink = await followRedirect(r.aderUrl, config.domains);
      if (r.postLink) r.type = detectType(r.postLink);
      delete r.aderUrl;
    })
  );

  return raw
    .filter(r => r.postLink && isValidNaverUrl(r.postLink, config.domains))
    .map((r, i) => ({
      rank: i + 1,
      title: r.title,
      author: r.author,
      date: formatDate(r.dateRaw),
      daysAgo: parseDaysAgo(r.dateRaw),
      postLink: r.postLink,
      type: r.type || detectType(r.postLink),
      blogId: r.postLink.match(/blog\.naver\.com\/([^/?#\s]+)\//)?.[1] || '',
    }));
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

export async function fetchBlogRankings(keyword, tab = 'blog') {
  const key = `${tab}:${keyword.toLowerCase().trim()}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  if (pending.has(key)) return pending.get(key);

  const promise = (async () => {
    let scraped = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        scraped = await scrapeNaverTab(keyword, tab, 10);
        if (scraped.length) break;
        console.warn(`[${tab}-rankings] attempt ${attempt}: 0 results for "${keyword}"`);
      } catch (err) {
        console.error(`[${tab}-rankings] attempt ${attempt} failed: ${err.message}`);
        if (attempt === 2) return [];
      }
    }
    if (!scraped.length) return [];

    // 블로그 타입만 방문자 수 조회
    const result = await Promise.all(
      scraped.map(async item => ({
        ...item,
        dailyVisitors: item.type === 'blog' ? await fetchDailyVisitors(item.blogId) : null,
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
