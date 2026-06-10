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
const THEME_STORAGE_KEY  = 'keywordlab.theme';

function getInitialVisibleColumns() {
  try {
    const saved = window.localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!saved) return { ...DEFAULT_VISIBLE_COLUMN_KEYS };
    return { ...DEFAULT_VISIBLE_COLUMN_KEYS, ...JSON.parse(saved), keyword: true };
  } catch { return { ...DEFAULT_VISIBLE_COLUMN_KEYS }; }
}

async function parseApiResponse(response) {
  const rawBody = await response.text();
  const isJson = response.headers.get('content-type')?.includes('application/json');
  if (!rawBody) return {};
  if (!isJson) return { message: rawBody };
  try { return JSON.parse(rawBody); } catch { return { message: rawBody }; }
}

function buildSummary(rows) {
  const total = rows.length;
  return {
    totalKeywords:    total,
    priorityCount:    rows.filter((r) => r.recommendAction === '우선 테스트').length,
    opportunityCount: rows.filter((r) => r.recommendAction === '기회 키워드').length,
    saturatedCount:   rows.filter((r) => r.recommendAction === '과포화 주의').length,
    avgEfficiencyScore: total ? Math.round(rows.reduce((s,r)=>s+r.efficiencyScore,0)/total) : 0,
    avgSaturationScore: total ? Math.round(rows.reduce((s,r)=>s+r.saturationScore,0)/total) : 0
  };
}

function buildBlogFileName() {
  const d = new Date();
  return `naver_blog_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.xlsx`;
}

/* ── Toast ── */
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="mac-toast">{message}</div>;
}

/* ── Loading ── */
function LoadingRow({ label }) {
  return (
    <div
      className="mac-fade-in mac-card flex items-center gap-3 px-5 py-4"
    >
      <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent)' }} />
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}

/* ── Theme Toggle (fixed top-right) ── */
function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 1001,
        padding: 3,
        background: isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(24px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
        borderRadius: 999,
        boxShadow: isDark
          ? '0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05) inset'
          : '0 4px 16px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.8) inset',
      }}
    >
      <div style={{ position: 'relative', display: 'flex' }}>
        {/* Sliding indicator */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '50%', height: '100%',
            borderRadius: 999,
            background: isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.09)',
            transform: isDark ? 'translateX(100%)' : 'translateX(0%)',
            transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
            pointerEvents: 'none',
          }}
        />
        {[{ label: 'LIGHT', active: !isDark }, { label: 'DARK', active: isDark }].map(({ label, active }) => (
          <button
            key={label}
            onClick={onToggle}
            style={{
              position: 'relative', zIndex: 1,
              minWidth: 52, padding: '5px 14px',
              border: 'none', background: 'transparent',
              cursor: active ? 'default' : 'pointer',
              borderRadius: 999,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
              transition: 'color 0.22s',
              fontFamily: 'inherit',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Hero / compact wrapper ── */
function HeroSection({ tab, hasResults, children }) {
  const maxW = tab === 'expansion' ? 960 : 680;
  return (
    <div
      className="hero-transition"
      style={{
        position: 'relative',
        background: hasResults
          ? 'transparent'
          : 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(10,132,255,0.09) 0%, transparent 65%)',
        paddingTop: hasResults ? 'calc(var(--nav-offset) + 24px)' : 'calc(var(--nav-offset) + 90px)',
        paddingBottom: hasResults ? 20 : 72
      }}
    >
      <section
        className="mx-auto flex w-full flex-col items-center px-5 lg:px-8"
        style={{ maxWidth: maxW }}
      >
        {!hasResults && (
          <div className="mac-fade-in mb-10 text-center">
            <p style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--text-tertiary)', marginBottom: 14
            }}>
              {tab === 'analysis' && 'Keyword Analysis'}
              {tab === 'expansion' && 'Keyword Expansion'}
              {tab === 'blog'     && 'Blog Analysis'}
            </p>
            <h1 style={{
              fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px',
              color: 'var(--text-primary)', margin: 0, lineHeight: 1.25
            }}>
              {tab === 'analysis' && '키워드를 분석해드립니다'}
              {tab === 'expansion' && '시드 키워드로 대량 발굴'}
              {tab === 'blog'     && '블로그 기회를 찾아드립니다'}
            </h1>
            <p style={{ fontSize: 15, fontWeight: 400, color: 'var(--text-secondary)', marginTop: 10 }}>
              {tab === 'analysis' && '검색량 · 경쟁도 · 포화도 · 기회 점수를 한번에'}
              {tab === 'expansion' && '시드 키워드 기반으로 관련 키워드를 대량으로 발굴'}
              {tab === 'blog'     && '블로그 콘텐츠 경쟁도와 기회 점수를 분석'}
            </p>
          </div>
        )}
        {children}
      </section>
    </div>
  );
}

/* ── Quick toggle (dark/light aware) ── */
function QuickToggle({ label, checked, onChange, title }) {
  return (
    <label
      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5"
      style={{
        fontSize: 13,
        fontWeight: 500,
        border: '1px solid var(--border)',
        background: checked ? 'var(--accent)' : 'var(--bg-overlay)',
        color: checked ? '#fff' : 'var(--text-secondary)',
        transition: 'background 0.15s, color 0.15s'
      }}
      title={title}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ display: 'none' }}
      />
      {label}
    </label>
  );
}

/* ═══════════════════════════════════════════ */
export default function App() {
  const [theme, setTheme] = useState(() =>
    window.localStorage.getItem(THEME_STORAGE_KEY) || 'dark'
  );
  const [activeTab, setActiveTab]       = useState('analysis');
  const [analysis,  setAnalysis]        = useState(null);
  const [expansion, setExpansion]       = useState(null);
  const [blogAnalysis, setBlogAnalysis] = useState(null);
  const [filters,  setFilters]          = useState(defaultFilters);
  const [sortConfig, setSortConfig]     = useState({ key: 'relevanceScore', direction: 'desc' });
  const [visibleColumns, setVisibleColumns] = useState(getInitialVisibleColumns);
  const [loading, setLoading]           = useState(false);
  const [error,   setError]             = useState('');
  const [toast,   setToast]             = useState('');
  const toastRef = useRef(null);

  const isKeywordTab  = activeTab === 'analysis' || activeTab === 'expansion';
  const activeResult  = activeTab === 'analysis' ? analysis : expansion;
  const activeRows    = activeResult?.keywords || [];
  const hasResults    = (isKeywordTab && !!activeResult) || (activeTab === 'blog' && !!blogAnalysis);

  /* Apply theme to <html> */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const showToast = useCallback((msg) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast(msg);
  }, []);

  const updateFilter = (key, value) => setFilters((p) => ({ ...p, [key]: value }));

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
      if (filters.keywordText &&
          !row.keyword.toLowerCase().includes(filters.keywordText.trim().toLowerCase())) return false;
      return true;
    });
    return sortKeywords(filtered, sortConfig);
  }, [activeRows, filters, isKeywordTab, sortConfig]);

  const currentSummary = useMemo(() => buildSummary(filteredRows), [filteredRows]);

  const requestKeywords = async (endpoint, payload, failMsg, nextSort) => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.message || failMsg);
      if (!data.keywords) throw new Error(data.message || '키워드 응답 형식이 올바르지 않습니다.');
      setFilters(defaultFilters);
      setSortConfig(nextSort);
      return data;
    } catch (e) {
      setError(e.message || failMsg);
      return null;
    } finally { setLoading(false); }
  };

  const analyzeKeyword = async (keyword) => {
    const data = await requestKeywords('/api/keywords/analyze', { keyword },
      '키워드 데이터를 조회하지 못했습니다.', { key: 'relevanceScore', direction: 'desc' });
    if (data) setAnalysis(data);
  };

  const expandKeyword = async (payload) => {
    const data = await requestKeywords('/api/keywords/expand', payload,
      '키워드 확장 데이터를 조회하지 못했습니다.', { key: 'discoveryScore', direction: 'desc' });
    if (data) setExpansion(data);
  };

  const analyzeBlog = async (payload) => {
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/blog/analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.message || '블로그 키워드 데이터를 조회하지 못했습니다.');
      if (!data.metrics) throw new Error(data.message || '블로그 분석 응답 형식이 올바르지 않습니다.');
      setBlogAnalysis(data);
    } catch (e) {
      setError(e.message || '블로그 키워드 데이터를 조회하지 못했습니다.');
    } finally { setLoading(false); }
  };

  const handleSort = (key) =>
    setSortConfig((p) => ({ key, direction: p.key === key && p.direction === 'desc' ? 'asc' : 'desc' }));

  const resetVisibleColumns = () => setVisibleColumns({ ...DEFAULT_VISIBLE_COLUMN_KEYS });

  const downloadKeywordExcel = () => {
    const rows = filteredRows.map((r) => ({
      키워드: r.keyword, '의도 유형': r.intentType, '발굴 점수': r.discoveryScore,
      연관도: r.relevanceLevel, '연관도 점수': r.relevanceScore,
      'PC 검색량': r.monthlyPcSearch, '모바일 검색량': r.monthlyMobileSearch,
      '총 검색량': r.totalSearch, '모바일 비중': formatPercent(r.mobileRatio),
      '평균 CTR': formatPercent(r.averageCtr), 경쟁도: r.competition,
      '평균 노출 깊이': r.averageDepth, '포화도 점수': r.saturationScore,
      '효율 점수': r.efficiencyScore, '추천 액션': r.recommendAction
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), activeTab === 'analysis' ? '키워드 분석' : '키워드 확장');
    XLSX.writeFile(wb, getDownloadFileName());
  };

  const downloadBlogExcel = () => {
    if (!blogAnalysis?.metrics) return;
    const m = blogAnalysis.metrics;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
      키워드: m.keyword, '월 검색량': m.monthlySearch, '블로그 문서 수': m.totalBlogDocuments,
      '최근 30일 샘플 수': m.recentPostCount, '최근 발행 비중': formatPercent(m.recentPublishRatio),
      '키워드 일치도': formatPercent(m.keywordMatchRatio), '블로그 경쟁도': m.blogCompetitionScore,
      '블로그 포화도': m.blogSaturationScore, '콘텐츠 기회 점수': m.contentOpportunityScore,
      '검색 트렌드': m.trendDirection, '트렌드 변화율': formatPercent(m.trendChangeRate), '추천 액션': m.recommendAction
    }]), '블로그 분석');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      blogAnalysis.posts.map((p) => ({ 제목: p.title, 설명: p.description, 블로그명: p.bloggerName,
        작성일: p.postDate, '키워드 포함': p.keywordMatched ? '포함' : '낮음', 링크: p.link }))
    ), '상위 블로그 결과');
    XLSX.writeFile(wb, buildBlogFileName());
  };

  const switchTab = (next) => {
    setActiveTab(next); setError(''); setFilters(defaultFilters);
    if (next === 'analysis')  setSortConfig({ key: 'relevanceScore',  direction: 'desc' });
    if (next === 'expansion') setSortConfig({ key: 'discoveryScore',  direction: 'desc' });
  };

  const handleMockAction = () => showToast('준비 중인 기능입니다 — 곧 만나보실 수 있어요!');

  /* ── Render ── */
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <Navbar
        activeTab={activeTab}
        onSwitchTab={switchTab}
        onMockAction={handleMockAction}
        theme={theme}
      />
      <ThemeToggle theme={theme} onToggle={toggleTheme} />

      {/* Hero search */}
      <HeroSection tab={activeTab} hasResults={hasResults}>
        {activeTab === 'analysis' && (
          <KeywordSearchForm onSubmit={analyzeKeyword} loading={loading}
            suggestions={analysis?.searchSuggestions || []} />
        )}
        {activeTab === 'expansion' && (
          <KeywordExpansionForm onSubmit={expandKeyword} loading={loading} />
        )}
        {activeTab === 'blog' && (
          <BlogAnalysisForm onSubmit={analyzeBlog} loading={loading} />
        )}
      </HeroSection>

      {/* Results */}
      <div className="mx-auto w-full max-w-[1560px] px-5 pb-20 lg:px-8">
        {loading && (
          <div className="mb-5">
            <LoadingRow label={
              activeTab === 'analysis' ? '키워드 데이터를 분석 중입니다…' :
              activeTab === 'expansion' ? '키워드를 확장 중입니다…' :
              '블로그 키워드 데이터를 분석 중입니다…'
            } />
          </div>
        )}

        {error && (
          <div
            className="mac-fade-in mac-card mb-5 px-5 py-4"
            style={{ fontSize: 13, color: 'var(--destructive)', border: '1px solid rgba(255,69,58,0.25)' }}
          >
            {error}
          </div>
        )}

        {/* Keyword results */}
        {isKeywordTab && activeResult && !loading && (
          <div className="mac-fade-in flex flex-col gap-5">
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
            <div
              className="mac-card flex flex-col gap-3 px-5 py-4 xl:flex-row xl:items-center xl:justify-between"
            >
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  {activeTab === 'analysis' ? '키워드 분석 테이블' : '키워드 확장 테이블'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  현재 필터 기준 {formatNumber(filteredRows.length)}개 키워드
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <QuickToggle
                  label="낮은 연관도 제외"
                  checked={filters.excludeLowRelevance}
                  onChange={(v) => updateFilter('excludeLowRelevance', v)}
                  title="연관도 낮음 키워드를 숨깁니다."
                />
                <QuickToggle
                  label="과포화 제외"
                  checked={filters.excludeSaturated}
                  onChange={(v) => updateFilter('excludeSaturated', v)}
                  title="과포화 주의 키워드를 숨깁니다."
                />
                <button
                  className="mac-btn mac-btn-sm"
                  onClick={downloadKeywordExcel}
                  disabled={!filteredRows.length}
                >
                  <Download className="h-3.5 w-3.5" />
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

        {/* Blog results */}
        {activeTab === 'blog' && blogAnalysis && !loading && (
          <div className="mac-fade-in flex flex-col gap-5">
            <BlogSummaryCards metrics={blogAnalysis.metrics} />

            <div
              className="mac-card flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  블로그 분석 결과
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  블로그 검색 결과 {formatNumber(blogAnalysis.metrics.totalBlogDocuments)}건 기준
                </p>
              </div>
              <button className="mac-btn mac-btn-sm" onClick={downloadBlogExcel}>
                <Download className="h-3.5 w-3.5" />
                엑셀 다운로드
              </button>
            </div>

            <BlogAnalysisPanel result={blogAnalysis} />
          </div>
        )}
      </div>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  );
}
