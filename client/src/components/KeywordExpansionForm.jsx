import { Rocket } from 'lucide-react';
import { useMemo, useState } from 'react';

function parseWords(value, max) {
  return value.split(/\n|,/).map((w) => w.trim()).filter(Boolean).slice(0, max);
}

export default function KeywordExpansionForm({ onSubmit, loading }) {
  const [seedText,    setSeedText]    = useState('');
  const [includeText, setIncludeText] = useState('');
  const [excludeText, setExcludeText] = useState('');
  const [highQuality, setHighQuality] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');

  const seedKeywords  = useMemo(() => parseWords(seedText,    3), [seedText]);
  const includeWords  = useMemo(() => parseWords(includeText, 5), [includeText]);
  const excludeWords  = useMemo(() => parseWords(excludeText, 5), [excludeText]);

  const submitExpansion = (e) => {
    e.preventDefault();
    if (!seedKeywords.length) { setValidationMessage('확장할 시드 키워드를 입력해 주세요.'); return; }
    setValidationMessage('');
    onSubmit({ seedKeywords, includeWords, excludeWords, highQuality });
  };

  return (
    <div className="mac-card px-4 py-4">
      <form className="grid gap-3 xl:grid-cols-[1.1fr_1fr_1fr_auto]" onSubmit={submitExpansion}>
        <WordArea label="시드 키워드" helper={`${seedKeywords.length}/3`}
          placeholder={"1줄에 1개 입력"}
          value={seedText} onChange={setSeedText} disabled={loading} tall />

        <WordArea label="포함할 단어" helper={`${includeWords.length}/5`}
          placeholder={""}
          value={includeText} onChange={setIncludeText} disabled={loading} />

        <WordArea label="제외할 단어" helper={`${excludeWords.length}/5`}
          placeholder={""}
          value={excludeText} onChange={setExcludeText} disabled={loading} />

        <div className="flex flex-col justify-end gap-2">
          <label
            className="flex cursor-pointer items-center gap-2 rounded-[10px] px-3 py-2.5"
            style={{ border: '1px solid var(--border)', background: 'var(--bg-overlay)', fontSize: 13, color: 'var(--text-secondary)', minHeight: 42 }}
          >
            <input
              className="mac-checkbox"
              type="checkbox"
              checked={highQuality}
              onChange={(e) => setHighQuality(e.target.checked)}
              disabled={loading}
            />
            고성능 확장
          </label>
          <button className="mac-btn" type="submit" disabled={loading}>
            <Rocket className="h-4 w-4" />
            {loading ? '확장 중' : '확장하기'}
          </button>
        </div>
      </form>

      {validationMessage && (
        <p style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 8 }}>{validationMessage}</p>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10, lineHeight: 1.6 }}>
        시드 키워드 최대 3개, 포함/제외 단어 최대 5개 — 줄바꿈 또는 쉼표로 구분
      </p>
    </div>
  );
}

function WordArea({ label, helper, placeholder, value, onChange, disabled, tall = false }) {
  return (
    <label className="block">
      <span
        className="mb-1.5 flex items-center justify-between"
        style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}
      >
        {label}
        <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>{helper}</span>
      </span>
      <textarea
        className="mac-input"
        style={{ resize: 'none', height: tall ? 108 : 94, fontSize: tall ? 15 : 13, padding: '10px 12px' }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </label>
  );
}
