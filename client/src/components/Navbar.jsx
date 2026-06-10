import { ChevronDown, FileText, Megaphone, Search, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const NOTION_URL =
  'https://helix-territory-c92.notion.site/37b24604a09180c5956cf11cf9595818?source=copy_link';

const SERVICES = [
  {
    id: 'analysis',
    icon: Search,
    label: '키워드 분석',
    desc: '기준 키워드로 연관 키워드 발굴'
  },
  {
    id: 'expansion',
    icon: Sparkles,
    label: '키워드 확장',
    desc: '시드 키워드로 대량 발굴'
  },
  {
    id: 'blog',
    icon: FileText,
    label: '블로그 분석',
    desc: '콘텐츠 기회 점수 분석'
  }
];

export default function Navbar({ activeTab, onSwitchTab, onMockAction }) {
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
    <nav
      className="glass-nav fixed left-0 right-0 top-0 z-50"
      style={{ height: 'var(--nav-h)' }}
    >
      <div className="mx-auto flex h-full max-w-[1560px] items-center justify-between px-5 lg:px-8">
        {/* ── Logo ── */}
        <div className="flex items-center gap-6">
          <button className="flex items-center gap-2" onClick={() => onSwitchTab('analysis')}>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-950">
              <span className="text-[10px] font-black tracking-tight text-white">K</span>
            </div>
            <span className="text-sm font-black tracking-tight text-slate-950">키워드랩</span>
          </button>

          {/* ── Service dropdown ── */}
          <div className="relative" ref={dropdownRef}>
            <button
              className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-semibold text-slate-600 transition hover:bg-black/5 hover:text-slate-950"
              onClick={() => setServiceOpen((v) => !v)}
            >
              서비스
              <ChevronDown
                className="h-3.5 w-3.5 transition-transform duration-200"
                style={{ transform: serviceOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {serviceOpen && (
              <div
                className="service-dropdown animate-scale-in absolute left-0 top-full mt-1.5 w-60 p-1.5"
                style={{ minWidth: 232 }}
              >
                {SERVICES.map(({ id, icon: Icon, label, desc }) => (
                  <button
                    key={id}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 ${
                      activeTab === id ? 'bg-slate-50' : ''
                    }`}
                    onClick={() => handleServiceClick(id)}
                  >
                    <div
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                        activeTab === id ? 'bg-slate-950' : 'bg-slate-100'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${activeTab === id ? 'text-white' : 'text-slate-500'}`}
                      />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-slate-900">{label}</p>
                      <p className="text-[11px] text-slate-500">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="hidden h-8 items-center rounded-lg px-2.5 text-[13px] font-semibold text-slate-600 transition hover:bg-black/5 hover:text-slate-950 sm:flex"
            onClick={onMockAction}
          >
            요금제
          </button>
        </div>

        {/* ── Right side ── */}
        <div className="flex items-center gap-1.5">
          <a
            className="hidden h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-slate-500 transition hover:bg-black/5 hover:text-slate-800 md:flex"
            href={NOTION_URL}
            target="_blank"
            rel="noreferrer"
          >
            <Megaphone className="h-3.5 w-3.5" />
            <span>업데이트</span>
          </a>

          <div className="mx-1 hidden h-4 w-px bg-slate-200 md:block" />

          <button
            className="h-8 rounded-lg px-3 text-[13px] font-semibold text-slate-600 transition hover:bg-black/5 hover:text-slate-950"
            onClick={onMockAction}
          >
            로그인
          </button>

          <button
            className="h-8 rounded-lg bg-slate-950 px-3.5 text-[13px] font-bold text-white transition hover:bg-slate-800 active:scale-95"
            onClick={onMockAction}
          >
            가입하기
          </button>
        </div>
      </div>
    </nav>
  );
}
