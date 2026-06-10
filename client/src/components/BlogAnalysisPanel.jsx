import { ExternalLink } from 'lucide-react';
import { formatNumber, formatPercent } from '../utils/formatters';

function formatPostDate(value) {
  if (!/^\d{8}$/.test(String(value || ''))) return '-';
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function MetricRow({ label, value, helper }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <th className="w-48 bg-slate-50 px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </th>
      <td className="px-4 py-3 text-sm font-black text-slate-950">{value}</td>
      <td className="px-4 py-3 text-sm font-medium text-slate-500">{helper}</td>
    </tr>
  );
}

export default function BlogAnalysisPanel({ result }) {
  const metrics = result?.metrics;
  const posts = result?.posts || [];

  if (!metrics) return null;

  return (
    <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-black text-slate-950">블로그 분석 지표</h2>
          <p className="text-sm font-medium text-slate-500">{metrics.keyword}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse">
            <tbody>
              <MetricRow
                label="월 검색량"
                value={formatNumber(metrics.monthlySearch)}
                helper="검색광고 API에서 가져온 월 PC+모바일 검색량"
              />
              <MetricRow
                label="블로그 문서 수"
                value={formatNumber(metrics.totalBlogDocuments)}
                helper="네이버 블로그 검색 API의 total 값"
              />
              <MetricRow
                label="최근 발행 비중"
                value={formatPercent(metrics.recentPublishRatio)}
                helper="날짜순 검색 결과 샘플 중 최근 30일 게시글 비중"
              />
              <MetricRow
                label="키워드 일치도"
                value={formatPercent(metrics.keywordMatchRatio)}
                helper="상위 블로그 결과 제목/요약에 검색어가 포함된 비중"
              />
              <MetricRow
                label="블로그 경쟁도"
                value={Math.round(metrics.blogCompetitionScore)}
                helper="문서 수, 최근 발행 비중, 검색량 대비 문서량 기반 추정"
              />
              <MetricRow
                label="블로그 포화도"
                value={Math.round(metrics.blogSaturationScore)}
                helper="높을수록 이미 콘텐츠 경쟁이 많은 키워드"
              />
              <MetricRow
                label="콘텐츠 기회 점수"
                value={Math.round(metrics.contentOpportunityScore)}
                helper="높을수록 블로그 콘텐츠 작성 우선순위가 높은 키워드"
              />
              <MetricRow
                label="검색 트렌드"
                value={metrics.trendAvailable ? metrics.trendDirection : '미제공'}
                helper={
                  metrics.trendAvailable
                    ? `${metrics.trendStartDate} ~ ${metrics.trendEndDate}, ${formatPercent(metrics.trendChangeRate)} 변화`
                    : '네이버 개발자 센터에서 데이터랩 API 권한을 켜면 표시됩니다.'
                }
              />
            </tbody>
          </table>
        </div>
      </article>

      <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">상위 블로그 결과</h2>
            <p className="text-sm font-medium text-slate-500">정확도순 상위 {posts.length}개 샘플</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">제목</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">블로그</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">작성일</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">일치</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">링크</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr className="border-b border-slate-100 last:border-0" key={`${post.link}-${post.postDate}`}>
                  <td className="max-w-xl px-4 py-3">
                    <p className="line-clamp-1 text-sm font-black text-slate-900">{post.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-500">
                      {post.description}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-700">{post.bloggerName}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-600">{formatPostDate(post.postDate)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-black ${
                        post.keywordMatched
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {post.keywordMatched ? '포함' : '낮음'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700 transition hover:border-slate-500"
                      href={post.link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      열기
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
