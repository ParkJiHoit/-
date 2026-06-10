import { FileText } from 'lucide-react';
import { useState } from 'react';

export default function BlogAnalysisForm({ onSubmit, loading }) {
  const [keyword, setKeyword] = useState('');
  const [months, setMonths] = useState(12);
  const [validationMessage, setValidationMessage] = useState('');

  const submitKeyword = (event) => {
    event.preventDefault();

    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      setValidationMessage('분석할 블로그 키워드를 입력해 주세요.');
      return;
    }

    setValidationMessage('');
    onSubmit({ keyword: trimmedKeyword, months });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-dashboard">
      <form className="grid gap-3 lg:grid-cols-[1fr_180px_auto]" onSubmit={submitKeyword}>
        <div className="relative">
          <FileText className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            className="h-14 w-full rounded-md border border-slate-300 bg-slate-50 pl-12 pr-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-200"
            placeholder="예: 휴대폰창업, 소자본창업, 여성창업"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            disabled={loading}
          />
        </div>

        <label className="block">
          <span className="sr-only">트렌드 기간</span>
          <select
            className="h-14 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm font-black text-slate-700 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-200"
            value={months}
            onChange={(event) => setMonths(Number(event.target.value))}
            disabled={loading}
          >
            <option value={6}>최근 6개월</option>
            <option value={12}>최근 12개월</option>
            <option value={24}>최근 24개월</option>
          </select>
        </label>

        <button
          className="h-14 rounded-md bg-slate-950 px-7 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          type="submit"
          disabled={loading}
        >
          {loading ? '분석 중' : '블로그 분석'}
        </button>
      </form>

      {validationMessage && <p className="mt-3 text-sm font-medium text-rose-600">{validationMessage}</p>}
    </section>
  );
}
