import { useState } from 'react';
import { Lock, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { formatNumber, formatPercent, formatScore } from '../utils/formatters';
import { SORTABLE_COLUMNS } from '../utils/tableSort';
import KeywordBadge from './KeywordBadge';
import { KEYWORD_TABLE_COLUMNS } from './KeywordTable';

const RELEVANCE_CLASS = {
  높음: 'mac-badge-green',
  중간: 'mac-badge-orange',
  낮음: 'mac-badge-gray',
};

const INTENT_CLASS = {
  '창업 의도':   'mac-badge-green',
  '대리점/매장': 'mac-badge-blue',
  '비용/수익':   'mac-badge-indigo',
  '정보 탐색':   'mac-badge-orange',
  '판매/유통':   'mac-badge-purple',
  '핵심 연관':   'mac-badge-accent',
  '수리/중고':   'mac-badge-red',
  '잡키워드':    'mac-badge-red',
  '일반 후보':   'mac-badge-gray',
};

/* 숫자 아래 얇은 바 */
function InlineBar({ value, color, max = 100 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
      <div style={{ width: 36, height: 2, borderRadius: 1, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min((typeof value === 'number' ? value : parseFloat(value)) / max * 100, 100)}%`,
          height: '100%', background: color, borderRadius: 1,
          transition: 'width 0.5s cubic-bezier(0.34,1.2,0.64,1)',
        }} />
      </div>
    </div>
  );
}

export default function KeywordTableB({ rows, sortConfig, onSort, visibleColumns, isLoggedIn, onLoginPrompt }) {
  const activeColumns = KEYWORD_TABLE_COLUMNS.filter(
    (col) => col.alwaysVisible || visibleColumns?.[col.key]
  );
  const minWidth = Math.max(980, activeColumns.length * 118);

  if (!rows.length) {
    return (
      <div className="mac-card p-10 text-center" style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
        추천 키워드가 없습니다. 다른 키워드로 다시 조회해 주세요.
      </div>
    );
  }

  return (
    <section
      className="mac-card overflow-hidden"
      style={{ borderTop: '2px solid rgba(10,132,255,0.35)' }}
    >
      <div style={{ maxHeight: 640, overflowX: 'auto', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth }}>

          {/* ── 헤더 ── */}
          <thead>
            <tr>
              {activeColumns.map((col) => {
                const isActive = sortConfig.key === col.key;
                return (
                  <th
                    key={col.key}
                    style={{
                      textAlign: col.align === 'right' ? 'right' : 'left',
                      padding: '13px 16px',
                      fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.09em', textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      position: 'sticky', top: 0, zIndex: 5,
                      background: isActive
                        ? 'linear-gradient(180deg, rgba(10,132,255,0.18) 0%, rgba(10,132,255,0.08) 100%)'
                        : 'var(--bg-elevated)',
                      color: isActive ? '#40A0FF' : 'var(--text-tertiary)',
                      borderBottom: `1px solid ${isActive ? 'rgba(10,132,255,0.35)' : 'var(--border)'}`,
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      transition: 'background 0.2s, color 0.2s',
                    }}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        title={`${SORTABLE_COLUMNS[col.key]} 정렬`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit',
                          letterSpacing: 'inherit', textTransform: 'inherit',
                          padding: '3px 6px', borderRadius: 5,
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(10,132,255,0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        {col.label}
                        {isActive
                          ? sortConfig.direction === 'asc'
                            ? <ArrowUp style={{ width: 10, height: 10 }} />
                            : <ArrowDown style={{ width: 10, height: 10 }} />
                          : <ArrowUpDown style={{ width: 10, height: 10, opacity: 0.3 }} />
                        }
                      </button>
                    ) : col.label}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* ── 바디 ── */}
          <tbody>
            {rows.map((row, idx) => (
              <TableRow
                key={row.keyword}
                row={row}
                idx={idx}
                activeColumns={activeColumns}
                sortKey={sortConfig.key}
                isLoggedIn={isLoggedIn}
                onLoginPrompt={onLoginPrompt}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TableRow({ row, idx, activeColumns, sortKey, isLoggedIn, onLoginPrompt }) {
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? 'linear-gradient(90deg, rgba(10,132,255,0.10) 0%, rgba(10,132,255,0.03) 30%, transparent 100%)'
          : idx % 2 === 0
            ? 'var(--bg-elevated)'
            : 'var(--bg-overlay)',
        transition: 'background 0.15s',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {activeColumns.map((col) => (
        <Cell
          key={col.key}
          column={col}
          row={row}
          isActive={sortKey === col.key}
          isLoggedIn={isLoggedIn}
          onLoginPrompt={onLoginPrompt}
          hovered={hovered}
        />
      ))}
    </tr>
  );
}

function Cell({ column, row, isActive, isLoggedIn, onLoginPrompt, hovered }) {
  const tdBase = {
    padding: '12px 16px',
    whiteSpace: 'nowrap',
    fontSize: 13,
    background: isActive ? 'rgba(10,132,255,0.05)' : 'transparent',
    borderLeft: isActive ? '1px solid rgba(10,132,255,0.12)' : '1px solid transparent',
    transition: 'background 0.15s',
    verticalAlign: 'middle',
  };

  /* 잠금 */
  if (column.key === 'efficiencyScore' && !isLoggedIn) {
    return (
      <td style={{ ...tdBase, textAlign: 'right' }}>
        <button onClick={onLoginPrompt} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          border: '1px solid rgba(10,132,255,0.25)', borderRadius: 6,
          background: 'rgba(10,132,255,0.08)', padding: '3px 9px',
          cursor: 'pointer', fontFamily: 'inherit',
          color: '#40A0FF', fontSize: 11, fontWeight: 600,
          transition: 'background 0.12s',
        }}>
          <Lock style={{ width: 10, height: 10 }} /> 로그인
        </button>
      </td>
    );
  }

  /* 추천 상태 */
  if (column.key === 'recommendAction') {
    return <td style={tdBase}><KeywordBadge action={row.recommendAction} /></td>;
  }

  /* 키워드 — 이름 + 의도유형 두 줄 */
  if (column.key === 'keyword') {
    return (
      <td style={{ ...tdBase, minWidth: 140 }}>
        <p style={{
          margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.2,
          color: hovered ? 'var(--accent)' : 'var(--text-primary)',
          letterSpacing: '-0.2px',
          transition: 'color 0.12s',
        }}>
          {row.keyword}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1 }}>
          {row.intentType || '—'}
        </p>
      </td>
    );
  }

  /* 의도유형 — keyword 셀에 통합했으므로 badge만 */
  if (column.key === 'intentType') {
    return <td style={tdBase}><span className={`mac-badge ${INTENT_CLASS[row.intentType] || 'mac-badge-gray'}`}>{row.intentType || '일반 후보'}</span></td>;
  }

  /* 연관도 */
  if (column.key === 'relevanceLevel') {
    return <td style={tdBase}><span className={`mac-badge ${RELEVANCE_CLASS[row.relevanceLevel] || 'mac-badge-gray'}`}>{row.relevanceLevel || '낮음'}</span></td>;
  }

  /* 경쟁도 */
  if (column.key === 'competition') {
    const color = { 높음: '#FF453A', 중간: '#FF9F0A', 낮음: '#30D158' }[row.competition] ?? 'var(--text-secondary)';
    return (
      <td style={tdBase}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 12, fontWeight: 700, color,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
          {row.competition}
        </span>
      </td>
    );
  }

  /* 총 검색량 */
  if (column.key === 'totalSearch') {
    return (
      <td style={{ ...tdBase, textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          {formatNumber(row.totalSearch)}
        </span>
      </td>
    );
  }

  /* 모바일 비중 — 바 포함 */
  if (column.key === 'mobileRatio') {
    return (
      <td style={{ ...tdBase, textAlign: 'right' }}>
        <InlineBar value={row.mobileRatio} color="#0A84FF" max={100} />
      </td>
    );
  }

  /* 포화도 — 바 포함 */
  if (column.key === 'saturationScore') {
    const color = row.saturationScore >= 70 ? '#FF453A' : row.saturationScore >= 40 ? '#FF9F0A' : '#30D158';
    return (
      <td style={{ ...tdBase, textAlign: 'right' }}>
        <InlineBar value={row.saturationScore} color={color} max={100} />
      </td>
    );
  }

  /* 효율 점수 — 바 포함 */
  if (column.key === 'efficiencyScore') {
    const color = row.efficiencyScore >= 60 ? '#30D158' : row.efficiencyScore >= 40 ? '#FF9F0A' : '#FF453A';
    return (
      <td style={{ ...tdBase, textAlign: 'right' }}>
        <InlineBar value={row.efficiencyScore} color={color} max={100} />
      </td>
    );
  }

  /* 나머지 수치 */
  const v = row[column.key];
  let formatted;
  if (column.key.includes('Ctr') || column.key === 'averageCtr') formatted = formatPercent(v);
  else if (column.key.includes('Score')) formatted = formatScore(v);
  else if (column.key === 'averageDepth') formatted = Number(v || 0).toFixed(1);
  else formatted = formatNumber(v);

  return (
    <td style={{ ...tdBase, textAlign: column.align === 'right' ? 'right' : 'left', color: 'var(--text-secondary)' }}>
      {formatted}
    </td>
  );
}
