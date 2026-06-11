import { Rocket } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

function parseWords(value, max) {
  return value.split(/\n|,/).map((w) => w.trim()).filter(Boolean).slice(0, max);
}

export default function KeywordExpansionForm({ onSubmit, loading }) {
  const [seedText,    setSeedText]    = useState('');
  const [includeText, setIncludeText] = useState('');
  const [excludeText, setExcludeText] = useState('');
  const [highQuality, setHighQuality] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');
  const [anyFocused, setAnyFocused] = useState(false);
  const blurTimer = useRef(null);

  const seedKeywords  = useMemo(() => parseWords(seedText,    3), [seedText]);
  const includeWords  = useMemo(() => parseWords(includeText, 5), [includeText]);
  const excludeWords  = useMemo(() => parseWords(excludeText, 5), [excludeText]);

  const submitExpansion = (e) => {
    e.preventDefault();
    if (!seedKeywords.length) { setValidationMessage('확장할 시드 키워드를 입력해 주세요.'); return; }
    setValidationMessage('');
    onSubmit({ seedKeywords, includeWords, excludeWords, highQuality });
  };

  const handleFocusIn = () => {
    clearTimeout(blurTimer.current);
    setAnyFocused(true);
  };
  const handleFocusOut = () => {
    blurTimer.current = setTimeout(() => setAnyFocused(false), 60);
  };

  return (
    <div
      style={{
        width: '100%',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 18,
        border: anyFocused
          ? '1.5px solid rgba(10,180,255,0.60)'
          : '1.5px solid rgba(255,255,255,0.10)',
        boxShadow: anyFocused
          ? '0 0 0 3px rgba(10,180,255,0.12), 0 0 40px rgba(10,180,255,0.22), 0 0 80px rgba(10,180,255,0.09)'
          : '0 2px 20px rgba(0,0,0,0.4), 0 0 18px rgba(10,180,255,0.07), 0 0 48px rgba(10,180,255,0.04)',
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
        padding: '22px',
      }}
      onFocus={handleFocusIn}
      onBlur={handleFocusOut}
    >
      <form onSubmit={submitExpansion}>
        <div className="grid gap-3 sm:grid-cols-3">
          <WordArea label="시드 키워드" helper={`${seedKeywords.length}/3`}
            placeholder="1줄에 1개 입력"
            value={seedText} onChange={setSeedText} disabled={loading} />

          <WordArea label="포함할 단어" helper={`${includeWords.length}/5`}
            placeholder=""
            value={includeText} onChange={setIncludeText} disabled={loading} />

          <WordArea label="제외할 단어" helper={`${excludeWords.length}/5`}
            placeholder=""
            value={excludeText} onChange={setExcludeText} disabled={loading} />
        </div>

        {validationMessage && (
          <p style={{ fontSize: 12, color: 'var(--destructive)', margin: '8px 0 0' }}>{validationMessage}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>
            시드 키워드 최대 3개, 포함/제외 단어 최대 5개 — 줄바꿈 또는 쉼표로 구분
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: 'var(--text-secondary)',
                cursor: 'pointer', userSelect: 'none',
              }}
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
            <button className="mac-btn" type="submit" disabled={loading} style={{ height: 38, padding: '0 20px' }}>
              <Rocket className="h-4 w-4" />
              {loading ? '확장 중' : '확장하기'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function WordArea({ label, helper, placeholder, value, onChange, disabled }) {
  const [focused, setFocused] = useState(false);
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
        style={{
          resize: 'none',
          height: 100,
          fontSize: 13,
          padding: '10px 12px',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          ...(focused ? {
            borderColor: 'rgba(10,180,255,0.65)',
            boxShadow: '0 0 0 2px rgba(10,180,255,0.15)',
            outline: 'none',
          } : {}),
        }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
      />
    </label>
  );
}
