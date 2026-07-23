import { RefreshCw, Plus, Trash2, Download, Pencil, Bell, Share2 } from 'lucide-react';
import { formatKSTDateTime } from './trackerFormat';

export default function TrackerToolbar({
  mode, groups, selectedGroupId, onGroupChange, onCreateGroup, onRenameGroup, onDeleteGroup,
  searchQuery, onSearchChange,
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
      <select
        value={selectedGroupId}
        onChange={e => {
          if (e.target.value === '__new__') { onCreateGroup(); return; }
          onGroupChange(e.target.value);
        }}
        style={{
          height: 34, padding: '0 8px', borderRadius: 8,
          background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
          color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
          outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
        }}
      >
        <option value="">전체 그룹</option>
        {groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
        <option value="__new__">+ 새 그룹 만들기</option>
      </select>
      {selectedGroupId && (
        <>
          <button onClick={onRenameGroup} title="그룹 이름 변경" className="mac-btn-ghost mac-btn-sm" style={{ display: 'flex', padding: 6 }}>
            <Pencil size={12} />
          </button>
          <button onClick={onDeleteGroup} title="그룹 삭제" className="mac-btn-ghost mac-btn-sm" style={{ display: 'flex', padding: 6, color: '#FF453A' }}>
            <Trash2 size={12} />
          </button>
        </>
      )}
      <button
        onClick={onOpenShareModal}
        title={selectedGroupId ? '이 그룹 리포트 공유' : '전체 그룹 리포트 공유'}
        className="mac-btn-ghost mac-btn-sm"
        style={{ display: 'flex', padding: 6 }}
      >
        <Share2 size={12} />
      </button>
      <input
        value={searchQuery}
        onChange={e => onSearchChange(e.target.value)}
        placeholder="키워드 검색"
        style={{
          height: 34, padding: '0 10px', borderRadius: 8, width: 170,
          background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
          color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
        }}
      />
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
      <button onClick={onOpenNotificationSettings} title="순위 변동 Slack 알림 설정" className="mac-btn-ghost mac-btn-sm" style={{ display: 'flex', padding: 6 }}>
        <Bell size={13} />
      </button>
      <button onClick={onOpenBulkModal} className="mac-btn-ghost mac-btn-sm">대량 등록</button>
      <button onClick={onOpenAddModal} className="mac-btn mac-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Plus size={12} /> 등록
      </button>
    </div>
  );
}
