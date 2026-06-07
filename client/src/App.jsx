import { Download, Loader2, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import ColumnVisibilitySettings from './components/ColumnVisibilitySettings';
import KeywordExpansionForm from './components/KeywordExpansionForm';
import KeywordFilters, { defaultFilters } from './components/KeywordFilters';
import KeywordSearchForm from './components/KeywordSearchForm';
import KeywordTable, { DEFAULT_VISIBLE_COLUMN_KEYS } from './components/KeywordTable';
import SummaryCards from './components/SummaryCards';
import { formatPercent, getDownloadFileName } from './utils/formatters';
import { sortKeywords } from './utils/tableSort';

const COLUMN_STORAGE_KEY = 'naverKeywordDashboard.visibleColumns.v2';

function getInitialVisibleColumns() {
  try {
    const savedColumns = window.localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!savedColumns) return { ...DEFAULT_VISIBLE_COLUMN_KEYS };

    return {
      ...DEFAULT_VISIBLE_COLUMN_KEYS,
      ...JSON.parse(savedColumns),
      keyword: true
    };
  } catch {
    return { ...DEFAULT_VISIBLE_COLUMN_KEYS };
  }
}

async function parseApiResponse(response) {
  const rawBody = await response.text();
  const isJson = response.headers.get('content-type')?.includes('application/json');

  if (!rawBody) return {};
  if (!isJson) return { message: rawBody };

  try {
    return JSON.parse(rawBody);
  } catch {
    return { message: rawBody };
  }
}

function buildSummary(rows) {
  const totalKeywords = rows.length;
  const efficiencySum = rows.reduce((sum, row) => sum + row.efficiencyScore, 0);
  const saturationSum = rows.reduce((sum, row) => sum + row.saturationScore, 0);

  return {
    totalKeywords,
    priorityCount: rows.filter((row) => row.recommendAction === '우선 테스트').length,
    opportunityCount: rows.filter((row) => row.recommendAction === '기회 키워드').length,
    saturatedCount: rows.filter((row) => row.recommendAction === '과포화 주의').length,
    avgEfficiencyScore: totalKeywords ? Math.round(efficiencySum / totalKeywords) : 0,
    avgSaturationScore: totalKeywords ? Math.round(saturationSum / totalKeywords) : 0
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('analysis');
  const [analysis, setAnalysis] = useState(null);
  const [expansion, setExpansion] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [sortConfig, setSortConfig] = useState({ key: 'relevanceScore', direction: 'desc' });
  const [visibleColumns, setVisibleColumns] = useState(getInitialVisibleColumns);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeResult = activeTab === 'analysis' ? analysis : expansion;
  const activeRows = activeResult?.keywords || [];

  useEffect(() => {
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const updateFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
  };

  const filteredRows = useMemo(() => {
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
      if (
        filters.keywordText &&
        !row.keyword.toLowerCase().includes(filters.keywordText.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    return sortKeywords(filtered, sortConfig);
  }, [activeRows, filters, sortConfig]);

  const currentSummary = useMemo(() => buildSummary(filteredRows), [filteredRows]);

  const requestKeywords = async (endpoint, payload, failureMessage) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data.message || failureMessage);
      }

      if (!data.keywords) {
        throw new Error(data.message || '키워드 응답 형식이 올바르지 않습니다.');
      }

      setFilters(defaultFilters);
      setSortConfig({ key: 'relevanceScore', direction: 'desc' });
      return data;
    } catch (requestError) {
      setError(requestError.message || failureMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const analyzeKeyword = async (keyword) => {
    const data = await requestKeywords(
      '/api/keywords/analyze',
      { keyword },
      '키워드 데이터를 조회하지 못했습니다.'
    );

    if (data) setAnalysis(data);
  };

  const expandKeyword = async (payload) => {
    const data = await requestKeywords(
      '/api/keywords/expand',
      payload,
      '키워드 확장 데이터를 조회하지 못했습니다.'
    );

    if (data) setExpansion(data);
  };

  const handleSort = (key) => {
    setSortConfig((previous) => ({
      key,
      direction: previous.key === key && previous.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const resetVisibleColumns = () => {
    setVisibleColumns({ ...DEFAULT_VISIBLE_COLUMN_KEYS });
  };

  const downloadExcel = () => {
    const exportRows = filteredRows.map((row) => ({
      키워드: row.keyword,
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

  return (
    <main className="min-h-screen bg-[#eef2f7]">
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-6 px-5 py-8 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-300 pb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                Naver Search Ads Keyword Ops
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                네이버 키워드 추천 대시보드
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">
                검색광고 운영을 위한 키워드 검색량, 경쟁도, 포화도, 효율 점수 분석
              </p>
            </div>
            {activeResult?.baseKeyword && (
              <div className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                {activeTab === 'analysis' ? '기준 키워드' : '시드 키워드'}
                <span className="ml-2 text-slate-950">
                  {activeTab === 'analysis'
                    ? activeResult.baseKeyword
                    : activeResult.seedKeywords?.join(', ') || activeResult.baseKeyword}
                </span>
              </div>
            )}
          </div>

          <nav className="flex flex-wrap gap-2">
            <TabButton
              active={activeTab === 'analysis'}
              icon={Search}
              label="키워드 분석"
              onClick={() => {
                setActiveTab('analysis');
                setError('');
                setFilters(defaultFilters);
              }}
            />
            <TabButton
              active={activeTab === 'expansion'}
              icon={Sparkles}
              label="키워드 확장"
              onClick={() => {
                setActiveTab('expansion');
                setError('');
                setFilters(defaultFilters);
              }}
            />
          </nav>
        </header>

        {activeTab === 'analysis' ? (
          <KeywordSearchForm
            onSubmit={analyzeKeyword}
            loading={loading}
            suggestions={analysis?.searchSuggestions || []}
          />
        ) : (
          <KeywordExpansionForm onSubmit={expandKeyword} loading={loading} />
        )}

        {loading && (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-5 text-sm font-bold text-slate-700 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-slate-950" />
            {activeTab === 'analysis' ? '키워드 데이터를 분석 중입니다.' : '키워드를 확장 중입니다.'}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

        {activeResult && !loading && (
          <>
            {activeTab === 'analysis' && (
              <>
                <SummaryCards summary={currentSummary} />
                <KeywordFilters
                  filters={filters}
                  onChange={setFilters}
                  onReset={() => setFilters(defaultFilters)}
                />
              </>
            )}
            <ColumnVisibilitySettings
              visibleColumns={visibleColumns}
              onChange={setVisibleColumns}
              onReset={resetVisibleColumns}
            />
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  {activeTab === 'analysis' ? '키워드 분석 테이블' : '키워드 확장 테이블'}
                </h2>
                <p className="text-sm font-medium text-slate-500">
                  현재 필터 기준 {filteredRows.length}개 키워드 표시
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <QuickToggle
                  label="낮은 연관도 제외"
                  checked={filters.excludeLowRelevance}
                  onChange={(checked) => updateFilter('excludeLowRelevance', checked)}
                  title="검색 키워드와 연관도 등급이 낮음인 키워드를 테이블에서 숨깁니다."
                />
                <QuickToggle
                  label="과포화 키워드 제외"
                  checked={filters.excludeSaturated}
                  onChange={(checked) => updateFilter('excludeSaturated', checked)}
                  title="추천 액션이 과포화 주의인 키워드를 테이블에서 숨깁니다."
                />
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  type="button"
                  onClick={downloadExcel}
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
          </>
        )}
      </div>
    </main>
  );
}

function TabButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      className={`inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-black transition ${
        active
          ? 'border-slate-950 bg-slate-950 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
      }`}
      type="button"
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function QuickToggle({ label, checked, onChange, title }) {
  return (
    <label
      className={`flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-black transition ${
        checked
          ? 'border-slate-900 bg-slate-950 text-white'
          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
      }`}
      title={title}
    >
      <input
        className="h-4 w-4 accent-emerald-500"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
