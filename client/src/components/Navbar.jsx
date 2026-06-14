import { ChevronDown, FileText, Search, Sparkles, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const NOTION_UPDATE_URL =
  'https://helix-territory-c92.notion.site/37b24604a09180c5956cf11cf9595818?source=copy_link';

const NOTION_GUIDE_URL =
  'https://helix-territory-c92.notion.site/37b24604a091802abe38f48e986102d7?source=copy_link';

const SERVICES = [
  { id: 'analysis',  icon: Search,   label: '키워드 분석', desc: '기준 키워드로 연관 키워드 발굴' },
  { id: 'expansion', icon: Sparkles, label: '키워드 확장', desc: '시드 키워드로 대량 발굴' },
  { id: 'blog',      icon: FileText, label: '블로그 분석', desc: '콘텐츠 기회 점수 분석' }
];

export default function Navbar({ activeTab, onSwitchTab, onGoHome, onGoToService, onMockAction, theme }) {
  const [serviceOpen, setServiceOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);
  const [hoveredService, setHoveredService] = useState(null);
  const [comingSoonVisible, setComingSoonVisible] = useState(false);
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
    if (id === 'expansion') {
      setServiceOpen(false);
      setComingSoonVisible(true);
      setTimeout(() => setComingSoonVisible(false), 2200);
      return;
    }
    onGoToService(id);
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
    <>
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
          주요 서비스
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
              const isHovered = hoveredService === id;
              const isComingSoon = id === 'expansion';
              const highlighted = isActive || isHovered;
              return (
                <button
                  key={id}
                  className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left"
                  style={{
                    background: highlighted
                      ? isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
                      : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={() => setHoveredService(id)}
                  onMouseLeave={() => setHoveredService(null)}
                  onClick={() => handleServiceClick(id)}
                >
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: isActive ? 'var(--accent)' : isHovered ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)') : 'var(--bg-overlay)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <Icon className="h-4 w-4" style={{ color: isActive ? '#fff' : isHovered ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{label}</p>
                      {isComingSoon && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                          color: '#FF9F0A', background: 'rgba(255,159,10,0.12)',
                          border: '1px solid rgba(255,159,10,0.3)',
                          borderRadius: 4, padding: '1px 5px',
                        }}>준비중</span>
                      )}
                    </div>
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
      <button
        onClick={onMockAction}
        style={{
          ...pillItem('login'),
          padding: hoveredNav === 'login' ? '6px 16px' : '6px 10px',
        }}
        onMouseEnter={() => setHoveredNav('login')}
        onMouseLeave={() => setHoveredNav(null)}
      >
        로그인
      </button>

      {/* 가입하기 */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={onMockAction}
          style={{
            borderRadius: 999,
            padding: '6px 14px',
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s',
            display: 'block',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
        >
          가입하기
        </button>

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
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderBottom: `5px solid ${isDark ? 'rgba(30,80,180,0.6)' : 'rgba(30,80,180,0.4)'}`,
              marginBottom: -1,
            }} />
            <div style={{
              background: isDark ? 'rgba(20,60,160,0.28)' : 'rgba(20,60,160,0.14)',
              borderRadius: 20,
              padding: '4px 11px',
              fontSize: 10,
              fontWeight: 600,
              color: isDark ? 'rgba(150,190,255,0.95)' : 'rgba(30,80,200,0.9)',
              letterSpacing: '0.04em',
              border: `1px solid ${isDark ? 'rgba(60,120,240,0.4)' : 'rgba(60,120,240,0.3)'}`,
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              7일 무료체험
            </div>
          </div>
        </div>
      </div>
    </nav>

    {/* 준비중 토스트 — nav 바깥에서 렌더해야 fixed 위치가 정상 동작 */}
    {comingSoonVisible && (
      <div style={{
        position: 'fixed',
        bottom: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: isDark ? 'rgba(44,44,46,0.96)' : 'rgba(255,255,255,0.96)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
        borderRadius: 999,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        animation: 'macFadeUp 0.2s ease',
      }}>
        <Sparkles style={{ width: 14, height: 14, color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          키워드 확장 — 곧 출시 예정입니다
        </span>
      </div>
    )}
    </>
  );
}
