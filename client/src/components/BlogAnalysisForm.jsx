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
    <section className="apple-card p-4">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitKeyword}>
        <div className="relative flex-1">
          <FileText className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ width: 18, height: 18 }} />
          <input
            className="apple-input h-12 w-full pl-10 pr-4 text-[15px] font-semibold text-slate-900"
            placeholder="분석할 블로그 키워드 입력 (예: 휴대폰창업)"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            disabled={loading}
          />
        </div>

        <label className="block shrink-0">
          <span className="sr-only">트렌드 기간</span>
          <select
            className="apple-input h-12 w-full cursor-pointer px-3 text-[13px] font-bold text-slate-700 sm:w-36"
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
          className="h-12 shrink-0 rounded-xl bg-slate-950 px-6 text-[13px] font-bold text-white transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300"
          type="submit"
          disabled={loading}
        >
          {loading ? '분석 중' : '블로그 분석'}
        </button>
      </form>

      {validationMessage && <p className="mt-2.5 text-[13px] font-medium text-rose-600">{validationMessage}</p>}
    </section>
  );
}
