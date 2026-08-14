import { useState } from 'react';
import { Plus, Trash2, X, ChevronRight, ChevronDown, Star, RefreshCw, PauseCircle, PlayCircle } from 'lucide-react';
import { formatRankStatus } from './trackerFormat';
import { STABILIZED_AFTER_DAYS, mostRecentAddedDate, itemAgeDays } from '../../utils/stabilization';

const SORT_DEFAULT_DIR = { keyword: 'asc', searchVolume: 'desc', rank: 'asc', addedDate: 'desc' };

function bestRank(item) {
  const ranks = Object.values(item.latestRanks || {}).filter(r => r.rank != null).map(r => r.rank);
  return ranks.length ? Math.min(...ranks) : null;
}

// "2026-07-10" -> "26-07-10"
function formatShortDate(dateStr) {
  return dateStr ? dateStr.slice(2) : null;
}

function getSortValue(item, key) {
  if (key === 'keyword') return item.keyword;
  if (key === 'searchVolume') return item.searchVolume ?? -1;
  if (key === 'rank') return bestRank(item) ?? 999;
  // 키워드에 새 링크를 추가하면(기존 링크는 그대로 두고) 그 키워드가 목록 최상단으로
  // 올라와야 하므로, 가장 오래된 링크가 아니라 가장 최근에 추가된 링크 기준으로 정렬한다.
  if (key === 'addedDate') return mostRecentAddedDate(item) || '';
  return 0;
}

export default function TrackerTable({
  mode, rows, groups, sortKey, sortDir, onSortChange,
  selectedIds, onToggleSelect, onToggleSelectAll,
  onRowClick, onMoveItemGroup, onAddBlog, onRemoveBlog, onDeleteKeyword, onBulkDeleteSelected,
  onSetStabilizedSelected,
  onRefreshSelected, refreshingSelected,
  onToggleFavorite,
  loading,
}) {
  const [expanded, setExpanded] = useState(new Set());
  const [showStabilized, setShowStabilized] = useState(false);
  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>불러오는 중…</div>;
  }
  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1.7 }}>
        조건에 맞는 항목이 없습니다.<br />검색어나 그룹 필터를 확인해 보세요.
      </div>
    );
  }

  const sortedByKey = sortKey
    ? [...rows].sort((a, b) => {
        const av = getSortValue(a, sortKey);
        const bv = getSortValue(b, sortKey);
        const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : rows;

  // 즐겨찾기는 현재 정렬 기준과 무관하게 항상 맨 위에 고정한다(Array.sort는 안정 정렬이라
  // 즐겨찾기/일반 그룹 내부의 상대 순서는 위에서 계산한 정렬 결과 그대로 유지된다).
  const sortedItems = [...sortedByKey].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));

  const buildFlatRows = (items) => {
    const out = [];
    for (const item of items) {
      // blog_ids는 DB에 등록된 순서(=가장 오래된 게 먼저) 그대로라, 기존 키워드에
      // 새 포스팅을 추가해도 대표 행(접혔을 때 보이는 첫 줄)이 계속 옛날 링크로
      // 고정돼 있었다. 링크별 등록일(addedDate) 내림차순으로 정렬해 항상 가장 최근
      // 등록한 링크가 대표 행 + 펼쳤을 때도 맨 위로 오게 한다.
      const blogIds = mode === 'blog'
        ? [...(item.blog_ids || [])].sort((a, b) => {
            const da = item.latestRanks?.[a]?.addedDate || '';
            const db = item.latestRanks?.[b]?.addedDate || '';
            return db.localeCompare(da);
          })
        : [];
      if (!blogIds.length) {
        out.push({ item, blogId: null, isFirst: true, isOpen: false, hiddenCount: 0 });
      } else {
        const isOpen = blogIds.length > 1 && expanded.has(item.id);
        const visibleIds = blogIds.length > 1 && !isOpen ? blogIds.slice(0, 1) : blogIds;
        const hiddenCount = blogIds.length - visibleIds.length;
        visibleIds.forEach((blogId, i) => out.push({ item, blogId, isFirst: i === 0, isOpen, hiddenCount }));
      }
    }
    return out;
  };

  // 등록 14일 경과(자동, 화면 정리용)뿐 아니라 사람이 범위 선택해서 수동으로 표시한
  // is_stabilized 항목도 함께 "안정화됨" 섹션으로 접어서 분리한다 — 특정 그룹 보기든
  // 전체 그룹 보기든 동일하게 적용한다.
  const recentItems = sortedItems.filter(i => !i.is_stabilized && itemAgeDays(i, mode) < STABILIZED_AFTER_DAYS);
  const stabilizedItems = sortedItems.filter(i => i.is_stabilized || itemAgeDays(i, mode) >= STABILIZED_AFTER_DAYS);

  const flatRows = buildFlatRows(recentItems);
  const stabilizedFlatRows = buildFlatRows(stabilizedItems);

  const allSelected = rows.length > 0 && rows.every(r => selectedIds.has(r.id));

  const headerClick = (key) => {
    if (sortKey === key) onSortChange(key, sortDir === 'asc' ? 'desc' : 'asc');
    else onSortChange(key, SORT_DEFAULT_DIR[key]);
  };

  const sortArrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div>
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 8,
          borderRadius: 8, background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selectedIds.size}개 선택됨</span>
          <button
            onClick={() => onRefreshSelected([...selectedIds])}
            disabled={refreshingSelected}
            className="mac-btn-ghost mac-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: refreshingSelected ? 0.6 : 1 }}
          >
            <RefreshCw size={12} style={{ animation: refreshingSelected ? 'spin 1s linear infinite' : 'none' }} />
            선택 갱신
          </button>
          {onSetStabilizedSelected && (
            <>
              <button
                onClick={() => onSetStabilizedSelected([...selectedIds], true)}
                disabled={refreshingSelected}
                title="선택한 항목을 안정화 처리해 전체 갱신에서 제외합니다"
                className="mac-btn-ghost mac-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <PauseCircle size={12} /> 안정화 처리
              </button>
              <button
                onClick={() => onSetStabilizedSelected([...selectedIds], false)}
                disabled={refreshingSelected}
                title="선택한 항목의 안정화를 해제해 다시 전체 갱신 대상에 포함합니다"
                className="mac-btn-ghost mac-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <PlayCircle size={12} /> 안정화 해제
              </button>
            </>
          )}
          <button
            onClick={() => onBulkDeleteSelected([...selectedIds])}
            disabled={refreshingSelected}
            className="mac-btn-ghost mac-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#FF453A', borderColor: 'rgba(255,69,58,0.3)' }}
          >
            <Trash2 size={12} /> 선택 삭제
          </button>
        </div>
      )}

      <div className="mac-scroll" style={{ maxHeight: 560, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
      <table className="mac-table mac-table-lg" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input type="checkbox" className="mac-checkbox" checked={allSelected} onChange={onToggleSelectAll} />
            </th>
            {mode === 'blog' && (
              <th className={sortKey === 'addedDate' ? 'th-active' : ''} onClick={() => headerClick('addedDate')} style={{ cursor: 'pointer', width: '9%' }}>
                등록일{sortArrow('addedDate')}
              </th>
            )}
            <th className={sortKey === 'keyword' ? 'th-active' : ''} onClick={() => headerClick('keyword')} style={{ cursor: 'pointer', width: '26%' }}>
              {/* 즐겨찾기 별표 + 펼치기 화살표가 차지하는 폭만큼 앞에 빈 자리를 둬서
                  "키워드" 라벨이 별표가 아니라 실제 키워드 텍스트 위에 오게 맞춘다. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 20, flexShrink: 0 }} />
                <span style={{ width: 17, flexShrink: 0 }} />
                <span>키워드{sortArrow('keyword')}</span>
              </div>
            </th>
            {mode === 'blog' && (
              <th style={{ width: '24%' }}>블로그</th>
            )}
            <th className={sortKey === 'searchVolume' ? 'th-active' : ''} onClick={() => headerClick('searchVolume')} style={{ cursor: 'pointer', width: '8%' }}>
              검색량{sortArrow('searchVolume')}
            </th>
            <th className={sortKey === 'rank' ? 'th-active' : ''} onClick={() => headerClick('rank')} style={{ cursor: 'pointer', width: '8%' }}>
              순위{sortArrow('rank')}
            </th>
            {mode === 'blog' && <th style={{ width: '7%' }}>통검</th>}
            <th style={{ width: 72 }}></th>
          </tr>
        </thead>
        <tbody>
          {flatRows.map((row, i) => renderRow(row, i))}
          {stabilizedItems.length > 0 && (
            <tr>
              <td colSpan={mode === 'blog' ? 8 : 5} style={{ padding: 0, border: 'none' }}>
                <button
                  onClick={() => setShowStabilized(v => !v)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: 'none',
                    borderTop: '1px solid var(--border)', color: 'var(--text-tertiary)',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  }}
                >
                  <ChevronDown size={13} style={{ transform: showStabilized ? 'none' : 'rotate(-90deg)' }} />
                  안정화됨 (등록 {STABILIZED_AFTER_DAYS}일 경과) · {stabilizedItems.length}개
                </button>
              </td>
            </tr>
          )}
          {showStabilized && stabilizedFlatRows.map((row, i) => renderRow(row, i))}
        </tbody>
      </table>
      </div>
    </div>
  );

  function renderRow({ item, blogId, isFirst, isOpen, hiddenCount }, i) {
    const entry = blogId ? item.latestRanks?.[blogId] ?? null : null;
    const totalBlogCount = mode === 'blog' ? (item.blog_ids || []).length : 0;
    const { label, color } = formatRankStatus(entry?.rank ?? null, entry?.status ?? null);
    const best = bestRank(item);
    const allLabel = best != null ? `최고 ${best}위` : '기록 없음';
    const allColor = best != null && best <= 5 ? '#30D158' : 'var(--text-tertiary)';
    return (
              <tr
                key={`${item.id}-${blogId ?? 'x'}-${i}`}
                onClick={() => onRowClick(item)}
                style={{
                  cursor: 'pointer',
                  borderTop: isFirst ? '2px solid var(--border-strong)' : undefined,
                  background: isFirst ? undefined : 'rgba(255,255,255,0.015)',
                }}
              >
                <td onClick={e => e.stopPropagation()}>
                  {isFirst && (
                    <input
                      type="checkbox" className="mac-checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => onToggleSelect(item.id)}
                    />
                  )}
                </td>
                {mode === 'blog' && (
                  <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                    {formatShortDate(entry?.addedDate) || '—'}
                  </td>
                )}
                <td>
                  {isFirst ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id, !item.is_favorite); }}
                        className="mac-icon-btn mac-icon-btn-star"
                        title={item.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'flex', flexShrink: 0,
                          color: item.is_favorite ? '#FFD60A' : 'var(--text-tertiary)',
                        }}
                      >
                        <Star size={14} fill={item.is_favorite ? '#FFD60A' : 'none'} />
                      </button>
                      <span style={{ width: 17, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                        {totalBlogCount > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                            className="mac-expand-toggle"
                            title={isOpen ? '접기' : `블로그 ${totalBlogCount}개 펼치기`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, display: 'flex' }}
                          >
                            <ChevronRight size={13} style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }} />
                          </button>
                        )}
                      </span>
                      <span style={{ color: 'var(--accent)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 0', minWidth: 0 }}>
                        {item.keyword}
                      </span>
                      {item.is_stabilized && (
                        <span title="수동으로 안정화 처리됨 (전체 갱신 제외)" style={{ display: 'flex', flexShrink: 0, color: 'var(--text-tertiary)' }}>
                          <PauseCircle size={13} />
                        </span>
                      )}
                      <select
                        value={String(item.group_id ?? '')}
                        onClick={e => e.stopPropagation()}
                        onChange={e => onMoveItemGroup(item.id, e.target.value || null)}
                        title="그룹 이동"
                        style={{
                          flexShrink: 0, fontSize: 11, fontWeight: 600, padding: '3px 5px',
                          borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                          color: 'var(--text-tertiary)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <option value="">그룹 없음</option>
                        {groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)', paddingLeft: 14 }}>↳</span>
                  )}
                </td>
                {mode === 'blog' && (
                  <td style={{ color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      <span style={{ width: 158, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {blogId || '—'}
                      </span>
                      {isFirst && !isOpen && hiddenCount > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                          style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          외 {hiddenCount}개
                        </button>
                      )}
                    </div>
                  </td>
                )}
                <td>{isFirst ? (item.searchVolume ?? '—') : ''}</td>
                {mode === 'blog' ? (
                  <td style={{ color, fontWeight: 700 }}>{blogId ? label : '—'}</td>
                ) : (
                  <td style={{ color: allColor, fontWeight: 700 }}>{allLabel}</td>
                )}
                {mode === 'blog' && (
                  <td style={{ color: entry?.integratedExposed ? '#0A84FF' : 'var(--text-tertiary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {entry?.integratedExposed == null ? '—' : (entry.integratedExposed ? '노출' : '미노출')}
                  </td>
                )}
                <td onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    {mode === 'blog' && blogId && (
                      <button onClick={() => onRemoveBlog(item.id, blogId)} title="이 블로그만 추적에서 빼기"
                        className="mac-icon-btn mac-icon-btn-danger mac-icon-btn-x"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, display: 'flex' }}>
                        <X size={13} />
                      </button>
                    )}
                    {isFirst && mode === 'blog' && (
                      <button onClick={() => onAddBlog(item)} title="블로그 URL 추가"
                        className="mac-icon-btn mac-icon-btn-accent"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4, display: 'flex' }}>
                        <Plus size={13} />
                      </button>
                    )}
                    {isFirst && (
                      <button onClick={() => onDeleteKeyword(item.id)} title="삭제"
                        className="mac-icon-btn mac-icon-btn-danger"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, display: 'flex' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
    );
  }
}
