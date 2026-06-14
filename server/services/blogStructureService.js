import { fetchBlogRankings } from './blogRankingService.js';

function analyzeKeywordPosition(title, keyword) {
  const t = title.toLowerCase().replace(/\s+/g, '');
  const k = keyword.toLowerCase().replace(/\s+/g, '');
  if (!t || !k) return 'none';
  const idx = t.indexOf(k);
  if (idx === -1) {
    // 단어 단위 부분 일치
    const words = keyword.split(/\s+/).filter(Boolean);
    const hitCount = words.filter(w => t.includes(w.toLowerCase())).length;
    return hitCount >= Math.ceil(words.length / 2) ? 'partial' : 'none';
  }
  const ratio = idx / t.length;
  if (ratio < 0.25) return 'front';
  if (ratio < 0.6)  return 'middle';
  return 'back';
}

function categorizeRecency(daysAgo) {
  if (daysAgo === null || daysAgo === undefined) return 'unknown';
  if (daysAgo <= 7)   return 'week';
  if (daysAgo <= 30)  return 'month';
  if (daysAgo <= 90)  return 'quarter';
  if (daysAgo <= 365) return 'year';
  return 'old';
}

export async function analyzeBlogStructure(keyword) {
  const [blogPosts, viewPosts] = await Promise.all([
    fetchBlogRankings(keyword, 'blog'),
    fetchBlogRankings(keyword, 'view'),
  ]);

  const posts = blogPosts.slice(0, 10);
  if (!posts.length) throw new Error('블로그 순위 데이터를 가져올 수 없습니다.');

  // ── 키워드 제목 포함 분석 ──────────────────────────────
  const positionCounts = { front: 0, middle: 0, back: 0, partial: 0, none: 0 };
  posts.forEach(p => {
    const pos = analyzeKeywordPosition(p.title, keyword);
    positionCounts[pos]++;
  });

  const titleIncludeCount = positionCounts.front + positionCounts.middle + positionCounts.back;
  const titleIncludeRate  = Math.round((titleIncludeCount / posts.length) * 100);

  // ── 최신성 분포 ──────────────────────────────────────
  const recencyCounts = { week: 0, month: 0, quarter: 0, year: 0, old: 0, unknown: 0 };
  posts.forEach(p => {
    recencyCounts[categorizeRecency(p.daysAgo)]++;
  });
  const freshRate = Math.round(((recencyCounts.week + recencyCounts.month) / posts.length) * 100);

  // ── 블로그 다양성 ─────────────────────────────────────
  const authorSet = new Set(posts.map(p => p.blogId || p.author).filter(Boolean));
  const uniqueAuthorCount = authorSet.size;
  const diversityRate     = Math.round((uniqueAuthorCount / posts.length) * 100);

  // ── 제목 길이 ─────────────────────────────────────────
  const titleLengths = posts.map(p => p.title?.length || 0).filter(v => v > 0);
  const avgTitleLength = titleLengths.length
    ? Math.round(titleLengths.reduce((s, v) => s + v, 0) / titleLengths.length)
    : 0;

  // ── 방문자 분석 ───────────────────────────────────────
  const knownVisitors = posts.filter(p => p.dailyVisitors != null).map(p => p.dailyVisitors);
  const avgDailyVisitors = knownVisitors.length
    ? Math.round(knownVisitors.reduce((s, v) => s + v, 0) / knownVisitors.length)
    : null;

  // ── VIEW 탭 블로그 vs 카페 비중 ───────────────────────
  const viewBlogCount = viewPosts.filter(p => p.type === 'blog').length;
  const viewCafeCount = viewPosts.filter(p => p.type === 'cafe').length;

  // ── 인사이트 요약 ─────────────────────────────────────
  const insights = buildInsights({
    titleIncludeRate, positionCounts, freshRate,
    diversityRate, avgTitleLength, avgDailyVisitors,
    viewBlogCount, viewCafeCount, keyword,
    total: posts.length,
  });

  return {
    keyword,
    total: posts.length,
    posts: posts.map(p => ({
      rank:          p.rank,
      title:         p.title,
      author:        p.author,
      date:          p.date,
      daysAgo:       p.daysAgo,
      postLink:      p.postLink,
      dailyVisitors: p.dailyVisitors,
      keywordPosition: analyzeKeywordPosition(p.title, keyword),
      titleLength:   p.title?.length || 0,
    })),
    analysis: {
      titleIncludeRate,
      positionCounts,
      recencyCounts,
      freshRate,
      uniqueAuthorCount,
      diversityRate,
      avgTitleLength,
      avgDailyVisitors,
      viewMix: { blog: viewBlogCount, cafe: viewCafeCount, total: viewPosts.length },
    },
    insights,
  };
}

function buildInsights({ titleIncludeRate, positionCounts, freshRate, diversityRate, avgTitleLength, avgDailyVisitors, viewBlogCount, viewCafeCount, keyword, total }) {
  const result = [];

  // 제목 포함률
  if (titleIncludeRate >= 80) {
    result.push({ type: 'warning', icon: '⚠️', title: '제목 키워드 포함 필수', body: `상위 ${total}개 중 ${titleIncludeRate}%가 제목에 "${keyword}"를 포함합니다. 제목에 키워드를 넣지 않으면 경쟁에서 불리합니다.` });
  } else if (titleIncludeRate >= 50) {
    result.push({ type: 'info', icon: '💡', title: '제목 키워드 포함 권장', body: `상위 결과의 ${titleIncludeRate}%가 제목에 키워드를 포함합니다. 제목 앞부분에 배치하면 유리합니다.` });
  } else {
    result.push({ type: 'success', icon: '✅', title: '제목 키워드 포함 자유도 높음', body: `상위 결과의 ${titleIncludeRate}%만 제목에 키워드를 포함합니다. 자연스러운 제목으로도 경쟁 가능합니다.` });
  }

  // 제목 앞부분 배치
  if (positionCounts.front >= Math.ceil(total * 0.4)) {
    result.push({ type: 'info', icon: '📌', title: '제목 앞부분에 키워드 배치 트렌드', body: `상위 포스트의 ${positionCounts.front}개가 제목 앞부분에 키워드를 배치합니다. 검색 노출에 유리한 패턴입니다.` });
  }

  // 최신성
  if (freshRate >= 70) {
    result.push({ type: 'warning', icon: '🔥', title: '최신 콘텐츠 경쟁 치열', body: `상위 결과의 ${freshRate}%가 최근 30일 이내 발행됐습니다. 빠른 발행 및 꾸준한 업데이트가 중요합니다.` });
  } else if (freshRate <= 20) {
    result.push({ type: 'success', icon: '🕰️', title: '꾸준함이 통하는 키워드', body: `최근 30일 이내 게시물이 ${freshRate}%뿐입니다. 오래된 글도 순위를 유지하는 키워드로, 콘텐츠 품질이 더 중요합니다.` });
  }

  // 다양성
  if (diversityRate <= 60) {
    result.push({ type: 'warning', icon: '👤', title: '특정 블로그 독점 가능성', body: `상위 ${total}개 중 ${total - (Math.round(diversityRate * total / 100))}개가 중복 블로그입니다. 파워 블로거가 순위를 독점하는 경향이 있습니다.` });
  } else {
    result.push({ type: 'success', icon: '🌐', title: '블로그 다양성 높음', body: `상위 결과가 ${Math.round(diversityRate * total / 100)}개의 서로 다른 블로그로 구성됩니다. 신규 블로그도 상위 노출 가능성이 있습니다.` });
  }

  // 제목 길이
  if (avgTitleLength > 0) {
    result.push({ type: 'info', icon: '📝', title: `평균 제목 길이 ${avgTitleLength}자`, body: avgTitleLength >= 30
      ? `상위 포스트 제목이 평균 ${avgTitleLength}자로 길고 상세합니다. 구체적이고 정보성 있는 제목이 경쟁력이 있습니다.`
      : `상위 포스트 제목이 평균 ${avgTitleLength}자로 간결합니다. 핵심 키워드를 포함한 짧고 명확한 제목이 효과적입니다.` });
  }

  // 방문자
  if (avgDailyVisitors != null) {
    const label = avgDailyVisitors >= 10000 ? '상위권 파워 블로그' : avgDailyVisitors >= 1000 ? '중간 규모 블로거' : '일반 블로거';
    result.push({ type: 'info', icon: '👁️', title: `상위 블로그 평균 방문자 ${avgDailyVisitors.toLocaleString()}명/일`, body: `${label} 수준의 블로그가 상위를 차지하고 있습니다.` });
  }

  // VIEW 믹스
  if (viewBlogCount + viewCafeCount > 0) {
    const cafeRatio = Math.round((viewCafeCount / (viewBlogCount + viewCafeCount)) * 100);
    if (cafeRatio >= 40) {
      result.push({ type: 'info', icon: '☕', title: `VIEW 탭 카페 비중 ${cafeRatio}%`, body: `네이버 VIEW에서 카페 글이 상당수 노출됩니다. 블로그 외 카페 게시글도 검색 노출에 활용할 수 있습니다.` });
    }
  }

  return result;
}
