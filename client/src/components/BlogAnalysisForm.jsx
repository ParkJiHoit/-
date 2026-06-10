import { FileText } from 'lucide-react';
import { useState } from 'react';

export default function BlogAnalysisForm({ onSubmit, loading }) {
  const [keyword, setKeyword] = useState('');
  const [months, setMonths]   = useState(12);
  const [validationMessage, setValidationMessage] = useState('');

  const submitKeyword = (e) => {
    e.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed) { setValidationMessage('분석할 블로그 키워드를 입력해 주세요.'); return; }
    setValidationMessage('');
    onSubmit({ keyword: trimmed, months });
  };

  return (
    <div className="mac-card px-4 py-3.5">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitKeyword}>
        <div className="relative flex-1">
          <FileText
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ width: 16, height: 16, color: 'var(--text-tertiary)' }}
          />
          <input
            className="mac-input"
            style={{ paddingLeft: 36 }}
            placeholder="분석할 블로그 키워드 (예: 휴대폰창업)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={loading}
          />
        </div>

        <select
          className="mac-input mac-select"
          style={{ fontSize: 13, width: 'auto', minWidth: 140 }}
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          disabled={loading}
        >
          <option value={6}>최근 6개월</option>
          <option value={12}>최근 12개월</option>
          <option value={24}>최근 24개월</option>
        </select>

        <button className="mac-btn" type="submit" disabled={loading} style={{ minWidth: 100 }}>
          {loading ? '분석 중' : '블로그 분석'}
        </button>
      </form>

      {validationMessage && (
        <p style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 8 }}>{validationMessage}</p>
      )}
    </div>
  );
}
