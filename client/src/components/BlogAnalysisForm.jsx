import { FileText, Search } from 'lucide-react';
import { useState } from 'react';

export default function BlogAnalysisForm({ onSubmit, loading }) {
  const [keyword, setKeyword] = useState('');
  const [months,  setMonths]  = useState(12);
  const [focused, setFocused] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  const submitKeyword = (e) => {
    e.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed) { setValidationMessage('분석할 블로그 키워드를 입력해 주세요.'); return; }
    setValidationMessage('');
    onSubmit({ keyword: trimmed, months });
  };

  return (
    <div style={{ width: '100%' }}>
      <form
        onSubmit={submitKeyword}
        style={{
          position: 'relative',
          borderRadius: 999,
          border: focused
            ? '1.5px solid rgba(10,180,255,0.85)'
            : '1.5px solid rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.04)',
          boxShadow: focused
            ? '0 0 0 3px rgba(10,180,255,0.18), 0 0 32px rgba(10,180,255,0.22), 0 0 80px rgba(10,180,255,0.08)'
            : '0 2px 20px rgba(0,0,0,0.4)',
          transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
          display: 'flex',
          alignItems: 'center',
          height: 64
        }}
      >
        {/* Icon badge */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
          paddingLeft: 22, paddingRight: 18,
          borderRight: '1px solid rgba(255,255,255,0.10)',
          color: '#0A84FF', fontWeight: 700, fontSize: 13
        }}>
          <FileText style={{ width: 14, height: 14 }} />
          블로그
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
          placeholder="분석할 블로그 키워드를 입력하세요"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={loading}
        />

        {/* Period select (compact) */}
        <select
          style={{
            flexShrink: 0, height: 34, borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
            paddingLeft: 10, paddingRight: 24, marginRight: 8,
            cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
            appearance: 'none',
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2398989D' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center'
          }}
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          disabled={loading}
        >
          <option value={6}>6개월</option>
          <option value={12}>12개월</option>
          <option value={24}>24개월</option>
        </select>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            flexShrink: 0, marginRight: 10,
            width: 44, height: 44, borderRadius: 999,
            border: 'none',
            background: focused ? 'var(--accent)' : 'rgba(255,255,255,0.10)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s', color: '#fff'
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
    </div>
  );
}
