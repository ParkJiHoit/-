import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { formatNumber, formatPercent, formatScore } from '../utils/formatters';
import { SORTABLE_COLUMNS } from '../utils/tableSort';
import KeywordBadge, { getActionRowClass } from './KeywordBadge';

export const KEYWORD_TABLE_COLUMNS = [
  { key: 'recommendAction', label: '추천 상태', defaultVisible: true },
  { key: 'keyword', label: '키워드', alwaysVisible: true, defaultVisible: true },
  { key: 'intentType', label: '의도 유형', defaultVisible: true },
  { key: 'discoveryScore', label: '발굴 점수', sortable: true, align: 'right', defaultVisible: true },
  { key: 'relevanceLevel', label: '연관도', defaultVisible: true },
  { key: 'relevanceScore', label: '연관도 점수', sortable: true, align: 'right', defaultVisible: false },
  { key: 'intentScore', label: '의도 점수', sortable: true, align: 'right', defaultVisible: false },
  { key: 'monthlyPcSearch', label: 'PC 검색량', align: 'right', defaultVisible: false },
  { key: 'monthlyMobileSearch', label: '모바일 검색량', align: 'right', defaultVisible: false },
  { key: 'totalSearch', label: '총 검색량', sortable: true, align: 'right', defaultVisible: true },
  { key: 'mobileRatio', label: '모바일 비중', sortable: true, align: 'right', defaultVisible: true },
  { key: 'monthlyPcCtr', label: 'PC 평균 CTR', align: 'right', defaultVisible: false },
  { key: 'monthlyMobileCtr', label: '모바일 평균 CTR', align: 'right', defaultVisible: false },
  { key: 'averageCtr', label: '평균 CTR', sortable: true, align: 'right', defaultVisible: true },
  { key: 'competition', label: '경쟁도', sortable: true, defaultVisible: true },
  { key: 'averageDepth', label: '평균 노출 깊이', sortable: true, align: 'right', defaultVisible: false },
  { key: 'saturationScore', label: '포화도 점수', sortable: true, align: 'right', defaultVisible: true },
  { key: 'efficiencyScore', label: '효율 점수', sortable: true, align: 'right', defaultVisible: true },
  { key: 'recommendActionText', label: '추천 액션', defaultVisible: false }
];

export const DEFAULT_VISIBLE_COLUMN_KEYS = KEYWORD_TABLE_COLUMNS.reduce((columns, column) => {
  columns[column.key] = Boolean(column.alwaysVisible || column.defaultVisible);
  return columns;
}, {});

const relevanceStyles = {
  높음: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  중간: 'bg-amber-100 text-amber-700 ring-amber-200',
  낮음: 'bg-slate-100 text-slate-600 ring-slate-200'
};

const intentStyles = {
  '창업 의도': 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  '대리점/매장': 'bg-sky-100 text-sky-700 ring-sky-200',
  '비용/수익': 'bg-indigo-100 text-indigo-700 ring-indigo-200',
  '정보 탐색': 'bg-amber-100 text-amber-700 ring-amber-200',
  '판매/유통': 'bg-violet-100 text-violet-700 ring-violet-200',
  '핵심 연관': 'bg-slate-900 text-white ring-slate-900',
  '수리/중고': 'bg-orange-100 text-orange-700 ring-orange-200',
  잡키워드: 'bg-rose-100 text-rose-700 ring-rose-200',
  '일반 후보': 'bg-slate-100 text-slate-600 ring-slate-200'
};

export default function KeywordTable({ rows, sortConfig, onSort, visibleColumns }) {
  const activeColumns = KEYWORD_TABLE_COLUMNS.filter(
    (column) => column.alwaysVisible || visibleColumns?.[column.key]
  );
  const minWidth = Math.max(980, activeColumns.length * 118);

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-semibold text-slate-500">
        추천 키워드가 없습니다. 다른 키워드로 다시 조회해 주세요.
      </div>
    );
  }

  return (
    <section className="apple-card overflow-hidden">
      <div className="scrollbar-thin max-h-[620px] overflow-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth }}>
          <thead className="sticky top-0 z-10 bg-slate-950 text-left text-xs font-bold uppercase tracking-wide text-white">
            <tr>
              {activeColumns.map((column) => (
                <th
                  className={`whitespace-nowrap px-4 py-3 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                  key={column.key}
                >
                  {column.sortable ? (
                    <button
                      className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-white/10"
                      type="button"
                      onClick={() => onSort(column.key)}
                      title={`${SORTABLE_COLUMNS[column.key]} 정렬`}
                    >
                      {column.label}
                      {sortConfig.key === column.key ? (
                        sortConfig.direction === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr className={`${getActionRowClass(row)} transition hover:bg-slate-100`} key={row.keyword}>
                {activeColumns.map((column) => (
                  <TableCell column={column} row={row} key={column.key} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TableCell({ column, row }) {
  if (column.key === 'recommendAction') {
    return (
      <td className="whitespace-nowrap px-4 py-3">
        <KeywordBadge action={row.recommendAction} />
      </td>
    );
  }

  if (column.key === 'keyword') {
    return <td className="whitespace-nowrap px-4 py-3 font-black text-slate-950">{row.keyword}</td>;
  }

  if (column.key === 'relevanceLevel') {
    return (
      <td className="whitespace-nowrap px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${
            relevanceStyles[row.relevanceLevel] || relevanceStyles.낮음
          }`}
        >
          {row.relevanceLevel || '낮음'}
        </span>
      </td>
    );
  }

  if (column.key === 'intentType') {
    return (
      <td className="whitespace-nowrap px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${
            intentStyles[row.intentType] || intentStyles['일반 후보']
          }`}
        >
          {row.intentType || '일반 후보'}
        </span>
      </td>
    );
  }

  if (column.key === 'competition') {
    return <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{row.competition}</td>;
  }

  if (column.key === 'recommendActionText') {
    return <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{row.recommendAction}</td>;
  }

  const numericValue = getFormattedValue(column.key, row);

  return (
    <NumberCell
      value={numericValue}
      strong={column.key === 'totalSearch' || column.key === 'efficiencyScore' || column.key === 'discoveryScore'}
    />
  );
}

function getFormattedValue(key, row) {
  const value = row[key];

  if (key.includes('Ctr') || key === 'averageCtr' || key === 'mobileRatio') {
    return formatPercent(value);
  }

  if (key.includes('Score')) {
    return formatScore(value);
  }

  if (key === 'averageDepth') {
    return Number(value || 0).toFixed(1);
  }

  return formatNumber(value);
}

function NumberCell({ value, strong = false }) {
  return (
    <td
      className={`whitespace-nowrap px-4 py-3 text-right ${
        strong ? 'font-black text-slate-950' : 'font-semibold text-slate-700'
      }`}
    >
      {value}
    </td>
  );
}
