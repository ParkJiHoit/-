import { useEffect, useState } from 'react';
import { X, Bell } from 'lucide-react';

const API = '/api/rank-tracker/notification-settings';

export default function NotificationSettingsModal({ token, onClose }) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API, { headers: { 'Authorization': `Bearer ${token}` } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || '설정을 불러오지 못했습니다.');
        setWebhookUrl(body.slackWebhookUrl || '');
        setEnabled(body.slackEnabled !== false);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [token]);

  async function handleSave() {
    setSaving(true); setError(''); setMessage('');
    try {
      const res = await fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ slackWebhookUrl: webhookUrl, slackEnabled: enabled }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '저장에 실패했습니다.');
      setWebhookUrl(body.slackWebhookUrl || '');
      setEnabled(body.slackEnabled !== false);
      setMessage('저장했습니다.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true); setError(''); setMessage('');
    try {
      const res = await fetch(`${API}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ slackWebhookUrl: webhookUrl }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '전송에 실패했습니다.');
      setMessage('테스트 메시지를 보냈습니다. Slack 채널을 확인해 보세요.');
    } catch (e) { setError(e.message); }
    finally { setTesting(false); }
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
            <Bell size={17} style={{ color: 'var(--accent)' }} />
            순위 변동 알림
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
              추적 중인 블로그가 갱신될 때 <b>5위 안 진입/이탈</b>, <b>통합검색 노출 시작/종료</b>가 감지되면
              Slack으로 알려드립니다. Slack 워크스페이스에서 "Incoming Webhooks" 앱을 추가해 채널을 선택하면
              전용 URL을 발급받을 수 있어요.
            </p>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Slack Webhook URL
            </label>
            <input
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="mac-input"
              style={{ marginBottom: 14 }}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input type="checkbox" className="mac-checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
              알림 켜기
            </label>

            {error && (
              <div style={{ marginBottom: 14, fontSize: 12, color: '#FF453A' }}>{error}</div>
            )}
            {message && (
              <div style={{ marginBottom: 14, fontSize: 12, color: '#30D158' }}>{message}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleTest}
                disabled={testing || !webhookUrl.trim()}
                className="mac-btn-ghost mac-btn-sm"
                style={{ flex: 1, opacity: (!webhookUrl.trim()) ? 0.5 : 1 }}
              >
                {testing ? '전송 중...' : '테스트 보내기'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="mac-btn mac-btn-sm"
                style={{ flex: 1 }}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
