import { Lock, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { formatNumber, formatPercent, formatScore } from '../utils/formatters';
import { SORTABLE_COLUMNS } from '../utils/tableSort';
import KeywordBadge from './KeywordBadge';

export const KEYWORD_TABLE_COLUMNS = [
  { key: 'recommendAction',     label: '추천 상태',    defaultVisible: true },
  { key: 'keyword',             label: '키워드',        alwaysVisible: true, defaultVisible: true },
  { key: 'intentType',          label: '의도 유형',    defaultVisible: true },
  { key: 'relevanceLevel',      label: '연관도',        defaultVisible: false },
  { key: 'discoveryScore',      label: '발굴 점수',    sortable: true, align: 'right', defaultVisible: false },
  { key: 'totalSearch',         label: '총 검색량',    sortable: true, align: 'right', defaultVisible: true },
  { key: 'monthlyPcSearch',     label: 'PC 검색량',    align: 'right', defaultVisible: false },
  { key: 'monthlyMobileSearch', label: '모바일 검색량', align: 'right', defaultVisible: false },
  { key: 'mobileRatio',         label: '모바일 비중',  sortable: true, align: 'right', defaultVisible: true },
  { key: 'averageCtr',          label: '평균 CTR',     sortable: true, align: 'right', defaultVisible: true },
  { key: 'competition',         label: '경쟁도',        sortable: true, defaultVisible: true },
  { key: 'saturationScore',     label: '포화도',        sortable: true, align: 'right', defaultVisible: true },
  { key: 'efficiencyScore',     label: '효율 점수',    sortable: true, align: 'right', defaultVisible: true },
];

export const DEFAULT_VISIBLE_COLUMN_KEYS = KEYWORD_TABLE_COLUMNS.reduce((acc, col) => {
  acc[col.key] = Boolean(col.alwaysVisible || col.defaultVisible);
  return acc;
}, {});

/* macOS badge classes for inline table badges */
const RELEVANCE_CLASS = {
  높음: 'mac-badge-green',
  중간: 'mac-badge-orange',
  낮음: 'mac-badge-gray'
};

const INTENT_CLASS = {
  '창업 의도':  'mac-badge-green',
  '대리점/매장': 'mac-badge-blue',
  '비용/수익':  'mac-badge-indigo',
  '정보 탐색':  'mac-badge-orange',
  '판매/유통':  'mac-badge-purple',
  '핵심 연관':  'mac-badge-accent',
  '수리/중고':  'mac-badge-red',
  '잡키워드':   'mac-badge-red',
  '일반 후보':  'mac-badge-gray'
};

export default function KeywordTable({ rows, sortConfig, onSort, visibleColumns, isLoggedIn, onLoginPrompt }) {
  const activeColumns = KEYWORD_TABLE_COLUMNS.filter(
    (col) => col.alwaysVisible || visibleColumns?.[col.key]
  );
  const minWidth = Math.max(980, activeColumns.length * 118);

  if (!rows.length) {
    return (
      <div
        className="mac-card p-10 text-center"
        style={{ fontSize: 14, color: 'var(--text-tertiary)' }}
      >
        추천 키워드가 없습니다. 다른 키워드로 다시 조회해 주세요.
      </div>
    );
  }

  return (
    <section className="mac-card overflow-hidden">
      <div className="mac-scroll" style={{ maxHeight: 620, overflowX: 'auto', overflowY: 'auto' }}>
        <table className="mac-table" style={{ minWidth }}>
          <thead>
            <tr>
              {activeColumns.map((col) => (
                <th
                  key={col.key}
                  className={sortConfig.key === col.key ? 'th-active' : ''}
                  style={{ textAlign: col.align === 'right' ? 'right' : 'left' }}
                >
                  {col.sortable ? (
                    <button
                      className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition"
                      style={{ color: 'inherit', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      type="button"
                      onClick={() => onSort(col.key)}
                      title={`${SORTABLE_COLUMNS[col.key]} 정렬`}
                    >
                      {col.label}
                      {sortConfig.key === col.key
                        ? sortConfig.direction === 'asc'
                          ? <ArrowUp className="h-3 w-3" />
                          : <ArrowDown className="h-3 w-3" />
                        : <ArrowUpDown className="h-3 w-3" style={{ opacity: 0.4 }} />
                      }
                    </button>
                  ) : col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.keyword}>
                {activeColumns.map((col) => (
                  <TableCell key={col.key} column={col} row={row} isLoggedIn={isLoggedIn} onLoginPrompt={onLoginPrompt} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TableCell({ column, row, isLoggedIn, onLoginPrompt }) {
  // 효율 점수: 비로그인 시 잠금 표시
  if (column.key === 'efficiencyScore' && !isLoggedIn) {
    return (
      <td style={{ textAlign: 'right' }}>
        <button
          onClick={onLoginPrompt}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--bg-overlay)', padding: '2px 8px',
            cursor: 'pointer', fontFamily: 'inherit',
            color: 'var(--text-tertiary)', fontSize: 11,
          }}
          title="로그인하면 효율 점수를 볼 수 있어요"
        >
          <Lock style={{ width: 10, height: 10 }} />
          로그인
        </button>
      </td>
    );
  }
  if (column.key === 'recommendAction') {
    return (
      <td>
        <KeywordBadge action={row.recommendAction} />
      </td>
    );
  }

  if (column.key === 'keyword') {
    return (
      <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
        {row.keyword}
      </td>
    );
  }

  if (column.key === 'relevanceLevel') {
    return (
      <td>
        <span className={`mac-badge ${RELEVANCE_CLASS[row.relevanceLevel] || 'mac-badge-gray'}`}>
          {row.relevanceLevel || '낮음'}
        </span>
      </td>
    );
  }

  if (column.key === 'intentType') {
    return (
      <td>
        <span className={`mac-badge ${INTENT_CLASS[row.intentType] || 'mac-badge-gray'}`}>
          {row.intentType || '일반 후보'}
        </span>
      </td>
    );
  }

  if (column.key === 'competition') {
    return (
      <td style={{ color: 'var(--text-secondary)' }}>{row.competition}</td>
    );
  }

  const numericValue = getFormattedValue(column.key, row);
  const isStrong = column.key === 'totalSearch' || column.key === 'efficiencyScore';

  return (
    <td style={{ textAlign: 'right', fontWeight: isStrong ? 600 : 400, color: isStrong ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
      {numericValue}
    </td>
  );
}

function getFormattedValue(key, row) {
  const v = row[key];
  if (key.includes('Ctr') || key === 'averageCtr' || key === 'mobileRatio') return formatPercent(v);
  if (key.includes('Score')) return formatScore(v);
  if (key === 'averageDepth') return Number(v || 0).toFixed(1);
  return formatNumber(v);
}
