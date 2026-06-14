import { useMemo } from 'react';

export default function ClusterTabs({ keywords, selected, onChange }) {
  const clusters = useMemo(() => {
    if (!keywords?.length) return [];
    const map = new Map();
    for (const kw of keywords) {
      const src = kw.sourceKeyword || kw.baseKeyword || '기타';
      map.set(src, (map.get(src) || 0) + 1);
    }
    // Sort by count desc, base keyword always first
    const baseKw = keywords[0]?.baseKeyword || '';
    return [...map.entries()]
      .sort(([aKey, aC], [bKey, bC]) => {
        const aIsBase = aKey === baseKw;
        const bIsBase = bKey === baseKw;
        if (aIsBase !== bIsBase) return aIsBase ? -1 : 1;
        return bC - aC;
      })
      .map(([label, count]) => ({ label, count }));
  }, [keywords]);

  if (clusters.length <= 1) return null;

  const total = keywords?.length || 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}
    >
      {/* 레이블 */}
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-tertiary)',
        marginRight: 4, flexShrink: 0,
      }}>
        클러스터
      </span>

      {/* 전체 탭 */}
      <ClusterTab
        label="전체"
        count={total}
        active={selected === null}
        onClick={() => onChange(null)}
        isBase
      />

      {/* 클러스터 탭들 */}
      {clusters.map(({ label, count }) => (
        <ClusterTab
          key={label}
          label={label}
          count={count}
          active={selected === label}
          onClick={() => onChange(selected === label ? null : label)}
        />
      ))}
    </div>
  );
}

function ClusterTab({ label, count, active, onClick, isBase }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 999,
        border: active
          ? '1px solid var(--accent)'
          : '1px solid var(--border)',
        background: active
          ? 'rgba(10,132,255,0.12)'
          : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize: 11,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        transition: 'all 0.12s',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {label}
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        color: active ? 'var(--accent)' : 'var(--text-tertiary)',
        background: active ? 'rgba(10,132,255,0.15)' : 'var(--bg-overlay)',
        borderRadius: 99,
        padding: '1px 6px',
        minWidth: 18,
        textAlign: 'center',
      }}>
        {count}
      </span>
    </button>
  );
}
