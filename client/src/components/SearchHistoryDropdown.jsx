import { useEffect, useRef, useState } from 'react';
import { History, Search, FileText } from 'lucide-react';
import { supabase } from '../supabase';
import useDelayedUnmount from '../hooks/useDelayedUnmount';

const TYPE_META = {
  keyword: { label: '키워드 분석', icon: Search, color: '#0A84FF' },
  blog: { label: '블로그 분석', icon: FileText, color: '#30D158' },
};

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(isoString).toISOString().slice(0, 10);
}

export default function SearchHistoryDropdown({ user, isDark, onSelect, pillStyle }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);
  const { shouldRender: dropdownMounted, isClosing: dropdownClosing } = useDelayedUnmount(open);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadHistory = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('search_history')
      .select('id, type, keyword, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15);
    setLoading(false);
    if (error) { setError('불러오지 못했습니다.'); return; }
    setItems(data || []);
  };

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadHistory();
  };

  if (!user) return null;

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        className="nav-pill"
        style={pillStyle}
        onClick={handleToggle}
        title="최근 검색"
      >
        <History size={11} />
        최근 검색
      </button>

      {dropdownMounted && (
        <div
          className="mac-dropdown p-1.5"
          data-closing={dropdownClosing}
          style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            top: 'calc(100% + 10px)', width: 300, maxHeight: 380, overflowY: 'auto',
          }}
        >
          {loading && (
            <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
              불러오는 중…
            </div>
          )}
          {!loading && error && (
            <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12, color: 'var(--destructive)' }}>
              {error}
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              최근 검색 기록이 없습니다.<br />키워드나 블로그를 분석해 보세요.
            </div>
          )}
          {!loading && !error && items.map((item) => {
            const meta = TYPE_META[item.type] || TYPE_META.keyword;
            const Icon = meta.icon;
            return (
              <button
                key={item.id}
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                onClick={() => { onSelect(item.type, item.keyword); setOpen(false); }}
              >
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: meta.color + '18', border: `1px solid ${meta.color}35` }}
                >
                  <Icon className="h-4 w-4" style={{ color: meta.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.keyword}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
                    {meta.label} · {timeAgo(item.created_at)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
