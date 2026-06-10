import { ChevronDown, FileText, Moon, Search, Sparkles, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const NOTION_URL =
  'https://helix-territory-c92.notion.site/37b24604a09180c5956cf11cf9595818?source=copy_link';

const SERVICES = [
  { id: 'analysis',  icon: Search,   label: '키워드 분석', desc: '기준 키워드로 연관 키워드 발굴' },
  { id: 'expansion', icon: Sparkles, label: '키워드 확장', desc: '시드 키워드로 대량 발굴' },
  { id: 'blog',      icon: FileText, label: '블로그 분석', desc: '콘텐츠 기회 점수 분석' }
];

const NAV_ITEMS = [
  { id: 'services', label: '서비스', dropdown: true },
  { id: 'pricing',  label: '요금제' },
  { id: 'updates',  label: '업데이트', href: NOTION_URL },
];

export default function Navbar({ activeTab, onSwitchTab, onMockAction, theme, onToggleTheme }) {
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

  const pillItem = (id) => ({
    borderRadius: 999,
    padding: hoveredNav === id ? '6px 22px' : '6px 14px',
    transition: 'padding 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.18s ease, color 0.18s ease',
    background: hoveredNav === id ? 'rgba(255,255,255,0.09)' : 'transparent',
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
  });

  return (
    <nav className="mac-nav">
      <div
        className="mx-auto flex h-full max-w-[1560px] items-center justify-between px-4"
        style={{ position: 'relative' }}
      >
        {/* ── Left: traffic lights + logo ── */}
        <div className="flex items-center gap-5">
          <div className="traffic-lights pl-0">
            <div className="traffic-dot tl-red" />
            <div className="traffic-dot tl-yellow" />
            <div className="traffic-dot tl-green" />
          </div>

          <button
            className="flex items-center gap-2"
            onClick={() => onSwitchTab('analysis')}
          >
            <div
              className="flex h-5 w-5 items-center justify-center rounded-md"
              style={{ background: 'var(--accent)' }}
            >
              <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>K</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              키워드랩
            </span>
          </button>
        </div>

        {/* ── Center: elastic pill nav ── */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 999,
            padding: '3px',
          }}
        >
          {/* 서비스 (dropdown) */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              style={pillItem('services')}
              onMouseEnter={() => setHoveredNav('services')}
              onMouseLeave={() => setHoveredNav(null)}
              onClick={() => setServiceOpen((v) => !v)}
            >
              서비스
              <ChevronDown
                style={{
                  width: 10, height: 10, opacity: 0.55,
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
                  top: 'calc(100% + 8px)',
                  minWidth: 228,
                }}
              >
                {SERVICES.map(({ id, icon: Icon, label, desc }) => {
                  const isActive = activeTab === id;
                  return (
                    <button
                      key={id}
                      className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition"
                      style={{ background: isActive ? 'var(--bg-overlay)' : 'transparent' }}
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
            onClick={onMockAction}
          >
            요금제
          </button>

          {/* 업데이트 */}
          <a
            href={NOTION_URL}
            target="_blank"
            rel="noreferrer"
            style={pillItem('updates')}
            onMouseEnter={() => setHoveredNav('updates')}
            onMouseLeave={() => setHoveredNav(null)}
          >
            업데이트
          </a>
        </div>

        {/* ── Right: theme + auth ── */}
        <div className="flex items-center gap-1.5">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg transition"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-overlay)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onClick={onToggleTheme}
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <div className="mx-1 hidden h-4 md:block" style={{ width: 1, background: 'var(--border)' }} />

          <button className="mac-btn-ghost mac-btn mac-btn-sm" onClick={onMockAction}>로그인</button>
          <button className="mac-btn mac-btn-sm" onClick={onMockAction}>가입하기</button>
        </div>
      </div>
    </nav>
  );
}
