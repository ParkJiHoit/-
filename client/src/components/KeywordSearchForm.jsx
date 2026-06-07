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
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-dashboard">
      <form
        className="flex flex-col gap-3 lg:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          submitKeyword();
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            className="h-14 w-full rounded-md border border-slate-300 bg-slate-50 pl-12 pr-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-200"
            placeholder="예: 휴대폰창업, 소자본창업, 여성창업"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            disabled={loading}
          />
        </div>
        <button
          className="h-14 rounded-md bg-slate-950 px-7 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          type="submit"
          disabled={loading}
        >
          {loading ? '분석 중' : '조회'}
        </button>
      </form>

      {validationMessage && <p className="mt-3 text-sm font-medium text-rose-600">{validationMessage}</p>}

      {suggestions.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">관련 추천 검색어</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:bg-white"
                key={suggestion.keyword}
                type="button"
                onClick={() => submitKeyword(suggestion.keyword)}
                disabled={loading}
                title={`연관도 ${suggestion.relevanceLevel} · ${suggestion.relevanceScore}점`}
              >
                {suggestion.keyword}
                <span className="ml-1 text-xs text-slate-400">{suggestion.relevanceScore}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
