import { Check, Sparkles, Zap } from 'lucide-react';

const FEATURES = [
  { text: '연관 키워드 발굴', sub: '시드 키워드 하나로 수십 개 순삭' },
  { text: '블로그탭 순위 실시간 확인', sub: '지금 이 순간 네이버 블탭 1위가 누군지' },
  { text: '키워드 효율 점수 & 종합 평가', sub: '어떤 키워드가 진짜 기회인지 숫자로' },
  { text: '일별 · 월별 · 연간 트렌드 차트', sub: '검색량이 오르는 중인지 내리는 중인지' },
  { text: '관련 기사 실시간 피드', sub: '키워드 주변 분위기 파악' },
  { text: '검색 횟수 제한 없음', sub: '분당 몇 번? 그런 거 없어요 마음껏 쓰세요' },
  { text: 'Excel / CSV 다운로드', sub: '데이터는 내 것, 가져가세요' },
];

const OTHERS = [
  { name: '로땡떙', price: '49,000', emoji: '🫠' },
  { name: '블떙떙', price: '39,000', emoji: '😵' },
];

export default function PricingPage({ onMockAction }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'calc(var(--nav-offset) + 60px) 24px 80px',
      }}
    >
      {/* 상단 배지 */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(10,132,255,0.12)',
          border: '1px solid rgba(10,132,255,0.3)',
          borderRadius: 999,
          padding: '5px 14px',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--accent)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 24,
        }}
      >
        <Sparkles size={11} />
        단일 요금제
      </div>

      {/* 헤드라인 */}
      <h1
        style={{
          fontSize: 48,
          fontWeight: 800,
          letterSpacing: '-1.5px',
          textAlign: 'center',
          margin: '0 0 12px',
          lineHeight: 1.15,
          color: 'var(--text-primary)',
        }}
      >
        월 <span style={{
          background: 'linear-gradient(120deg, #0A84FF 0%, #34C1FF 55%, #30D158 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>1,000원</span>으로<br />다 됩니다
      </h1>

      <p style={{ fontSize: 16, color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 48px', lineHeight: 1.6, maxWidth: 480 }}>
        다른 툴들이 매달 몇만 원씩 받는 기능들을<br />
        <strong style={{ color: 'var(--text-primary)' }}>커피값도 안 되는 돈</strong>에 드립니다 ☕
      </p>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 900 }}>

        {/* 메인 플랜 카드 */}
        <div
          className="mac-card"
          style={{
            flex: '1 1 380px',
            maxWidth: 480,
            padding: '36px 36px',
            border: '1px solid rgba(10,132,255,0.35)',
            boxShadow: '0 0 0 3px rgba(10,132,255,0.08), 0 20px 60px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 배경 글로우 */}
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 180, height: 180, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(10,132,255,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* 플랜 이름 + 뱃지 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Ranklet</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>스탠다드 플랜</p>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #0A84FF, #34C1FF)',
              borderRadius: 10, padding: '6px 12px',
              fontSize: 11, fontWeight: 700, color: '#fff',
              letterSpacing: '0.04em',
            }}>
              유일한 플랜
            </div>
          </div>

          {/* 가격 */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 28 }}>
            <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-2px', color: 'var(--text-primary)', lineHeight: 1 }}>₩1,000</span>
            <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 500 }}> / 월</span>
          </div>

          {/* 구분선 */}
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 24 }} />

          {/* 기능 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
            {FEATURES.map(({ text, sub }) => (
              <div key={text} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                  background: 'rgba(48,209,88,0.15)', border: '1px solid rgba(48,209,88,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                }}>
                  <Check size={11} color="#30D158" strokeWidth={2.5} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{text}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={onMockAction}
            style={{
              width: '100%', padding: '14px 0',
              background: 'linear-gradient(135deg, #0A84FF 0%, #34C1FF 100%)',
              border: 'none', borderRadius: 12,
              fontSize: 14, fontWeight: 700, color: '#fff',
              cursor: 'pointer', letterSpacing: '0.02em',
              boxShadow: '0 4px 20px rgba(10,132,255,0.4)',
              transition: 'opacity 0.15s, transform 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <Zap size={14} />
            시작하기 (준비 중)
          </button>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            구독 즉시 이용 · 언제든 해지 가능
          </p>
        </div>

        {/* 비교 사이드 */}
        <div style={{ flex: '1 1 260px', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 타사 비교 카드들 */}
          {OTHERS.map(({ name, price, emoji }) => (
            <div
              key={name}
              className="mac-card"
              style={{ padding: '20px 22px', opacity: 0.65 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>{name} {emoji}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  background: 'rgba(255,69,58,0.12)', color: '#FF375F',
                  border: '1px solid rgba(255,69,58,0.25)',
                  borderRadius: 6, padding: '2px 8px',
                }}>
                  비쌈
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text-primary)', textDecoration: 'line-through', opacity: 0.5 }}>
                  ₩{price}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>/ 월</span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                비슷한 기능인데{' '}
                <strong style={{ color: '#FF375F' }}>
                  {Math.round((parseInt(price.replace(',', '')) / 1000))}배
                </strong>{' '}
                더 비쌉니다 {emoji}
              </p>
            </div>
          ))}

          {/* 하단 멘트 카드 */}
          <div
            className="mac-card"
            style={{
              padding: '20px 22px',
              background: 'rgba(48,209,88,0.05)',
              border: '1px solid rgba(48,209,88,0.18)',
            }}
          >
            <p style={{ margin: 0, fontSize: 20 }}>🎉</p>
            <p style={{ margin: '8px 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Ranklet은 ₩1,000
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              분당 검색 제한도 없고,<br />
              기능 잠금도 없고,<br />
              그냥 다 씁니다.
            </p>
          </div>

        </div>
      </div>

      {/* 하단 안내 */}
      <p style={{ marginTop: 48, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.7 }}>
        * 아직 베타 서비스입니다. 정식 출시 시 요금제가 확정됩니다.<br />
        * "로땡떙", "블떙떙" 은 실제 서비스명이 아닌 가명입니다.
      </p>
    </div>
  );
}
