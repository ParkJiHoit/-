import { Search } from 'lucide-react';

const ACTIONS = ['우선 테스트', '기회 키워드', '모바일 집중', '과포화 주의', '제외 검토', '핵심 후보', '모니터링'];
const COMPETITIONS = ['낮음', '중간', '높음', '알 수 없음'];

export const defaultFilters = {
  minSearchVolume: '', maxSaturation: '', minEfficiency: '', minRelevance: '',
  competition: '', action: '', relevanceLevel: '', mobileOnly: false,
  excludeSaturated: false, excludeLowRelevance: true, keywordText: ''
};

const base = {
  height: 34,
  padding: '0 10px',
  fontSize: 13,
  borderRadius: 8,
  background: 'var(--bg-overlay)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
};

export default function KeywordFilters({ filters, onChange }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <>
      {/* Text search */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search style={{ position: 'absolute', left: 9, width: 13, height: 13, color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
        <input
          style={{ ...base, paddingLeft: 28, width: 156, color: 'var(--text-primary)' }}
          type="text"
          placeholder="키워드 검색"
          value={filters.keywordText}
          onChange={(e) => set('keywordText', e.target.value)}
        />
      </div>

      {/* Competition */}
      <select
        style={{ ...base, cursor: 'pointer' }}
        value={filters.competition}
        onChange={(e) => set('competition', e.target.value)}
      >
        <option value="">경쟁도 전체</option>
        {COMPETITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {/* Recommended action */}
      <select
        style={{ ...base, cursor: 'pointer' }}
        value={filters.action}
        onChange={(e) => set('action', e.target.value)}
      >
        <option value="">추천 상태 전체</option>
        {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>

      {/* Min search volume */}
      <input
        style={{ ...base, width: 110, color: 'var(--text-primary)' }}
        type="number"
        placeholder="최소 검색량"
        value={filters.minSearchVolume}
        onChange={(e) => set('minSearchVolume', e.target.value)}
      />
    </>
  );
}
