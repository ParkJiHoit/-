import { X } from 'lucide-react';
import { useAuth } from '../AuthContext';

export default function LoginPromptModal({ reason, onClose, onGoToAuth }) {
  const { signInWithGoogle } = useAuth();

  const handleLogin = () => {
    onClose();
    if (onGoToAuth) onGoToAuth();
    else signInWithGoogle();
  };

  const isBlog = reason === 'blog';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'macFadeIn 0.18s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="mac-card"
        style={{
          width: '100%', maxWidth: 400,
          padding: '32px 28px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
          textAlign: 'center',
          animation: 'macScaleIn 0.2s cubic-bezier(0.34,1.2,0.64,1)',
        }}
      >
        {/* 닫기 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--text-tertiary)', padding: 4, borderRadius: 6,
          }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>

        {/* 아이콘 */}
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg, #0A84FF 0%, #34C1FF 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(10,132,255,0.35)',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 22V12h6v10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* 제목 */}
        <div>
          <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.3px' }}>
            {isBlog ? '블로그 분석은 로그인이 필요해요' : '무료 횟수를 모두 사용했어요'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
            {isBlog
              ? '블로그 구조 분석 기능은 로그인한 회원만 사용할 수 있습니다.'
              : `비로그인 상태에서는 키워드 분석을 ${4}회까지 무료로 사용할 수 있어요. 로그인하면 하루 10회까지 사용할 수 있습니다.`}
          </p>
        </div>

        {/* 구글 로그인 버튼 */}
        <button
          onClick={handleLogin}
          style={{
            width: '100%', padding: '12px 20px',
            borderRadius: 12, border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-overlay)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
        >
          {/* Google 로고 SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            Google로 계속하기
          </span>
        </button>

        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>
          가입하면 모든 기능을 무제한으로 이용할 수 있어요
        </p>
      </div>
    </div>
  );
}
