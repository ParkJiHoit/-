import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import RankCalendar from '../components/RankCalendar';
import RankChart from '../components/RankChart';
import { RefreshCw, Plus, Trash2, X, ExternalLink } from 'lucide-react';

const API = (path) => `/api/rank-tracker${path}`;

async function apiFetch(path, options, token) {
  const res = await fetch(API(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || '오류가 발생했습니다.');
  return body;
}

export default function RankTrackerPage({ onLoginRequest }) {
  const { user, session } = useAuth();
  const token = session?.access_token;

  const [mode, setMode] = useState('blog');
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null); // null = 신규, item = 수정
  const [error, setError] = useState('');

  const loadItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch('', {}, token);
      setItems(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const selectItem = useCallback(async (item) => {
    setSelected(item);
    setSnapshots([]);
    if (!token) return;
    try {
      const data = await apiFetch(`/${item.id}/snapshots`, {}, token);
      setSnapshots(data.snapshots || []);
    } catch (e) { setError(e.message); }
  }, [token]);

  const handleRefresh = async () => {
    if (!selected || !token) return;
    setRefreshing(true);
    try {
      await apiFetch(`/${selected.id}/refresh`, { method: 'POST' }, token);
      const [snapshotData, listData] = await Promise.all([
        apiFetch(`/${selected.id}/snapshots`, {}, token),
        apiFetch('', {}, token),
      ]);
      setSnapshots(snapshotData.snapshots || []);
      setItems(listData);
      const refreshed = listData.find(i => i.id === selected.id);
      if (refreshed) setSelected(refreshed);
    } catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  };

  const handleDelete = async (id) => {
    if (!token) return;
    if (!confirm('추적 항목을 삭제할까요? 모든 순위 기록이 사라집니다.')) return;
    try {
      await apiFetch(`/${id}`, { method: 'DELETE' }, token);
      if (selected?.id === id) { setSelected(null); setSnapshots([]); }
      await loadItems();
    } catch (e) { setError(e.message); }
  };

  const filteredItems = items.filter(i => i.mode === mode);
  const latestRanks = selected?.latestRanks || {};
  const blogIds = selected?.blog_ids || [];
  const latestDate = snapshots.length ? snapshots[0].snapshotted_at : null;
  const latestSnapshot = selected?.mode === 'all'
    ? snapshots.filter(s => s.snapshotted_at === latestDate).sort((a, b) => (a.rank || 99) - (b.rank || 99))
    : [];

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 14 }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>📊</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>로그인 후 이용할 수 있습니다</div>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.7 }}>
          키워드별 블로그 순위를 날짜별로 추적하고<br/>변화를 확인해보세요
        </p>
        <button
          onClick={onLoginRequest}
          style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          로그인하기
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {error && (
        <div style={{
          padding: '10px 16px', borderRadius: 10,
          background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)',
          fontSize: 13, color: '#FF453A', display: 'flex', justifyContent: 'space-between',
        }}>
          {error}
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#FF453A', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { id: 'blog', title: '블로그 추적 모드', desc: '특정 블로그가 키워드에서 몇 위인지 추적' },
          { id: 'all',  title: '전체 순위 모드',   desc: '키워드 블로그탭 상위 10개 스냅샷 기록' },
        ].map(m => (
          <div
            key={m.id}
            onClick={() => { setMode(m.id); setSelected(null); setSnapshots([]); }}
            style={{
              flex: 1, padding: '14px 18px', borderRadius: 14, cursor: 'pointer',
              border: `1.5px solid ${mode === m.id ? 'var(--accent)' : 'var(--border)'}`,
              background: mode === m.id ? 'rgba(10,132,255,0.08)' : 'var(--bg-elevated)',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: mode === m.id ? 'var(--accent)' : 'var(--text-primary)', marginBottom: 3 }}>{m.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{m.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
              {mode === 'blog' ? '블로그 추적' : '전체 순위'} <span style={{ color: 'var(--accent)' }}>{filteredItems.length}</span>
            </span>
            <button
              onClick={() => { setEditItem(null); setShowModal(true); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: '#fff',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Plus size={12} /> 등록
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>불러오는 중…</div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1.7 }}>
              등록된 추적 항목이 없습니다.<br/>위 등록 버튼으로 추가해보세요.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => selectItem(item)}
                  style={{
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    border: `1px solid ${selected?.id === item.id ? 'var(--accent)' : 'var(--border)'}`,
                    background: selected?.id === item.id ? 'rgba(10,132,255,0.06)' : 'var(--bg-elevated)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 999,
                      background: 'rgba(10,132,255,0.15)', border: '1px solid rgba(10,132,255,0.3)',
                      fontSize: 13, fontWeight: 700, color: 'var(--accent)',
                    }}>
                      {item.keyword}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {item.mode === 'blog' && (
                        <button
                          onClick={e => { e.stopPropagation(); setEditItem(item); setShowModal(true); }}
                          title="블로그 URL 추가"
                          className="icon-btn-plus"
                          style={{
                            background: 'none', border: '1px solid transparent', cursor: 'pointer',
                            color: 'var(--accent)', padding: 6, display: 'flex', borderRadius: 7,
                            transition: 'background 0.15s, border-color 0.15s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(10,132,255,0.12)';
                            e.currentTarget.style.borderColor = 'rgba(10,132,255,0.3)';
                            e.currentTarget.querySelector('svg').style.transform = 'rotate(180deg)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'none';
                            e.currentTarget.style.borderColor = 'transparent';
                            e.currentTarget.querySelector('svg').style.transform = 'rotate(0deg)';
                          }}
                        >
                          <Plus size={14} style={{ transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)' }} />
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                        title="삭제"
                        style={{
                          background: 'none', border: '1px solid transparent', cursor: 'pointer',
                          color: 'var(--text-tertiary)', padding: 6, display: 'flex', borderRadius: 7,
                          transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(255,69,58,0.10)';
                          e.currentTarget.style.borderColor = 'rgba(255,69,58,0.25)';
                          e.currentTarget.style.color = '#FF453A';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'none';
                          e.currentTarget.style.borderColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-tertiary)';
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {mode === 'blog' && item.blog_ids?.map(blogId => {
                    const rank = item.latestRanks?.[blogId] ?? null;
                    return (
                      <div key={blogId} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', marginBottom: 3,
                      }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{blogId}</span>
                        <span style={{
                          fontSize: 14, fontWeight: 800,
                          fontFamily: "'Space Grotesk', sans-serif",
                          color: rank == null ? 'var(--text-tertiary)' : rank <= 3 ? '#30D158' : rank <= 6 ? '#FF9F0A' : 'var(--text-secondary)',
                        }}>
                          {rank != null ? `${rank}위` : '미노출'}
                        </span>
                      </div>
                    );
                  })}
                  {mode === 'all' && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      스냅샷 기록됨
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {!selected ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: 360, color: 'var(--text-tertiary)', gap: 10, textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, opacity: 0.2 }}>←</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>항목을 선택하세요</div>
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>왼쪽 목록에서 추적 항목을 선택하면<br/>순위 기록과 차트를 확인할 수 있습니다</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div className="mac-card" style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>
                    {selected.keyword}
                    {mode === 'blog' && blogIds.length > 0 && <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 10 }}>블로그 {blogIds.length}개 추적</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {selected.last_refreshed_at
                      ? (() => {
                          const d = new Date(new Date(selected.last_refreshed_at).getTime() + 9 * 60 * 60 * 1000);
                          const date = d.toISOString().slice(0, 10);
                          const hm = d.toISOString().slice(11, 16);
                          return `마지막 갱신: ${date} ${hm}`;
                        })()
                      : latestDate ? `마지막 갱신: ${latestDate}` : '아직 갱신 내역 없음'}
                  </div>
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-strong)',
                    color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                  {refreshing ? '갱신 중…' : '순위 갱신'}
                </button>
              </div>

              {mode === 'blog' && blogIds.length > 0 && (() => {
                const firstBlog = blogIds[0];
                const curRank = latestRanks[firstBlog] ?? null;
                const allRanks = snapshots.filter(s => s.blog_id === firstBlog && s.rank != null).map(s => s.rank);
                const bestRank = allRanks.length ? Math.min(...allRanks) : null;
                const trackDays = selected.created_at
                  ? Math.max(1, Math.round((Date.now() - new Date(selected.created_at)) / 86400000))
                  : 0;
                return (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { label: '현재 순위', value: curRank != null ? `${curRank}위` : '미노출', color: curRank != null && curRank <= 3 ? '#30D158' : curRank != null && curRank <= 6 ? '#FF9F0A' : 'var(--text-tertiary)' },
                      { label: '최고 순위', value: bestRank != null ? `${bestRank}위` : '—', color: '#30D158' },
                      { label: '추적 기간', value: `${trackDays}일`, color: 'var(--text-primary)' },
                      { label: '총 기록', value: `${snapshots.filter(s => s.blog_id === firstBlog).length}회`, color: 'var(--text-primary)' },
                    ].map(chip => (
                      <div key={chip.label} style={{
                        padding: '8px 14px', borderRadius: 10, minWidth: 80,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{chip.label}</span>
                        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: chip.color, lineHeight: 1 }}>{chip.value}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="mac-card" style={{ padding: '18px 22px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
                일별 노출 순위 — 캘린더
              </div>
              <RankCalendar
                snapshots={snapshots}
                blogIds={mode === 'blog' ? blogIds : [...new Set(snapshots.map(s => s.blog_id))]}
                days={30}
              />
            </div>

            {mode === 'blog' && (
              <div className="mac-card" style={{ padding: '18px 22px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
                  순위 추이
                </div>
                <RankChart snapshots={snapshots} blogIds={blogIds} />
              </div>
            )}

            {mode === 'all' && latestSnapshot.length > 0 && (
              <div className="mac-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                    현재 블로그탭 상위 10위 ({latestDate})
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                      {['순위', '포스팅 제목', '블로그'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {latestSnapshot.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: s.rank <= 3 ? '#30D158' : 'var(--text-primary)' }}>{s.rank}</span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', maxWidth: 360 }}>
                          {s.post_link ? (
                            <a href={s.post_link} target="_blank" rel="noreferrer"
                              style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.post_title || '(제목 없음)'}</span>
                              <ExternalLink size={10} style={{ flexShrink: 0, opacity: 0.4 }} />
                            </a>
                          ) : (s.post_title || '(제목 없음)')}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--accent)' }}>{s.blog_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}
      </div>

      {showModal && (
        <AddTrackerModal
          mode={mode}
          token={token}
          editItem={editItem}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          onAdded={async () => { setShowModal(false); setEditItem(null); await loadItems(); }}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function AddTrackerModal({ mode: defaultMode, token, editItem, onClose, onAdded }) {
  const isEdit = !!editItem;
  const [modalMode, setModalMode] = useState(editItem?.mode || defaultMode);
  const [keyword, setKeyword] = useState(editItem?.keyword || '');
  const [urlInput, setUrlInput] = useState('');
  const [blogUrls, setBlogUrls] = useState(editItem?.blog_ids || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function extractBlogId(url) {
    const m = String(url).match(/blog\.naver\.com\/([^/?#\s]+)/);
    return m ? m[1] : url.trim();
  }

  function addUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setBlogUrls(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    setUrlInput('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!keyword.trim()) { setError('키워드를 입력해 주세요.'); return; }
    if (modalMode === 'blog' && !blogUrls.length) { setError('블로그 URL을 1개 이상 추가해 주세요.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/rank-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ keyword: keyword.trim(), mode: modalMode, blogUrls }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '등록에 실패했습니다.');
      onAdded();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
        borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 480,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{isEdit ? `URL 추가 — ${editItem.keyword}` : '추적 등록'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {!isEdit && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {[{ id: 'blog', label: '블로그 추적', desc: '내 블로그 순위 추적' }, { id: 'all', label: '전체 순위', desc: '상위 10위 스냅샷' }].map(m => (
              <div key={m.id} onClick={() => setModalMode(m.id)} style={{
                flex: 1, padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1.5px solid ${modalMode === m.id ? 'var(--accent)' : 'var(--border)'}`,
                background: modalMode === m.id ? 'rgba(10,132,255,0.08)' : 'transparent',
                transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: modalMode === m.id ? 'var(--accent)' : 'var(--text-secondary)' }}>{m.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isEdit && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>타겟 키워드</label>
              <input
                value={keyword} onChange={e => setKeyword(e.target.value)}
                placeholder=""
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 9, boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
          )}

          {modalMode === 'blog' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>추적할 블로그 URL</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  value={urlInput} onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
                  placeholder=""
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 9, boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-strong)',
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <button type="button" onClick={addUrl} style={{
                  padding: '9px 14px', borderRadius: 9, border: 'none', background: 'var(--accent)',
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                }}>추가</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {blogUrls.map(url => (
                  <span key={url} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 999,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-strong)',
                    fontSize: 12, color: 'var(--text-secondary)',
                  }}>
                    {extractBlogId(url)}
                    <button type="button" onClick={() => setBlogUrls(p => p.filter(u => u !== url))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex', lineHeight: 1 }}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && <p style={{ margin: 0, fontSize: 12, color: '#FF453A', fontWeight: 500 }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border-strong)',
              background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}>취소</button>
            <button type="submit" disabled={loading} style={{
              padding: '9px 20px', borderRadius: 9, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>{loading ? (isEdit ? '저장 중…' : '등록 중…') : (isEdit ? '저장하기' : '등록하기')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
