import { Rocket } from 'lucide-react';
import { useMemo, useState } from 'react';

function parseWords(value, maxCount) {
  return value
    .split(/\n|,/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, maxCount);
}

export default function KeywordExpansionForm({ onSubmit, loading }) {
  const [seedText, setSeedText] = useState('');
  const [includeText, setIncludeText] = useState('');
  const [excludeText, setExcludeText] = useState('');
  const [highQuality, setHighQuality] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');

  const seedKeywords = useMemo(() => parseWords(seedText, 3), [seedText]);
  const includeWords = useMemo(() => parseWords(includeText, 5), [includeText]);
  const excludeWords = useMemo(() => parseWords(excludeText, 5), [excludeText]);

  const submitExpansion = (event) => {
    event.preventDefault();

    if (!seedKeywords.length) {
      setValidationMessage('확장할 시드 키워드를 입력해 주세요.');
      return;
    }

    setValidationMessage('');
    onSubmit({
      seedKeywords,
      includeWords,
      excludeWords,
      highQuality
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-dashboard">
      <form className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr_auto]" onSubmit={submitExpansion}>
        <WordTextarea
          label="시드 키워드"
          helper={`${seedKeywords.length}/3개`}
          placeholder={`예:\n휴대폰창업\n핸드폰창업\n휴대폰대리점`}
          value={seedText}
          onChange={setSeedText}
          disabled={loading}
          large
        />

        <WordTextarea
          label="포함할 단어"
          helper={`${includeWords.length}/5개`}
          placeholder={`예:\n소자본\n대리점\n무인`}
          value={includeText}
          onChange={setIncludeText}
          disabled={loading}
        />

        <WordTextarea
          label="제외할 단어"
          helper={`${excludeWords.length}/5개`}
          placeholder={`예:\n중고\n수리\n케이스`}
          value={excludeText}
          onChange={setExcludeText}
          disabled={loading}
        />

        <div className="flex flex-col justify-end gap-3">
          <label className="flex min-h-12 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-700">
            <input
              className="h-4 w-4 accent-slate-950"
              type="checkbox"
              checked={highQuality}
              onChange={(event) => setHighQuality(event.target.checked)}
              disabled={loading}
            />
            고성능 확장
          </label>
          <button
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            type="submit"
            disabled={loading}
          >
            <Rocket className="h-4 w-4" />
            {loading ? '확장 중' : '확장하기'}
          </button>
        </div>
      </form>

      {validationMessage && <p className="mt-3 text-sm font-medium text-rose-600">{validationMessage}</p>}

      <p className="mt-4 text-sm font-medium leading-6 text-slate-500">
        시드 키워드는 최대 3개, 포함/제외 단어는 최대 5개까지 줄바꿈 또는 쉼표로 구분합니다. 고성능 확장은 후보 수보다 연관도와 테스트 가치를 우선합니다.
      </p>
    </section>
  );
}

function WordTextarea({ label, helper, placeholder, value, onChange, disabled, large = false }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
        <span className="font-bold text-slate-400">{helper}</span>
      </span>
      <textarea
        className={`w-full resize-none rounded-md border border-slate-300 bg-slate-50 px-3 py-3 font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-200 ${
          large ? 'h-32 text-base' : 'h-28 text-sm'
        }`}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </label>
  );
}
