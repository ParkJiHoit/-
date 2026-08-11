import { Columns3 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { KEYWORD_TABLE_COLUMNS } from './KeywordTable';
import useDelayedUnmount from '../hooks/useDelayedUnmount';

const DESCRIPTIONS = {
  relevanceLevel:      '기준 키워드와의 텍스트/의도 유사도를 높음·중간·낮음으로 구분합니다.',
  discoveryScore:      '연관도·검색량·경쟁도·의도·포화도를 종합한 발굴 우선순위 점수입니다.',
  monthlyPcSearch:     '최근 기준 PC 월간 검색량입니다.',
  monthlyMobileSearch: '최근 기준 모바일 월간 검색량입니다.',
};

const optionalCols = KEYWORD_TABLE_COLUMNS.filter((c) => !c.alwaysVisible);

export default function ColumnVisibilitySettings({ visibleColumns, onChange, onReset }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { shouldRender: dropdownMounted, isClosing: dropdownClosing } = useDelayedUnmount(open);

  const extraCount = optionalCols.filter((c) => !c.defaultVisible && visibleColumns[c.key]).length;

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          height: 34, padding: '0 12px',
          background: 'var(--bg-overlay)',
          border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border)'}`,
          borderRadius: 8, fontSize: 13, fontWeight: 500,
          color: 'var(--text-secondary)', cursor: 'pointer',
          fontFamily: 'inherit', transition: 'border-color 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        <Columns3 style={{ width: 13, height: 13, flexShrink: 0 }} />
        컬럼
        {extraCount > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>+{extraCount}</span>
        )}
      </button>

      {dropdownMounted && (
        <div
          className="mac-dropdown"
          data-closing={dropdownClosing}
          style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 240, padding: '10px 14px', zIndex: 200 }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 8px' }}>
            추가 컬럼
          </p>

          {optionalCols.map((col) => (
            <label
              key={col.key}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                className="mac-checkbox"
                style={{ marginTop: 2, flexShrink: 0 }}
                checked={Boolean(visibleColumns[col.key])}
                onChange={(e) => onChange({ ...visibleColumns, [col.key]: e.target.checked })}
              />
              <div>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{col.label}</span>
                {DESCRIPTIONS[col.key] && (
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0', lineHeight: 1.4 }}>
                    {DESCRIPTIONS[col.key]}
                  </p>
                )}
              </div>
            </label>
          ))}

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={onReset}
              style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              기본값으로 초기화
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
