import { Search } from 'lucide-react';
import { useState } from 'react';

export default function KeywordSearchForm({ onSubmit, loading, suggestions = [] }) {
  const [keyword, setKeyword] = useState('');
  const [validationMessage, setValidationMessage] = useState('');

  const submitKeyword = (next = keyword) => {
    const trimmed = next.trim();
    if (!trimmed) { setValidationMessage('분석할 키워드를 입력해 주세요.'); return; }
    setValidationMessage('');
    setKeyword(trimmed);
    onSubmit(trimmed);
  };

  return (
    <div className="mac-card px-4 py-3.5">
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); submitKeyword(); }}
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ width: 16, height: 16, color: 'var(--text-tertiary)' }}
          />
          <input
            className="mac-input"
            style={{ paddingLeft: 36 }}
            placeholder="분석할 키워드 입력 (예: 휴대폰창업)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={loading}
          />
        </div>
        <button className="mac-btn" type="submit" disabled={loading} style={{ minWidth: 72 }}>
          {loading ? '분석 중' : '조회'}
        </button>
      </form>

      {validationMessage && (
        <p style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 8 }}>{validationMessage}</p>
      )}

      {suggestions.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>
            관련 추천 검색어
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.keyword}
                type="button"
                onClick={() => submitKeyword(s.keyword)}
                disabled={loading}
                title={`연관도 ${s.relevanceLevel} · ${s.relevanceScore}점`}
                className="mac-badge mac-badge-gray"
                style={{ cursor: 'pointer', fontSize: 12, padding: '4px 10px' }}
              >
                {s.keyword}
                <span style={{ marginLeft: 5, opacity: 0.6 }}>{s.relevanceScore}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
