import puppeteer from 'puppeteer';
import axios from 'axios';
import https from 'https';
import http from 'http';
import fs from 'fs';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();
const pending = new Map();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const LAUNCH_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
  '--disable-gpu', '--no-first-run', '--no-zygote', '--disable-extensions',
  '--window-size=1280,800',
];

// ── Naver 블로그탭 DOM 셀렉터 (구조 변경 시 여기만 수정) ──────────────────
const SEL = {
  resultItem:  '[data-template-id="ugcItem"]',
  organicLink: 'a[data-heatmap-target=".nblg"][href*="blog.naver.com"]',
  powerTitle:  'a[data-heatmap-target=".tit"]',
  author:      'a[data-heatmap-target="articleSourceJSX_title"]',
  date:        '.sds-comps-profile-info-subtext',
};

// ── 날짜 파싱 ──────────────────────────────────────────────────────────────
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

// ── ader.naver.com HTTP 리다이렉트 추적 ────────────────────────────────────
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

// ── Chrome 경로 확인 ───────────────────────────────────────────────────────
async function logChromeInfo() {
  try {
    const execPath = await Promise.resolve(puppeteer.executablePath());
    const exists = typeof execPath === 'string' && fs.existsSync(execPath);
    console.log(`[blog-rankings] Chrome: ${execPath} (exists=${exists})`);
  } catch (e) {
    console.log(`[blog-rankings] Chrome path error: ${e.message}`);
  }
}

// ── Puppeteer 크롤링 ───────────────────────────────────────────────────────
async function scrapeBlogTab(keyword, limit = 10) {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: LAUNCH_ARGS, timeout: 20000 });
    const page = await browser.newPage();

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
    });
    await page.setUserAgent(UA);
    await page.setViewport({ width: 1280, height: 800 });

    // 이미지·폰트·미디어만 차단 (stylesheet·script는 허용)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const t = req.resourceType();
      if (t === 'image' || t === 'font' || t === 'media') req.abort();
      else req.continue();
    });

    const url = `https://search.naver.com/search.naver?ssc=tab.blog.all&sm=tab_jum&query=${encodeURIComponent(keyword)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector(SEL.resultItem, { timeout: 8000 }).catch(() => {});

    // ── DOM에서 결과 추출 (브라우저 컨텍스트) ────────────────────────────
    const raw = await page.evaluate((SEL, limit) => {
      const results = [];
      const seenUrl = new Set();
      const seenAder = new Set();

      for (const item of document.querySelectorAll(SEL.resultItem)) {
        if (results.length >= limit) break;

        const authorEl = item.querySelector(SEL.author);
        const author = authorEl ? (authorEl.innerText || '').trim() : '';
        const dateEl = item.querySelector(SEL.date);
        const dateRaw = dateEl ? (dateEl.innerText || '').trim() : '';

        // 오가닉: 직접 blog.naver.com 링크
        const nblgEl = item.querySelector(SEL.organicLink);
        if (nblgEl) {
          const postLink = nblgEl.href;
          if (seenUrl.has(postLink)) continue;
          seenUrl.add(postLink);
          const title = (nblgEl.innerText || '').trim().replace(/\s+/g, ' ');
          const blogId = postLink.match(/blog\.naver\.com\/([^/?#\s]+)\//)?.[1] || '';
          results.push({ title, author, dateRaw, postLink, blogId, aderUrl: null });
          continue;
        }

        // 파워컨텐츠(광고): ader.naver.com 리다이렉트 필요
        const titEl = item.querySelector(SEL.powerTitle);
        if (titEl) {
          const aderUrl = titEl.href;
          if (seenAder.has(aderUrl)) continue;
          seenAder.add(aderUrl);
          const title = (titEl.innerText || '').trim().replace(/\s+/g, ' ');
          const authorHref = authorEl ? authorEl.href : '';
          const blogId = authorHref.match(/blog\.naver\.com\/([^/?#\s]+)/)?.[1] || '';
          results.push({ title, author, dateRaw, postLink: null, blogId, aderUrl });
        }
      }
      return results;
    }, SEL, limit);

    // ── 파워컨텐츠 리다이렉트 URL 병렬 조회 (Node.js 컨텍스트) ──────────
    await Promise.all(
      raw.filter((r) => r.aderUrl).map(async (r) => {
        r.postLink = await followRedirect(r.aderUrl);
        delete r.aderUrl;
      })
    );

    return raw
      .filter((r) => r.postLink)
      .map((r, i) => ({
        rank: i + 1,
        title: r.title,
        author: r.author,
        date: formatDate(r.dateRaw),
        daysAgo: parseDaysAgo(r.dateRaw),
        postLink: r.postLink,
        blogId: r.blogId || r.postLink.match(/blog\.naver\.com\/([^/?#\s]+)\//)?.[1] || '',
      }));
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ── 방문자 수 조회 ─────────────────────────────────────────────────────────
async function fetchDailyVisitors(blogId) {
  if (!blogId) return null;
  try {
    const res = await axios.get('https://blog.naver.com/NVisitorgp4Ajax.naver', {
      params: { blogId },
      headers: { 'User-Agent': UA, Referer: `https://blog.naver.com/${blogId}` },
      timeout: 5000,
    });
    const counts = [...String(res.data).matchAll(/cnt="(\d+)"/g)]
      .map((m) => parseInt(m[1], 10))
      .filter((v) => v >= 0);
    if (!counts.length) return null;
    const base = counts.length > 1 ? counts.slice(0, -1) : counts;
    return Math.round(base.reduce((s, v) => s + v, 0) / base.length);
  } catch {
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────
let _chromeLogged = false;
export async function fetchBlogRankings(keyword) {
  if (!_chromeLogged) { _chromeLogged = true; logChromeInfo(); }
  const key = keyword.toLowerCase().trim();

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  // 동일 키워드 동시 요청 → puppeteer 중복 실행 방지
  if (pending.has(key)) return pending.get(key);

  const promise = (async () => {
    let scraped = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        scraped = await scrapeBlogTab(keyword, 10);
        if (scraped.length) break;
        console.warn(`[blog-rankings] attempt ${attempt}: scraped 0 results for "${keyword}"`);
      } catch (err) {
        console.error(`[blog-rankings] attempt ${attempt} failed: ${err.message}`);
        if (attempt === 2) return [];
      }
    }
    if (!scraped.length) return [];

    const result = await Promise.all(
      scraped.map(async (item) => ({
        ...item,
        dailyVisitors: await fetchDailyVisitors(item.blogId),
      }))
    );

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
