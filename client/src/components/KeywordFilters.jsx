import { Filter, RotateCcw } from 'lucide-react';

const actions      = ['우선 테스트', '기회 키워드', '모바일 집중', '과포화 주의', '제외 검토', '핵심 후보', '모니터링'];
const competitions = ['낮음', '중간', '높음', '알 수 없음'];
const relevanceLevels = ['높음', '중간', '낮음'];

export const defaultFilters = {
  minSearchVolume: '', maxSaturation: '', minEfficiency: '', minRelevance: '',
  competition: '', action: '', relevanceLevel: '', mobileOnly: false,
  excludeSaturated: false, excludeLowRelevance: true, keywordText: ''
};

export default function KeywordFilters({ filters, onChange, onReset }) {
  const updateFilter = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <section className="mac-card px-5 py-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>필터</span>
        </div>
        <button
          className="mac-btn mac-btn-ghost mac-btn-sm flex items-center gap-1.5"
          type="button"
          onClick={onReset}
        >
          <RotateCcw className="h-3 w-3" />
          초기화
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FilterInput label="최소 검색량"    value={filters.minSearchVolume} onChange={(v) => updateFilter('minSearchVolume', v)} />
        <FilterInput label="최대 포화도"    value={filters.maxSaturation}   onChange={(v) => updateFilter('maxSaturation', v)} />
        <FilterInput label="최소 효율 점수" value={filters.minEfficiency}   onChange={(v) => updateFilter('minEfficiency', v)} />
        <FilterInput label="최소 연관도 점수" value={filters.minRelevance}  onChange={(v) => updateFilter('minRelevance', v)} />
        <FilterInput label="키워드 텍스트 검색" type="text" value={filters.keywordText} onChange={(v) => updateFilter('keywordText', v)} />

        <FilterSelect label="연관도 선택"   value={filters.relevanceLevel} options={relevanceLevels} onChange={(v) => updateFilter('relevanceLevel', v)} />
        <FilterSelect label="경쟁도 선택"   value={filters.competition}    options={competitions}    onChange={(v) => updateFilter('competition', v)} />
        <FilterSelect label="추천 액션 선택" value={filters.action}         options={actions}         onChange={(v) => updateFilter('action', v)} />

        <label
          className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5"
          style={{ border: '1px solid var(--border)', background: 'var(--bg-overlay)', fontSize: 13, color: 'var(--text-secondary)', minHeight: 36 }}
        >
          <input
            className="mac-checkbox"
            type="checkbox"
            checked={filters.mobileOnly}
            onChange={(e) => updateFilter('mobileOnly', e.target.checked)}
          />
          모바일 비중 70% 이상만
        </label>
      </div>
    </section>
  );
}

function FilterInput({ label, type = 'number', value, onChange }) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block"
        style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}
      >
        {label}
      </span>
      <input
        className="mac-input mac-input-sm"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block"
        style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}
      >
        {label}
      </span>
      <select
        className="mac-input mac-input-sm mac-select"
        style={{ fontSize: 13 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">전체</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
