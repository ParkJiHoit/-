import { Columns3, Eye, EyeOff, HelpCircle, RotateCcw } from 'lucide-react';
import { DEFAULT_VISIBLE_COLUMN_KEYS, KEYWORD_TABLE_COLUMNS } from './KeywordTable';

const columnDescriptions = {
  recommendAction: '키워드의 현재 추천 상태를 색상 배지로 표시합니다.',
  keyword: '네이버 검색광고 API에서 내려온 추천 키워드입니다. 기준점이라 항상 표시됩니다.',
  relevanceLevel: '검색한 기준 키워드와 추천 키워드의 텍스트/의도 유사도를 높음, 중간, 낮음으로 구분합니다.',
  relevanceScore: '기준 키워드와 추천 키워드가 얼마나 가까운지 0~100점으로 계산한 내부 점수입니다.',
  monthlyPcSearch: '최근 기준 PC 월간 검색량입니다. 네이버 API의 PC 검색량 값을 사용합니다.',
  monthlyMobileSearch: '최근 기준 모바일 월간 검색량입니다. 네이버 API의 모바일 검색량 값을 사용합니다.',
  totalSearch: 'PC 검색량과 모바일 검색량을 합산한 전체 월간 검색량입니다.',
  mobileRatio: '전체 검색량 중 모바일 검색량이 차지하는 비율입니다.',
  monthlyPcCtr: '네이버 검색광고 API가 제공하는 PC 평균 클릭률입니다.',
  monthlyMobileCtr: '네이버 검색광고 API가 제공하는 모바일 평균 클릭률입니다.',
  averageCtr: 'PC 평균 CTR과 모바일 평균 CTR의 평균값입니다.',
  competition: '네이버 검색광고 API의 경쟁도 값입니다. 낮음, 중간, 높음으로 표시됩니다.',
  averageDepth: '광고가 평균적으로 어느 노출 깊이까지 표시되는지 나타내는 네이버 API 값입니다.',
  saturationScore: '경쟁도, 평균 노출 깊이, 검색량 보정을 합쳐 과열 정도를 0~100점으로 계산한 내부 점수입니다.',
  efficiencyScore: '검색량, CTR, 경쟁도, 모바일 비중, 포화도를 종합해 테스트 가치를 0~100점으로 계산한 내부 점수입니다.',
  recommendActionText: '점수와 조건을 바탕으로 자동 분류한 추천 실행 방향입니다.'
};

export default function ColumnVisibilitySettings({ visibleColumns, onChange, onReset }) {
  const visibleCount = KEYWORD_TABLE_COLUMNS.filter(
    (column) => column.alwaysVisible || visibleColumns[column.key]
  ).length;

  const updateColumn = (key, checked) => {
    onChange({ ...visibleColumns, [key]: checked });
  };

  const showAll = () => {
    onChange(DEFAULT_VISIBLE_COLUMN_KEYS);
  };

  const hideOptionalColumns = () => {
    const nextColumns = { ...DEFAULT_VISIBLE_COLUMN_KEYS };

    KEYWORD_TABLE_COLUMNS.forEach((column) => {
      nextColumns[column.key] = Boolean(column.alwaysVisible);
    });

    onChange(nextColumns);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Columns3 className="h-4 w-4 text-slate-500" />
          <div>
            <h2 className="text-sm font-black text-slate-900">컬럼 설정</h2>
            <p className="text-xs font-semibold text-slate-500">
              현재 {visibleCount}개 컬럼 표시 중
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
            type="button"
            onClick={showAll}
          >
            <Eye className="h-3.5 w-3.5" />
            전체 보기
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
            type="button"
            onClick={hideOptionalColumns}
          >
            <EyeOff className="h-3.5 w-3.5" />
            필수만 보기
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
            type="button"
            onClick={onReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            기본값
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {KEYWORD_TABLE_COLUMNS.map((column) => (
          <label
            className={`group relative flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
              column.alwaysVisible
                ? 'border-slate-200 bg-slate-100 text-slate-400'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
            }`}
            key={column.key}
            title={columnDescriptions[column.key]}
          >
            <input
              className="h-4 w-4 accent-slate-950 disabled:accent-slate-300"
              type="checkbox"
              checked={column.alwaysVisible || Boolean(visibleColumns[column.key])}
              disabled={column.alwaysVisible}
              onChange={(event) => updateColumn(column.key, event.target.checked)}
            />
            <span className="truncate">{column.label}</span>
            <HelpCircle className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="pointer-events-none absolute left-2 top-full z-20 mt-2 hidden w-64 rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold leading-5 text-white shadow-xl group-hover:block">
              {columnDescriptions[column.key]}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
