import { ChevronDown, FileText, Search, Sparkles, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LiquidMetalButton } from './ui/liquid-metal-button';

const NOTION_UPDATE_URL =
  'https://helix-territory-c92.notion.site/37b24604a09180c5956cf11cf9595818?source=copy_link';

const NOTION_GUIDE_URL =
  'https://helix-territory-c92.notion.site/37b24604a091802abe38f48e986102d7?source=copy_link';

const SERVICES = [
  { id: 'analysis',  icon: Search,   label: '키워드 분석', desc: '기준 키워드로 연관 키워드 발굴' },
  { id: 'expansion', icon: Sparkles, label: '키워드 확장', desc: '시드 키워드로 대량 발굴' },
  { id: 'blog',      icon: FileText, label: '블로그 분석', desc: '콘텐츠 기회 점수 분석' }
];

export default function Navbar({ activeTab, onSwitchTab, onGoHome, onMockAction, theme }) {
  const [serviceOpen, setServiceOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setServiceOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleServiceClick = (id) => {
    onSwitchTab(id);
    setServiceOpen(false);
  };

  const isDark = theme !== 'light';

  const navBg     = isDark ? 'rgba(62,62,68,0.52)'     : 'rgba(210,215,225,0.55)';
  const navBorder = isDark ? 'rgba(255,255,255,0.12)'  : 'rgba(0,0,0,0.10)';
  const navShadow = isDark
    ? '0 4px 32px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.08) inset'
    : '0 4px 24px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.9) inset';

  const divider = (
    <div style={{ width: 1, height: 16, background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)', flexShrink: 0 }} />
  );

  const pillItem = (id) => ({
    borderRadius: 999,
    padding: hoveredNav === id ? '6px 20px' : '6px 12px',
    transition: 'padding 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.18s ease, color 0.18s ease',
    background: hoveredNav === id
      ? isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'
      : 'transparent',
    fontSize: 11,
    fontWeight: 700,
    color: hoveredNav === id ? 'var(--text-primary)' : 'var(--text-secondary)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontFamily: 'inherit',
    textDecoration: 'none',
    lineHeight: 1,
  });

  return (
    <nav
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        height: 44,
        padding: '0 6px',
        gap: 2,
        background: navBg,
        backdropFilter: 'blur(24px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
        border: `1px solid ${navBorder}`,
        borderRadius: 999,
        boxShadow: navShadow,
        whiteSpace: 'nowrap',
      }}
    >
      {/* Logo */}
      <button
        onClick={onGoHome}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '0 10px 0 8px',
          border: 'none', background: 'transparent', cursor: 'pointer',
        }}
      >
        {/* Ranklet icon: rising bars */}
        <div
          style={{
            width: 24, height: 24, borderRadius: 7, flexShrink: 0,
            background: 'linear-gradient(135deg, #0A84FF 0%, #34C1FF 100%)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '4px 5px 3px',
            gap: 2,
            boxShadow: '0 2px 8px rgba(10,132,255,0.4)',
          }}
        >
          {[5, 9, 7].map((h, i) => (
            <div key={i} style={{ width: 3, height: h, borderRadius: 1.5, background: '#fff', opacity: i === 1 ? 1 : 0.75 }} />
          ))}
        </div>
        <span style={{
          fontSize: 13, fontWeight: 800, letterSpacing: '0.04em',
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          RANKLET
        </span>
      </button>

      {divider}

      {/* 서비스 dropdown */}
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <button
          style={pillItem('services')}
          onMouseEnter={() => setHoveredNav('services')}
          onMouseLeave={() => setHoveredNav(null)}
          onClick={() => setServiceOpen((v) => !v)}
        >
          모든 서비스
          <ChevronDown
            style={{
              width: 10, height: 10, opacity: 0.5,
              transition: 'transform 0.15s',
              transform: serviceOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </button>

        {serviceOpen && (
          <div
            className="mac-dropdown p-1.5"
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              top: 'calc(100% + 10px)',
              minWidth: 228,
            }}
          >
            {SERVICES.map(({ id, icon: Icon, label, desc }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left"
                  style={{ background: isActive ? 'var(--bg-overlay)' : 'transparent', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-overlay)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  onClick={() => handleServiceClick(id)}
                >
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: isActive ? 'var(--accent)' : 'var(--bg-overlay)' }}
                  >
                    <Icon className="h-4 w-4" style={{ color: isActive ? '#fff' : 'var(--text-secondary)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 요금제 */}
      <button
        style={pillItem('pricing')}
        onMouseEnter={() => setHoveredNav('pricing')}
        onMouseLeave={() => setHoveredNav(null)}
        onClick={() => onSwitchTab('pricing')}
      >
        요금제
      </button>

      {/* 사용 가이드 */}
      <a
        href={NOTION_GUIDE_URL}
        target="_blank"
        rel="noreferrer"
        style={pillItem('guide')}
        onMouseEnter={() => setHoveredNav('guide')}
        onMouseLeave={() => setHoveredNav(null)}
      >
        사용 가이드
      </a>

      {/* 업데이트 */}
      <a
        href={NOTION_UPDATE_URL}
        target="_blank"
        rel="noreferrer"
        style={pillItem('updates')}
        onMouseEnter={() => setHoveredNav('updates')}
        onMouseLeave={() => setHoveredNav(null)}
      >
        업데이트
      </a>

      {divider}

      {/* 로그인 */}
      <LiquidMetalButton
        label="로그인"
        onClick={onMockAction}
        viewMode="text"
        height={34}
        width={82}
      />

      {/* 가입하기 */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <LiquidMetalButton
          label="가입하기"
          onClick={onMockAction}
          viewMode="text"
          height={34}
          width={96}
        />

        {/* 둥실둥실 7일 무료체험 뱃지 */}
        {/* 외부 div: 위치 잡기 (transform으로 정렬) — 애니메이션 없음 */}
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 12px)',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}>
          {/* 내부 div: 둥실 애니메이션만 담당 */}
          <div className="float-bob" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* 말풍선 꼬리 */}
            <div style={{
              width: 0, height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: '6px solid #FF9F0A',
              marginBottom: -1,
            }} />
            <div style={{
              background: 'linear-gradient(135deg, #FF9F0A 0%, #FF6B35 100%)',
              borderRadius: 20,
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '0.02em',
              boxShadow: '0 4px 16px rgba(255,159,10,0.5), 0 2px 4px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              🎁 7일 무료체험
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
