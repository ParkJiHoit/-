import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export default function InfoTip({ text, placement = 'top' }) {
  const [show, setShow] = useState(false);
  const isTop = placement === 'top';
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 4, verticalAlign: 'middle' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <HelpCircle style={{ width: 11, height: 11, color: 'var(--text-tertiary)', cursor: 'default' }} />
      {show && (
        <span style={{
          position: 'absolute',
          ...(isTop ? { bottom: 'calc(100% + 7px)' } : { top: 'calc(100% + 7px)' }),
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 300, width: 220,
          background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
          borderRadius: 10, padding: '9px 12px',
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
          boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
          pointerEvents: 'none', whiteSpace: 'normal', textAlign: 'left',
          fontWeight: 400,
          transformOrigin: isTop ? 'bottom center' : 'top center',
          animation: 'macScaleIn 0.15s var(--ease-out) both',
        }}>
          {text}
        </span>
      )}
    </span>
  );
}
