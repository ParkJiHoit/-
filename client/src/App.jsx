import { Download, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import BlogAnalysisForm from './components/BlogAnalysisForm';
import BlogAnalysisPanel from './components/BlogAnalysisPanel';
import BlogSummaryCards from './components/BlogSummaryCards';
import ColumnVisibilitySettings from './components/ColumnVisibilitySettings';
import KeywordExpansionForm from './components/KeywordExpansionForm';
import KeywordFilters, { defaultFilters } from './components/KeywordFilters';
import KeywordSearchForm from './components/KeywordSearchForm';
import KeywordTable, { DEFAULT_VISIBLE_COLUMN_KEYS } from './components/KeywordTable';
import Navbar from './components/Navbar';
import SummaryCards from './components/SummaryCards';
import { formatNumber, formatPercent, getDownloadFileName } from './utils/formatters';
import { sortKeywords } from './utils/tableSort';

const COLUMN_STORAGE_KEY = 'naverKeywordDashboard.visibleColumns.v3';

function getInitialVisibleColumns() {
  try {
    const savedColumns = window.localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!savedColumns) return { ...DEFAULT_VISIBLE_COLUMN_KEYS };
    return { ...DEFAULT_VISIBLE_COLUMN_KEYS, ...JSON.parse(savedColumns), keyword: true };
  } catch {
    return { ...DEFAULT_VISIBLE_COLUMN_KEYS };
  }
}

async function parseApiResponse(response) {
  const rawBody = await response.text();
  const isJson = response.headers.get('content-type')?.includes('application/json');
  if (!rawBody) return {};
  if (!isJson) return { message: rawBody };
  try { return JSON.parse(rawBody); } catch { return { message: rawBody }; }
}

function buildSummary(rows) {
  const totalKeywords = rows.length;
  const efficiencySum = rows.reduce((sum, row) => sum + row.efficiencyScore, 0);
  const saturationSum = rows.reduce((sum, row) => sum + row.saturationScore, 0);
  return {
    totalKeywords,
    priorityCount: rows.filter((r) => r.recommendAction === '우선 테스트').length,
    opportunityCount: rows.filter((r) => r.recommendAction === '기회 키워드').length,
    saturatedCount: rows.filter((r) => r.recommendAction === '과포화 주의').length,
    avgEfficiencyScore: totalKeywords ? Math.round(efficiencySum / totalKeywords) : 0,
    avgSaturationScore: totalKeywords ? Math.round(saturationSum / totalKeywords) : 0
  };
}

function buildBlogDownloadFileName() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `naver_blog_keyword_analysis_${yyyy}${mm}${dd}.xlsx`;
}

/* ── Toast ───────────────────────────────────────────────── */
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast">{message}</div>;
}

/* ── Spinner overlay ─────────────────────────────────────── */
function LoadingBar({ label }) {
  return (
    <div className="animate-fade-in flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      <span className="text-sm font-semibold text-slate-600">{label}</span>
    </div>
  );
}

/* ── Hero / compact search header ───────────────────────── */
function HeroSection({ tab, hasResults, children }) {
  const compact = hasResults;
  return (
    <section
      className="hero-section flex flex-col items-center"
      style={{
        paddingTop: compact ? '80px' : 'calc(var(--nav-h) + 72px)',
        paddingBottom: compact ? '28px' : '72px'
      }}
    >
      {!compact && (
        <div className="animate-fade-in-up mb-7 text-center">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            {tab === 'analysis' && '키워드 분석'}
            {tab === 'expansion' && '키워드 확장'}
            {tab === 'blog' && '블로그 분석'}
          </p>
          <h1 className="text-[2.1rem] font-black leading-tight tracking-tight text-slate-950 sm:text-[2.6rem]">
            {tab === 'analysis' && (
              <>원하는 키워드를 <span className="text-slate-400">검색하세요</span></>
            )}
            {tab === 'expansion' && (
              <>시드 키워드로 <span className="text-slate-400">대량 발굴</span></>
            )}
            {tab === 'blog' && (
              <>블로그 기회를 <span className="text-slate-400">찾아드립니다</span></>
            )}
          </h1>
          <p className="mt-3 text-[0.9rem] font-medium text-slate-500">
            {tab === 'analysis' && '검색량, 경쟁도, 포화도, 기회 점수를 한번에 확인'}
            {tab === 'expansion' && '시드 키워드 기반으로 관련 키워드를 대량으로 발굴'}
            {tab === 'blog' && '블로그 콘텐츠 경쟁도와 기회 점수를 분석'}
          </p>
        </div>
      )}
      <div className={`w-full ${compact ? 'max-w-2xl' : 'max-w-xl'} transition-all duration-500`}>
        {children}
      </div>
    </section>
  );
}

/* ── Quick toggle ────────────────────────────────────────── */
function QuickToggle({ label, checked, onChange, title }) {
  return (
    <label
      className={`flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition ${
        checked
          ? 'border-slate-900 bg-slate-950 text-white'
          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-900'
      }`}
      title={title}
    >
      <input
        className="h-3.5 w-3.5 accent-slate-900"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

/* ── Main ────────────────────────────────────────────────── */
export default function App() {
  const [activeTab, setActiveTab] = useState('analysis');
  const [analysis, setAnalysis] = useState(null);
  const [expansion, setExpansion] = useState(null);
  const [blogAnalysis, setBlogAnalysis] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [sortConfig, setSortConfig] = useState({ key: 'relevanceScore', direction: 'desc' });
  const [visibleColumns, setVisibleColumns] = useState(getInitialVisibleColumns);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const toastTimerRef = useRef(null);

  const isKeywordTab = activeTab === 'analysis' || activeTab === 'expansion';
  const activeResult = activeTab === 'analysis' ? analysis : expansion;
  const activeRows = activeResult?.keywords || [];

  const hasResults =
    (isKeywordTab && !!activeResult) || (activeTab === 'blog' && !!blogAnalysis);

  useEffect(() => {
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
  }, []);

  const clearToast = useCallback(() => setToast(''), []);

  const updateFilter = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const filteredRows = useMemo(() => {
    if (!isKeywordTab) return [];
    const filtered = activeRows.filter((row) => {
      if (filters.excludeLowRelevance && row.relevanceLevel === '낮음') return false;
      if (filters.relevanceLevel && row.relevanceLevel !== filters.relevanceLevel) return false;
      if (filters.minRelevance && row.relevanceScore < Number(filters.minRelevance)) return false;
      if (filters.minSearchVolume && row.totalSearch < Number(filters.minSearchVolume)) return false;
      if (filters.maxSaturation && row.saturationScore > Number(filters.maxSaturation)) return false;
      if (filters.minEfficiency && row.efficiencyScore < Number(filters.minEfficiency)) return false;
      if (filters.competition && row.competition !== filters.competition) return false;
      if (filters.action && row.recommendAction !== filters.action) return false;
      if (filters.mobileOnly && row.mobileRatio < 70) return false;
      if (filters.excludeSaturated && row.recommendAction === '과포화 주의') return false;
      if (filters.keywordText && !row.keyword.toLowerCase().includes(filters.keywordText.trim().toLowerCase())) return false;
      return true;
    });
    return sortKeywords(filtered, sortConfig);
  }, [activeRows, filters, isKeywordTab, sortConfig]);

  const currentSummary = useMemo(() => buildSummary(filteredRows), [filteredRows]);

  const requestKeywords = async (endpoint, payload, failureMessage, nextSortConfig) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await parseApiResponse(response);
      if (!response.ok) throw new Error(data.message || failureMessage);
      if (!data.keywords) throw new Error(data.message || '키워드 응답 형식이 올바르지 않습니다.');
      setFilters(defaultFilters);
      setSortConfig(nextSortConfig);
      return data;
    } catch (err) {
      setError(err.message || failureMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const analyzeKeyword = async (keyword) => {
    const data = await requestKeywords('/api/keywords/analyze', { keyword }, '키워드 데이터를 조회하지 못했습니다.', { key: 'relevanceScore', direction: 'desc' });
    if (data) setAnalysis(data);
  };

  const expandKeyword = async (payload) => {
    const data = await requestKeywords('/api/keywords/expand', payload, '키워드 확장 데이터를 조회하지 못했습니다.', { key: 'discoveryScore', direction: 'desc' });
    if (data) setExpansion(data);
  };

  const analyzeBlog = async (payload) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/blog/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await parseApiResponse(response);
      if (!response.ok) throw new Error(data.message || '블로그 키워드 데이터를 조회하지 못했습니다.');
      if (!data.metrics) throw new Error(data.message || '블로그 분석 응답 형식이 올바르지 않습니다.');
      setBlogAnalysis(data);
    } catch (err) {
      setError(err.message || '블로그 키워드 데이터를 조회하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) =>
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));

  const resetVisibleColumns = () => setVisibleColumns({ ...DEFAULT_VISIBLE_COLUMN_KEYS });

  const downloadKeywordExcel = () => {
    const exportRows = filteredRows.map((row) => ({
      키워드: row.keyword,
      '의도 유형': row.intentType,
      '발굴 점수': row.discoveryScore,
      연관도: row.relevanceLevel,
      '연관도 점수': row.relevanceScore,
      'PC 검색량': row.monthlyPcSearch,
      '모바일 검색량': row.monthlyMobileSearch,
      '총 검색량': row.totalSearch,
      '모바일 비중': formatPercent(row.mobileRatio),
      '평균 CTR': formatPercent(row.averageCtr),
      경쟁도: row.competition,
      '평균 노출 깊이': row.averageDepth,
      '포화도 점수': row.saturationScore,
      '효율 점수': row.efficiencyScore,
      '추천 액션': row.recommendAction
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeTab === 'analysis' ? '키워드 분석' : '키워드 확장');
    XLSX.writeFile(workbook, getDownloadFileName());
  };

  const downloadBlogExcel = () => {
    if (!blogAnalysis?.metrics) return;
    const metricRows = [{
      키워드: blogAnalysis.metrics.keyword,
      '월 검색량': blogAnalysis.metrics.monthlySearch,
      '블로그 문서 수': blogAnalysis.metrics.totalBlogDocuments,
      '최근 30일 샘플 수': blogAnalysis.metrics.recentPostCount,
      '최근 발행 비중': formatPercent(blogAnalysis.metrics.recentPublishRatio),
      '키워드 일치도': formatPercent(blogAnalysis.metrics.keywordMatchRatio),
      '블로그 경쟁도': blogAnalysis.metrics.blogCompetitionScore,
      '블로그 포화도': blogAnalysis.metrics.blogSaturationScore,
      '콘텐츠 기회 점수': blogAnalysis.metrics.contentOpportunityScore,
      '검색 트렌드': blogAnalysis.metrics.trendDirection,
      '트렌드 변화율': formatPercent(blogAnalysis.metrics.trendChangeRate),
      '추천 액션': blogAnalysis.metrics.recommendAction
    }];
    const postRows = blogAnalysis.posts.map((post) => ({
      제목: post.title, 설명: post.description, 블로그명: post.bloggerName,
      작성일: post.postDate, '키워드 포함': post.keywordMatched ? '포함' : '낮음', 링크: post.link
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(metricRows), '블로그 분석');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(postRows), '상위 블로그 결과');
    XLSX.writeFile(workbook, buildBlogDownloadFileName());
  };

  const switchTab = (nextTab) => {
    setActiveTab(nextTab);
    setError('');
    setFilters(defaultFilters);
    if (nextTab === 'analysis') setSortConfig({ key: 'relevanceScore', direction: 'desc' });
    if (nextTab === 'expansion') setSortConfig({ key: 'discoveryScore', direction: 'desc' });
  };

  const handleMockAction = () => {
    showToast('준비 중인 기능입니다 — 곧 만나보실 수 있어요!');
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar activeTab={activeTab} onSwitchTab={switchTab} onMockAction={handleMockAction} />

      {/* ── Hero + search form ───────────────────────────── */}
      <HeroSection tab={activeTab} hasResults={hasResults}>
        {activeTab === 'analysis' && (
          <KeywordSearchForm
            onSubmit={analyzeKeyword}
            loading={loading}
            suggestions={analysis?.searchSuggestions || []}
          />
        )}
        {activeTab === 'expansion' && (
          <KeywordExpansionForm onSubmit={expandKeyword} loading={loading} />
        )}
        {activeTab === 'blog' && (
          <BlogAnalysisForm onSubmit={analyzeBlog} loading={loading} />
        )}
      </HeroSection>

      {/* ── Results area ─────────────────────────────────── */}
      <div
        className="mx-auto w-full max-w-[1560px] px-5 pb-20 lg:px-8"
        style={{ minHeight: hasResults ? undefined : 0 }}
      >
        {loading && (
          <div className="mb-5">
            <LoadingBar
              label={
                activeTab === 'analysis'
                  ? '키워드 데이터를 분석 중입니다…'
                  : activeTab === 'expansion'
                  ? '키워드를 확장 중입니다…'
                  : '블로그 키워드 데이터를 분석 중입니다…'
              }
            />
          </div>
        )}

        {error && (
          <div className="animate-fade-in mb-5 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* ── Keyword results ─────────────────────────── */}
        {isKeywordTab && activeResult && !loading && (
          <div className="animate-fade-in-up flex flex-col gap-4">
            {activeTab === 'analysis' && (
              <>
                <SummaryCards summary={currentSummary} />
                <KeywordFilters filters={filters} onChange={setFilters} onReset={() => setFilters(defaultFilters)} />
              </>
            )}
            {activeTab === 'expansion' && (
              <KeywordFilters filters={filters} onChange={setFilters} onReset={() => setFilters(defaultFilters)} />
            )}

            <ColumnVisibilitySettings
              visibleColumns={visibleColumns}
              onChange={setVisibleColumns}
              onReset={resetVisibleColumns}
            />

            {/* Table header bar */}
            <div className="apple-card flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-base font-black text-slate-950">
                  {activeTab === 'analysis' ? '키워드 분석 테이블' : '키워드 확장 테이블'}
                </h2>
                <p className="mt-0.5 text-[13px] font-medium text-slate-500">
                  현재 필터 기준 {formatNumber(filteredRows.length)}개 키워드 표시
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:items-center">
                <QuickToggle
                  label="낮은 연관도 제외"
                  checked={filters.excludeLowRelevance}
                  onChange={(v) => updateFilter('excludeLowRelevance', v)}
                  title="검색 키워드와 연관도 등급이 낮음인 키워드를 테이블에서 숨깁니다."
                />
                <QuickToggle
                  label="과포화 제외"
                  checked={filters.excludeSaturated}
                  onChange={(v) => updateFilter('excludeSaturated', v)}
                  title="추천 액션이 과포화 주의인 키워드를 테이블에서 숨깁니다."
                />
                <button
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-[13px] font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  type="button"
                  onClick={downloadKeywordExcel}
                  disabled={!filteredRows.length}
                >
                  <Download className="h-4 w-4" />
                  엑셀 다운로드
                </button>
              </div>
            </div>

            <KeywordTable
              rows={filteredRows}
              sortConfig={sortConfig}
              onSort={handleSort}
              visibleColumns={visibleColumns}
            />
          </div>
        )}

        {/* ── Blog results ────────────────────────────── */}
        {activeTab === 'blog' && blogAnalysis && !loading && (
          <div className="animate-fade-in-up flex flex-col gap-4">
            <BlogSummaryCards metrics={blogAnalysis.metrics} />

            <div className="apple-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-black text-slate-950">블로그 분석 결과</h2>
                <p className="mt-0.5 text-[13px] font-medium text-slate-500">
                  블로그 검색 결과 {formatNumber(blogAnalysis.metrics.totalBlogDocuments)}건 기준
                </p>
              </div>
              <button
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-[13px] font-bold text-white transition hover:bg-slate-800"
                type="button"
                onClick={downloadBlogExcel}
              >
                <Download className="h-4 w-4" />
                엑셀 다운로드
              </button>
            </div>

            <BlogAnalysisPanel result={blogAnalysis} />
          </div>
        )}
      </div>

      {/* ── Toast ────────────────────────────────────────── */}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  );
}
