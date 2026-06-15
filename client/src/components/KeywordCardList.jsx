import { useState } from 'react';
import { Lock } from 'lucide-react';
import { formatNumber, formatPercent, formatScore } from '../utils/formatters';
import KeywordBadge from './KeywordBadge';

const COMPETITION_COLOR = { 높음: '#FF453A', 중간: '#FF9F0A', 낮음: '#30D158' };

function ScorePill({ value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 44, height: 4, borderRadius: 2,
        background: 'rgba(255,255,255,0.07)', overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{
          width: `${Math.min(value, 100)}%`, height: '100%',
          background: color, borderRadius: 2,
          transition: 'width 0.5s cubic-bezier(0.34,1.2,0.64,1)',
        }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 24 }}>{value}</span>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: color ?? 'var(--text-primary)', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  );
}

function KeywordCard({ row, isLoggedIn, onLoginPrompt }) {
  const [hovered, setHovered] = useState(false);

  const effColor = row.efficiencyScore >= 60 ? '#30D158'
    : row.efficiencyScore >= 40 ? '#FF9F0A' : '#FF453A';
  const satColor = row.saturationScore >= 70 ? '#FF453A'
    : row.saturationScore >= 40 ? '#FF9F0A' : '#30D158';
  const compColor = COMPETITION_COLOR[row.competition] ?? 'var(--text-secondary)';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 18px',
        borderRadius: 12,
        border: `1px solid ${hovered ? 'rgba(10,132,255,0.30)' : 'var(--border)'}`,
        background: hovered
          ? 'radial-gradient(ellipse at left, rgba(10,132,255,0.07) 0%, transparent 70%)'
          : 'var(--bg-elevated)',
        transition: 'border-color 0.15s, background 0.15s',
        cursor: 'default',
      }}
    >
      {/* 추천 배지 */}
      <div style={{ flexShrink: 0, width: 76 }}>
        <KeywordBadge action={row.recommendAction} />
      </div>

      {/* 키워드 + 의도 유형 */}
      <div style={{ flex: '0 0 160px', minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
          {row.keyword}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
          {row.intentType}
        </p>
      </div>

      {/* 구분선 */}
      <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0 }} />

      {/* 수치들 */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 24, minWidth: 0, flexWrap: 'wrap' }}>
        <Stat label="검색량" value={formatNumber(row.totalSearch)} />
        <Stat label="모바일" value={formatPercent(row.mobileRatio)} color="#0A84FF" />
        <Stat label="CTR" value={formatPercent(row.averageCtr)} />
        <Stat label="경쟁도" value={row.competition} color={compColor} />
      </div>

      {/* 구분선 */}
      <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0 }} />

      {/* 스코어 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, width: 110 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>포화도</span>
          <ScorePill value={row.saturationScore} color={satColor} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>효율</span>
          {isLoggedIn ? (
            <ScorePill value={row.efficiencyScore} color={effColor} />
          ) : (
            <button onClick={onLoginPrompt} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              border: '1px solid var(--border)', borderRadius: 5,
              background: 'var(--bg-overlay)', padding: '1px 7px',
              cursor: 'pointer', fontFamily: 'inherit',
              color: 'var(--text-tertiary)', fontSize: 10,
            }}>
              <Lock style={{ width: 9, height: 9 }} /> 로그인
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KeywordCardList({ rows, isLoggedIn, onLoginPrompt }) {
  if (!rows.length) {
    return (
      <div className="mac-card p-10 text-center" style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
        추천 키워드가 없습니다. 다른 키워드로 다시 조회해 주세요.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((row) => (
        <KeywordCard
          key={row.keyword}
          row={row}
          isLoggedIn={isLoggedIn}
          onLoginPrompt={onLoginPrompt}
        />
      ))}
    </div>
  );
}
