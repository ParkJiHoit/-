import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import AuthScene from '../components/AuthScene';
import VerticalCutReveal from '../components/VerticalCutReveal';
import rankletLogoDark from '../assets/ChatGPT_Image_2026년_6월_14일_오후_11_42_18-removebg-preview.png';
import rankletLogoLight from '../assets/ChatGPT_Image_2026년_6월_14일_오후_11_45_46-removebg-preview.png';

export default function AuthPage({ onSuccess, onClose, theme }) {
  const [mode, setMode] = useState('login'); // 'login' | 'email' | 'signup'
  const isDark = theme !== 'light';

  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    /* 전체 오버레이 */
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'authOverlayIn 0.2s ease',
      }}
    >
      {/* 팝업 박스 */}
      <div style={{
        display: 'flex',
        width: '100%',
        maxWidth: 1020,
        height: 640,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: isDark
          ? '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)'
          : '0 32px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.08)',
        animation: 'authPopIn 0.28s cubic-bezier(0.34,1.1,0.64,1)',
        position: 'relative',
      }}>

        {/* ── 왼쪽: 폼 패널 ── */}
        <div style={{
          flex: '0 0 50%',
          display: 'flex',
          flexDirection: 'column',
          background: isDark ? '#1C1C1E' : '#FFFFFF',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 상단 컨트롤 바 — 뒤로가기 버튼 + 로고 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '16px 20px 0',
            flexShrink: 0,
            gap: 10,
          }}>
            <IconBtn
              onClick={mode === 'login' ? onClose : () => setMode('login')}
              isDark={isDark}
              title={mode === 'login' ? '메인으로 돌아가기' : '뒤로가기'}
            >
              <ArrowLeftIcon />
            </IconBtn>
            {/* 로고 — 뒤로가기 버튼과 동일 선상 */}
            <div style={{ width: 140, height: 34, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
              <img
                src={isDark ? rankletLogoDark : rankletLogoLight}
                alt="RANKLET"
                style={{ width: 140, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              />
            </div>
          </div>

          {/* 폼 콘텐츠 */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 40px 32px',
            overflowY: 'auto',
          }}>
            {mode === 'login' && (
              <LoginPanel
                isDark={isDark}
                onEmailMode={() => setMode('email')}
                onSignup={() => setMode('signup')}
                onSuccess={onSuccess}
              />
            )}
            {mode === 'email' && (
              <EmailPanel
                isDark={isDark}
                onSuccess={onSuccess}
              />
            )}
            {mode === 'signup' && (
              <SignupPanel
                isDark={isDark}
                onSuccess={onSuccess}
                onDone={() => setMode('login')}
              />
            )}
          </div>
        </div>

        {/* ── 오른쪽: Three.js 씬 ── */}
        <div style={{
          flex: '0 0 50%',
          position: 'relative',
          background: '#000',
          overflow: 'hidden',
        }}>
          {/* 왼쪽 경계 페이드 */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, #000 0%, transparent 22%)',
            zIndex: 1, pointerEvents: 'none',
          }} />
          <AuthScene />
        </div>
      </div>
    </div>
  );
}

/* ─── 로고 ─── */
function Logo({ isDark }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, marginTop: 8 }}>
      {/* 이미지 캔버스 여백을 clip으로 제거 — 실제 로고는 세로 중앙 약 30% 영역 */}
      <div style={{
        width: 190,
        height: 48,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}>
        <img
          src={isDark ? rankletLogoDark : rankletLogoLight}
          alt="RANKLET"
          style={{
            width: 190,
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    </div>
  );
}

/* ─── 로그인 메인 패널 (소셜 + 이메일 진입) ─── */
function LoginPanel({ isDark, onEmailMode, onSignup, onSuccess }) {
  const { signInWithGoogle } = useAuth();
  const color = isDark ? '#F5F5F7' : '#1C1C1E';
  const tr = { type: 'spring', stiffness: 200, damping: 21 };

  return (
    <div style={{ width: '100%', maxWidth: 300 }}>
      {/* VerticalCutReveal 타이틀 */}
      <div style={{ marginBottom: 28, color, fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.4 }}>
        <VerticalCutReveal splitBy="characters" staggerDuration={0.025} staggerFrom="first" transition={tr}>
          {`HI 👋, FRIEND!`}
        </VerticalCutReveal>
        <VerticalCutReveal splitBy="characters" staggerDuration={0.025} staggerFrom="last" reverse={true} transition={{ ...tr, delay: 0.5 }}>
          {`🌤️ IT IS NICE ⇗ TO`}
        </VerticalCutReveal>
        <VerticalCutReveal splitBy="characters" staggerDuration={0.025} staggerFrom="center" transition={{ ...tr, delay: 1.1 }}>
          {`MEET 😊 YOU.`}
        </VerticalCutReveal>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Google */}
        <SocialButton onClick={signInWithGoogle} isDark={isDark}>
          <GoogleIcon />
          구글로 로그인
        </SocialButton>

        <Divider isDark={isDark} />

        {/* 이메일로 로그인하기 */}
        <SocialButton onClick={onEmailMode} isDark={isDark}>
          <MailIcon />
          이메일로 로그인하기
        </SocialButton>
      </div>

      {/* 하단 링크 */}
      <div style={{ textAlign: 'center', marginTop: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ margin: 0, fontSize: 12, color: isDark ? '#8E8E93' : '#8E8E93' }}>
          계정이 없으신가요?{' '}
          <InlineLink onClick={onSignup} isDark={isDark}>회원가입</InlineLink>
        </p>
      </div>
    </div>
  );
}

/* ─── 이메일 로그인 패널 ─── */
function EmailPanel({ isDark, onSuccess }) {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signInWithEmail(email, password);
    setLoading(false);
    if (error) setError(getKoreanError(error.message));
    else onSuccess?.();
  }

  return (
    <div style={{ width: '100%', maxWidth: 300 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.3px', color: isDark ? '#F5F5F7' : '#1C1C1E' }}>
          이메일로 로그인
        </h1>
        <p style={{ fontSize: 12, color: isDark ? '#8E8E93' : '#8E8E93', margin: 0 }}>
          이메일과 패스워드를 입력해주세요
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <FormField label="이메일" isDark={isDark}>
          <AuthInput type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com" autoComplete="email" required isDark={isDark} />
        </FormField>
        <FormField label="패스워드" isDark={isDark}>
          <AuthInput type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" autoComplete="current-password" required isDark={isDark} />
        </FormField>
        {error && <ErrorMsg>{error}</ErrorMsg>}
        <PrimaryButton type="submit" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? '로그인 중...' : '로그인'}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* ─── 회원가입 패널 ─── */
function SignupPanel({ isDark, onSuccess, onDone }) {
  const { signUpWithEmail } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== passwordConfirm) { setError('패스워드가 일치하지 않습니다.'); return; }
    setLoading(true);
    const { error } = await signUpWithEmail(email, password, name, phone);
    setLoading(false);
    if (error) setError(getKoreanError(error.message));
    else setDone(true);
  }

  if (done) {
    return (
      <div style={{ width: '100%', maxWidth: 300, textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, margin: '0 auto 14px',
          background: 'linear-gradient(135deg,#0A84FF,#34C1FF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(10,132,255,0.35)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: isDark ? '#F5F5F7' : '#1C1C1E', margin: '0 0 8px' }}>
          이메일을 확인해주세요
        </h2>
        <p style={{ fontSize: 13, color: isDark ? '#8E8E93' : '#636366', margin: '0 0 20px', lineHeight: 1.6 }}>
          <span style={{ color: isDark ? '#C4C4C8' : '#1C1C1E', fontWeight: 500 }}>{email}</span>으로<br/>인증 메일을 보냈습니다.
        </p>
        <PrimaryButton onClick={onDone}>로그인으로 돌아가기</PrimaryButton>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 300 }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.3px', color: isDark ? '#F5F5F7' : '#1C1C1E' }}>
          계정 만들기
        </h1>
        <p style={{ fontSize: 12, color: isDark ? '#8E8E93' : '#8E8E93', margin: 0 }}>
          7일 무료 체험을 시작해보세요
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FormField label="이름" isDark={isDark}>
          <AuthInput type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="홍길동" autoComplete="name" required isDark={isDark} />
        </FormField>
        <FormField label="이메일" isDark={isDark}>
          <AuthInput type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com" autoComplete="email" required isDark={isDark} />
        </FormField>
        <FormField label="연락처" isDark={isDark}>
          <AuthInput type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="010-0000-0000" autoComplete="tel" isDark={isDark} />
        </FormField>
        <FormField label="패스워드" isDark={isDark}>
          <AuthInput type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" autoComplete="new-password" required isDark={isDark} />
        </FormField>
        <FormField label="패스워드 확인" isDark={isDark}>
          <AuthInput type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}
            placeholder="••••••••" autoComplete="new-password" required isDark={isDark} />
        </FormField>
        {error && <ErrorMsg>{error}</ErrorMsg>}
        <PrimaryButton type="submit" disabled={loading} style={{ marginTop: 2 }}>
          {loading ? '가입 중...' : '회원가입'}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* ─── 공통 원자 컴포넌트 ─── */
function IconBtn({ children, onClick, isDark, title }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 34, height: 34, borderRadius: 8, border: 'none',
        background: hovered
          ? isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'
          : 'transparent',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function FormField({ label, isDark, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#8E8E93' : '#636366', letterSpacing: '0.04em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function AuthInput({ isDark, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      style={{
        width: '100%', padding: '9px 11px',
        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
        border: `1px solid ${focused ? '#0A84FF' : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'}`,
        borderRadius: 8, color: isDark ? '#F5F5F7' : '#1C1C1E',
        fontSize: 13, fontFamily: 'inherit', outline: 'none',
        boxSizing: 'border-box', transition: 'border-color 0.15s',
        boxShadow: focused ? '0 0 0 3px rgba(10,132,255,0.15)' : 'none',
      }}
    />
  );
}

function PrimaryButton({ children, style, ...props }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      {...props}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '10px',
        background: hovered ? '#409CFF' : '#0A84FF',
        border: 'none', borderRadius: 8, color: '#fff',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'background 0.15s, transform 0.1s',
        transform: hovered ? 'scale(1.015)' : 'scale(1)',
        boxShadow: '0 2px 10px rgba(10,132,255,0.3)',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SocialButton({ children, onClick, isDark }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '10px 14px',
        background: isDark
          ? hovered ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.05)'
          : hovered ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.03)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.12)'}`,
        borderRadius: 9, color: isDark ? '#F5F5F7' : '#1C1C1E',
        fontSize: 13, fontWeight: 500, cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'background 0.15s, transform 0.1s',
        transform: hovered ? 'scale(1.013)' : 'scale(1)',
      }}
    >
      {children}
    </button>
  );
}

function Divider({ isDark }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
      <div style={{ flex: 1, height: 1, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)' }} />
      <span style={{ fontSize: 11, color: isDark ? '#636366' : '#8E8E93', letterSpacing: '0.05em' }}>또는</span>
      <div style={{ flex: 1, height: 1, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)' }} />
    </div>
  );
}

function ErrorMsg({ children }) {
  return <p style={{ margin: 0, fontSize: 12, color: '#FF453A', fontWeight: 500 }}>{children}</p>;
}

function InlineLink({ onClick, isDark, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: '#0A84FF', fontSize: 'inherit', padding: 0,
      fontFamily: 'inherit', fontWeight: 600,
    }}>
      {children}
    </button>
  );
}

/* ─── 아이콘 ─── */
function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function getKoreanError(msg) {
  if (msg.includes('Invalid login credentials')) return '이메일 또는 패스워드가 올바르지 않습니다.';
  if (msg.includes('Email not confirmed')) return '이메일 인증이 필요합니다. 메일함을 확인해주세요.';
  if (msg.includes('User already registered')) return '이미 가입된 이메일입니다.';
  if (msg.includes('Password should be')) return '패스워드는 6자 이상이어야 합니다.';
  return msg;
}
