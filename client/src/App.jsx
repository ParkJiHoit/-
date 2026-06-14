import { Download, Loader2, Moon, Sun } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import BlogStructurePanel from './components/BlogStructurePanel';
import ColumnVisibilitySettings from './components/ColumnVisibilitySettings';
import KeywordExpansionForm from './components/KeywordExpansionForm';
import KeywordFilters, { defaultFilters } from './components/KeywordFilters';
import KeywordInsightPanel from './components/KeywordInsightPanel';
import KeywordSearchForm from './components/KeywordSearchForm';
import KeywordTable, { DEFAULT_VISIBLE_COLUMN_KEYS } from './components/KeywordTable';
import AuroraBackground from './components/AuroraBackground';
import Navbar from './components/Navbar';
import PricingPage from './components/PricingPage';
import SummaryCards from './components/SummaryCards';
import { formatNumber, formatPercent, getDownloadFileName } from './utils/formatters';
import { sortKeywords } from './utils/tableSort';

const COLUMN_STORAGE_KEY = 'naverKeywordDashboard.visibleColumns.v4';
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
    <div className="mac-fade-in" style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '12px 22px', borderRadius: 999,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      }}>
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
    </div>
  );
}

/* ── 메인 페이지 전용 로딩 (블로그 첫 검색) ── */
function MainPageLoading({ label }) {
  return (
    <div className="mac-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 0' }}>
      <div style={{
        width: 44, height: 44, borderRadius: 999,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      }}>
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}

/* ── Theme Toggle (fixed top-right) ── */
function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 1001, padding: 3,
      background: isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(24px) saturate(1.8)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
      borderRadius: 999,
      boxShadow: isDark
        ? '0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05) inset'
        : '0 4px 16px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.8) inset',
    }}>
      <div style={{ position: 'relative', display: 'flex' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: 34, height: 34, borderRadius: 999,
          background: isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.09)',
          transform: isDark ? 'translateX(34px)' : 'translateX(0px)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          pointerEvents: 'none',
        }} />
        {[{ Icon: Sun, active: !isDark }, { Icon: Moon, active: isDark }].map(({ Icon, active }, i) => (
          <button key={i} onClick={onToggle} style={{
            position: 'relative', zIndex: 1,
            width: 34, height: 34, border: 'none', background: 'transparent',
            cursor: active ? 'default' : 'pointer', borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
            transition: 'color 0.22s',
          }}>
            <Icon style={{ width: 14, height: 14 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Hero / compact wrapper ── */
function HeroSection({ tab, hasResults, children }) {
  const maxW = tab === 'expansion' ? 1140 : 680;
  return (
    <div className="hero-transition" style={{
      position: 'relative',
      background: hasResults
        ? 'transparent'
        : 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(10,132,255,0.09) 0%, transparent 65%)',
      paddingTop: hasResults ? 'calc(var(--nav-offset) + 24px)' : 'calc(var(--nav-offset) + 190px)',
      paddingBottom: hasResults ? 20 : 72
    }}>
      <section className="mx-auto flex w-full flex-col items-center px-5 lg:px-8" style={{ maxWidth: maxW }}>
        {!hasResults && (
          <div className="mac-fade-in mb-10 text-center">
            <p style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--text-tertiary)', marginBottom: 14
            }}>
              {tab === 'analysis' && 'Keyword Analysis'}
              {tab === 'expansion' && 'Keyword Expansion'}
              {tab === 'blog'     && 'Blog Structure Analysis'}
            </p>
            <h1 style={{
              fontSize: 42, fontWeight: 800, letterSpacing: '-1.2px',
              color: 'var(--text-primary)', margin: 0, lineHeight: 1.22, textAlign: 'center'
            }}>
              {tab === 'analysis' && (
                <>
                  아직 아무도 쓰지 않은 키워드를
                  <br />
                  <span style={{
                    background: 'linear-gradient(120deg, #0A84FF 0%, #34C1FF 45%, #30D158 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  }}>먼저 차지하세요</span>
                </>
              )}
              {tab === 'expansion' && (
                <>
                  아직 발굴되지 않은
                  <br />
                  <span style={{
                    background: 'linear-gradient(120deg, #BF5AF2 0%, #0A84FF 55%, #34C1FF 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  }}>키워드가 있습니다</span>
                </>
              )}
              {tab === 'blog' && (
                <>
                  상위 블로그는 어떻게
                  <br />
                  <span style={{
                    background: 'linear-gradient(120deg, #30D158 0%, #0A84FF 55%, #34C1FF 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  }}>구성되어 있을까요</span>
                </>
              )}
            </h1>
            <p style={{ fontSize: 15, fontWeight: 400, color: 'var(--text-secondary)', marginTop: 10 }}>
              {tab === 'analysis' && '키워드를 분석하고, 가능성을 실험하는 공간'}
              {tab === 'expansion' && '시드 키워드로 숨겨진 틈새 키워드를 한 번에 찾아드립니다'}
              {tab === 'blog'     && '상위 1~10위 블로그 구조를 분석하고 콘텐츠 전략을 세우세요'}
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
    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5" style={{
      fontSize: 13, fontWeight: 500,
      border: '1px solid var(--border)',
      background: checked ? 'var(--accent)' : 'var(--bg-overlay)',
      color: checked ? '#fff' : 'var(--text-secondary)',
      transition: 'background 0.15s, color 0.15s'
    }} title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ display: 'none' }} />
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
  const [blogStructure, setBlogStructure] = useState(null);
  const [blogStructureKeyword, setBlogStructureKeyword] = useState('');
  const [insights, setInsights]         = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError]     = useState(null);
  const [filters,  setFilters]          = useState(defaultFilters);
  const [sortConfig, setSortConfig]     = useState({ key: 'efficiencyScore', direction: 'desc' });
  const [visibleColumns, setVisibleColumns] = useState(getInitialVisibleColumns);
  const [loading, setLoading]           = useState(false);
  const [error,   setError]             = useState('');
  const [toast,   setToast]             = useState('');
  const toastRef = useRef(null);

  const isKeywordTab  = activeTab === 'analysis' || activeTab === 'expansion';
  const activeResult  = activeTab === 'analysis' ? analysis : expansion;
  const activeRows    = activeResult?.keywords || [];
  const hasResults    = (isKeywordTab && !!activeResult) || (activeTab === 'blog' && !!blogStructure);

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

  const fetchInsights = useCallback(async (keyword) => {
    setInsightsLoading(true);
    setInsights(null);
    setInsightsError(null);
    try {
      const res = await fetch(`/api/keywords/insights?keyword=${encodeURIComponent(keyword)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInsightsError(data?.message || `DataLab API 오류 (${res.status})`);
        return;
      }
      setInsights(data);
    } catch (e) {
      setInsightsError(e.message || '네트워크 오류');
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const analyzeKeyword = async (keyword) => {
    fetchInsights(keyword);
    const data = await requestKeywords('/api/keywords/analyze', { keyword },
      '키워드 데이터를 조회하지 못했습니다.', { key: 'efficiencyScore', direction: 'desc' });
    if (data) setAnalysis(data);
  };

  const expandKeyword = async (payload) => {
    const data = await requestKeywords('/api/keywords/expand', payload,
      '키워드 확장 데이터를 조회하지 못했습니다.', { key: 'discoveryScore', direction: 'desc' });
    if (data) setExpansion(data);
  };

  const analyzeBlogStructure = async (keyword) => {
    if (!keyword) return;
    setBlogStructureKeyword(keyword);
    // 기존 결과가 있으면(재검색) 유지 — null로 지우면 hasResults가 false가 되어 메인으로 튕김
    // 기존 결과가 없으면(첫 검색) 메인 페이지 로딩 인디케이터를 보여줘야 하므로 그대로 null 유지
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/blog/structure-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword }) });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.message || '블로그 구조 분석에 실패했습니다.');
      setBlogStructure(data);
    } catch (e) {
      setError(e.message || '블로그 구조 분석에 실패했습니다.');
    } finally { setLoading(false); }
  };

  const handleViewDetail = (keyword) => {
    setActiveTab('blog');
    setError('');
    analyzeBlogStructure(keyword);
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

  const switchTab = (next) => {
    setActiveTab(next); setError(''); setFilters(defaultFilters);
    setInsights(null); setInsightsLoading(false); setInsightsError(null);
    if (next === 'analysis')  setSortConfig({ key: 'efficiencyScore',  direction: 'desc' });
    if (next === 'expansion') setSortConfig({ key: 'discoveryScore',  direction: 'desc' });
    if (next === 'blog') { setBlogStructure(null); setBlogStructureKeyword(''); }
  };

  const goHome = () => {
    setActiveTab('analysis');
    setAnalysis(null);
    setInsights(null);
    setInsightsLoading(false);
    setInsightsError(null);
    setBlogStructure(null);
    setBlogStructureKeyword('');
    setError('');
    setFilters(defaultFilters);
    setSortConfig({ key: 'efficiencyScore', direction: 'desc' });
  };

  const goToService = (id) => {
    setError('');
    setFilters(defaultFilters);
    if (id === 'analysis') {
      setActiveTab('analysis');
      setAnalysis(null);
      setExpansion(null);
      setInsights(null);
      setInsightsLoading(false);
      setInsightsError(null);
      setSortConfig({ key: 'efficiencyScore', direction: 'desc' });
    } else if (id === 'expansion') {
      setActiveTab('expansion');
      setAnalysis(null);
      setExpansion(null);
      setInsights(null);
      setInsightsLoading(false);
      setInsightsError(null);
      setSortConfig({ key: 'discoveryScore', direction: 'desc' });
    } else if (id === 'blog') {
      setActiveTab('blog');
      setBlogStructure(null);
      setBlogStructureKeyword('');
    }
  };

  const handleMockAction = () => showToast('준비 중인 기능입니다 — 곧 만나보실 수 있어요!');

  /* ── Render ── */
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', position: 'relative' }}>
      <AuroraBackground theme={theme} hidden={hasResults} />
      {/* 결과 페이지 grid 배경 */}
      {hasResults && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, black 30%, transparent 100%)',
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
      <Navbar activeTab={activeTab} onSwitchTab={switchTab} onGoHome={goHome} onGoToService={goToService} onMockAction={handleMockAction} theme={theme} />
      <ThemeToggle theme={theme} onToggle={toggleTheme} />

      {activeTab === 'pricing' ? (
        <PricingPage onMockAction={handleMockAction} />
      ) : (
      <>

      <HeroSection tab={activeTab} hasResults={hasResults}>
        {activeTab === 'analysis' && (
          <KeywordSearchForm onSubmit={analyzeKeyword} loading={loading}
            suggestions={analysis?.searchSuggestions || []}
            isMain={!hasResults} />
        )}
        {activeTab === 'expansion' && (
          <KeywordExpansionForm onSubmit={expandKeyword} loading={loading} />
        )}
        {activeTab === 'blog' && (
          <KeywordSearchForm onSubmit={analyzeBlogStructure} loading={loading} isMain={!hasResults} />
        )}
        {/* 블로그 첫 검색 로딩: 메인 페이지에 중앙 표시 */}
        {activeTab === 'blog' && loading && !blogStructure && (
          <MainPageLoading label="상위 블로그 구조를 분석 중입니다…" />
        )}
        {/* 블로그 첫 검색 에러: 메인 페이지에 표시 */}
        {activeTab === 'blog' && !blogStructure && error && (
          <p className="mac-fade-in" style={{ fontSize: 13, color: 'var(--destructive)', textAlign: 'center', marginTop: 16 }}>
            {error}
          </p>
        )}
      </HeroSection>

      <div className="mx-auto w-full max-w-[1400px] px-5 pb-16 lg:px-10">
        {/* 키워드 분석/확장 탭 로딩 */}
        {loading && isKeywordTab && (
          <div className="mb-5">
            <LoadingRow label={
              activeTab === 'analysis' ? '키워드 데이터를 분석 중입니다…' :
              '키워드를 확장 중입니다…'
            } />
          </div>
        )}
        {/* 블로그 재검색 로딩 (기존 결과 위에) */}
        {loading && activeTab === 'blog' && blogStructure && (
          <div className="mb-5">
            <LoadingRow label="상위 블로그 구조를 분석 중입니다…" />
          </div>
        )}

        {error && isKeywordTab && (
          <div className="mac-fade-in mac-card mb-5 px-5 py-4"
            style={{ fontSize: 13, color: 'var(--destructive)', border: '1px solid rgba(255,69,58,0.25)' }}>
            {error}
          </div>
        )}
        {error && activeTab === 'blog' && blogStructure && (
          <div className="mac-fade-in mac-card mb-5 px-5 py-4"
            style={{ fontSize: 13, color: 'var(--destructive)', border: '1px solid rgba(255,69,58,0.25)' }}>
            {error}
          </div>
        )}

        {/* Keyword results */}
        {isKeywordTab && activeResult && !loading && (
          <div className="mac-fade-in flex flex-col gap-5">
            {activeTab === 'analysis' && (
              <KeywordInsightPanel
                baseKeyword={activeResult.baseKeyword}
                keywordRow={
                  activeResult.keywords?.find(
                    (r) => r.keyword?.toLowerCase().replace(/\s+/g, '') ===
                           (activeResult.baseKeyword || '').toLowerCase().replace(/\s+/g, '')
                  ) || activeResult.keywords?.[0]
                }
                insights={insights}
                insightsLoading={insightsLoading}
                insightsError={insightsError}
                onViewDetail={handleViewDetail}
              />
            )}
            {activeTab === 'analysis' && (
              <SummaryCards summary={currentSummary} />
            )}

            <div className="mac-card overflow-hidden">
              <div style={{
                padding: '12px 16px 11px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  키워드 클러스터링
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 4,
                  background: 'var(--bg-overlay)', color: 'var(--text-tertiary)', border: '1px solid var(--border)',
                }}>연관 키워드</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                  {formatNumber(filteredRows.length)}개 키워드
                </span>
              </div>

              <div style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <KeywordFilters filters={filters} onChange={setFilters} />
                <div style={{ width: 1, height: 22, background: 'var(--border)', flexShrink: 0 }} />
                <QuickToggle label="낮은 연관도 제외" checked={filters.excludeLowRelevance}
                  onChange={(v) => updateFilter('excludeLowRelevance', v)} title="연관도 낮음 키워드를 숨깁니다." />
                <QuickToggle label="과포화 제외" checked={filters.excludeSaturated}
                  onChange={(v) => updateFilter('excludeSaturated', v)} title="과포화 주의 키워드를 숨깁니다." />
                <div style={{ width: 1, height: 22, background: 'var(--border)', flexShrink: 0 }} />
                <ColumnVisibilitySettings visibleColumns={visibleColumns} onChange={setVisibleColumns} onReset={resetVisibleColumns} />
                <div style={{ flex: 1, minWidth: 4 }} />
                <button className="mac-btn mac-btn-ghost mac-btn-sm" type="button" onClick={() => setFilters(defaultFilters)}>
                  초기화
                </button>
                <button className="mac-btn mac-btn-sm" onClick={downloadKeywordExcel} disabled={!filteredRows.length}>
                  <Download className="h-3.5 w-3.5" />
                  엑셀 다운로드
                </button>
              </div>
            </div>

            <KeywordTable rows={filteredRows} sortConfig={sortConfig} onSort={handleSort} visibleColumns={visibleColumns} />
          </div>
        )}

        {/* Blog structure results */}
        {activeTab === 'blog' && blogStructure && (
          <div className="mac-fade-in flex flex-col gap-5">
            <BlogStructurePanel result={blogStructure} keyword={blogStructureKeyword} />
          </div>
        )}
      </div>

      </> )} {/* end pricing conditional */}

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
      </div>
    </div>
  );
}