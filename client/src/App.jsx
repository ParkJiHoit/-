import { Download, Loader2, Moon, Sun, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';
import BlogStructurePanel from './components/BlogStructurePanel';
import BlogAuditPanel from './components/BlogAuditPanel';
import ColumnVisibilitySettings from './components/ColumnVisibilitySettings';
import KeywordFilters, { defaultFilters } from './components/KeywordFilters';
import KeywordInsightPanel from './components/KeywordInsightPanel';
import KeywordSearchForm from './components/KeywordSearchForm';
import KeywordTable, { DEFAULT_VISIBLE_COLUMN_KEYS } from './components/KeywordTable';
import KeywordCardList from './components/KeywordCardList';
import KeywordTableB from './components/KeywordTableB';
import KeywordCardListAB from './components/KeywordCardListAB';
import AuroraBackground from './components/AuroraBackground';
import Navbar from './components/Navbar';
import PricingPage from './components/PricingPage';
import LoginPromptModal from './components/LoginPromptModal';
import AuthPage from './pages/AuthPage';
import RankTrackerPage from './pages/RankTrackerPage';
import SummaryCards from './components/SummaryCards';
import { formatNumber, formatPercent, getDownloadFileName } from './utils/formatters';
import { sortKeywords } from './utils/tableSort';

const COLUMN_STORAGE_KEY   = 'naverKeywordDashboard.visibleColumns.v4';
const THEME_STORAGE_KEY    = 'keywordlab.theme';
const GUEST_COUNT_KEY      = 'ranklet.guestAnalysisCount';
const GUEST_MAX_KEYWORD    = 4;

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

/* ── Blog Audit Form ── */
const AUDIT_HISTORY_KEY = 'keywordlab.auditHistory';
const MAX_AUDIT_HISTORY = 6;

function getAuditHistory() {
  try { return JSON.parse(localStorage.getItem(AUDIT_HISTORY_KEY) || '[]'); }
  catch { return []; }
}

const AUDIT_PLACEHOLDERS = [
  'https://blog.naver.com/example',
  'https://blog.naver.com/mystore',
  'https://blog.naver.com/traveler',
];

function useTypingPlaceholder(items) {
  const [placeholder, setPlaceholder] = useState('');
  const idx = useRef(0);
  const charIdx = useRef(0);
  const deleting = useRef(false);
  useEffect(() => {
    let timer;
    const tick = () => {
      const current = items[idx.current];
      if (!deleting.current) {
        charIdx.current++;
        setPlaceholder(current.slice(0, charIdx.current));
        if (charIdx.current === current.length) { deleting.current = true; timer = setTimeout(tick, 1800); }
        else { timer = setTimeout(tick, 80); }
      } else {
        charIdx.current--;
        setPlaceholder(current.slice(0, charIdx.current));
        if (charIdx.current === 0) { deleting.current = false; idx.current = (idx.current + 1) % items.length; timer = setTimeout(tick, 400); }
        else { timer = setTimeout(tick, 40); }
      }
    };
    timer = setTimeout(tick, 800);
    return () => clearTimeout(timer);
  }, [items]);
  return placeholder;
}

function BlogAuditForm({ onSubmit, loading }) {
  const [url, setUrl] = useState('');
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState(() => getAuditHistory());
  const animatedPlaceholder = useTypingPlaceholder(AUDIT_PLACEHOLDERS);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...history.filter(u => u !== trimmed)].slice(0, MAX_AUDIT_HISTORY);
    setHistory(updated);
    localStorage.setItem(AUDIT_HISTORY_KEY, JSON.stringify(updated));
    onSubmit(trimmed);
  };

  const removeItem = (item, e) => {
    e.stopPropagation();
    const updated = history.filter(u => u !== item);
    setHistory(updated);
    localStorage.setItem(AUDIT_HISTORY_KEY, JSON.stringify(updated));
  };

  const clearAll = () => {
    setHistory([]);
    localStorage.removeItem(AUDIT_HISTORY_KEY);
  };

  return (
    <div style={{ width: '100%' }}>
      <form
        onSubmit={handleSubmit}
        style={{
          position: 'relative',
          borderRadius: 999,
          border: focused
            ? '1.5px solid rgba(10,180,255,0.85)'
            : '1.5px solid rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.10)',
          boxShadow: focused
            ? '0 0 0 3px rgba(10,180,255,0.18), 0 0 32px rgba(10,180,255,0.22), 0 0 80px rgba(10,180,255,0.08)'
            : '0 2px 20px rgba(0,0,0,0.4), 0 0 18px rgba(10,180,255,0.07), 0 0 48px rgba(10,180,255,0.04)',
          transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
          display: 'flex',
          alignItems: 'center',
          height: 64,
        }}
      >
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center',
          paddingLeft: 22, paddingRight: 18,
          borderRight: '1px solid rgba(255,255,255,0.10)',
          color: '#06C755', fontWeight: 700, fontSize: 13,
          letterSpacing: '-0.2px', whiteSpace: 'nowrap',
          cursor: 'default', userSelect: 'none',
        }}>
          NAVER
        </div>
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={focused || url ? '' : animatedPlaceholder}
          disabled={loading}
          style={{
            flex: 1, height: '100%',
            background: 'transparent', border: 'none', outline: 'none',
            paddingLeft: 18, paddingRight: 8,
            fontSize: 17, fontWeight: 400,
            color: 'var(--text-primary)', fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          style={{
            flexShrink: 0, marginRight: 10,
            width: 44, height: 44, borderRadius: 999, border: 'none',
            background: focused ? 'var(--accent)' : 'var(--search-btn-bg)',
            cursor: loading || !url.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, color 0.15s',
            color: focused ? '#fff' : 'var(--search-btn-icon)',
          }}
          onMouseEnter={(e) => { if (!focused) e.currentTarget.style.background = 'var(--search-btn-hover)'; }}
          onMouseLeave={(e) => { if (!focused) e.currentTarget.style.background = 'var(--search-btn-bg)'; }}
        >
          {loading
            ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
            : <Search style={{ width: 18, height: 18 }} />
          }
        </button>
      </form>

      {/* 최근 분석 블로그 */}
      {history.length > 0 && (
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                최근 분석 블로그
              </span>
            </div>
            <button
              onClick={clearAll}
              style={{
                fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                letterSpacing: '0.04em', transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              전체 삭제
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
            {history.map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex', alignItems: 'center', gap: 0,
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 999, overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
              >
                <button
                  type="button"
                  onClick={() => { setUrl(item); onSubmit(item); }}
                  disabled={loading}
                  style={{
                    padding: '7px 4px 7px 14px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 500,
                    color: 'var(--text-secondary)', fontFamily: 'inherit',
                    letterSpacing: '-0.2px', transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                  {item.replace('https://blog.naver.com/', '')}
                </button>
                <button
                  type="button"
                  onClick={(e) => removeItem(item, e)}
                  style={{
                    padding: '7px 10px 7px 6px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                    color: 'var(--text-tertiary)', transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Hero / compact wrapper ── */
function HeroSection({ tab, blogSubTab, hasResults, children }) {
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
              {tab === 'blog' && blogSubTab === 'structure' && 'Blog Structure Analysis'}
              {tab === 'blog' && blogSubTab === 'audit'     && 'Blog Audit'}
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
              {tab === 'blog' && blogSubTab === 'structure' && (
                <>
                  상위 블로그는 어떻게
                  <br />
                  <span style={{
                    background: 'linear-gradient(120deg, #30D158 0%, #0A84FF 55%, #34C1FF 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  }}>구성되어 있을까요</span>
                </>
              )}
              {tab === 'blog' && blogSubTab === 'audit' && (
                <>
                  배포를 맡겨도 될
                  <br />
                  <span style={{
                    background: 'linear-gradient(120deg, #0A84FF 0%, #BF5AF2 55%, #34C1FF 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  }}>블로그인지 확인하세요</span>
                </>
              )}
            </h1>
            <p style={{ fontSize: 15, fontWeight: 400, color: 'var(--text-secondary)', marginTop: 10 }}>
              {tab === 'analysis' && '키워드를 분석하고, 가능성을 실험하는 공간'}
              {tab === 'blog' && blogSubTab === 'structure' && '상위 1~10위 블로그 구조를 분석하고 콘텐츠 전략을 세우세요'}
              {tab === 'blog' && blogSubTab === 'audit'     && '노출 가능성과 상위 노출 이력을 기반으로 블로그 적합성을 분석합니다'}
            </p>
          </div>
        )}
        {children}
      </section>
    </div>
  );
}

/* ── Section label ── */
function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
      <span style={{
        fontSize: 13, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase',
        color: 'var(--accent)', whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 2, borderRadius: 1, background: 'linear-gradient(to right, rgba(10,132,255,0.35), transparent)' }} />
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
  const { user, session } = useAuth();
  const [theme, setTheme] = useState(() =>
    window.localStorage.getItem(THEME_STORAGE_KEY) || 'dark'
  );
  const [activeTab, setActiveTab]       = useState('analysis');
  const [analysis,  setAnalysis]        = useState(null);
  const [blogStructure, setBlogStructure] = useState(null);
  const [blogStructureKeyword, setBlogStructureKeyword] = useState('');
  const [blogSubTab, setBlogSubTab] = useState('structure'); // 'structure' | 'audit'
  const [blogAudit, setBlogAudit] = useState(null);
  const [blogAuditLoading, setBlogAuditLoading] = useState(false);
  const [blogAuditError, setBlogAuditError] = useState('');
  const [insights, setInsights]         = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError]     = useState(null);
  const [filters,  setFilters]          = useState(defaultFilters);
  const [sortConfig, setSortConfig]     = useState({ key: 'efficiencyScore', direction: 'desc' });
  const [visibleColumns, setVisibleColumns] = useState(getInitialVisibleColumns);
  const [loading, setLoading]           = useState(false);
  const [error,   setError]             = useState('');
  const [toast,   setToast]             = useState('');
  const [loginPrompt, setLoginPrompt]   = useState(null); // null | 'keyword' | 'blog'
  const [limitExceeded, setLimitExceeded] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false); // false | true | 'admin'
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const toastRef = useRef(null);

  useEffect(() => {
    if (!session?.access_token) { setIsSubscribed(false); return; }
    fetch('/api/billing/status', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.json())
      .then(d => setIsSubscribed(d.status === 'admin' ? 'admin' : !!d.isSubscribed))
      .catch(() => setIsSubscribed(false));
  }, [session?.access_token]);

  // 결제 완료 후 리다이렉트 감지 + 구독 상태 폴링
  useEffect(() => {
    if (!window.location.pathname.includes('payment-success')) return;
    setPaymentSuccess(true);
    window.history.replaceState({}, '', '/');
    if (!session?.access_token) return;
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      fetch('/api/billing/status', { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(r => r.json())
        .then(d => {
          if (d.isSubscribed) {
            setIsSubscribed(true);
            clearInterval(poll);
          }
        })
        .catch(() => {});
      if (attempts >= 10) clearInterval(poll); // 최대 20초
    }, 2000);
    return () => clearInterval(poll);
  }, [session?.access_token]);

  // 비로그인 키워드 분석 횟수
  const guestCount = () => parseInt(localStorage.getItem(GUEST_COUNT_KEY) || '0', 10);
  const incGuestCount = () => localStorage.setItem(GUEST_COUNT_KEY, guestCount() + 1);

  const isKeywordTab  = activeTab === 'analysis';
  const activeResult  = analysis;
  const activeRows    = activeResult?.keywords || [];
  const hasResults    = (isKeywordTab && !!activeResult) ||
    (activeTab === 'blog' && (!!blogStructure || !!blogAudit)) ||
    activeTab === 'rank-tracker';

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
    setLoading(true); setError(''); setLimitExceeded(false);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res  = await fetch(endpoint, { method:'POST', headers, body: JSON.stringify(payload) });
      const data = await parseApiResponse(res);
      if (res.status === 429) {
        setLimitExceeded(true);
        setError(data.message || failMsg);
        return null;
      }
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

  const saveSearchHistory = useCallback(async (type, keyword) => {
    if (!user) return;
    await supabase.from('search_history').insert({ user_id: user.id, type, keyword });
  }, [user]);

  const analyzeKeyword = async (keyword) => {
    // 비로그인: 4회 초과 시 차단
    if (!user) {
      if (guestCount() >= GUEST_MAX_KEYWORD) {
        setLoginPrompt('keyword');
        return;
      }
      incGuestCount();
    }
    fetchInsights(keyword);
    const data = await requestKeywords('/api/keywords/analyze', { keyword },
      '키워드 데이터를 조회하지 못했습니다.', { key: 'efficiencyScore', direction: 'desc' });
    if (data) {
      setAnalysis(data);
      saveSearchHistory('keyword', keyword);
    }
  };

  const analyzeBlogStructure = async (keyword) => {
    if (!keyword) return;
    // 비로그인 완전 차단
    if (!user) {
      setLoginPrompt('blog');
      return;
    }
    setBlogStructureKeyword(keyword);
    setLoading(true); setError(''); setLimitExceeded(false);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res  = await fetch('/api/blog/structure-analysis', { method: 'POST', headers, body: JSON.stringify({ keyword }) });
      const data = await parseApiResponse(res);
      if (res.status === 429) { setLimitExceeded(true); setError(data.message || '블로그 구조 분석에 실패했습니다.'); return; }
      if (!res.ok) throw new Error(data.message || '블로그 구조 분석에 실패했습니다.');
      setBlogStructure(data);
      saveSearchHistory('blog', keyword);
    } catch (e) {
      setError(e.message || '블로그 구조 분석에 실패했습니다.');
    } finally { setLoading(false); }
  };

  const auditBlog = async (url) => {
    if (!user) { setLoginPrompt('blog'); return; }
    setBlogAudit(null);
    setBlogAuditError('');
    setBlogAuditLoading(true);
    setLimitExceeded(false);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res  = await fetch('/api/blog/audit', { method: 'POST', headers, body: JSON.stringify({ url }) });
      const data = await parseApiResponse(res);
      if (res.status === 429) { setLimitExceeded(true); setBlogAuditError(data.message || '블로그 진단에 실패했습니다.'); return; }
      if (!res.ok) throw new Error(data.message || '블로그 진단에 실패했습니다.');
      setBlogAudit(data);
    } catch (e) {
      setBlogAuditError(e.message || '블로그 진단에 실패했습니다.');
    } finally { setBlogAuditLoading(false); }
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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '키워드 분석');
    XLSX.writeFile(wb, getDownloadFileName());
  };

  const switchTab = (next) => {
    setActiveTab(next); setError(''); setFilters(defaultFilters);
    setInsights(null); setInsightsLoading(false); setInsightsError(null);
    if (next === 'analysis') setSortConfig({ key: 'efficiencyScore', direction: 'desc' });
    if (next === 'blog') { setBlogStructure(null); setBlogStructureKeyword(''); setBlogAudit(null); setBlogAuditError(''); }
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
      setInsights(null);
      setInsightsLoading(false);
      setInsightsError(null);
      setSortConfig({ key: 'efficiencyScore', direction: 'desc' });
    } else if (id === 'blog') {
      setActiveTab('blog');
      setBlogStructure(null);
      setBlogStructureKeyword('');
    } else if (id === 'rank-tracker') {
      setActiveTab('rank-tracker');
    }
  };

  const handleMockAction = () => showToast('준비 중인 기능입니다 — 곧 만나보실 수 있어요!');

  /* ── Render ── */
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', position: 'relative' }}>
      {loginPrompt && (
        <LoginPromptModal
          reason={loginPrompt}
          onClose={() => setLoginPrompt(null)}
          onGoToAuth={() => { setLoginPrompt(null); switchTab('auth'); }}
        />
      )}

      {paymentSuccess && (
        <div onClick={() => setPaymentSuccess(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 3000, padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: theme !== 'light' ? '#1C1C1E' : '#FFFFFF',
            borderRadius: 20, padding: '36px 32px', maxWidth: 400, width: '100%',
            textAlign: 'center',
            border: theme !== 'light' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
              프리미엄 시작!
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {isSubscribed
                ? '구독이 활성화됐어요. 모든 기능을 자유롭게 사용해보세요.'
                : '결제가 확인되는 중이에요. 잠시 후 자동으로 활성화됩니다.'}
            </p>
            {!isSubscribed && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF9F0A', animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>구독 상태 확인 중...</span>
              </div>
            )}
            <button
              onClick={() => setPaymentSuccess(false)}
              style={{
                width: '100%', padding: '12px 0',
                background: 'linear-gradient(135deg,#0A84FF,#34C1FF)',
                border: 'none', borderRadius: 12,
                fontSize: 14, fontWeight: 700, color: '#fff',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              시작하기
            </button>
          </div>
        </div>
      )}
      <AuroraBackground theme={theme} hidden={hasResults} loading={loading || blogAuditLoading} />
      {/* 결과 페이지 배경 */}
      {hasResults && (
        <>
          {/* dot grid */}
          <div style={{
            position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(circle, rgba(10,132,255,0.18) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 100% 70% at 50% 0%, black 0%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 100% 70% at 50% 0%, black 0%, transparent 100%)',
          }} />
          {/* 상단 haze */}
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 320, zIndex: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 80% 100% at 50% -10%, rgba(10,132,255,0.08) 0%, transparent 100%)',
          }} />
          {/* 브랜드 시그니처 라인 */}
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 2000, pointerEvents: 'none',
            background: 'linear-gradient(90deg, transparent 0%, #0A84FF 25%, #34C1FF 55%, #0A84FF 80%, transparent 100%)',
            opacity: 0.9,
          }} />
        </>
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
      <Navbar activeTab={activeTab} onSwitchTab={switchTab} onGoHome={goHome} onGoToService={goToService} theme={theme} isSubscribed={isSubscribed} />
      <ThemeToggle theme={theme} onToggle={toggleTheme} />

      {/* Auth 모달 오버레이 */}
      {activeTab === 'auth' && (
        <AuthPage onSuccess={() => switchTab('analysis')} onClose={() => switchTab('analysis')} theme={theme} />
      )}

      {activeTab === 'pricing' ? (
        <PricingPage onGoToAuth={() => setActiveTab('auth')} user={user} token={session?.access_token} theme={theme} isSubscribed={isSubscribed} />
      ) : activeTab === 'rank-tracker' ? (
        <div style={{ paddingTop: 'calc(var(--nav-offset) + 24px)', paddingBottom: 64 }}>
          <div className="mx-auto w-full max-w-[1400px] px-5 lg:px-10">
            <RankTrackerPage onLoginRequest={() => switchTab('auth')} onGoPricing={() => switchTab('pricing')} />
          </div>
        </div>
      ) : (
      <>

      <HeroSection tab={activeTab} blogSubTab={blogSubTab} hasResults={hasResults}>
        {activeTab === 'analysis' && (
          <KeywordSearchForm onSubmit={analyzeKeyword} loading={loading}
            suggestions={analysis?.searchSuggestions || []}
            isMain={!hasResults} />
        )}
        {activeTab === 'blog' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 서브탭 스위처 */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
              <div style={{
                display: 'inline-flex',
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border)',
                borderRadius: 999,
                padding: 3,
                gap: 2,
              }}>
                {[{ id: 'structure', label: '블로그 구조 분석' }, { id: 'audit', label: '블로그 진단' }].map(({ id, label }) => {
                  const isActive = blogSubTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => { setBlogSubTab(id); setError(''); setBlogAuditError(''); }}
                      style={{
                        padding: '8px 20px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 13, fontWeight: isActive ? 700 : 500,
                        borderRadius: 999,
                        background: isActive ? 'var(--accent)' : 'transparent',
                        color: isActive ? '#fff' : 'var(--text-secondary)',
                        transition: 'background 0.2s, color 0.2s',
                        letterSpacing: '-0.1px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* 구조 분석 폼 */}
            {blogSubTab === 'structure' && (
              <KeywordSearchForm onSubmit={analyzeBlogStructure} loading={loading} isMain={!hasResults} historyKey="keywordlab.blogHistory" />
            )}
            {/* 감사 폼 */}
            {blogSubTab === 'audit' && (
              <BlogAuditForm onSubmit={auditBlog} loading={blogAuditLoading} />
            )}
          </div>
        )}
        {/* 에러 */}
        {activeTab === 'blog' && blogSubTab === 'structure' && !blogStructure && error && (
          <p className="mac-fade-in" style={{ fontSize: 13, color: 'var(--destructive)', textAlign: 'center', marginTop: 16 }}>
            {error}
          </p>
        )}
        {activeTab === 'blog' && blogSubTab === 'audit' && !blogAudit && blogAuditError && (
          <div className="mac-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 13, color: limitExceeded ? '#FF9F0A' : 'var(--destructive)', margin: 0 }}>{blogAuditError}</p>
            {limitExceeded && !isSubscribed && (
              <button onClick={() => switchTab('pricing')} style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#0A84FF,#34C1FF)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                프리미엄 업그레이드
              </button>
            )}
          </div>
        )}
      </HeroSection>

      <div className="mx-auto w-full max-w-[1400px] px-5 pb-16 lg:px-10">
        {/* 키워드 분석/확장 탭 재검색 로딩 (결과 있을 때만) */}
        {loading && isKeywordTab && activeResult && (
          <div className="mb-5">
            <LoadingRow label="키워드 데이터를 분석 중입니다…" />
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
            style={{ border: limitExceeded ? '1px solid rgba(255,159,10,0.35)' : '1px solid rgba(255,69,58,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: limitExceeded ? '#FF9F0A' : 'var(--destructive)' }}>{error}</span>
            {limitExceeded && !isSubscribed && (
              <button onClick={() => switchTab('pricing')} style={{ flexShrink: 0, padding: '6px 14px', background: 'linear-gradient(135deg,#0A84FF,#34C1FF)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                프리미엄 업그레이드
              </button>
            )}
          </div>
        )}
        {error && activeTab === 'blog' && blogStructure && (
          <div className="mac-fade-in mac-card mb-5 px-5 py-4"
            style={{ border: limitExceeded ? '1px solid rgba(255,159,10,0.35)' : '1px solid rgba(255,69,58,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: limitExceeded ? '#FF9F0A' : 'var(--destructive)' }}>{error}</span>
            {limitExceeded && !isSubscribed && (
              <button onClick={() => switchTab('pricing')} style={{ flexShrink: 0, padding: '6px 14px', background: 'linear-gradient(135deg,#0A84FF,#34C1FF)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                프리미엄 업그레이드
              </button>
            )}
          </div>
        )}

        {/* Keyword results */}
        {isKeywordTab && activeResult && !loading && (
          <div className="mac-fade-in flex flex-col" style={{ gap: 48 }}>
            {activeTab === 'analysis' && (
              <section>
                <SectionLabel>키워드 인사이트</SectionLabel>
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
                  isLoggedIn={!!user}
                  onLoginPrompt={() => setLoginPrompt('keyword')}
                />
              </section>
            )}
            {activeTab === 'analysis' && (
              <section>
                <SectionLabel>키워드 요약</SectionLabel>
                <SummaryCards summary={currentSummary} />
              </section>
            )}

            <section>
              <SectionLabel>키워드 클러스터링</SectionLabel>
              <div className="mac-card overflow-hidden">
                <div style={{
                  padding: '13px 18px 12px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    연관 키워드
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {formatNumber(filteredRows.length)}개
                  </span>
                </div>
                <div style={{ padding: '12px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
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
              <div style={{ marginTop: 12 }}>
                <KeywordTableB rows={filteredRows} sortConfig={sortConfig} onSort={handleSort} visibleColumns={visibleColumns} isLoggedIn={!!user} onLoginPrompt={() => setLoginPrompt('keyword')} />
              </div>
            </section>
          </div>
        )}

        {/* Blog audit results */}
        {activeTab === 'blog' && blogSubTab === 'audit' && blogAudit && !blogAuditLoading && (
          <div className="mac-fade-in flex flex-col" style={{ gap: 48 }}>
            <section>
              <SectionLabel>블로그 진단 결과</SectionLabel>
              <BlogAuditPanel result={blogAudit} />
            </section>
          </div>
        )}
        {activeTab === 'blog' && blogSubTab === 'audit' && blogAuditError && blogAudit && (
          <div className="mac-fade-in mac-card mb-5 px-5 py-4"
            style={{ fontSize: 13, color: 'var(--destructive)', border: '1px solid rgba(255,69,58,0.25)' }}>
            {blogAuditError}
          </div>
        )}

        {/* Blog structure results */}
        {activeTab === 'blog' && blogSubTab === 'structure' && blogStructure && (
          <div className="mac-fade-in flex flex-col" style={{ gap: 48 }}>
            <section>
              <SectionLabel>블로그 구조 분석</SectionLabel>
              <BlogStructurePanel result={blogStructure} keyword={blogStructureKeyword} />
            </section>
          </div>
        )}
      </div>

      </> )} {/* end pricing conditional */}

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
      </div>
    </div>
  );
}