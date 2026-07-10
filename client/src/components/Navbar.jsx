import { ChevronDown, FileText, Home, LogOut, MessageSquarePlus, Search, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext';
import SearchHistoryDropdown from './SearchHistoryDropdown';
import logoLight from '../assets/logo-light.png';
import logoDark from '../assets/logo-dark.png';

const NOTION_UPDATE_URL =
  'https://helix-territory-c92.notion.site/37b24604a09180c5956cf11cf9595818?source=copy_link';

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
  { id: 'dashboard',    icon: Home,        label: '대시보드',   desc: '순위 변동과 최근 활동 한눈에 보기' },
  { id: 'analysis',     icon: Search,      label: '키워드 분석', desc: '기준 키워드로 연관 키워드 발굴' },
  { id: 'blog',         icon: FileText,    label: '블로그 분석', desc: '콘텐츠 기회 점수 분석' },
  { id: 'rank-tracker', icon: TrendingUp,  label: '순위 추적',   desc: '블로그 키워드 순위 일별 추적' },
];

export default function Navbar({ activeTab, onSwitchTab, onGoHome, onGoToService, theme, isSubscribed, onSelectHistory }) {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [serviceOpen, setServiceOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);
  const [hoveredService, setHoveredService] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('bug');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const dropdownRef = useRef(null);
  const userMenuRef = useRef(null);

  async function handleFeedbackSubmit() {
    if (!feedbackContent.trim()) return;
    setFeedbackSending(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: feedbackType, content: feedbackContent, email: user?.email }),
      });
      setFeedbackDone(true);
      setFeedbackContent('');
      setTimeout(() => { setFeedbackOpen(false); setFeedbackDone(false); }, 1500);
    } catch {
      alert('전송에 실패했습니다.');
    } finally {
      setFeedbackSending(false);
    }
  }

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

      {/* 최근 검색 */}
      {user && (
        <SearchHistoryDropdown
          user={user}
          isDark={isDark}
          onSelect={onSelectHistory}
          pillStyle={pillItem('history')}
        />
      )}

      {/* 요금제 */}
      <div style={{ position: 'relative' }}>
        <button
          style={pillItem('pricing')}
          onMouseEnter={() => setHoveredNav('pricing')}
          onMouseLeave={() => setHoveredNav(null)}
          onClick={() => onSwitchTab('pricing')}
        >
          요금제
        </button>
      </div>

      {/* 사용 가이드 */}
      <button
        style={pillItem('guide')}
        onMouseEnter={() => setHoveredNav('guide')}
        onMouseLeave={() => setHoveredNav(null)}
        onClick={() => onSwitchTab('guide')}
      >
        사용 가이드
      </button>

      {/* 업데이트 */}
      <button
        style={pillItem('updates')}
        onMouseEnter={() => setHoveredNav('updates')}
        onMouseLeave={() => setHoveredNav(null)}
        onClick={() => window.open(NOTION_UPDATE_URL, '_blank', 'noopener,noreferrer')}
      >
        업데이트
      </button>

      {divider}

      {/* 피드백 버튼 */}
      <button
        onClick={() => setFeedbackOpen(true)}
        style={pillItem('feedback')}
        onMouseEnter={() => setHoveredNav('feedback')}
        onMouseLeave={() => setHoveredNav(null)}
      >
        <MessageSquarePlus size={11} />
        피드백
      </button>

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
        /* ── 비로그인 상태: 로그인 버튼 ── */
        <button
          onClick={() => onSwitchTab('auth')}
          style={{
            borderRadius: 999, padding: '6px 14px', border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
        >
          로그인
        </button>
      )}
    </nav>

    {feedbackOpen && (
      <div onClick={() => setFeedbackOpen(false)} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: 24,
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: 16, padding: '28px 28px',
          maxWidth: 460, width: '100%',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>피드백 보내기</h2>
            <button onClick={() => setFeedbackOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-tertiary)', lineHeight: 1 }}>✕</button>
          </div>

          {feedbackDone ? (
            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 15, color: 'var(--text-primary)', fontWeight: 700 }}>
              감사합니다! 소중한 피드백을 잘 받았습니다 🙏
            </div>
          ) : (
            <>
              {/* 유형 선택 */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[{ id: 'bug', label: '버그 신고' }, { id: 'feature', label: '기능 제안' }].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setFeedbackType(id)}
                    style={{
                      flex: 1, height: 40, borderRadius: 10,
                      border: feedbackType === id ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                      background: feedbackType === id ? 'rgba(10,132,255,0.12)' : isDark ? '#2C2C2E' : '#F2F2F7',
                      color: feedbackType === id ? 'var(--accent)' : 'var(--text-secondary)',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.15s',
                      textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 내용 입력 */}
              <textarea
                value={feedbackContent}
                onChange={e => setFeedbackContent(e.target.value)}
                placeholder={feedbackType === 'bug' ? '어떤 버그를 발견하셨나요? 재현 방법을 알려주시면 더 빨리 해결할 수 있어요.' : '어떤 기능이 있으면 좋을 것 같나요?'}
                rows={5}
                style={{
                  width: '100%', borderRadius: 10, padding: '12px 14px',
                  border: '1.5px solid var(--border)',
                  background: isDark ? '#2C2C2E' : '#F2F2F7', color: 'var(--text-primary)',
                  fontSize: 13, fontFamily: 'inherit', resize: 'none',
                  outline: 'none', boxSizing: 'border-box', lineHeight: 1.6,
                }}
              />

              <button
                onClick={handleFeedbackSubmit}
                disabled={feedbackSending || !feedbackContent.trim()}
                style={{
                  width: '100%', marginTop: 12, padding: '11px 0',
                  background: feedbackContent.trim() ? 'var(--accent)' : isDark ? '#2C2C2E' : '#F2F2F7',
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 700,
                  color: feedbackContent.trim() ? '#fff' : 'var(--text-tertiary)',
                  cursor: feedbackContent.trim() ? 'pointer' : 'default',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }}
              >
                {feedbackSending ? '전송 중...' : '보내기'}
              </button>
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
}
