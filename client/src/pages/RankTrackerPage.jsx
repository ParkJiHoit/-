import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx-js-style';
import { useAuth } from '../AuthContext';
import RankCalendar from '../components/RankCalendar';
import RankChart from '../components/RankChart';
import BulkImportModal from '../components/BulkImportModal';
import { RefreshCw, Plus, Trash2, X, ExternalLink, Pencil, Download } from 'lucide-react';

function getKSTToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// RankCalendar 화면 배색과 맞춘 히트맵 셀 색상 — rank==null이면 미노출, status가 fetch_failed면 조회 실패로 별도 표시.
function heatmapCellColor(cell) {
  if (!cell) return { bg: 'F2F2F2', font: '9E9E9E' };
  if (cell.status === 'fetch_failed') return { bg: 'FFCC80', font: '7A4B00' };
  const rank = cell.rank;
  if (rank == null) return { bg: 'E0E0E0', font: '9E9E9E' };
  if (rank === 1) return { bg: '1E8E3E', font: 'FFFFFF' };
  if (rank <= 2) return { bg: '34A853', font: 'FFFFFF' };
  if (rank <= 3) return { bg: '81C995', font: '1A3C1A' };
  if (rank <= 5) return { bg: 'FBBC04', font: '5C4400' };
  if (rank <= 7) return { bg: 'FDD663', font: '5C4400' };
  return { bg: 'F28B82', font: '7A1E14' };
}

const HEATMAP_LEGEND = [
  { label: '1위', bg: '1E8E3E', font: 'FFFFFF' },
  { label: '2위', bg: '34A853', font: 'FFFFFF' },
  { label: '3위', bg: '81C995', font: '1A3C1A' },
  { label: '5위', bg: 'FBBC04', font: '5C4400' },
  { label: '7위', bg: 'FDD663', font: '5C4400' },
  { label: '10위', bg: 'F28B82', font: '7A1E14' },
  { label: '미노출', bg: 'E0E0E0', font: '9E9E9E' },
  { label: '조회 실패', bg: 'FFCC80', font: '7A4B00' },
];

// 통합검색 노출 O/X 셀 색 — 순위 팔레트(초록~빨강)와 겹치면 구분이 안 가서
// 아예 다른 색 계열(파란색)을 쓴다.
function integratedCellColor(value) {
  if (value === 'O') return { bg: '1A73E8', font: 'FFFFFF' };
  if (value === 'X') return { bg: 'B3C6E8', font: '1A3C6E' };
  return { bg: 'F2F2F2', font: '9E9E9E' };
}

const INTEGRATED_LEGEND = [
  { label: 'O (통검 노출)', bg: '1A73E8', font: 'FFFFFF' },
  { label: 'X (통검 미노출)', bg: 'B3C6E8', font: '1A3C6E' },
];

// 한글 등 전각 문자는 2칸, 그 외는 1칸으로 계산해 열 너비를 값 길이에 맞춰 자동 산출한다.
function displayWidth(str) {
  const s = String(str ?? '');
  let width = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0);
    const isWide = (code >= 0x1100 && code <= 0x115F) || (code >= 0x2E80 && code <= 0xA4CF) ||
      (code >= 0xAC00 && code <= 0xD7A3) || (code >= 0xF900 && code <= 0xFAFF) ||
      (code >= 0xFF00 && code <= 0xFF60) || (code >= 0xFFE0 && code <= 0xFFE6);
    width += isWide ? 2 : 1;
  }
  return width;
}

function autoColWidth(values, minWidth) {
  const max = values.reduce((m, v) => Math.max(m, displayWidth(v)), 0);
  return Math.max(max + 2, minWidth);
}

// 같은 해 안에서만 "YYYY-" 접두어를 생략한다 — 연도가 걸치면 MM-DD만으로는
// 서로 다른 해의 같은 날짜가 겹쳐 보일 수 있어 전체 날짜를 그대로 쓴다.
function formatDateLabels(dates) {
  const years = new Set(dates.map(d => d.slice(0, 4)));
  if (years.size <= 1) return dates.map(d => d.slice(5));
  return dates;
}

function buildHeatmapSheet(rows) {
  const dates = [...new Set(rows.map(r => r.date))].sort();
  const dateLabels = formatDateLabels(dates);

  const rowMap = new Map();
  for (const r of rows) {
    const key = `${r.keyword} ${r.blogId}`;
    if (!rowMap.has(key)) rowMap.set(key, { group: r.group || '없음', keyword: r.keyword, searchVolume: r.searchVolume, blogId: r.blogId, mode: r.mode, registeredAt: r.registeredAt, cells: {} });
    rowMap.get(key).cells[r.date] = { rank: r.rank, status: r.status, integratedExposed: r.integratedExposed, postDate: r.postDate };
  }
  const dataRows = [...rowMap.values()].sort((a, b) =>
    a.keyword.localeCompare(b.keyword) || a.blogId.localeCompare(b.blogId)
  );

  // 통합검색노출/등록일은 날짜별 이력이 아니라 가장 최근에 확인된 값 하나만 보여준다
  // (통합검색노출은 blog 모드만 해당 — all 모드는 특정 블로그에 매이지 않아 체크 대상이 아니다).
  // 포스팅 자체의 발행일을 한 번도 확인 못했으면(블로그탭 10위 안에 든 적 없음) 트래커에
  // 등록한 날짜로 대체하고 '*'를 붙여 실제 발행일과 구분한다.
  let hasFallbackDate = false;
  for (const dr of dataRows) {
    let integratedLatest = null;
    let postDate = null;
    for (let i = dates.length - 1; i >= 0; i--) {
      const c = dr.cells[dates[i]];
      if (!c) continue;
      if (dr.mode === 'blog' && integratedLatest == null && c.integratedExposed != null) integratedLatest = c.integratedExposed;
      if (postDate == null && c.postDate) postDate = c.postDate;
    }
    dr.integratedLatest = integratedLatest;
    dr.postDateIsFallback = !postDate && !!dr.registeredAt;
    dr.postDate = postDate || dr.registeredAt || null;
    if (dr.postDateIsFallback) hasFallbackDate = true;
  }

  const header = ['등록일', '그룹', '키워드', '월간 검색량', '블로그', '통검 노출', ...dateLabels];
  const aoa = [
    header,
    ...dataRows.map(dr => [
      dr.postDate ? (dr.postDateIsFallback ? `${dr.postDate}*` : dr.postDate) : '',
      dr.group, dr.keyword, dr.searchVolume ?? '', dr.blogId,
      dr.integratedLatest == null ? '' : (dr.integratedLatest ? 'O' : 'X'),
      ...dates.map(d => {
        const c = dr.cells[d];
        if (!c) return 'X';
        if (c.status === 'fetch_failed') return '실패';
        return c.rank != null ? c.rank : 'X';
      }),
    ]),
  ];

  const legendGap = 2;
  const legendStartRow = aoa.length + legendGap;
  aoa.push(...Array(legendGap).fill([]));
  aoa.push(['순위 컬러']);
  HEATMAP_LEGEND.forEach(l => aoa.push(['', l.label]));
  aoa.push([]);
  const integratedLegendStartRow = aoa.length;
  aoa.push(['통검 노출 컬러']);
  INTEGRATED_LEGEND.forEach(l => aoa.push(['', l.label]));
  if (hasFallbackDate) {
    aoa.push([]);
    aoa.push(['* 포스팅 발행일 미확인 — 트래커 등록일로 대체 표시']);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const headerStyle = {
    fill: { fgColor: { rgb: '1C2333' } },
    font: { color: { rgb: 'FFFFFF' }, bold: true },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
  header.forEach((_, col) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: col });
    if (ws[ref]) ws[ref].s = headerStyle;
  });

  dataRows.forEach((dr, rIdx) => {
    const volumeRef = XLSX.utils.encode_cell({ r: rIdx + 1, c: 3 });
    if (ws[volumeRef]) ws[volumeRef].s = { alignment: { horizontal: 'center' } };

    const integratedRef = XLSX.utils.encode_cell({ r: rIdx + 1, c: 5 });
    if (ws[integratedRef]) {
      const { bg, font } = integratedCellColor(dr.integratedLatest == null ? '' : (dr.integratedLatest ? 'O' : 'X'));
      ws[integratedRef].s = {
        fill: { fgColor: { rgb: bg } },
        font: { color: { rgb: font }, bold: true },
        alignment: { horizontal: 'center' },
      };
    }

    dates.forEach((d, cIdx) => {
      const ref = XLSX.utils.encode_cell({ r: rIdx + 1, c: cIdx + 6 });
      if (!ws[ref]) return;
      const { bg, font } = heatmapCellColor(dr.cells[d]);
      ws[ref].s = {
        fill: { fgColor: { rgb: bg } },
        font: { color: { rgb: font }, bold: true },
        alignment: { horizontal: 'center' },
      };
    });
  });

  HEATMAP_LEGEND.forEach((l, i) => {
    const ref = XLSX.utils.encode_cell({ r: legendStartRow + 1 + i, c: 0 });
    if (ws[ref]) ws[ref].s = { fill: { fgColor: { rgb: l.bg } }, font: { color: { rgb: l.font } } };
  });
  INTEGRATED_LEGEND.forEach((l, i) => {
    const ref = XLSX.utils.encode_cell({ r: integratedLegendStartRow + 1 + i, c: 0 });
    if (ws[ref]) ws[ref].s = { fill: { fgColor: { rgb: l.bg } }, font: { color: { rgb: l.font } } };
  });

  ws['!cols'] = [
    { wch: 12 },
    { wch: 14 },
    { wch: autoColWidth([header[2], ...dataRows.map(dr => dr.keyword)], 16) },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    ...dateLabels.map(d => ({ wch: autoColWidth([d], 8) })),
  ];

  return ws;
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

  const handleRemoveBlog = async (trackedId, blogId) => {
    if (!token) return;
    if (!confirm(`"${blogId}" 블로그를 이 키워드 추적에서 뺄까요?`)) return;
    try {
      await apiFetch(`/${trackedId}/remove-blog`, { method: 'POST', body: JSON.stringify({ blogId }) }, token);
      const listData = await apiFetch('', {}, token);
      setItems(listData);
      if (selected?.id === trackedId) {
        const refreshed = listData.find(i => i.id === trackedId);
        if (refreshed) setSelected(refreshed);
      }
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

      // 그룹별로 행을 나눠 그룹마다 별도 시트를 만든다(전체 그룹 보기에서 내보내도
      // 그룹1/그룹2/... 시트가 하나의 워크북에 나뉘어 담김). 특정 그룹만 선택해
      // 내보낸 경우는 자연히 시트가 하나뿐이다.
      const byGroupName = new Map();
      for (const r of rows) {
        const key = r.group || '없음';
        if (!byGroupName.has(key)) byGroupName.set(key, []);
        byGroupName.get(key).push(r);
      }
      const orderedNames = [...groups.map(g => g.name), '없음'].filter(name => byGroupName.has(name));
      for (const name of byGroupName.keys()) {
        if (!orderedNames.includes(name)) orderedNames.push(name);
      }

      const wb = XLSX.utils.book_new();
      const usedSheetNames = new Set();
      for (const name of orderedNames) {
        const sheet = buildHeatmapSheet(byGroupName.get(name));
        const base = String(name).replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || '없음';
        let sheetName = base;
        let i = 2;
        while (usedSheetNames.has(sheetName)) sheetName = `${base.slice(0, 28)}(${i++})`;
        usedSheetNames.add(sheetName);
        XLSX.utils.book_append_sheet(wb, sheet, sheetName);
      }

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
              {mode === 'blog' && (
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>
                  {' '}· 링크 <span style={{ color: 'var(--accent)' }}>{filteredItems.reduce((sum, i) => sum + (i.blog_ids?.length || 0), 0)}</span>개
                </span>
              )}
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
                    <a
                      href={`https://search.naver.com/search.naver?ssc=tab.blog.all&sm=tab_jum&query=${encodeURIComponent(item.keyword)}`}
                      target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      title="네이버 블로그탭에서 검색"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                        padding: '3px 10px', borderRadius: 999, textDecoration: 'none', cursor: 'pointer',
                        background: 'rgba(10,132,255,0.15)', border: '1px solid rgba(10,132,255,0.3)',
                        fontSize: 13, fontWeight: 700, color: 'var(--accent)',
                      }}
                    >
                      {item.keyword}
                    </a>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: 14, fontWeight: 800,
                            fontFamily: "'Space Grotesk', sans-serif",
                            color,
                          }}>
                            {label}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); handleRemoveBlog(item.id, blogId); }}
                            title="이 블로그만 추적에서 빼기"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-tertiary)', padding: 2, display: 'flex', lineHeight: 1,
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>
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
