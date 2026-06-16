import { ChevronDown, FileText, LogOut, Search, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext';
import logoLight from '../assets/logo-light.png';
import logoDark from '../assets/logo-dark.png';

const NOTION_UPDATE_URL =
  'https://helix-territory-c92.notion.site/37b24604a09180c5956cf11cf9595818?source=copy_link';

const NOTION_GUIDE_URL =
  'https://helix-territory-c92.notion.site/37b24604a091802abe38f48e986102d7?source=copy_link';

const SHADCN_AVATARS = [
  'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-1.png',
  'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-2.png',
  'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-3.png',
  'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-4.png',
  'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-5.png',
  'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-6.png',
  'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-7.png',
  'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-8.png',
];

// 유저 ID 기반으로 항상 같은 아바타 배정
function getAssignedAvatar(userId) {
  if (!userId) return SHADCN_AVATARS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return SHADCN_AVATARS[hash % SHADCN_AVATARS.length];
}

const SERVICES = [
  { id: 'analysis',     icon: Search,      label: '키워드 분석', desc: '기준 키워드로 연관 키워드 발굴' },
  { id: 'blog',         icon: FileText,    label: '블로그 분석', desc: '콘텐츠 기회 점수 분석' },
  { id: 'rank-tracker', icon: TrendingUp,  label: '순위 추적',   desc: '블로그 키워드 순위 일별 추적' },
];

export default function Navbar({ activeTab, onSwitchTab, onGoHome, onGoToService, theme }) {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [serviceOpen, setServiceOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);
  const [hoveredService, setHoveredService] = useState(null);
  const dropdownRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setServiceOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleServiceClick = (id) => {
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
    <div style={{ width: 1, height: 16, background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)', flexShrink: 0, margin: '0 8px' }} />
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
          display: 'flex', alignItems: 'center',
          padding: '0 6px 0 4px',
          border: 'none', background: 'transparent', cursor: 'pointer',
        }}
      >
        <img
          src={isDark ? logoDark : logoLight}
          alt="RANKLET"
          style={{
            height: 22, width: 'auto', display: 'block',
            mixBlendMode: isDark ? 'screen' : 'multiply',
          }}
        />
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

      {user ? (
        /* ── 로그인 상태: 아바타 + 드롭다운 ── */
        <div style={{ position: 'relative', flexShrink: 0 }} ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '4px 10px 4px 4px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
              borderRadius: 999,
              background: userMenuOpen
                ? isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'
                : 'transparent',
              cursor: 'pointer',
              transition: 'background 0.15s',
              fontFamily: 'inherit',
            }}
          >
            <img
              src={getAssignedAvatar(user.id)}
              alt="avatar"
              style={{ width: 26, height: 26, borderRadius: 999, objectFit: 'cover', flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
            </span>
            <ChevronDown style={{ width: 10, height: 10, opacity: 0.5, transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>

          {userMenuOpen && (
            <div className="mac-dropdown p-1.5" style={{
              position: 'absolute', right: 0, top: 'calc(100% + 10px)', minWidth: 180,
            }}>
              <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.user_metadata?.full_name || '사용자'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </p>
              </div>
              <button
                onClick={() => { signOut(); setUserMenuOpen(false); }}
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--destructive)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,69,58,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <LogOut style={{ width: 14, height: 14 }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>로그아웃</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ── 비로그인 상태: 로그인 버튼 하나 ── */
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => onSwitchTab('auth')}
            style={{
              borderRadius: 999, padding: '6px 14px', border: 'none',
              background: 'var(--accent)', color: '#fff',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
          >
            로그인
          </button>
          <div style={{
            position: 'absolute', top: 'calc(100% + 12px)', left: '50%',
            transform: 'translateX(-50%)', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10,
          }}>
            <div className="float-bob" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 0, height: 0,
                borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
                borderBottom: `5px solid ${isDark ? 'rgba(30,80,180,0.6)' : 'rgba(30,80,180,0.4)'}`,
                marginBottom: -1,
              }} />
              <div style={{
                background: isDark ? 'rgba(20,60,160,0.28)' : 'rgba(20,60,160,0.14)',
                borderRadius: 20, padding: '4px 11px', fontSize: 10, fontWeight: 600,
                color: isDark ? 'rgba(150,190,255,0.95)' : 'rgba(30,80,200,0.9)',
                letterSpacing: '0.04em',
                border: `1px solid ${isDark ? 'rgba(60,120,240,0.4)' : 'rgba(60,120,240,0.3)'}`,
                backdropFilter: 'blur(8px)',
              }}>
                7일 무료체험
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>

    </>
  );
}
