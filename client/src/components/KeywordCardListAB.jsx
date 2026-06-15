import { useState } from 'react';
import { Lock } from 'lucide-react';
import { formatNumber, formatPercent, formatScore } from '../utils/formatters';
import KeywordBadge from './KeywordBadge';

const COMPETITION_COLOR = { 높음: '#FF453A', 중간: '#FF9F0A', 낮음: '#30D158' };

function ScoreBar({ value, color, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{value}</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(value, 100)}%`, height: '100%',
          background: color, borderRadius: 2,
          transition: 'width 0.55s cubic-bezier(0.34,1.2,0.64,1)',
        }} />
      </div>
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '6px 10px', borderRadius: 8,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
      minWidth: 64, flexShrink: 0,
    }}>
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
        padding: '16px 20px',
        borderRadius: 12,
        border: `1px solid ${hovered ? 'rgba(10,132,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
        background: hovered
          ? 'radial-gradient(ellipse at 0% 50%, rgba(10,132,255,0.10) 0%, rgba(36,36,38,0.95) 55%)'
          : 'rgba(36,36,38,0.85)',
        transition: 'border-color 0.15s, background 0.15s',
        cursor: 'default',
      }}
    >
      {/* 추천 배지 */}
      <div style={{ flexShrink: 0, width: 72 }}>
        <KeywordBadge action={row.recommendAction} />
      </div>

      {/* 키워드 + 의도유형 */}
      <div style={{ flex: '0 0 150px', minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 15, fontWeight: 700,
          color: hovered ? '#fff' : 'var(--text-primary)',
          letterSpacing: '-0.3px', transition: 'color 0.12s',
        }}>
          {row.keyword}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
          {row.intentType}
        </p>
      </div>

      {/* 구분선 */}
      <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

      {/* 수치 칩들 */}
      <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
        <StatChip label="검색량" value={formatNumber(row.totalSearch)} />
        <StatChip label="모바일" value={formatPercent(row.mobileRatio)} color="#0A84FF" />
        <StatChip label="CTR" value={formatPercent(row.averageCtr)} />
        <StatChip
          label="경쟁도"
          value={row.competition}
          color={compColor}
        />
      </div>

      {/* 구분선 */}
      <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

      {/* 스코어 바 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, width: 120 }}>
        <ScoreBar value={row.saturationScore} color={satColor} label="포화도" />
        {isLoggedIn ? (
          <ScoreBar value={row.efficiencyScore} color={effColor} label="효율" />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>효율</span>
            <button onClick={onLoginPrompt} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              border: '1px solid var(--border)', borderRadius: 5,
              background: 'var(--bg-overlay)', padding: '2px 7px',
              cursor: 'pointer', fontFamily: 'inherit',
              color: 'var(--text-tertiary)', fontSize: 10,
            }}>
              <Lock style={{ width: 9, height: 9 }} /> 로그인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function KeywordCardListAB({ rows, isLoggedIn, onLoginPrompt }) {
  if (!rows.length) {
    return (
      <div className="mac-card p-10 text-center" style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
        추천 키워드가 없습니다. 다른 키워드로 다시 조회해 주세요.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
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
