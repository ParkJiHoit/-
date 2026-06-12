import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import http from 'http';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();
const pending = new Map();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SEL = {
  resultItem:  '[data-template-id="ugcItem"]',
  organicLink: 'a[data-heatmap-target=".nblg"][href*="blog.naver.com"]',
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

function followRedirect(url, maxRedirects = 6) {
  return new Promise((resolve) => {
    try {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, { headers: { 'User-Agent': UA }, timeout: 5000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
          const loc = res.headers.location;
          const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
          res.destroy();
          resolve(followRedirect(next, maxRedirects - 1));
        } else {
          res.destroy();
          resolve(/blog\.naver\.com\/[^/?#\s]+\/\d{5,}/.test(url) ? url : null);
        }
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch {
      resolve(null);
    }
  });
}

async function scrapeBlogTab(keyword, limit = 10) {
  const url = `https://search.naver.com/search.naver?ssc=tab.blog.all&sm=tab_jum&query=${encodeURIComponent(keyword)}`;

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

    const nblgEl = $el.find(SEL.organicLink).first();
    if (nblgEl.length) {
      const postLink = nblgEl.attr('href');
      if (!postLink || seenUrl.has(postLink)) return;
      seenUrl.add(postLink);
      const title  = nblgEl.text().trim().replace(/\s+/g, ' ');
      const blogId = postLink.match(/blog\.naver\.com\/([^/?#\s]+)\//)?.[1] || '';
      raw.push({ title, author, dateRaw, postLink, blogId, aderUrl: null });
      return;
    }

    const titEl = $el.find(SEL.powerTitle).first();
    if (titEl.length) {
      const aderUrl = titEl.attr('href');
      if (!aderUrl || seenAder.has(aderUrl)) return;
      seenAder.add(aderUrl);
      const title      = titEl.text().trim().replace(/\s+/g, ' ');
      const authorHref = $el.find(SEL.author).first().attr('href') || '';
      const blogId     = authorHref.match(/blog\.naver\.com\/([^/?#\s]+)/)?.[1] || '';
      raw.push({ title, author, dateRaw, postLink: null, blogId, aderUrl });
    }
  });

  await Promise.all(
    raw.filter(r => r.aderUrl).map(async r => {
      r.postLink = await followRedirect(r.aderUrl);
      delete r.aderUrl;
    })
  );

  return raw
    .filter(r => r.postLink)
    .map((r, i) => ({
      rank: i + 1,
      title: r.title,
      author: r.author,
      date: formatDate(r.dateRaw),
      daysAgo: parseDaysAgo(r.dateRaw),
      postLink: r.postLink,
      blogId: r.blogId || r.postLink.match(/blog\.naver\.com\/([^/?#\s]+)\//)?.[1] || '',
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

export async function fetchBlogRankings(keyword) {
  const key = keyword.toLowerCase().trim();

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  if (pending.has(key)) return pending.get(key);

  const promise = (async () => {
    let scraped = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        scraped = await scrapeBlogTab(keyword, 10);
        if (scraped.length) break;
        console.warn(`[blog-rankings] attempt ${attempt}: 0 results for "${keyword}"`);
      } catch (err) {
        console.error(`[blog-rankings] attempt ${attempt} failed: ${err.message}`);
        if (attempt === 2) return [];
      }
    }
    if (!scraped.length) return [];

    const result = await Promise.all(
      scraped.map(async item => ({
        ...item,
        dailyVisitors: await fetchDailyVisitors(item.blogId),
      }))
    );

    console.log(`[blog-rankings] ✓ ${result.length}개`);
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
