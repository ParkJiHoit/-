import { useState } from 'react';
import { Check, Sparkles, Zap } from 'lucide-react';

const BASIC_FEATURES = [
  '연관 키워드 발굴',
  '블로그탭 순위 확인',
  '월별 검색량 확인',
  '키워드 분석 하루 10회',
  '블로그 분석·진단 하루 3회',
  '순위 추적 갱신 하루 2회',
];

const STANDARD_FEATURES = [
  '연관 키워드 발굴',
  '블로그탭 순위 실시간 확인',
  '키워드 효율 점수 & 종합 평가',
  '일별 · 월별 · 연간 트렌드 차트',
  '블로그 순위 추적 & 히스토리',
  '관련 기사 실시간 피드',
  '검색 횟수 제한 없음',
  'Excel / CSV 다운로드',
];

const ADMIN_EMAILS = ['qkrwlgh52660724@gmail.com'];

export default function PricingPage({ onGoToAuth, user, token }) {
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // 'privacy' | 'terms' | null
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  async function handleSubscribe() {
    if (!user) { onGoToAuth(); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        alert(json.message || '결제 URL 생성에 실패했습니다.');
      }
    } catch {
      alert('결제 요청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 'calc(var(--nav-offset) + 32px) 24px 48px',
    }}>
      {/* 헤드라인 */}
      <h1 style={{
        fontSize: 40, fontWeight: 800, letterSpacing: '-1.5px',
        textAlign: 'center', margin: '0 0 8px', lineHeight: 1.15,
        color: 'var(--text-primary)',
      }}>
        월 <span style={{
          background: 'linear-gradient(120deg, #0A84FF 0%, #34C1FF 55%, #30D158 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>9,900원</span>으로 다 됩니다
      </h1>

      <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 32px', lineHeight: 1.6, maxWidth: 480 }}>
        다른 툴들이 매달 몇만 원씩 받는 기능들을&nbsp;
        <strong style={{ color: 'var(--text-primary)' }}>커피 두 잔 값</strong>에 드립니다 ☕
      </p>

      {/* 카드 2열 */}
      <div style={{
        display: 'flex', gap: 16, alignItems: 'stretch',
        flexWrap: 'wrap', justifyContent: 'center',
        width: '100%', maxWidth: 800,
      }}>

        {/* ── 베이직 플랜 ── */}
        <div className="mac-card" style={{
          flex: '1 1 260px', maxWidth: 300,
          padding: '20px 22px',
          border: '1px solid var(--border)',
          opacity: 0.82,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ marginBottom: 10 }}>
            <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ranklet</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-secondary)' }}>베이직 플랜</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-2px', color: 'var(--text-secondary)', lineHeight: 1 }}>무료</span>
          </div>

          <div style={{ height: 1, background: 'var(--border)', marginBottom: 12 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {BASIC_FEATURES.map(text => (
              <div key={text} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Check size={13} color="var(--text-tertiary)" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{text}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto' }}>
            <button
              onClick={user ? undefined : onGoToAuth}
              style={{
                width: '100%', padding: '10px 0',
                background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
                borderRadius: 10, fontSize: 12, fontWeight: 600,
                color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
            >
              무료로 시작
            </button>
            <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>
              로그인 후 바로 이용 가능
            </p>
          </div>
        </div>

        {/* ── 스탠다드 플랜 ── */}
        <div className="mac-card" style={{
          flex: '1 1 300px', maxWidth: 380,
          padding: '20px 24px',
          border: '1px solid rgba(10,132,255,0.35)',
          boxShadow: '0 0 0 3px rgba(10,132,255,0.08), 0 20px 60px rgba(0,0,0,0.25)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 180, height: 180, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(10,132,255,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ranklet</p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>스탠다드 플랜</p>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #0A84FF, #34C1FF)',
              borderRadius: 8, padding: '4px 10px',
              fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.04em', flexShrink: 0,
            }}>추천</div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>₩34,900</span>
              <span style={{
                background: 'linear-gradient(135deg, #FF3B30, #FF6B35)',
                borderRadius: 6, padding: '2px 7px',
                fontSize: 10, fontWeight: 800, color: '#fff',
              }}>71% OFF</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-2px', color: 'var(--text-primary)', lineHeight: 1 }}>₩9,900</span>
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}> / 월</span>
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(10,132,255,0.2)', marginBottom: 12 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {STANDARD_FEATURES.map(text => (
              <div key={text} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Check size={13} color="var(--accent)" strokeWidth={2.8} style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{text}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto' }}>
            {isAdmin ? (
              <div style={{
                width: '100%', padding: '12px 0',
                background: 'rgba(10,132,255,0.12)',
                border: '1px solid rgba(10,132,255,0.3)',
                borderRadius: 10, fontSize: 13, fontWeight: 700,
                color: 'var(--accent)', textAlign: 'center',
              }}>
                관리자 계정 (무제한)
              </div>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={loading}
                style={{
                  width: '100%', padding: '12px 0',
                  background: loading ? 'rgba(10,132,255,0.5)' : 'linear-gradient(135deg, #0A84FF 0%, #34C1FF 100%)',
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  cursor: loading ? 'default' : 'pointer', letterSpacing: '0.02em', fontFamily: 'inherit',
                  boxShadow: '0 4px 20px rgba(10,132,255,0.4)',
                  transition: 'opacity 0.15s, transform 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <Zap size={13} />
                {loading ? '연결 중...' : '시작하기'}
              </button>
            )}
            <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>
              구독 즉시 이용 · 언제든 해지 가능
            </p>
          </div>
        </div>

      </div>

      <p style={{ marginTop: 32, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.7 }}>
        * 아직 베타 서비스입니다. 정식 출시 시 요금제가 확정됩니다.
      </p>

      <div style={{ marginTop: 12, display: 'flex', gap: 16, justifyContent: 'center' }}>
        <button onClick={() => setModal('privacy')} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>개인정보처리방침</button>
        <button onClick={() => setModal('terms')} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>이용약관</button>
      </div>

      {modal && (
        <div onClick={() => setModal(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#1C1C1E', borderRadius: 16, padding: '28px 32px',
            maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                {modal === 'privacy' ? '개인정보처리방침' : '이용약관'}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-tertiary)', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              {modal === 'privacy' ? <PrivacyContent /> : <TermsContent />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PrivacyContent() {
  return (
    <>
      <p><strong>시행일: 2026년 6월 17일</strong></p>
      <p>Ranklet(이하 "서비스")은 이용자의 개인정보를 중요하게 여기며, 개인정보보호법에 따라 아래와 같이 처리합니다.</p>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>1. 수집하는 개인정보</h3>
      <p>• 이메일 주소 (회원가입 시)<br />• 서비스 이용 기록 (키워드 분석, 순위 추적 등)<br />• 결제 정보 (LemonSqueezy를 통해 처리, 당사 서버에 저장하지 않음)</p>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>2. 수집 목적</h3>
      <p>• 회원 인증 및 서비스 제공<br />• 구독 관리 및 결제 처리<br />• 서비스 개선 및 통계 분석</p>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>3. 보관 기간</h3>
      <p>회원 탈퇴 시까지 보관하며, 탈퇴 후 즉시 파기합니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>4. 제3자 제공</h3>
      <p>이용자의 개인정보는 원칙적으로 제3자에게 제공하지 않습니다. 단, 서비스 운영을 위해 아래 업체에 최소한의 정보를 위탁합니다.<br />• Supabase (인증 서버 운영)<br />• LemonSqueezy (결제 처리)</p>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>5. 이용자 권리</h3>
      <p>이용자는 언제든지 개인정보 조회, 수정, 삭제를 요청할 수 있습니다. 요청은 아래 이메일로 문의해주세요.</p>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>6. 문의</h3>
      <p>개인정보 관련 문의: <strong>qkrwlgh52660724@gmail.com</strong></p>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <p><strong>시행일: 2026년 6월 17일</strong></p>
      <p>본 약관은 Ranklet(이하 "서비스")의 이용 조건을 규정합니다.</p>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>1. 서비스 설명</h3>
      <p>Ranklet은 네이버 키워드 분석, 블로그 순위 추적, 블로그 진단 기능을 제공하는 SaaS 서비스입니다.</p>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>2. 이용 자격</h3>
      <p>만 14세 이상 누구나 가입할 수 있습니다. 타인의 정보를 도용하거나 허위 정보로 가입하는 경우 계정이 정지될 수 있습니다.</p>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>3. 구독 및 결제</h3>
      <p>• 스탠다드 플랜은 월 ₩9,900이며 매월 자동 결제됩니다.<br />• 구독은 언제든지 해지할 수 있으며, 해지 후 해당 월 말까지 이용 가능합니다.<br />• 환불은 결제일로부터 7일 이내 요청 시 전액 환불됩니다.</p>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>4. 데이터 정확도</h3>
      <p>서비스에서 제공하는 검색량, 순위 데이터는 네이버 API 기반이며 실제 수치와 차이가 있을 수 있습니다. 데이터 정확도를 100% 보장하지 않습니다.</p>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>5. 서비스 변경 및 종료</h3>
      <p>서비스 내용은 사전 공지 후 변경될 수 있습니다. 서비스 종료 시 30일 전 공지하며, 잔여 구독 기간에 대해 환불합니다.</p>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>6. 금지 행위</h3>
      <p>• 서비스를 통한 자동화 크롤링, API 남용<br />• 타인의 계정 도용<br />• 서비스 운영 방해 행위</p>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>7. 문의</h3>
      <p>서비스 관련 문의: <strong>qkrwlgh52660724@gmail.com</strong></p>
    </>
  );
}
