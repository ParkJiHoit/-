import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Plus, Trash2, Download, Pencil, Bell, Share2, AlertTriangle, Search, ChevronDown, Check } from 'lucide-react';
import { formatKSTDateTime } from './trackerFormat';
import useDelayedUnmount from '../../hooks/useDelayedUnmount';

function GroupSelect({ groups, selectedGroupId, onGroupChange, onCreateGroup }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { shouldRender: menuMounted, isClosing: menuClosing, isEntering: menuEntering } = useDelayedUnmount(open);
  const selectedName = selectedGroupId
    ? (groups.find(g => String(g.id) === String(selectedGroupId))?.name || '전체 그룹')
    : '전체 그룹';

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); window.removeEventListener('keydown', handleKey); };
  }, [open]);

  const options = [{ id: '', name: '전체 그룹' }, ...groups];

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          height: 34, padding: '0 10px 0 12px', borderRadius: 10, minWidth: 118, maxWidth: 180,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
          color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit', transition: 'border-color 0.15s',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedName}</span>
        <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--text-tertiary)', transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {menuMounted && (
        <div
          className="mac-dropdown"
          data-entering={menuEntering}
          data-closing={menuClosing}
          style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, minWidth: 190, zIndex: 200, padding: 6, transformOrigin: 'top left' }}
        >
          {options.map(g => {
            const isSelected = g.id === '' ? !selectedGroupId : String(g.id) === String(selectedGroupId);
            return (
              <button
                key={g.id || 'all'}
                type="button"
                onClick={() => { onGroupChange(g.id === '' ? '' : String(g.id)); setOpen(false); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7, border: 'none',
                  background: isSelected ? 'rgba(10,132,255,0.12)' : 'transparent',
                  color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                  fontSize: 13, fontWeight: isSelected ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                {isSelected && <Check size={13} style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
          <div className="mac-divider" style={{ margin: '6px 4px' }} />
          <button
            type="button"
            onClick={() => { onCreateGroup(); setOpen(false); }}
            style={{
              width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7, border: 'none',
              background: 'transparent', color: 'var(--accent)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(10,132,255,0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Plus size={13} /> 새 그룹 만들기
          </button>
        </div>
      )}
    </div>
  );
}

export default function TrackerToolbar({
  mode, groups, selectedGroupId, onGroupChange, onCreateGroup, onRenameGroup, onDeleteGroup,
  searchQuery, onSearchChange,
  failedOnly, onToggleFailedOnly, failedCount,
  filteredItems,
  refreshingAll, refreshAllProgress, onRefreshAll,
  failedJobId, onRetryFailed,
  onExport, onOpenBulkModal, onOpenAddModal, onOpenNotificationSettings, onOpenShareModal,
}) {
  const lastRefreshed = filteredItems.reduce((acc, i) => (
    i.last_refreshed_at && (!acc || i.last_refreshed_at > acc) ? i.last_refreshed_at : acc
  ), null);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <GroupSelect groups={groups} selectedGroupId={selectedGroupId} onGroupChange={onGroupChange} onCreateGroup={onCreateGroup} />
      {selectedGroupId && (
        <>
          <button onClick={onRenameGroup} title="그룹 이름 변경" className="mac-icon-btn"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 6, display: 'flex' }}>
            <Pencil size={13} />
          </button>
          <button onClick={onDeleteGroup} title="그룹 삭제" className="mac-icon-btn mac-icon-btn-danger"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 6, display: 'flex' }}>
            <Trash2 size={13} />
          </button>
        </>
      )}
      <button
        onClick={onOpenShareModal}
        title={selectedGroupId ? '이 그룹 리포트 공유' : '전체 그룹 리포트 공유'}
        className="mac-icon-btn"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 6, display: 'flex' }}
      >
        <Share2 size={13} />
      </button>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
        <input
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="키워드 검색"
          className="mac-input"
          style={{ height: 34, width: 170, padding: '0 10px 0 30px', fontSize: 13 }}
        />
      </div>
      {(failedCount > 0 || failedOnly) && (
        <button
          onClick={onToggleFailedOnly}
          title="조회실패만 보기"
          className="mac-btn-ghost mac-btn-sm"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            color: failedOnly ? '#FF453A' : 'var(--text-secondary)',
            borderColor: failedOnly ? 'rgba(255,69,58,0.4)' : undefined,
            background: failedOnly ? 'rgba(255,69,58,0.12)' : undefined,
          }}
        >
          <AlertTriangle size={12} />
          조회실패만{failedCount > 0 && ` (${failedCount})`}
        </button>
      )}
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        {lastRefreshed ? `최근 갱신: ${formatKSTDateTime(lastRefreshed)}` : '아직 갱신 내역 없음'}
      </span>
      <div style={{ flex: 1 }} />
      {filteredItems.length > 0 && (
        <button onClick={onRefreshAll} disabled={refreshingAll} className="mac-btn-ghost mac-btn-sm" title="전체 순위 갱신"
          style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: refreshingAll ? 0.6 : 1 }}>
          <RefreshCw size={12} style={{ animation: refreshingAll ? 'spin 1s linear infinite' : 'none' }} />
          {refreshingAll
            ? `${refreshAllProgress.done}/${refreshAllProgress.total}${refreshAllProgress.etaSeconds != null ? ` · 약 ${refreshAllProgress.etaSeconds}초 남음` : ''}`
            : '전체 갱신'}
        </button>
      )}
      {failedJobId && !refreshingAll && (
        <button onClick={onRetryFailed} className="mac-btn-ghost mac-btn-sm" style={{ color: '#FF453A', borderColor: 'rgba(255,69,58,0.3)' }}>
          실패 항목 재시도
        </button>
      )}
      {filteredItems.length > 0 && (
        <button onClick={onExport} className="mac-btn-ghost mac-btn-sm" title="현재 목록의 순위 기록을 엑셀로 내보내기"
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Download size={12} /> 내보내기
        </button>
      )}
      <button onClick={onOpenNotificationSettings} title="순위 변동 Slack 알림 설정" className="mac-icon-btn"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 6, display: 'flex' }}>
        <Bell size={13} />
      </button>
      <button onClick={onOpenBulkModal} className="mac-btn-ghost mac-btn-sm">대량 등록</button>
      <button onClick={onOpenAddModal} className="mac-btn mac-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Plus size={12} /> 등록
      </button>
    </div>
  );
}
