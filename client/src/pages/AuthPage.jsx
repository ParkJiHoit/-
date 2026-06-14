import { useState } from 'react';
import { useAuth } from '../AuthContext';
import AuthScene from '../components/AuthScene';

/* ─────────────────────────────────────────
   테마 감지 훅
───────────────────────────────────────── */
function useTheme() {
  const el = document.documentElement;
  return el.dataset.theme === 'light' ? 'light' : 'dark';
}

/* ─────────────────────────────────────────
   메인 페이지
───────────────────────────────────────── */
export default function AuthPage({ onSuccess }) {
  const [mode, setMode] = useState('login');
  const theme = useTheme();
  const isDark = theme === 'dark';

  /* 왼쪽 패널 배경 — 라이트: bg-base 동일, 다크: 약간 밝은 회색 */
  const leftBg = isDark ? '#1C1C1E' : '#F2F2F7';

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* ── 왼쪽: 폼 패널 ── */}
      <div style={{
        flex: '0 0 50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 64px',
        background: leftBg,
        position: 'relative',
        zIndex: 1,
      }}>
        {mode === 'login'
          ? <LoginForm onSwitch={() => setMode('signup')} onSuccess={onSuccess} isDark={isDark} />
          : <SignupForm onSwitch={() => setMode('login')} onSuccess={onSuccess} isDark={isDark} />
        }
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
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, #000 0%, transparent 20%)',
          zIndex: 1,
          pointerEvents: 'none',
        }} />
        <AuthScene />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   로그인 폼
───────────────────────────────────────── */
function LoginForm({ onSwitch, onSuccess, isDark }) {
  const { signInWithGoogle, signInWithEmail } = useAuth();
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
    <AuthCard isDark={isDark}>
      {/* 로고 */}
      <RankletLogo />

      {/* 타이틀 */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: isDark ? '#F5F5F7' : '#1C1C1E', margin: '0 0 6px', letterSpacing: '-0.4px' }}>
          다시 오신 것을 환영해요
        </h1>
        <p style={{ fontSize: 13, color: isDark ? '#8E8E93' : '#636366', margin: 0 }}>
          계정에 로그인하세요
        </p>
      </div>

      {/* Google 버튼 (primary) */}
      <SocialButton onClick={signInWithGoogle} isDark={isDark} isPrimary>
        <GoogleIcon />
        Google로 계속하기
      </SocialButton>

      <Divider isDark={isDark} />

      {/* 이메일 폼 */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FormField label="이메일" isDark={isDark}>
          <AuthInput
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            required
            isDark={isDark}
          />
        </FormField>
        <FormField label="패스워드" isDark={isDark}>
          <AuthInput
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            isDark={isDark}
          />
        </FormField>

        {error && <ErrorMsg>{error}</ErrorMsg>}

        <PrimaryButton type="submit" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? '로그인 중...' : '로그인'}
        </PrimaryButton>
      </form>

      <p style={{ textAlign: 'center', fontSize: 13, color: isDark ? '#8E8E93' : '#636366', margin: '20px 0 0' }}>
        계정이 없으신가요?{' '}
        <InlineLink onClick={onSwitch}>회원가입</InlineLink>
      </p>
    </AuthCard>
  );
}

/* ─────────────────────────────────────────
   회원가입 폼
───────────────────────────────────────── */
function SignupForm({ onSwitch, onSuccess, isDark }) {
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
    if (password !== passwordConfirm) {
      setError('패스워드가 일치하지 않습니다.');
      return;
    }
    setLoading(true);
    const { error } = await signUpWithEmail(email, password, name, phone);
    setLoading(false);
    if (error) setError(getKoreanError(error.message));
    else setDone(true);
  }

  if (done) {
    return (
      <AuthCard isDark={isDark} style={{ textAlign: 'center' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #0A84FF, #34C1FF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(10,132,255,0.35)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: isDark ? '#F5F5F7' : '#1C1C1E', margin: '0 0 8px' }}>
          이메일을 확인해주세요
        </h2>
        <p style={{ fontSize: 13, color: isDark ? '#8E8E93' : '#636366', margin: '0 0 24px', lineHeight: 1.7 }}>
          <span style={{ color: isDark ? '#C4C4C8' : '#1C1C1E', fontWeight: 500 }}>{email}</span>으로<br/>인증 메일을 보냈습니다.
        </p>
        <PrimaryButton onClick={onSwitch}>로그인으로 돌아가기</PrimaryButton>
      </AuthCard>
    );
  }

  return (
    <AuthCard isDark={isDark}>
      <RankletLogo />

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: isDark ? '#F5F5F7' : '#1C1C1E', margin: '0 0 6px', letterSpacing: '-0.4px' }}>
          계정 만들기
        </h1>
        <p style={{ fontSize: 13, color: isDark ? '#8E8E93' : '#636366', margin: 0 }}>
          7일 무료 체험을 시작해보세요
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
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

        <PrimaryButton type="submit" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? '가입 중...' : '회원가입'}
        </PrimaryButton>
      </form>

      <p style={{ textAlign: 'center', fontSize: 13, color: isDark ? '#8E8E93' : '#636366', margin: '18px 0 0' }}>
        이미 계정이 있으신가요?{' '}
        <InlineLink onClick={onSwitch}>로그인</InlineLink>
      </p>
    </AuthCard>
  );
}

/* ─────────────────────────────────────────
   공통 원자 컴포넌트
───────────────────────────────────────── */
function AuthCard({ children, isDark, style }) {
  return (
    <div style={{
      width: '100%',
      maxWidth: 380,
      background: isDark ? '#2C2C2E' : '#FFFFFF',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: 18,
      padding: '36px 32px 32px',
      boxShadow: isDark
        ? '0 8px 40px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.05) inset'
        : '0 8px 32px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.9) inset',
      animation: 'authFadeUp 0.3s cubic-bezier(0.34,1.1,0.64,1)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function RankletLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, justifyContent: 'center' }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: 'linear-gradient(135deg, #0A84FF 0%, #34C1FF 100%)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '5px 6px 4px', gap: 2.5,
        boxShadow: '0 2px 10px rgba(10,132,255,0.4)',
        flexShrink: 0,
      }}>
        {[6, 12, 9].map((h, i) => (
          <div key={i} style={{ width: 4, height: h, borderRadius: 2, background: '#fff', opacity: i === 1 ? 1 : 0.75 }} />
        ))}
      </div>
      <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
        RANKLET
      </span>
    </div>
  );
}

function FormField({ label, isDark, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#8E8E93' : '#636366', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
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
        width: '100%',
        padding: '10px 12px',
        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
        border: `1px solid ${focused
          ? '#0A84FF'
          : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'
        }`,
        borderRadius: 9,
        color: isDark ? '#F5F5F7' : '#1C1C1E',
        fontSize: 14,
        fontFamily: 'inherit',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s',
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
        width: '100%',
        padding: '11px',
        background: hovered ? '#409CFF' : '#0A84FF',
        border: 'none',
        borderRadius: 9,
        color: '#fff',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 0.15s, transform 0.1s',
        transform: hovered ? 'scale(1.015)' : 'scale(1)',
        boxShadow: '0 2px 12px rgba(10,132,255,0.35)',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SocialButton({ children, onClick, isDark, isPrimary }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        padding: '10px 14px',
        background: isDark
          ? hovered ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)'
          : hovered ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.04)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
        borderRadius: 9,
        color: isDark ? '#F5F5F7' : '#1C1C1E',
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        transition: 'background 0.15s, transform 0.1s',
        transform: hovered ? 'scale(1.015)' : 'scale(1)',
      }}
    >
      {children}
    </button>
  );
}

function Divider({ isDark }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
      <div style={{ flex: 1, height: 1, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />
      <span style={{ fontSize: 11, color: isDark ? '#636366' : '#8E8E93', letterSpacing: '0.06em', fontWeight: 500 }}>또는</span>
      <div style={{ flex: 1, height: 1, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />
    </div>
  );
}

function ErrorMsg({ children }) {
  return (
    <p style={{ margin: 0, fontSize: 12, color: '#FF453A', fontWeight: 500 }}>{children}</p>
  );
}

function InlineLink({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: '#0A84FF', fontSize: 13, padding: 0, fontFamily: 'inherit',
      fontWeight: 500,
    }}>
      {children}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
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
