import { Search } from 'lucide-react';
import { useState } from 'react';

export default function KeywordSearchForm({ onSubmit, loading, suggestions = [] }) {
  const [keyword, setKeyword] = useState('');
  const [validationMessage, setValidationMessage] = useState('');

  const submitKeyword = (nextKeyword = keyword) => {
    const trimmedKeyword = nextKeyword.trim();

    if (!trimmedKeyword) {
      setValidationMessage('분석할 키워드를 입력해 주세요.');
      return;
    }

    setValidationMessage('');
    setKeyword(trimmedKeyword);
    onSubmit(trimmedKeyword);
  };

  return (
    <section className="apple-card p-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submitKeyword();
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" style={{ width: 18, height: 18 }} />
          <input
            className="apple-input h-12 w-full pl-10 pr-4 text-[15px] font-semibold text-slate-900"
            placeholder="분석할 키워드 입력 (예: 휴대폰창업)"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            disabled={loading}
          />
        </div>
        <button
          className="h-12 rounded-xl bg-slate-950 px-6 text-[13px] font-bold text-white transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300"
          type="submit"
          disabled={loading}
        >
          {loading ? '분석 중' : '조회'}
        </button>
      </form>

      {validationMessage && <p className="mt-2.5 text-[13px] font-medium text-rose-600">{validationMessage}</p>}

      {suggestions.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">관련 추천 검색어</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => (
              <button
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-white hover:text-slate-900"
                key={suggestion.keyword}
                type="button"
                onClick={() => submitKeyword(suggestion.keyword)}
                disabled={loading}
                title={`연관도 ${suggestion.relevanceLevel} · ${suggestion.relevanceScore}점`}
              >
                {suggestion.keyword}
                <span className="ml-1 text-slate-400">{suggestion.relevanceScore}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
