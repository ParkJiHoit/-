import { Columns3, Eye, EyeOff, HelpCircle, RotateCcw } from 'lucide-react';
import { DEFAULT_VISIBLE_COLUMN_KEYS, KEYWORD_TABLE_COLUMNS } from './KeywordTable';

const columnDescriptions = {
  recommendAction: '키워드의 현재 추천 상태를 색상 배지로 표시합니다.',
  keyword: '네이버 검색광고 API에서 내려온 추천 키워드입니다. 기준점이라 항상 표시됩니다.',
  intentType: '추천 키워드의 검색 의도를 창업 의도, 대리점/매장, 비용/수익, 정보 탐색 등으로 분류합니다.',
  intentScore: '키워드가 광고 운영 목적과 얼마나 잘 맞는지 0~100점으로 계산한 내부 점수입니다.',
  discoveryScore: '연관도, 검색량, 경쟁도, 의도 적합도, 포화도를 종합한 키워드 발굴 우선순위 점수입니다.',
  relevanceLevel: '검색한 기준 키워드와 추천 키워드의 텍스트/의도 유사도를 높음, 중간, 낮음으로 구분합니다.',
  relevanceScore: '기준 키워드와 추천 키워드가 얼마나 가까운지 0~100점으로 계산한 내부 점수입니다.',
  monthlyPcSearch: '최근 기준 PC 월간 검색량입니다.',
  monthlyMobileSearch: '최근 기준 모바일 월간 검색량입니다.',
  totalSearch: 'PC + 모바일 합산 월간 검색량입니다.',
  mobileRatio: '전체 검색량 중 모바일 검색량이 차지하는 비율입니다.',
  monthlyPcCtr: '네이버 검색광고 API가 제공하는 PC 평균 클릭률입니다.',
  monthlyMobileCtr: '네이버 검색광고 API가 제공하는 모바일 평균 클릭률입니다.',
  averageCtr: 'PC 평균 CTR과 모바일 평균 CTR의 평균값입니다.',
  competition: '네이버 검색광고 API의 경쟁도 값입니다.',
  averageDepth: '광고가 평균적으로 어느 노출 깊이까지 표시되는지 나타내는 네이버 API 값입니다.',
  saturationScore: '경쟁도, 노출 깊이, 검색량 보정을 합쳐 과열 정도를 0~100점으로 계산한 점수입니다.',
  efficiencyScore: '검색량, CTR, 경쟁도, 모바일 비중, 포화도를 종합해 테스트 가치를 0~100점으로 계산한 점수입니다.',
  recommendActionText: '점수와 조건을 바탕으로 자동 분류한 추천 실행 방향입니다.'
};

export default function ColumnVisibilitySettings({ visibleColumns, onChange, onReset }) {
  const visibleCount = KEYWORD_TABLE_COLUMNS.filter(
    (col) => col.alwaysVisible || visibleColumns[col.key]
  ).length;

  const updateColumn = (key, checked) => onChange({ ...visibleColumns, [key]: checked });
  const showAll = () => onChange(DEFAULT_VISIBLE_COLUMN_KEYS);
  const hideOptional = () => {
    const next = { ...DEFAULT_VISIBLE_COLUMN_KEYS };
    KEYWORD_TABLE_COLUMNS.forEach((col) => { next[col.key] = Boolean(col.alwaysVisible); });
    onChange(next);
  };

  return (
    <section className="mac-card px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Columns3 className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>컬럼 설정</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8 }}>
              현재 {visibleCount}개 표시 중
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { label: '전체 보기', icon: Eye,      onClick: showAll },
            { label: '필수만',    icon: EyeOff,   onClick: hideOptional },
            { label: '기본값',    icon: RotateCcw, onClick: onReset }
          ].map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              className="mac-btn mac-btn-ghost mac-btn-sm flex items-center gap-1.5"
              type="button"
              onClick={onClick}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {KEYWORD_TABLE_COLUMNS.map((col) => {
          const isAlways = Boolean(col.alwaysVisible);
          const checked  = isAlways || Boolean(visibleColumns[col.key]);
          return (
            <label
              key={col.key}
              className="group relative flex cursor-pointer items-center gap-2 rounded-[10px] px-3 py-2.5"
              style={{
                border: '1px solid var(--border)',
                background: isAlways ? 'rgba(255,255,255,0.03)' : 'var(--bg-overlay)',
                opacity: isAlways ? 0.6 : 1,
                fontSize: 12,
                color: 'var(--text-secondary)',
                minHeight: 38,
                cursor: isAlways ? 'default' : 'pointer'
              }}
              title={columnDescriptions[col.key]}
            >
              <input
                className="mac-checkbox"
                type="checkbox"
                checked={checked}
                disabled={isAlways}
                onChange={(e) => updateColumn(col.key, e.target.checked)}
              />
              <span className="truncate">{col.label}</span>
              <HelpCircle className="ml-auto h-3 w-3 shrink-0" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }} />
              {/* Tooltip */}
              <span
                className="pointer-events-none absolute left-2 top-full z-20 mt-2 hidden w-64 rounded-xl px-3 py-2 text-xs leading-5 group-hover:block"
                style={{ background: 'rgba(58,58,60,0.98)', color: 'var(--text-primary)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
              >
                {columnDescriptions[col.key]}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
