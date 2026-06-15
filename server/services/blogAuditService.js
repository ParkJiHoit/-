import axios from 'axios';
import * as cheerio from 'cheerio';

const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const HEADERS = {
  'User-Agent': UA_PC,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://www.naver.com',
};
const HEADERS_MOBILE = {
  'User-Agent': UA_MOBILE,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://m.naver.com',
};

// ── URL 파싱 ──────────────────────────────────────────────────────────────────
function parseBlogUrl(url) {
  const clean = url.trim().replace(/^https?:\/\//, '');
  // blog.naver.com/blogId 또는 blog.naver.com/blogId/postNo
  const m = clean.match(/blog\.naver\.com\/([^/?#\s]+)/);
  if (!m) throw new Error('올바른 네이버 블로그 URL을 입력해 주세요. (예: https://blog.naver.com/blogId)');
  return { blogId: m[1] };
}

// ── 블로그 메인 페이지 크롤링 (모바일 UA — 이웃/방문자 수 노출됨) ─────────────
async function fetchBlogMain(blogId) {
  const url = `https://m.blog.naver.com/${blogId}`;
  const { data } = await axios.get(url, { headers: HEADERS_MOBILE, timeout: 10000 });
  const $ = cheerio.load(data);

  // 이웃 수: <span>139명의 이웃</span>
  let neighborCount = null;
  $('span').each((_, el) => {
    const text = $(el).text().trim();
    const m = text.match(/^([\d,]+)명의?\s*이웃/);
    if (m && !neighborCount) neighborCount = parseInt(m[1].replace(/,/g, ''));
  });
  // 폴백: 텍스트 전체에서 패턴 탐색
  if (!neighborCount) {
    const bodyText = $.root().text();
    const m = bodyText.match(/([\d,]+)명의?\s*이웃/);
    if (m) neighborCount = parseInt(m[1].replace(/,/g, ''));
  }

  // 방문자 수: class="count__jEvPR" → "오늘 569  전체 155,518"
  let dailyVisitors = null;
  let totalVisitors = null;
  $('[class*="count"]').each((_, el) => {
    const text = $(el).text().trim();
    const mToday = text.match(/오늘\s*([\d,]+)/);
    const mTotal = text.match(/전체\s*([\d,]+)/);
    if (mToday && !dailyVisitors) dailyVisitors = parseInt(mToday[1].replace(/,/g, ''));
    if (mTotal && !totalVisitors) totalVisitors = parseInt(mTotal[1].replace(/,/g, ''));
  });

  // 블로그 이름 (og:title 또는 title)
  const blogName = $('meta[property="og:title"]').attr('content') ||
    $('title').text().split('::')[0].trim() ||
    blogId;

  return { blogName, neighborCount, dailyVisitors, totalVisitors };
}

// ── 최근 포스트 목록 크롤링 (PostListByCategory API) ─────────────────────────
async function fetchRecentPosts(blogId, count = 30) {
  // 네이버 블로그 내부 API (비공개 but 실질적으로 사용 가능)
  const url = `https://blog.naver.com/PostList.naver?blogId=${blogId}&currentPage=1&postListType=blogid&listType=&categoryNo=0&skinType=&widgetSeq=0&from=postListByCategory`;
  try {
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(data);
    const posts = [];

    // 포스트 목록 파싱
    $('.post-item, .post_item, li[data-logtype]').each((_, el) => {
      const $el = $(el);
      const title = $el.find('.title, .post-title, .itemTitle').text().trim();
      const dateStr = $el.find('.date, .post-date, .itemDate').text().trim();
      const logNo = $el.attr('data-logno') || $el.find('[data-logno]').attr('data-logno');
      if (title) posts.push({ title, dateStr, logNo });
    });

    return posts;
  } catch {
    return [];
  }
}

// ── RSS 피드로 최근 포스트 가져오기 (대안) ────────────────────────────────────
async function fetchPostsViaRss(blogId) {
  const url = `https://rss.blog.naver.com/${blogId}.xml`;
  try {
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(data, { xmlMode: true });
    const posts = [];

    $('item').each((_, el) => {
      const $el = $(el);
      const title = $el.find('title').text().trim();
      const pubDate = $el.find('pubDate').text().trim();
      const link = $el.find('link').text().trim() || $el.find('guid').text().trim();
      const description = $el.find('description').text().replace(/<[^>]+>/g, '').trim().slice(0, 200);
      if (title) posts.push({ title, pubDate, link, description });
    });

    return posts;
  } catch {
    return [];
  }
}

// ── 날짜 파싱 ────────────────────────────────────────────────────────────────
function parsePostDate(str) {
  if (!str) return null;
  // RSS 형식: "Mon, 09 Jun 2025 14:30:00 +0900"
  const rssDate = new Date(str);
  if (!isNaN(rssDate)) return rssDate;
  // "2025.06.09" 형식
  const m = str.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return null;
}

function daysAgo(date) {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

// ── 광고성 포스트 탐지 ────────────────────────────────────────────────────────
const AD_KEYWORDS = ['제공', '협찬', '지원', '후원', '무상', '체험단', '이벤트', '#ad', '광고', '뒷광고', '브랜드딜'];
function detectAdRatio(posts) {
  if (!posts.length) return 0;
  const adCount = posts.filter(p =>
    AD_KEYWORDS.some(kw => (p.title + ' ' + (p.description || '')).includes(kw))
  ).length;
  return Math.round((adCount / posts.length) * 100);
}

// ── 포스팅 주기 분석 ─────────────────────────────────────────────────────────
function analyzePostingPattern(posts) {
  const dates = posts
    .map(p => parsePostDate(p.pubDate || p.dateStr))
    .filter(Boolean)
    .sort((a, b) => b - a);

  if (dates.length < 2) return { postsLast30: 0, postsLast90: 0, avgIntervalDays: null, isRegular: false };

  const now = Date.now();
  const postsLast30  = dates.filter(d => daysAgo(d) <= 30).length;
  const postsLast90  = dates.filter(d => daysAgo(d) <= 90).length;

  // 평균 포스팅 간격 (최근 10개 기준)
  const recent = dates.slice(0, Math.min(10, dates.length));
  let totalGap = 0;
  for (let i = 0; i < recent.length - 1; i++) {
    totalGap += daysAgo(recent[i + 1]) - daysAgo(recent[i]);
  }
  const avgIntervalDays = recent.length > 1 ? Math.round(Math.abs(totalGap) / (recent.length - 1)) : null;

  // 규칙성: 최근 90일 내 포스팅이 최소 4개이고 평균 간격이 21일 이하
  const isRegular = postsLast90 >= 4 && (avgIntervalDays === null || avgIntervalDays <= 21);

  return { postsLast30, postsLast90, avgIntervalDays, isRegular };
}

// ── 네이버 검색으로 상위 노출 이력 확인 ──────────────────────────────────────
async function checkExposureHistory(blogId, posts, checkCount = 5) {
  // 최근 포스트 제목 중 대표적인 것들 선택 (광고성 제외, 최근 것 우선)
  const candidates = posts
    .filter(p => !AD_KEYWORDS.some(kw => (p.title || '').includes(kw)))
    .slice(0, checkCount);

  if (!candidates.length) return { exposedCount: 0, exposureRate: 0, exposedTitles: [] };

  const exposedTitles = [];
  let exposedCount = 0;

  await Promise.allSettled(candidates.map(async (post) => {
    try {
      const keyword = post.title.replace(/[^\w\s가-힣]/g, '').trim().slice(0, 30);
      if (!keyword) return;

      const searchUrl = `https://search.naver.com/search.naver?ssc=tab.blog.all&sm=tab_jum&query=${encodeURIComponent(keyword)}`;
      const { data } = await axios.get(searchUrl, { headers: HEADERS, timeout: 8000 });
      const $ = cheerio.load(data);

      // 해당 blogId가 상위 결과에 있는지 확인
      let found = false;
      $('a[href*="blog.naver.com"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href.includes(`blog.naver.com/${blogId}`) || href.includes(`/${blogId}/`)) {
          found = true;
          return false;
        }
      });

      if (found) {
        exposedCount++;
        exposedTitles.push(keyword);
      }
    } catch {
      // 개별 검색 실패는 무시
    }
  }));

  const exposureRate = candidates.length > 0 ? Math.round((exposedCount / candidates.length) * 100) : 0;
  return { exposedCount, exposureRate, exposedTitles, checkedCount: candidates.length };
}

// ── 블로그 연차 계산 ─────────────────────────────────────────────────────────
function calcBlogAge(posts) {
  if (!posts.length) return null;
  const dates = posts.map(p => parsePostDate(p.pubDate || p.dateStr)).filter(Boolean);
  if (!dates.length) return null;
  const oldest = dates.sort((a, b) => a - b)[0];
  return Math.floor((Date.now() - oldest.getTime()) / (86400000 * 365));
}

// ── 종합 점수 계산 ────────────────────────────────────────────────────────────
function calcAuditScore({ posting, exposure, neighborCount, dailyVisitors, adRatio, blogAgeYears }) {
  let score = 0;
  const breakdown = {};

  // 1. 활동성 (30점)
  const activityScore = Math.min(30,
    (posting.postsLast30 >= 8  ? 30 :
     posting.postsLast30 >= 4  ? 22 :
     posting.postsLast30 >= 2  ? 14 :
     posting.postsLast30 >= 1  ? 8  : 2) +
    (posting.isRegular ? 5 : 0)
  );
  breakdown.activity = Math.min(30, activityScore);
  score += breakdown.activity;

  // 2. 상위 노출 이력 (30점)
  const exposureScore =
    exposure.exposureRate >= 80 ? 30 :
    exposure.exposureRate >= 60 ? 24 :
    exposure.exposureRate >= 40 ? 18 :
    exposure.exposureRate >= 20 ? 10 : 4;
  breakdown.exposure = exposureScore;
  score += breakdown.exposure;

  // 3. 영향력 (20점)
  const visitorScore = dailyVisitors != null
    ? (dailyVisitors >= 3000 ? 12 : dailyVisitors >= 1000 ? 9 : dailyVisitors >= 300 ? 6 : dailyVisitors >= 100 ? 3 : 1)
    : 3;
  const neighborScore = neighborCount != null
    ? (neighborCount >= 5000 ? 8 : neighborCount >= 1000 ? 6 : neighborCount >= 300 ? 4 : neighborCount >= 50 ? 2 : 1)
    : 2;
  breakdown.influence = visitorScore + neighborScore;
  score += breakdown.influence;

  // 4. 신뢰도 / 광고 비중 (10점)
  const trustScore =
    adRatio <= 10 ? 10 :
    adRatio <= 25 ? 7  :
    adRatio <= 50 ? 4  : 1;
  breakdown.trust = trustScore;
  score += breakdown.trust;

  // 5. 블로그 연차 (10점)
  const ageScore =
    !blogAgeYears        ? 2 :
    blogAgeYears >= 5    ? 10 :
    blogAgeYears >= 3    ? 8  :
    blogAgeYears >= 1    ? 5  : 3;
  breakdown.age = ageScore;
  score += breakdown.age;

  // 등급
  const grade =
    score >= 85 ? 'S' :
    score >= 70 ? 'A' :
    score >= 55 ? 'B' :
    score >= 40 ? 'C' : 'D';

  return { total: Math.min(100, score), breakdown, grade };
}

// ── 종합 판단 메시지 ─────────────────────────────────────────────────────────
function buildVerdict(score, posting, exposure, adRatio) {
  const { grade, total } = score;

  const verdicts = {
    S: '배포 적합 — 활발한 활동과 높은 상위 노출 이력을 보유한 우수 블로그입니다.',
    A: '배포 추천 — 전반적으로 노출 기대치가 높고 신뢰할 수 있는 블로그입니다.',
    B: '배포 가능 — 일부 지표가 아쉽지만 대행을 맡길 수 있는 수준입니다.',
    C: '신중 검토 — 활동성이나 노출 이력이 부족해 효과가 제한적일 수 있습니다.',
    D: '배포 비추천 — 활동이 저조하거나 광고 비중이 높아 신뢰도가 낮습니다.',
  };

  const warnings = [];
  if (adRatio > 50) warnings.push('광고성 포스트 비중이 매우 높아 신뢰도에 영향을 줄 수 있습니다.');
  if (posting.postsLast30 === 0) warnings.push('최근 30일간 포스팅이 없습니다. 현재 활동 중인지 확인이 필요합니다.');
  if (exposure.exposureRate < 20) warnings.push('확인된 상위 노출 이력이 적습니다. 실제 노출 효과가 낮을 수 있습니다.');
  if (!posting.isRegular) warnings.push('포스팅 주기가 불규칙합니다. 꾸준한 발행이 어려울 수 있습니다.');

  return { verdict: verdicts[grade], warnings };
}

// ── 메인 감사 함수 ────────────────────────────────────────────────────────────
export async function auditBlog(url) {
  const { blogId } = parseBlogUrl(url);

  // 병렬 데이터 수집
  const [mainInfo, rssPosts] = await Promise.all([
    fetchBlogMain(blogId).catch(() => ({ blogName: blogId, neighborCount: null, dailyVisitors: null, since: null })),
    fetchPostsViaRss(blogId),
  ]);

  const posts = rssPosts;
  const posting = analyzePostingPattern(posts);
  const adRatio = detectAdRatio(posts);
  const blogAgeYears = calcBlogAge(posts);

  // 상위 노출 이력 확인 (최근 포스트 5개)
  const exposure = await checkExposureHistory(blogId, posts, 5);

  const score = calcAuditScore({
    posting,
    exposure,
    neighborCount: mainInfo.neighborCount,
    dailyVisitors: mainInfo.dailyVisitors,
    adRatio,
    blogAgeYears,
  });

  const { verdict, warnings } = buildVerdict(score, posting, exposure, adRatio);

  return {
    blogId,
    blogUrl: `https://blog.naver.com/${blogId}`,
    blogName: mainInfo.blogName,
    score,
    verdict,
    warnings,
    stats: {
      postsLast30:     posting.postsLast30,
      postsLast90:     posting.postsLast90,
      avgIntervalDays: posting.avgIntervalDays,
      isRegular:       posting.isRegular,
      neighborCount:   mainInfo.neighborCount,
      dailyVisitors:   mainInfo.dailyVisitors,
      totalVisitors:   mainInfo.totalVisitors,
      adRatio,
      blogAgeYears,
      exposureRate:    exposure.exposureRate,
      exposedTitles:   exposure.exposedTitles,
      checkedCount:    exposure.checkedCount,
      totalPosts:      posts.length,
    },
    recentPosts: posts.slice(0, 10).map(p => ({
      title: p.title,
      date: p.pubDate || p.dateStr || '',
      link: p.link || '',
      isAd: AD_KEYWORDS.some(kw => (p.title + ' ' + (p.description || '')).includes(kw)),
    })),
  };
}
