import { Filter, RotateCcw } from 'lucide-react';

const actions = ['우선 테스트', '기회 키워드', '모바일 집중', '과포화 주의', '제외 검토', '핵심 후보', '모니터링'];
const competitions = ['낮음', '중간', '높음', '알 수 없음'];
const relevanceLevels = ['높음', '중간', '낮음'];

export const defaultFilters = {
  minSearchVolume: '',
  maxSaturation: '',
  minEfficiency: '',
  minRelevance: '',
  competition: '',
  action: '',
  relevanceLevel: '',
  mobileOnly: false,
  excludeSaturated: false,
  excludeLowRelevance: true,
  keywordText: ''
};

export default function KeywordFilters({ filters, onChange, onReset }) {
  const updateFilter = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-black text-slate-900">필터</h2>
        </div>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
          type="button"
          onClick={onReset}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          초기화
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FilterInput label="최소 검색량" value={filters.minSearchVolume} onChange={(value) => updateFilter('minSearchVolume', value)} />
        <FilterInput label="최대 포화도" value={filters.maxSaturation} onChange={(value) => updateFilter('maxSaturation', value)} />
        <FilterInput label="최소 효율 점수" value={filters.minEfficiency} onChange={(value) => updateFilter('minEfficiency', value)} />
        <FilterInput label="최소 연관도 점수" value={filters.minRelevance} onChange={(value) => updateFilter('minRelevance', value)} />
        <FilterInput label="키워드 텍스트 검색" type="text" value={filters.keywordText} onChange={(value) => updateFilter('keywordText', value)} />

        <FilterSelect label="연관도 선택" value={filters.relevanceLevel} options={relevanceLevels} onChange={(value) => updateFilter('relevanceLevel', value)} />
        <FilterSelect label="경쟁도 선택" value={filters.competition} options={competitions} onChange={(value) => updateFilter('competition', value)} />
        <FilterSelect label="추천 액션 선택" value={filters.action} options={actions} onChange={(value) => updateFilter('action', value)} />

        <label className="flex min-h-12 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
          <input
            className="h-4 w-4 accent-slate-950"
            type="checkbox"
            checked={filters.mobileOnly}
            onChange={(event) => updateFilter('mobileOnly', event.target.checked)}
          />
          모바일 비중 70% 이상만 보기
        </label>
      </div>
    </section>
  );
}

function FilterInput({ label, type = 'number', value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-500">{label}</span>
      <input
        className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-500">{label}</span>
      <select
        className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-900 focus:bg-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">전체</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
