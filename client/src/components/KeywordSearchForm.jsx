import { ChevronDown, Clock, Search, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

const KEYWORD_PLACEHOLDERS = ['분석할 키워드를 입력하세요'];
const BLOG_PLACEHOLDERS = ['분석할 키워드를 입력하세요'];

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
        if (charIdx.current === current.length) {
          deleting.current = true;
          timer = setTimeout(tick, 1800);
        } else {
          timer = setTimeout(tick, 80);
        }
      } else {
        charIdx.current--;
        setPlaceholder(current.slice(0, charIdx.current));
        if (charIdx.current === 0) {
          deleting.current = false;
          idx.current = (idx.current + 1) % items.length;
          timer = setTimeout(tick, 400);
        } else {
          timer = setTimeout(tick, 40);
        }
      }
    };
    timer = setTimeout(tick, 800);
    return () => clearTimeout(timer);
  }, [items]);

  return placeholder;
}

const MAX_HISTORY = 8;

function getHistory(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = raw.filter(k => !k.startsWith('http'));
    if (filtered.length !== raw.length) localStorage.setItem(key, JSON.stringify(filtered));
    return filtered;
  }
  catch { return []; }
}

export default function KeywordSearchForm({ onSubmit, loading, suggestions = [], isMain = false, historyKey = 'keywordlab.searchHistory', dark = true }) {
  const [keyword, setKeyword] = useState('');
  const [focused, setFocused] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [history, setHistory] = useState(() => getHistory(historyKey));
  const placeholders = historyKey === 'keywordlab.blogHistory' ? BLOG_PLACEHOLDERS : KEYWORD_PLACEHOLDERS;
  const animatedPlaceholder = useTypingPlaceholder(placeholders);

  const submitKeyword = (next = keyword) => {
    const trimmed = next.trim();
    if (!trimmed) { setValidationMessage('분석할 키워드를 입력해 주세요.'); return; }
    setValidationMessage('');
    setKeyword(trimmed);
    const updated = [trimmed, ...history.filter((k) => k !== trimmed)].slice(0, MAX_HISTORY);
    setHistory(updated);
    localStorage.setItem(historyKey, JSON.stringify(updated));
    onSubmit(trimmed);
  };

  const removeItem = (kw, e) => {
    e.stopPropagation();
    const updated = history.filter((k) => k !== kw);
    setHistory(updated);
    localStorage.setItem(historyKey, JSON.stringify(updated));
  };

  const clearAll = () => {
    setHistory([]);
    localStorage.removeItem(historyKey);
  };

  const showHistory  = isMain && history.length > 0 && suggestions.length === 0;
  const showSuggestions = suggestions.length > 0;

  return (
    <div style={{ width: '100%' }}>
      {/* ── Search pill ── */}
      <form
        onSubmit={(e) => { e.preventDefault(); submitKeyword(); }}
        style={{
          position: 'relative',
          borderRadius: 999,
          border: focused
            ? '1.5px solid rgba(10,180,255,0.85)'
            : '1.5px solid rgba(255,255,255,0.14)',
          // 라이트 배경에서는 흰색 유리 패널이 자연스럽지만, 다크 배경에서 같은 흰색을
          // 쓰면 톤이 붕 떠 보여서 짙은 색 유리로 바꾼다.
          background: dark ? 'rgba(28,28,30,0.55)' : 'rgba(255,255,255,0.4)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: focused
            ? '0 0 0 3px rgba(10,180,255,0.18), 0 0 32px rgba(10,180,255,0.22), 0 0 80px rgba(10,180,255,0.08)'
            : '0 2px 20px rgba(0,0,0,0.4), 0 0 18px rgba(10,180,255,0.07), 0 0 48px rgba(10,180,255,0.04)',
          transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
          display: 'flex',
          alignItems: 'center',
          height: 64
        }}
      >
        {/* Platform badge */}
        <div
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
            paddingLeft: 22, paddingRight: 18,
            borderRight: '1px solid rgba(255,255,255,0.10)',
            color: '#06C755', fontWeight: 700, fontSize: 13,
            letterSpacing: '-0.2px', whiteSpace: 'nowrap',
            cursor: 'default', userSelect: 'none'
          }}
        >
          NAVER
          <ChevronDown style={{ width: 12, height: 12, opacity: 0.6 }} />
        </div>

        {/* Input */}
        <input
          style={{
            flex: 1, height: '100%',
            background: 'transparent', border: 'none', outline: 'none',
            paddingLeft: 18, paddingRight: 8,
            fontSize: 17, fontWeight: 400,
            color: 'var(--text-primary)', fontFamily: 'inherit'
          }}
          placeholder={focused || keyword ? '' : animatedPlaceholder}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={loading}
        />

        {/* Search icon button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            flexShrink: 0, marginRight: 10,
            width: 44, height: 44, borderRadius: 999, border: 'none',
            background: focused ? 'var(--accent)' : 'var(--search-btn-bg)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, color 0.15s',
            color: focused ? '#fff' : 'var(--search-btn-icon)',
          }}
          onMouseEnter={(e) => { if (!focused) e.currentTarget.style.background = 'var(--search-btn-hover)'; }}
          onMouseLeave={(e) => { if (!focused) e.currentTarget.style.background = 'var(--search-btn-bg)'; }}
        >
          <Search style={{ width: 18, height: 18 }} />
        </button>
      </form>

      {validationMessage && (
        <p style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 10, textAlign: 'center' }}>
          {validationMessage}
        </p>
      )}

      {/* ── Recent search history ── */}
      {showHistory && (
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock style={{ width: 13, height: 13, color: 'var(--text-secondary)' }} />
              <span style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--text-secondary)'
              }}>
                최근 검색어
              </span>
            </div>
            <button
              onClick={clearAll}
              style={{
                fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                letterSpacing: '0.04em',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              전체 삭제
            </button>
          </div>

          {/* Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
            {history.map((kw) => (
              <div
                key={kw}
                style={{
                  display: 'flex', alignItems: 'center', gap: 0,
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 999,
                  overflow: 'hidden',
                  transition: 'border-color 0.15s',
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
              >
                <button
                  type="button"
                  onClick={() => submitKeyword(kw)}
                  disabled={loading}
                  style={{
                    padding: '7px 4px 7px 14px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 500,
                    color: 'var(--text-secondary)',
                    fontFamily: 'inherit', letterSpacing: '-0.2px',
                    lineHeight: 1,
                    transition: 'color 0.15s',
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
                    lineHeight: 1,
                    color: 'var(--text-tertiary)',
                    transition: 'color 0.15s',
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

      {/* ── Related suggestions (after search) ── */}
      {showSuggestions && (
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--text-tertiary)', margin: 0
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
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                  fontFamily: 'inherit'
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
