import { useEffect, useState } from 'react';
import { X, Share2, Copy, Check } from 'lucide-react';

export default function ShareReportModal({ token, groupId, groupName, onClose }) {
  const [shareToken, setShareToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const API = `/api/rank-tracker/groups/${groupId}/share`;
  const shareUrl = shareToken ? `${window.location.origin}/?report=${shareToken}` : '';

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API, { headers: { 'Authorization': `Bearer ${token}` } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || '불러오지 못했습니다.');
        setShareToken(body.token || null);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [API, token]);

  async function handleCreate() {
    setWorking(true); setError('');
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '링크 생성에 실패했습니다.');
      setShareToken(body.token);
    } catch (e) { setError(e.message); }
    finally { setWorking(false); }
  }

  async function handleRevoke() {
    if (!confirm('공유 링크를 해제할까요? 이미 공유된 링크는 더 이상 열리지 않습니다.')) return;
    setWorking(true); setError('');
    try {
      const res = await fetch(API, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('해제에 실패했습니다.');
      setShareToken(null);
    } catch (e) { setError(e.message); }
    finally { setWorking(false); }
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700 }}>
            <Share2 size={17} style={{ color: 'var(--accent)' }} />
            리포트 공유
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>불러오는 중…</div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7, marginTop: 0 }}>
              <b>{groupName}</b> 그룹의 순위 데이터를 로그인 없이 볼 수 있는 읽기전용 링크입니다.
              클라이언트에게 공유하면 편집 없이 순위만 확인할 수 있어요.
            </p>

            {shareToken ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input readOnly value={shareUrl} className="mac-input" style={{ flex: 1, fontSize: 12 }} onClick={e => e.target.select()} />
                  <button onClick={handleCopy} className="mac-btn-ghost mac-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
                {error && <div style={{ marginBottom: 14, fontSize: 12, color: '#FF453A' }}>{error}</div>}
                <button onClick={handleRevoke} disabled={working} className="mac-btn-ghost mac-btn-sm" style={{ width: '100%', color: '#FF453A' }}>
                  {working ? '처리 중...' : '공유 링크 해제'}
                </button>
              </>
            ) : (
              <>
                {error && <div style={{ marginBottom: 14, fontSize: 12, color: '#FF453A' }}>{error}</div>}
                <button onClick={handleCreate} disabled={working} className="mac-btn mac-btn-sm" style={{ width: '100%' }}>
                  {working ? '생성 중...' : '공유 링크 만들기'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
