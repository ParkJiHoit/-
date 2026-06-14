import { formatNumber } from '../utils/formatters';

const REL_STYLE = {
  '높음': { bg: '#30d15818', color: '#30d158', border: '#30d15830' },
  '중간': { bg: '#FF9F0A18', color: '#FF9F0A', border: '#FF9F0A30' },
  '낮음': { bg: 'var(--bg-overlay)', color: 'var(--text-tertiary)', border: 'var(--border)' },
};

const COMP_COLOR = {
  '낮음': '#30d158',
  '중간': '#FF9F0A',
  '높음': '#ff6b6b',
};

export default function SerpKeywordSection({ serpKeywords, onKeywordClick }) {
  const isEmpty = !serpKeywords?.length;

  return (
    <div className="mac-card overflow-hidden">
      {/* 헤더 */}
      <div style={{
        padding: '12px 16px 11px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--text-secondary)',
        }}>
          연관 키워드
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
          padding: '2px 7px', borderRadius: 4,
          background: '#0A84FF18', color: '#0A84FF', border: '1px solid #0A84FF30',
        }}>
          SERP 기준
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)' }}>
          네이버 검색결과(SERP) 기반 연관 키워드 · 클릭 시 재분석
        </span>
      </div>

      {/* 테이블 or 빈 상태 */}
      {isEmpty ? (
        <div style={{
          padding: '32px 20px',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 13,
        }}>
          SERP 기준 연관 검색어가 없습니다.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {[
                  { label: '#',    align: 'left',  w: 36 },
                  { label: '키워드', align: 'left', w: undefined },
                  { label: '검색량', align: 'right', w: 90 },
                  { label: '경쟁도', align: 'right', w: 72 },
                  { label: '연관도', align: 'right', w: 72 },
                ].map(({ label, align, w }) => (
                  <th key={label} style={{
                    padding: '7px 14px',
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: 'var(--text-tertiary)', textAlign: align,
                    background: 'var(--bg-secondary)',
                    ...(w ? { width: w } : {}),
                  }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {serpKeywords.map((kw, i) => {
                const rel  = REL_STYLE[kw.relevanceLevel]  || REL_STYLE['낮음'];
                const compColor = COMP_COLOR[kw.competition] || 'var(--text-tertiary)';
                return (
                  <tr
                    key={kw.keyword}
                    onClick={() => onKeywordClick(kw.keyword)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-overlay)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>{i + 1}</span>
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {kw.keyword}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: kw.totalSearch > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        {kw.totalSearch > 0 ? formatNumber(kw.totalSearch) : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                      <span style={{ fontSize: 11, color: compColor }}>
                        {kw.competition || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                      {kw.relevanceLevel ? (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                          background: rel.bg, color: rel.color, border: `1px solid ${rel.border}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {kw.relevanceLevel}
                        </span>
                      ) : <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
