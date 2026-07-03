import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../AuthContext';
import RankCalendar from '../components/RankCalendar';
import RankChart from '../components/RankChart';
import BulkImportModal from '../components/BulkImportModal';
import { RefreshCw, Plus, Trash2, X, ExternalLink, Pencil, Download } from 'lucide-react';

const STATUS_LABEL = { ranked: '노출', not_in_top5: '미노출', fetch_failed: '조회실패' };

function getKSTToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

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
  if (!res.ok) {
    const err = new Error(body.message || '오류가 발생했습니다.');
    err.premiumOnly = !!body.premiumOnly;
    err.status = res.status;
    throw err;
  }
  return body;
}

// status는 이미 상위 5위 판정을 반영한다(백엔드 refreshRanks) — 'ranked'일 때만 숫자를 보여준다.
function formatRankStatus(rank, status) {
  if (status === 'fetch_failed') return { label: '⚠ 조회 실패', color: '#FF9F0A' };
  if (status === 'ranked' && rank != null) {
    return { label: `${rank}위`, color: rank <= 3 ? '#30D158' : '#FF9F0A' };
  }
  return { label: '미노출', color: 'var(--text-tertiary)' };
}

export default function RankTrackerPage({ onLoginRequest, onGoPricing }) {
  const { user, session } = useAuth();
  const token = session?.access_token;

  const [mode, setMode] = useState('blog');
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(''); // '' = 전체 그룹
  const [selected, setSelected] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshAllProgress, setRefreshAllProgress] = useState({ done: 0, total: 0 });
  const [failedJobId, setFailedJobId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editItem, setEditItem] = useState(null); // null = 신규, item = 수정
  const [error, setError] = useState('');
  const [premiumOnly, setPremiumOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const loadItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch('', {}, token);
      setItems(data);
    } catch (e) {
      if (e.premiumOnly) { setPremiumOnly(true); }
      else { setError(e.message); }
    }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { setSelectedIds(new Set()); }, [mode, selectedGroupId]);

  const loadGroups = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch('/groups', {}, token);
      setGroups(data);
    } catch (e) {
      if (e.premiumOnly) setPremiumOnly(true);
    }
  }, [token]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const handleCreateGroup = async () => {
    const name = prompt('새 그룹 이름을 입력하세요');
    if (!name || !name.trim()) return;
    try {
      const g = await apiFetch('/groups', { method: 'POST', body: JSON.stringify({ name }) }, token);
      await loadGroups();
      setSelectedGroupId(String(g.id));
    } catch (e) { setError(e.message); }
  };

  const handleRenameGroup = async () => {
    if (!selectedGroupId) return;
    const current = groups.find(g => String(g.id) === selectedGroupId);
    const name = prompt('그룹 이름 변경', current?.name || '');
    if (!name || !name.trim()) return;
    try {
      await apiFetch(`/groups/${selectedGroupId}`, { method: 'PATCH', body: JSON.stringify({ name }) }, token);
      await loadGroups();
    } catch (e) { setError(e.message); }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroupId) return;
    if (!confirm('그룹을 삭제할까요? 그룹에 속한 항목은 삭제되지 않고 "전체"로 이동합니다.')) return;
    try {
      await apiFetch(`/groups/${selectedGroupId}`, { method: 'DELETE' }, token);
      setSelectedGroupId('');
      await Promise.all([loadGroups(), loadItems()]);
    } catch (e) { setError(e.message); }
  };

  const handleMoveItemGroup = async (itemId, groupId) => {
    try {
      await apiFetch(`/${itemId}/group`, { method: 'PATCH', body: JSON.stringify({ groupId: groupId || null }) }, token);
      await loadItems();
    } catch (e) { setError(e.message); }
  };

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

  const runJobToCompletion = async (job) => {
    let current = job;
    setRefreshAllProgress({ done: current.completed_count + current.failed_count, total: current.total_count });
    while (!current.done) {
      current = await apiFetch(`/refresh-jobs/${current.id}/process-chunk`, { method: 'POST' }, token);
      setRefreshAllProgress({ done: current.completed_count + current.failed_count, total: current.total_count });
    }
    return current;
  };

  const handleRefreshAll = async () => {
    if (!token || filteredItems.length === 0) return;
    setRefreshingAll(true);
    setFailedJobId(null);
    try {
      const job = await apiFetch(
        '/refresh-jobs',
        { method: 'POST', body: JSON.stringify({ trackedIds: filteredItems.map(i => i.id) }) },
        token
      );
      const finished = await runJobToCompletion(job);
      if (finished.failed_count > 0) setFailedJobId(finished.id);

      const listData = await apiFetch('', {}, token).catch(() => null);
      if (listData) {
        setItems(listData);
        if (selected) {
          const refreshed = listData.find(i => i.id === selected.id);
          if (refreshed) {
            setSelected(refreshed);
            const snapshotData = await apiFetch(`/${refreshed.id}/snapshots`, {}, token).catch(() => null);
            if (snapshotData) setSnapshots(snapshotData.snapshots || []);
          }
        }
      }
    } catch (e) { setError(e.message); }
    finally { setRefreshingAll(false); }
  };

  const handleRetryFailed = async () => {
    if (!token || !failedJobId) return;
    setRefreshingAll(true);
    try {
      const job = await apiFetch(`/refresh-jobs/${failedJobId}/retry-failed`, { method: 'POST' }, token);
      const finished = await runJobToCompletion(job);
      setFailedJobId(finished.failed_count > 0 ? finished.id : null);
      const listData = await apiFetch('', {}, token).catch(() => null);
      if (listData) setItems(listData);
    } catch (e) { setError(e.message); }
    finally { setRefreshingAll(false); }
  };

  const handleDelete = async (id) => {
    if (!token) return;
    if (!confirm('추적 항목을 삭제할까요? 모든 순위 기록이 사라집니다.')) return;
    try {
      await apiFetch(`/${id}`, { method: 'DELETE' }, token);
      if (selected?.id === id) { setSelected(null); setSnapshots([]); }
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      await loadItems();
    } catch (e) { setError(e.message); }
  };

  const toggleSelectId = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async (ids) => {
    if (!token || !ids.length) return;
    if (!confirm(`선택한 ${ids.length}개 항목을 삭제할까요? 모든 순위 기록이 사라집니다.`)) return;
    try {
      await apiFetch('/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }, token);
      if (selected && ids.includes(selected.id)) { setSelected(null); setSnapshots([]); }
      setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
      await loadItems();
    } catch (e) { setError(e.message); }
  };

  const filteredItems = items.filter(i =>
    i.mode === mode &&
    (!selectedGroupId || String(i.group_id ?? '') === selectedGroupId) &&
    (!searchQuery.trim() || i.keyword.toLowerCase().includes(searchQuery.trim().toLowerCase()))
  );

  const handleExport = async () => {
    if (!token || filteredItems.length === 0) return;
    try {
      const rows = await apiFetch(
        '/export',
        { method: 'POST', body: JSON.stringify({ ids: filteredItems.map(i => i.id) }) },
        token
      );
      if (!rows.length) { setError('내보낼 순위 기록이 없습니다.'); return; }

      const sheetRows = rows.map(r => ({
        그룹: r.group || '없음',
        키워드: r.keyword,
        블로그: r.blogId,
        날짜: r.date,
        순위: r.rank ?? '',
        상태: STATUS_LABEL[r.status] || r.status,
        포스트제목: r.postTitle || '',
        포스트링크: r.postLink || '',
      }));
      const ws = XLSX.utils.json_to_sheet(sheetRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '순위기록');
      const groupLabel = selectedGroupId
        ? (groups.find(g => String(g.id) === selectedGroupId)?.name || '그룹')
        : '전체';
      XLSX.writeFile(wb, `순위기록_${groupLabel}_${getKSTToday()}.xlsx`);
    } catch (e) { setError(e.message); }
  };

  const latestRanks = selected?.latestRanks || {};
  const blogIds = selected?.blog_ids || [];
  const latestDate = snapshots.length ? snapshots[0].snapshotted_at : null;
  const latestSnapshot = selected?.mode === 'all'
    ? snapshots.filter(s => s.snapshotted_at === latestDate).sort((a, b) => (a.rank || 99) - (b.rank || 99))
    : [];

  if (premiumOnly) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 18 }}>
        <div style={{ fontSize: 48, opacity: 0.25 }}>🔒</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>프리미엄 전용 기능입니다</div>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.8, margin: 0 }}>
          순위 추적은 프리미엄 플랜 구독자만 이용할 수 있어요.<br />7일 무료 체험으로 먼저 써보세요.
        </p>
        <button
          onClick={onGoPricing}
          style={{
            padding: '12px 32px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg,#0A84FF,#34C1FF)', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            marginTop: 4, boxShadow: '0 4px 20px rgba(10,132,255,0.4)',
          }}
        >
          7일 무료로 시작하기
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 18 }}>
        <div style={{ fontSize: 48, opacity: 0.25 }}>📊</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>로그인 후 이용할 수 있습니다</div>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.8, margin: 0 }}>
          키워드별 블로그 순위를 날짜별로 추적하고<br/>변화를 한눈에 확인해보세요
        </p>
        <button
          onClick={onLoginRequest}
          style={{
            padding: '12px 32px', borderRadius: 12, border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            marginTop: 4,
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

      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>

        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={selectedGroupId}
                onChange={e => {
                  if (e.target.value === '__new__') { handleCreateGroup(); return; }
                  setSelectedGroupId(e.target.value);
                  setSelected(null); setSnapshots([]);
                }}
                style={{
                  flex: 1, minWidth: 0, height: 30, padding: '0 8px', borderRadius: 8,
                  background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
                  outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                <option value="">전체 그룹</option>
                {groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                <option value="__new__">+ 새 그룹 만들기</option>
              </select>
              {selectedGroupId && (
                <>
                  <button
                    onClick={handleRenameGroup}
                    title="그룹 이름 변경"
                    style={{
                      display: 'flex', flexShrink: 0, background: 'none', border: '1px solid var(--border-strong)',
                      borderRadius: 7, padding: 6, cursor: 'pointer', color: 'var(--text-tertiary)',
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={handleDeleteGroup}
                    title="그룹 삭제"
                    style={{
                      display: 'flex', flexShrink: 0, background: 'none', border: '1px solid var(--border-strong)',
                      borderRadius: 7, padding: 6, cursor: 'pointer', color: '#FF453A',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="키워드 검색"
              style={{
                width: '100%', height: 30, padding: '0 10px', borderRadius: 8, boxSizing: 'border-box',
                background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
                color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
              {mode === 'blog' ? '블로그 추적' : '전체 순위'} <span style={{ color: 'var(--accent)' }}>{filteredItems.length}</span>
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {filteredItems.length > 0 && (
                <button
                  onClick={handleRefreshAll}
                  disabled={refreshingAll}
                  title="전체 순위 갱신"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap',
                    padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-strong)',
                    background: 'var(--bg-overlay)', color: 'var(--text-secondary)',
                    fontSize: 12, fontWeight: 600, cursor: refreshingAll ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', opacity: refreshingAll ? 0.6 : 1,
                  }}
                >
                  <RefreshCw size={12} style={{ animation: refreshingAll ? 'spin 1s linear infinite' : 'none' }} />
                  {refreshingAll ? `${refreshAllProgress.done}/${refreshAllProgress.total}` : '전체 갱신'}
                </button>
              )}
              {failedJobId && !refreshingAll && (
                <button
                  onClick={handleRetryFailed}
                  title="실패한 항목만 다시 시도"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap',
                    padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,69,58,0.3)',
                    background: 'rgba(255,69,58,0.08)', color: '#FF453A',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  실패 항목 재시도
                </button>
              )}
              {selectedIds.size > 0 && (
                <button
                  onClick={() => handleBulkDelete([...selectedIds])}
                  title="선택한 항목 삭제"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap',
                    padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,69,58,0.3)',
                    background: 'rgba(255,69,58,0.08)', color: '#FF453A',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <Trash2 size={12} /> 선택 삭제 ({selectedIds.size})
                </button>
              )}
              {filteredItems.length > 0 && (
                <button
                  onClick={() => handleBulkDelete(filteredItems.map(i => i.id))}
                  title="현재 목록 전체 삭제"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap',
                    padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-strong)',
                    background: 'var(--bg-overlay)', color: 'var(--text-secondary)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <Trash2 size={12} /> 전체 삭제
                </button>
              )}
              {filteredItems.length > 0 && (
                <button
                  onClick={handleExport}
                  title="현재 목록의 순위 기록을 엑셀로 내보내기"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap',
                    padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-strong)',
                    background: 'var(--bg-overlay)', color: 'var(--text-secondary)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <Download size={12} /> 내보내기
                </button>
              )}
              <button
                onClick={() => setShowBulkModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap',
                  padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-strong)',
                  background: 'var(--bg-overlay)', color: 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                대량 등록
              </button>
              <button
                onClick={() => { setEditItem(null); setShowModal(true); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap',
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: 'var(--accent)', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <Plus size={12} /> 등록
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>불러오는 중…</div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1.7 }}>
              {items.some(i => i.mode === mode)
                ? <>조건에 맞는 항목이 없습니다.<br/>검색어나 그룹 필터를 확인해 보세요.</>
                : <>등록된 추적 항목이 없습니다.<br/>위 등록 버튼으로 추가해보세요.</>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 320px)', minHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onClick={e => e.stopPropagation()}
                      onChange={() => toggleSelectId(item.id)}
                      style={{ flexShrink: 0, cursor: 'pointer' }}
                    />
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                      padding: '3px 10px', borderRadius: 999,
                      background: 'rgba(10,132,255,0.15)', border: '1px solid rgba(10,132,255,0.3)',
                      fontSize: 13, fontWeight: 700, color: 'var(--accent)',
                    }}>
                      {item.keyword}
                    </span>
                    <select
                      value={String(item.group_id ?? '')}
                      onClick={e => e.stopPropagation()}
                      onChange={e => handleMoveItemGroup(item.id, e.target.value)}
                      title="그룹 이동"
                      style={{
                        flex: 1, minWidth: 0, fontSize: 10, fontWeight: 600, padding: '2px 4px',
                        borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                        color: 'var(--text-tertiary)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <option value="">그룹 없음</option>
                      {groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
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
                    const entry = item.latestRanks?.[blogId] ?? null;
                    const rank = entry?.rank ?? null;
                    const status = entry?.status ?? null;
                    const { label, color } = formatRankStatus(rank, status);
                    return (
                      <div key={blogId} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', marginBottom: 3,
                      }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{blogId}</span>
                        <span style={{
                          fontSize: 14, fontWeight: 800,
                          fontFamily: "'Space Grotesk', sans-serif",
                          color,
                        }}>
                          {label}
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

        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

            <div className="mac-card" style={{ padding: '0 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64, borderBottom: mode === 'blog' && blogIds.length > 0 ? '1px solid var(--border)' : 'none', marginBottom: mode === 'blog' && blogIds.length > 0 ? 0 : 0 }}>
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
                const firstEntry = latestRanks[firstBlog] ?? null;
                const curRank = firstEntry?.rank ?? null;
                const curStatus = firstEntry?.status ?? null;
                const allRanks = snapshots.filter(s => s.blog_id === firstBlog && s.rank != null).map(s => s.rank);
                const bestRank = allRanks.length ? Math.min(...allRanks) : null;
                const trackDays = selected.created_at
                  ? Math.max(1, Math.round((Date.now() - new Date(selected.created_at)) / 86400000))
                  : 0;
                const curFormatted = formatRankStatus(curRank, curStatus);
                return (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 0' }}>
                    {[
                      {
                        label: '현재 순위',
                        value: curFormatted.label,
                        color: curFormatted.color,
                      },
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

            <div className="mac-card" style={{ padding: '18px 22px', minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
                일별 노출 순위 — 캘린더
              </div>
              <RankCalendar
                snapshots={snapshots}
                blogIds={mode === 'blog' ? blogIds : [...new Set(snapshots.map(s => s.blog_id))]}
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
          groups={groups}
          defaultGroupId={selectedGroupId}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          onAdded={async () => { setShowModal(false); setEditItem(null); await loadItems(); }}
        />
      )}

      {showBulkModal && (
        <BulkImportModal
          token={token}
          groups={groups}
          defaultGroupId={selectedGroupId}
          onClose={() => setShowBulkModal(false)}
          onImported={async () => { setShowBulkModal(false); await loadItems(); }}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function AddTrackerModal({ mode: defaultMode, token, editItem, groups, defaultGroupId, onClose, onAdded }) {
  const isEdit = !!editItem;
  const [modalMode, setModalMode] = useState(editItem?.mode || defaultMode);
  const [keyword, setKeyword] = useState(editItem?.keyword || '');
  const [urlInput, setUrlInput] = useState('');
  const [blogUrls, setBlogUrls] = useState(editItem?.blog_ids || []);
  const [groupId, setGroupId] = useState(String(editItem?.group_id ?? defaultGroupId ?? ''));
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
        body: JSON.stringify({ keyword: keyword.trim(), mode: modalMode, blogUrls, groupId: groupId ? Number(groupId) : null }),
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

          {!isEdit && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>그룹 (선택)</label>
              <select
                value={groupId} onChange={e => setGroupId(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 9, boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">그룹 없음</option>
                {(groups || []).map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
              </select>
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
