import { useState } from 'react';
import { GUIDE_CATEGORIES } from '../data/guideContent';

export default function GuidePage() {
  const [selectedId, setSelectedId] = useState(GUIDE_CATEGORIES[0].items[0].id);

  const selectedItem = GUIDE_CATEGORIES
    .flatMap(cat => cat.items)
    .find(item => item.id === selectedId) || GUIDE_CATEGORIES[0].items[0];

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 lg:px-10" style={{
      paddingTop: 'calc(var(--nav-offset) + 32px)', paddingBottom: 64,
    }}>
      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)', margin: '0 0 24px' }}>
        사용 가이드
      </h1>

      <div className="grid gap-8 lg:grid-cols-[250px_1fr]" style={{ alignItems: 'start' }}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 22, position: 'sticky', top: 'calc(var(--nav-offset) + 16px)' }}>
          {GUIDE_CATEGORIES.map(cat => (
            <div key={cat.id}>
              <p style={{ margin: '0 0 9px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                {cat.label}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {cat.items.map(item => {
                  const active = item.id === selectedId;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      style={{
                        textAlign: 'left', padding: '8px 11px', borderRadius: 8,
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 14, fontWeight: active ? 700 : 500,
                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        background: active ? 'rgba(10,132,255,0.1)' : 'transparent',
                        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                      }}
                    >
                      {item.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mac-card" style={{ padding: '32px 36px', minWidth: 0 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>
            {selectedItem.title}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.6 }}>
            {selectedItem.summary}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {selectedItem.steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, width: 24, height: 24, borderRadius: '50%', marginTop: 1,
                  background: 'rgba(10,132,255,0.12)', color: 'var(--accent)',
                  fontSize: 12.5, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {i + 1}
                </span>
                <p style={{ margin: 0, fontSize: 15.5, color: 'var(--text-primary)', lineHeight: 1.65 }}>
                  {step}
                </p>
              </div>
            ))}
          </div>
          {selectedItem.tip && (
            <div style={{
              marginTop: 24, padding: '14px 18px', borderRadius: 10,
              background: 'rgba(10,132,255,0.08)', borderLeft: '3px solid var(--accent)',
            }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                💡 {selectedItem.tip}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
