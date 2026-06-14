import { ExternalLink } from 'lucide-react';
import { formatNumber, formatPercent } from '../utils/formatters';
import TrendChart from './TrendChart';

function formatPostDate(value) {
  if (!/^\d{8}$/.test(String(value || ''))) return '-';
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function MetricRow({ label, value, helper }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <th
        style={{
          width: 168, background: 'var(--bg-overlay)', padding: '10px 14px',
          textAlign: 'left', fontSize: 12, fontWeight: 700,
          letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)',
          whiteSpace: 'nowrap'
        }}
      >
        {label}
      </th>
      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
        {value}
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-tertiary)' }}>
        {helper}
      </td>
    </tr>
  );
}

export default function BlogAnalysisPanel({ result }) {
  const metrics  = result?.metrics;
  const posts    = result?.posts || [];
  const trendData = result?.trend || [];

  if (!metrics) return null;

  return (
    <section className="flex flex-col gap-4">
      {/* Trend chart */}
      {metrics.trendAvailable && trendData.length >= 2 && (
        <article className="mac-card overflow-hidden">
          <div className="px-5 py-3.5 mac-divider" style={{ borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              검색 트렌드
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {metrics.trendStartDate} ~ {metrics.trendEndDate} · 네이버 데이터랩 기준
            </p>
          </div>
          <div className="px-5 pb-4">
            <TrendChart trendData={trendData} trendDirection={metrics.trendDirection} />
          </div>
        </article>
      )}

      {/* Metrics + Posts grid */}
      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        {/* Metrics table */}
        <article className="mac-card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              블로그 분석 지표
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {metrics.keyword}
            </p>
          </div>
          <div className="mac-scroll" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
              <tbody>
                <MetricRow label="월 검색량" value={formatNumber(metrics.monthlySearch)} helper="검색광고 API에서 가져온 월 PC+모바일 검색량" />
                <MetricRow label="블로그 문서 수" value={formatNumber(metrics.totalBlogDocuments)} helper="네이버 블로그 검색 API의 total 값" />
                <MetricRow label="최근 발행 비중" value={formatPercent(metrics.recentPublishRatio)} helper="날짜순 검색 결과 샘플 중 최근 30일 게시글 비중" />
                <MetricRow label="키워드 일치도" value={formatPercent(metrics.keywordMatchRatio)} helper="상위 블로그 결과 제목/요약에 검색어가 포함된 비중" />
                <MetricRow label="블로그 경쟁도" value={Math.round(metrics.blogCompetitionScore)} helper="문서 수, 최근 발행 비중, 검색량 대비 문서량 기반 추정" />
                <MetricRow label="블로그 포화도" value={Math.round(metrics.blogSaturationScore)} helper="높을수록 이미 콘텐츠 경쟁이 많은 키워드" />
                <MetricRow label="콘텐츠 기회 점수" value={Math.round(metrics.contentOpportunityScore)} helper="높을수록 블로그 콘텐츠 작성 우선순위가 높은 키워드" />
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

        {/* Top blog posts */}
        <article className="mac-card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              상위 블로그 결과
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              정확도순 상위 {posts.length}개 샘플
            </p>
          </div>
          <div className="mac-scroll" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 840, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['제목', '블로그', '작성일', '일치', '링크'].map((h) => (
                    <th
                      key={h}
                      style={{
                        background: 'var(--bg-overlay)', padding: '9px 14px',
                        fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                        textTransform: 'uppercase', color: 'var(--text-secondary)',
                        textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap'
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr
                    key={`${post.link}-${post.postDate}`}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-overlay)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 14px', maxWidth: 320 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                        {post.title}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>
                        {post.description}
                      </p>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {post.bloggerName}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {formatPostDate(post.postDate)}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <span
                        className={`mac-badge ${post.keywordMatched ? 'mac-badge-green' : 'mac-badge-gray'}`}
                      >
                        {post.keywordMatched ? '포함' : '낮음'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <a
                        href={post.link}
                        target="_blank"
                        rel="noreferrer"
                        className="mac-btn mac-btn-ghost mac-btn-sm inline-flex items-center gap-1"
                        style={{ textDecoration: 'none', fontSize: 11 }}
                      >
                        열기
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </section>
  );
}
