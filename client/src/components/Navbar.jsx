import { ChevronDown, FileText, Megaphone, Moon, Search, Sparkles, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const NOTION_URL =
  'https://helix-territory-c92.notion.site/37b24604a09180c5956cf11cf9595818?source=copy_link';

const SERVICES = [
  { id: 'analysis',  icon: Search,   label: '키워드 분석', desc: '기준 키워드로 연관 키워드 발굴' },
  { id: 'expansion', icon: Sparkles, label: '키워드 확장', desc: '시드 키워드로 대량 발굴' },
  { id: 'blog',      icon: FileText, label: '블로그 분석', desc: '콘텐츠 기회 점수 분석' }
];

export default function Navbar({ activeTab, onSwitchTab, onMockAction, theme, onToggleTheme }) {
  const [serviceOpen, setServiceOpen] = useState(false);
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

  return (
    <nav className="mac-nav">
      <div
        className="mx-auto flex h-full max-w-[1560px] items-center justify-between px-4"
      >
        {/* ── Left: traffic lights + logo ── */}
        <div className="flex items-center gap-5">
          {/* Traffic lights */}
          <div className="traffic-lights pl-0">
            <div className="traffic-dot tl-red" />
            <div className="traffic-dot tl-yellow" />
            <div className="traffic-dot tl-green" />
          </div>

          {/* Logo */}
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

          {/* ── Service dropdown ── */}
          <div className="relative" ref={dropdownRef}>
            <button
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition"
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-overlay)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => setServiceOpen((v) => !v)}
            >
              서비스
              <ChevronDown
                className="h-3 w-3 transition-transform duration-150"
                style={{ transform: serviceOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {serviceOpen && (
              <div
                className="mac-dropdown absolute left-0 top-full mt-1.5 p-1.5"
                style={{ minWidth: 228 }}
              >
                {SERVICES.map(({ id, icon: Icon, label, desc }) => {
                  const isActive = activeTab === id;
                  return (
                    <button
                      key={id}
                      className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition"
                      style={{ background: isActive ? 'var(--bg-overlay)' : 'transparent' }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'var(--bg-overlay)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                      onClick={() => handleServiceClick(id)}
                    >
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: isActive ? 'var(--accent)' : 'var(--bg-overlay)'
                        }}
                      >
                        <Icon
                          className="h-4 w-4"
                          style={{ color: isActive ? '#fff' : 'var(--text-secondary)' }}
                        />
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                          {label}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
                          {desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 요금제 */}
          <button
            className="hidden rounded-lg px-2.5 py-1.5 transition sm:block"
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-overlay)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onClick={onMockAction}
          >
            요금제
          </button>
        </div>

        {/* ── Right: actions ── */}
        <div className="flex items-center gap-1.5">
          {/* 업데이트 소식 */}
          <a
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition md:flex"
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', textDecoration: 'none' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-overlay)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            href={NOTION_URL}
            target="_blank"
            rel="noreferrer"
          >
            <Megaphone className="h-3.5 w-3.5" />
            업데이트
          </a>

          {/* Theme toggle */}
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg transition"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-overlay)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onClick={onToggleTheme}
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark'
              ? <Sun className="h-3.5 w-3.5" />
              : <Moon className="h-3.5 w-3.5" />
            }
          </button>

          {/* 구분선 */}
          <div
            className="mx-1 hidden h-4 md:block"
            style={{ width: 1, background: 'var(--border)' }}
          />

          {/* 로그인 */}
          <button
            className="mac-btn-ghost mac-btn mac-btn-sm"
            onClick={onMockAction}
          >
            로그인
          </button>

          {/* 가입하기 */}
          <button
            className="mac-btn mac-btn-sm"
            onClick={onMockAction}
          >
            가입하기
          </button>
        </div>
      </div>
    </nav>
  );
}
