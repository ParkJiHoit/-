import { Clock, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const HISTORY_KEY = 'keywordlab.searchHistory';
const MAX_HISTORY = 8;

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

export default function KeywordSearchForm({ onSubmit, loading, suggestions = [], isMain = false }) {
  const [keyword, setKeyword] = useState('');
  const [focused, setFocused] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [history, setHistory] = useState(() => getHistory());
  const inputRef = useRef(null);

  // ⌘ + / 단축키로 포커스
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const submitKeyword = (next = keyword) => {
    const trimmed = next.trim();
    if (!trimmed) { setValidationMessage('분석할 키워드를 입력해 주세요.'); return; }
    setValidationMessage('');
    setKeyword(trimmed);
    const updated = [trimmed, ...history.filter((k) => k !== trimmed)].slice(0, MAX_HISTORY);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    onSubmit(trimmed);
  };

  const removeItem = (kw, e) => {
    e.stopPropagation();
    const updated = history.filter((k) => k !== kw);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const clearAll = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  const showHistory = isMain && history.length > 0 && suggestions.length === 0;
  const showSuggestions = suggestions.length > 0;

  return (
    <div style={{ width: '100%' }}>
      {/* ── Search bar ── */}
      <form
        onSubmit={(e) => { e.preventDefault(); submitKeyword(); }}
        style={{
          position: 'relative',
          borderRadius: 999,
          border: focused
            ? '1.5px solid rgba(255,255,255,0.28)'
            : '1.5px solid rgba(255,255,255,0.10)',
          background: focused
            ? 'rgba(255,255,255,0.10)'
            : 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: focused
            ? '0 0 0 4px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.3)'
            : '0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          height: 64,
        }}
      >
        {/* 왼쪽 검색 아이콘 */}
        <Search
          style={{
            flexShrink: 0,
            marginLeft: 22,
            width: 20, height: 20,
            color: focused ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)',
            transition: 'color 0.2s ease',
          }}
        />

        {/* Input */}
        <input
          ref={inputRef}
          style={{
            flex: 1, height: '100%',
            background: 'transparent', border: 'none', outline: 'none',
            paddingLeft: 14, paddingRight: 12,
            fontSize: 17, fontWeight: 400,
            color: 'var(--text-primary)', fontFamily: 'inherit',
            letterSpacing: '-0.2px',
          }}
          placeholder="분석할 키워드를 입력하세요"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={loading}
        />

        {/* 오른쪽: 단축키 힌트 */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 4,
            marginRight: 18,
            padding: '4px 10px',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.10)',
            opacity: focused ? 0 : 0.8,
            transition: 'opacity 0.2s ease',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'inherit', letterSpacing: '0.02em' }}>
            ⌘
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>+</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'inherit' }}>/</span>
        </div>

        {/* 오른쪽: 제출 버튼 (숨겨진 기능용) */}
        <button type="submit" disabled={loading} style={{ display: 'none' }} />
      </form>

      {/* NAVER 플랫폼 표시 */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 5, marginTop: 12,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 10px',
          borderRadius: 999,
          background: 'rgba(6,199,85,0.10)',
          border: '1px solid rgba(6,199,85,0.20)',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#06C755',
            boxShadow: '0 0 6px rgba(6,199,85,0.8)',
          }} />
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            color: '#06C755', textTransform: 'uppercase',
          }}>
            NAVER
          </span>
        </div>
      </div>

      {validationMessage && (
        <p style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 10, textAlign: 'center' }}>
          {validationMessage}
        </p>
      )}

      {/* ── 최근 검색어 ── */}
      {showHistory && (
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock style={{ width: 11, height: 11, color: 'var(--text-tertiary)' }} />
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
              }}>
                최근 검색어
              </span>
            </div>
            <button
              onClick={clearAll}
              style={{
                fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                letterSpacing: '0.04em', transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              전체 삭제
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
            {history.map((kw) => (
              <div
                key={kw}
                style={{
                  display: 'flex', alignItems: 'center', gap: 0,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 999, overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
              >
                <button
                  type="button"
                  onClick={() => submitKeyword(kw)}
                  disabled={loading}
                  style={{
                    padding: '7px 4px 7px 14px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 500,
                    color: 'var(--text-secondary)', fontFamily: 'inherit',
                    letterSpacing: '-0.2px', transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                  {kw}
                </button>
                <button
                  type="button"
                  onClick={(e) => removeItem(kw, e)}
                  style={{
                    padding: '7px 10px 7px 6px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                    color: 'var(--text-tertiary)', transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <X style={{ width: 10, height: 10 }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 관련 추천 검색어 ── */}
      {showSuggestions && (
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--text-tertiary)', margin: 0,
          }}>
            관련 추천 검색어
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {suggestions.map((s) => (
              <button
                key={s.keyword}
                type="button"
                onClick={() => submitKeyword(s.keyword)}
                disabled={loading}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 999, padding: '7px 16px',
                  fontSize: 13, fontWeight: 500,
                  color: 'var(--text-secondary)', cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(10,180,255,0.12)';
                  e.currentTarget.style.borderColor = 'rgba(10,180,255,0.4)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                title={`연관도 ${s.relevanceLevel} · ${s.relevanceScore}점`}
              >
                #{s.keyword}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
