import { ChevronDown, Search } from 'lucide-react';
import { useState } from 'react';

const TRENDING = ['스마트스토어', '무인카페', '블로그수익화', '소자본창업', '위탁판매'];
const RANK_COLORS = ['#FF5C38', '#FF8C42', '#FFBA08', 'var(--text-tertiary)', 'var(--text-tertiary)'];

export default function KeywordSearchForm({ onSubmit, loading, suggestions = [] }) {
  const [keyword, setKeyword] = useState('');
  const [focused, setFocused] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  const submitKeyword = (next = keyword) => {
    const trimmed = next.trim();
    if (!trimmed) { setValidationMessage('분석할 키워드를 입력해 주세요.'); return; }
    setValidationMessage('');
    setKeyword(trimmed);
    onSubmit(trimmed);
  };

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
            : '1.5px solid rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.04)',
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
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            paddingLeft: 22,
            paddingRight: 18,
            borderRight: '1px solid rgba(255,255,255,0.10)',
            color: '#06C755',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '-0.2px',
            whiteSpace: 'nowrap',
            cursor: 'default',
            userSelect: 'none'
          }}
        >
          NAVER
          <ChevronDown style={{ width: 12, height: 12, opacity: 0.6 }} />
        </div>

        {/* Input */}
        <input
          style={{
            flex: 1,
            height: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            paddingLeft: 18,
            paddingRight: 8,
            fontSize: 17,
            fontWeight: 400,
            color: 'var(--text-primary)',
            fontFamily: 'inherit'
          }}
          placeholder="분석할 키워드를 입력하세요"
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
            flexShrink: 0,
            marginRight: 10,
            width: 44,
            height: 44,
            borderRadius: 999,
            border: 'none',
            background: focused ? 'var(--accent)' : 'rgba(255,255,255,0.10)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s',
            color: '#fff'
          }}
          onMouseEnter={(e) => !focused && (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
          onMouseLeave={(e) => !focused && (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
        >
          <Search style={{ width: 18, height: 18 }} />
        </button>
      </form>

      {validationMessage && (
        <p style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 10, textAlign: 'center' }}>
          {validationMessage}
        </p>
      )}

      {/* ── Trending keywords (before first search) ── */}
      {suggestions.length === 0 && (
        <div style={{ marginTop: 32, textAlign: 'center', animation: 'macFadeUp 0.5s ease both' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 16 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 6, height: 6, borderRadius: '50%',
              background: '#FF5C38',
              boxShadow: '0 0 7px rgba(255,92,56,0.7)',
              flexShrink: 0
            }} />
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--text-tertiary)'
            }}>
              실시간 인기 검색어
            </span>
          </div>

          {/* Keyword pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {TRENDING.map((kw, i) => (
              <button
                key={kw}
                type="button"
                onClick={() => submitKeyword(kw)}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 999,
                  padding: '8px 18px 8px 14px',
                  cursor: 'pointer',
                  transition: 'background 0.18s, border-color 0.18s, transform 0.15s',
                  fontFamily: 'inherit',
                  animationDelay: `${i * 0.07}s`,
                  animation: 'macFadeUp 0.4s ease both',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span style={{
                  fontSize: 11, fontWeight: 800,
                  color: RANK_COLORS[i],
                  minWidth: 10, textAlign: 'center', lineHeight: 1,
                  ...(i < 3 ? { filter: 'drop-shadow(0 0 4px currentColor)' } : {})
                }}>
                  {i + 1}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 500,
                  color: 'var(--text-secondary)',
                  letterSpacing: '-0.2px'
                }}>
                  {kw}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Related suggestions (after search) ── */}
      {suggestions.length > 0 && (
        <div style={{ marginTop: 22, textAlign: 'center' }}>
          <p style={{
            fontSize: 12, fontWeight: 500,
            color: 'var(--text-tertiary)',
            marginBottom: 12, letterSpacing: '0.04em'
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
                  borderRadius: 999,
                  padding: '7px 16px',
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
