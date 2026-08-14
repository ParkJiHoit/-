// 첫 검색 로딩 중 실제 결과와 비슷한 모양의 스켈레톤을 미리 보여준다 —
// 스피너 하나보다 "지금 이런 결과가 준비되고 있다"는 느낌을 훨씬 잘 전달한다.

function SkelLine({ width = '100%', height = 14, style }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

function SkelCircle({ size = 96 }) {
  return <div className="skeleton" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }} />;
}

function SkelStatCard() {
  return (
    <div className="mac-card-glass" style={{ padding: '20px 20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SkelLine width="60%" height={11} />
      <SkelLine width="45%" height={26} />
      <SkelLine width="70%" height={11} />
    </div>
  );
}

function SkelTable({ rows = 6 }) {
  return (
    <div className="mac-card-glass overflow-hidden">
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <SkelLine width={120} height={12} />
      </div>
      <div style={{ padding: '4px 20px' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '13px 0',
            borderBottom: i === rows - 1 ? 'none' : '1px solid var(--border)',
          }}>
            <SkelLine width={22} height={22} style={{ borderRadius: 6, flexShrink: 0 }} />
            <SkelLine width={`${62 - i * 5}%`} height={13} />
            <SkelLine width={60} height={11} style={{ marginLeft: 'auto', flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function KeywordSkeleton() {
  return (
    <div className="mac-stagger flex flex-col mac-fade-in" style={{ gap: 48 }}>
      {/* 키워드 인사이트 */}
      <section>
        <SkelLine width={140} height={13} style={{ marginBottom: 20 }} />
        <div className="mac-card-glass" style={{ padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <SkelCircle size={72} />
          <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SkelLine width="40%" height={20} />
            <SkelLine width="80%" height={13} />
            <SkelLine width="60%" height={13} />
          </div>
        </div>
      </section>

      {/* 키워드 요약 */}
      <section>
        <SkelLine width={110} height={13} style={{ marginBottom: 20 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => <SkelStatCard key={i} />)}
        </div>
      </section>

      {/* 키워드 클러스터링 */}
      <section>
        <SkelLine width={140} height={13} style={{ marginBottom: 20 }} />
        <SkelTable rows={7} />
      </section>
    </div>
  );
}

function BlogStructureSkeleton() {
  return (
    <div className="mac-stagger flex flex-col mac-fade-in" style={{ gap: 20 }}>
      {/* 헤더 */}
      <div className="mac-card-glass" style={{ padding: '20px 24px', maxWidth: 680, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkelLine width={120} height={12} />
          <SkelLine width={180} height={24} />
          <SkelLine width={220} height={12} />
        </div>
        <SkelLine width={90} height={44} style={{ flexShrink: 0 }} />
      </div>

      {/* 수치 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => <SkelStatCard key={i} />)}
      </div>

      {/* 도넛 차트 + 요약 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[0, 1].map(i => (
          <div key={i} className="mac-card-glass" style={{ width: 264, aspectRatio: '1 / 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <SkelCircle size={140} />
          </div>
        ))}
        <div className="mac-card-glass" style={{ flex: '1 1 260px', minWidth: 260, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
          <SkelLine width={80} height={11} />
          <SkelLine width="90%" height={13} />
          <SkelLine width="70%" height={13} />
        </div>
      </div>

      {/* 상위 블로그 목록 */}
      <SkelTable rows={6} />
    </div>
  );
}

export default function ResultSkeleton({ variant = 'keyword' }) {
  return variant === 'blog-structure' ? <BlogStructureSkeleton /> : <KeywordSkeleton />;
}
