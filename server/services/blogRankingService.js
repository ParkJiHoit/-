import puppeteer from 'puppeteer';
import https from 'https';
import http from 'http';
import axios from 'axios';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--disable-extensions',
  '--window-size=1280,800',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function formatDaysAgo(dateStr) {
  if (!dateStr) return '';
  if (/전|방금|어제|오늘/.test(dateStr)) return dateStr.trim();
  const clean = dateStr.replace(/\.$/, '').trim();
  const parts = clean.split('.');
  if (parts.length < 3) return clean;
  const y = parseInt(parts[0]), m = parseInt(parts[1]) - 1, d = parseInt(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return clean;
  const diff = Math.floor((Date.now() - new Date(y, m, d).getTime()) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  return `${diff}일 전`;
}

// ader.naver.com 리다이렉트 추적 → 실제 blog.naver.com URL 반환
function followRedirect(url, maxRedirects = 6) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': UA }, timeout: 5000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        const loc = res.headers.location;
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        res.destroy();
        resolve(followRedirect(next, maxRedirects - 1));
      } else {
        const finalUrl = res.req?.protocol
          ? `${res.req.protocol}//${res.req.host}${res.req.path}`
          : url;
        res.destroy();
        resolve(/blog\.naver\.com\/\w+\/\d{5,}/.test(finalUrl) ? finalUrl : null);
      }
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// 네이버 블로그탭 크롤링 (ssc=tab.blog.all)
async function scrapeBlogTab(keyword, limit = 8) {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: LAUNCH_ARGS, timeout: 20000 });
    const page = await browser.newPage();

    // 봇 탐지 우회
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
    });

    await page.setUserAgent(UA);
    await page.setViewport({ width: 1280, height: 800 });

    // 이미지/폰트/미디어만 차단
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const t = req.resourceType();
      if (t === 'image' || t === 'font' || t === 'media') req.abort();
      else req.continue();
    });

    const url = `https://search.naver.com/search.naver?ssc=tab.blog.all&sm=tab_jum&query=${encodeURIComponent(keyword)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // ugcItem 렌더링 대기
    await page.waitForSelector('[data-template-id="ugcItem"]', { timeout: 8000 }).catch(() => {});

    const rawItems = await page.evaluate((limit) => {
      const ugcItems = document.querySelectorAll('[data-template-id="ugcItem"]');
      const results = [];
      const seenUrls = new Set();
      const seenAder = new Set();

      for (const item of ugcItems) {
        if (results.length >= limit) break;

        // 작성자 (블로그명)
        const authorEl = item.querySelector('a[data-heatmap-target="articleSourceJSX_title"]');
        const author = authorEl ? (authorEl.innerText || '').trim() : '';

        // 날짜
        const dateEl = item.querySelector('.sds-comps-profile-info-subtext');
        const date = dateEl ? (dateEl.innerText || '').trim() : '';

        // 오가닉 결과: .nblg 직접 링크
        const nblgEl = item.querySelector('a[data-heatmap-target=".nblg"][href*="blog.naver.com"]');
        if (nblgEl) {
          const postLink = nblgEl.href;
          if (seenUrls.has(postLink)) continue;
          seenUrls.add(postLink);

          const title = (nblgEl.innerText || '').trim().replace(/\s+/g, ' ');
          const blogId = postLink.match(/blog\.naver\.com\/(\w+)\//)?.[1] || '';
          results.push({ title, author, date, postLink, blogId, aderUrl: null });
          continue;
        }

        // 파워컨텐츠(광고): .tit 링크 → ader.naver.com 리다이렉트 추적 필요
        const titEl = item.querySelector('a[data-heatmap-target=".tit"]');
        if (titEl) {
          const aderUrl = titEl.href;
          if (seenAder.has(aderUrl)) continue;
          seenAder.add(aderUrl);

          const title = (titEl.innerText || '').trim().replace(/\s+/g, ' ');
          const authorHref = authorEl ? authorEl.href : '';
          const blogId = authorHref.match(/blog\.naver\.com\/(\w+)/)?.[1] || '';
          results.push({ title, author, date, postLink: null, blogId, aderUrl });
        }
      }

      return results;
    }, limit);

    // 파워컨텐츠 URL 리다이렉트 병렬 추적
    await Promise.all(
      rawItems
        .filter((item) => item.aderUrl)
        .map(async (item) => {
          item.postLink = await followRedirect(item.aderUrl);
          item.aderUrl = undefined;
        })
    );

    return rawItems
      .filter((item) => item.postLink)
      .map((item, i) => ({
        rank: i + 1,
        title: item.title,
        author: item.author,
        date: formatDaysAgo(item.date),
        postLink: item.postLink,
        blogId: item.blogId || item.postLink?.match(/blog\.naver\.com\/(\w+)\//)?.[1] || '',
      }));
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// 네이버 NVisitorgp4Ajax: 블로그 일별 방문자 수
async function fetchDailyVisitors(blogId) {
  if (!blogId) return null;
  try {
    const res = await axios.get('https://blog.naver.com/NVisitorgp4Ajax.naver', {
      params: { blogId },
      headers: {
        'User-Agent': UA,
        Referer: `https://blog.naver.com/${blogId}`,
      },
      timeout: 5000,
    });
    const counts = [...String(res.data).matchAll(/cnt="(\d+)"/g)]
      .map((m) => parseInt(m[1], 10))
      .filter((v) => v >= 0);
    if (!counts.length) return null;
    const complete = counts.slice(0, -1);
    const base = complete.length ? complete : counts;
    return Math.round(base.reduce((s, v) => s + v, 0) / base.length);
  } catch {
    return null;
  }
}

export async function fetchBlogRankings(keyword) {
  const cacheKey = keyword.toLowerCase().trim();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.data;

  const scraped = await scrapeBlogTab(keyword, 8);

  const rankings = await Promise.all(
    scraped.map(async (item) => {
      const dailyVisitors = await fetchDailyVisitors(item.blogId);
      return { ...item, dailyVisitors };
    })
  );

  cache.set(cacheKey, { data: rankings, createdAt: Date.now() });
  return rankings;
}
