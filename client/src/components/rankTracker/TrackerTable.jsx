import { useState } from 'react';
import { Plus, Trash2, X, ChevronRight } from 'lucide-react';
import { formatRankStatus } from './trackerFormat';

const SORT_DEFAULT_DIR = { keyword: 'asc', searchVolume: 'desc', rank: 'asc', addedDate: 'desc' };

function bestRank(item) {
  const ranks = Object.values(item.latestRanks || {}).filter(r => r.rank != null).map(r => r.rank);
  return ranks.length ? Math.min(...ranks) : null;
}

function earliestAddedDate(item) {
  const dates = Object.values(item.latestRanks || {}).map(r => r.addedDate).filter(Boolean);
  return dates.length ? dates.sort()[0] : null;
}

function getSortValue(item, key) {
  if (key === 'keyword') return item.keyword;
  if (key === 'searchVolume') return item.searchVolume ?? -1;
  if (key === 'rank') return bestRank(item) ?? 999;
  if (key === 'addedDate') return earliestAddedDate(item) || '';
  return 0;
}

export default function TrackerTable({
  mode, rows, groups, sortKey, sortDir, onSortChange,
  selectedIds, onToggleSelect, onToggleSelectAll,
  onRowClick, onMoveItemGroup, onAddBlog, onRemoveBlog, onDeleteKeyword, onBulkDeleteSelected,
  loading,
}) {
  const [expanded, setExpanded] = useState(new Set());
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

  const sortedItems = sortKey
    ? [...rows].sort((a, b) => {
        const av = getSortValue(a, sortKey);
        const bv = getSortValue(b, sortKey);
        const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : rows;

  const flatRows = [];
  for (const item of sortedItems) {
    const blogIds = mode === 'blog' ? (item.blog_ids || []) : [];
    if (!blogIds.length) {
      flatRows.push({ item, blogId: null, isFirst: true, isOpen: false, hiddenCount: 0 });
    } else {
      const isOpen = blogIds.length > 1 && expanded.has(item.id);
      const visibleIds = blogIds.length > 1 && !isOpen ? blogIds.slice(0, 1) : blogIds;
      const hiddenCount = blogIds.length - visibleIds.length;
      visibleIds.forEach((blogId, i) => flatRows.push({ item, blogId, isFirst: i === 0, isOpen, hiddenCount }));
    }
  }

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
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedIds.size}개 선택됨</span>
          <button
            onClick={() => onBulkDeleteSelected([...selectedIds])}
            className="mac-btn-ghost mac-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#FF453A', borderColor: 'rgba(255,69,58,0.3)' }}
          >
            <Trash2 size={12} /> 선택 삭제
          </button>
        </div>
      )}

      <table className="mac-table" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input type="checkbox" className="mac-checkbox" checked={allSelected} onChange={onToggleSelectAll} />
            </th>
            <th className={sortKey === 'keyword' ? 'th-active' : ''} onClick={() => headerClick('keyword')} style={{ cursor: 'pointer', width: '22%' }}>
              키워드{sortArrow('keyword')}
            </th>
            {mode === 'blog' && (
              <th className={sortKey === 'addedDate' ? 'th-active' : ''} onClick={() => headerClick('addedDate')} style={{ cursor: 'pointer', width: '26%' }}>
                블로그{sortArrow('addedDate')}
              </th>
            )}
            <th className={sortKey === 'searchVolume' ? 'th-active' : ''} onClick={() => headerClick('searchVolume')} style={{ cursor: 'pointer', width: '12%' }}>
              검색량{sortArrow('searchVolume')}
            </th>
            <th className={sortKey === 'rank' ? 'th-active' : ''} onClick={() => headerClick('rank')} style={{ cursor: 'pointer', width: '12%' }}>
              순위{sortArrow('rank')}
            </th>
            {mode === 'blog' && <th style={{ width: '10%' }}>통검</th>}
            <th style={{ width: 72 }}></th>
          </tr>
        </thead>
        <tbody>
          {flatRows.map(({ item, blogId, isFirst, isOpen, hiddenCount }, i) => {
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
                <td>
                  {isFirst ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {totalBlogCount > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                          className="mac-expand-toggle"
                          title={isOpen ? '접기' : `블로그 ${totalBlogCount}개 펼치기`}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, display: 'flex', flexShrink: 0 }}
                        >
                          <ChevronRight size={13} style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }} />
                        </button>
                      )}
                      <span style={{ color: 'var(--accent)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.keyword}
                      </span>
                      <select
                        value={String(item.group_id ?? '')}
                        onClick={e => e.stopPropagation()}
                        onChange={e => onMoveItemGroup(item.id, e.target.value || null)}
                        title="그룹 이동"
                        style={{
                          flexShrink: 0, fontSize: 10, fontWeight: 600, padding: '2px 4px',
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
                      <span style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {blogId || '—'}
                      </span>
                      {entry?.addedDate && (
                        <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>
                          · {entry.addedDate} 등록
                        </span>
                      )}
                      {isFirst && !isOpen && hiddenCount > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                          style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
                  <td style={{ color: entry?.integratedExposed ? '#0A84FF' : 'var(--text-tertiary)', fontWeight: 700 }}>
                    {entry?.integratedExposed == null ? '—' : (entry.integratedExposed ? 'O' : 'X')}
                  </td>
                )}
                <td onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    {mode === 'blog' && blogId && (
                      <button onClick={() => onRemoveBlog(item.id, blogId)} title="이 블로그만 추적에서 빼기"
                        className="mac-icon-btn mac-icon-btn-danger"
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
          })}
        </tbody>
      </table>
    </div>
  );
}
