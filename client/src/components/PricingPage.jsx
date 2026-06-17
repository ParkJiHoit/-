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

export default function PricingPage({ onMockAction, onGoToAuth, user }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 'calc(var(--nav-offset) + 32px) 24px 48px',
    }}>
      {/* 배지 */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'rgba(10,132,255,0.12)', border: '1px solid rgba(10,132,255,0.3)',
        borderRadius: 999, padding: '5px 14px',
        fontSize: 11, fontWeight: 700, color: 'var(--accent)',
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16,
      }}>
        <Sparkles size={11} />
        심플한 요금제
      </div>

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
              onClick={user ? onMockAction : onGoToAuth}
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
            <button
              onClick={onMockAction}
              style={{
                width: '100%', padding: '12px 0',
                background: 'linear-gradient(135deg, #0A84FF 0%, #34C1FF 100%)',
                border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 700, color: '#fff',
                cursor: 'pointer', letterSpacing: '0.02em', fontFamily: 'inherit',
                boxShadow: '0 4px 20px rgba(10,132,255,0.4)',
                transition: 'opacity 0.15s, transform 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Zap size={13} />
              시작하기 (준비 중)
            </button>
            <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>
              구독 즉시 이용 · 언제든 해지 가능
            </p>
          </div>
        </div>

      </div>

      <p style={{ marginTop: 32, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.7 }}>
        * 아직 베타 서비스입니다. 정식 출시 시 요금제가 확정됩니다.
      </p>
    </div>
  );
}
