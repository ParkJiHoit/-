function formatYearMonth(periodStr) {
  if (!periodStr) return '';
  const parts = String(periodStr).split('-');
  if (parts.length < 2) return periodStr;
  return `${parts[0].slice(2)}.${parts[1]}`;
}

export default function TrendChart({ trendData, trendDirection }) {
  if (!trendData || trendData.length < 2) return null;

  const W = 600;
  const H = 120;
  const PAD = { top: 12, right: 16, bottom: 28, left: 32 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const ratios = trendData.map((d) => Number(d.ratio) || 0);
  const maxVal = Math.max(...ratios, 1);
  const minVal = Math.min(...ratios, 0);
  const range = maxVal - minVal || 1;

  const toX = (i) => PAD.left + (i / (ratios.length - 1)) * chartW;
  const toY = (v) => PAD.top + chartH - ((v - minVal) / range) * chartH;

  const points = ratios.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const areaPoints = [
    `${toX(0)},${PAD.top + chartH}`,
    ...ratios.map((v, i) => `${toX(i)},${toY(v)}`),
    `${toX(ratios.length - 1)},${PAD.top + chartH}`
  ].join(' ');

  const directionColor =
    trendDirection === '상승' ? '#059669' : trendDirection === '하락' ? '#e11d48' : '#64748b';
  const fillColor =
    trendDirection === '상승' ? '#d1fae5' : trendDirection === '하락' ? '#ffe4e6' : '#f1f5f9';

  // 레이블: 첫 달, 중간, 마지막 달만 표시
  const labelIndices = [0, Math.floor((ratios.length - 1) / 2), ratios.length - 1];

  // Y축 눈금: min, max
  const yTicks = [minVal, maxVal];

  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 120 }}
        aria-label="검색 트렌드 차트"
      >
        {/* 배경 그리드 라인 */}
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={PAD.left}
            y1={toY(tick)}
            x2={PAD.left + chartW}
            y2={toY(tick)}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        ))}

        {/* 영역 채우기 */}
        <polygon points={areaPoints} fill={fillColor} opacity="0.7" />

        {/* 라인 */}
        <polyline
          points={points}
          fill="none"
          stroke={directionColor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* 데이터 포인트 */}
        {ratios.map((v, i) => (
          <circle key={i} cx={toX(i)} cy={toY(v)} r="2.5" fill={directionColor} />
        ))}

        {/* X축 레이블 */}
        {labelIndices.map((i) => (
          <text
            key={i}
            x={toX(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize="9"
            fill="#94a3b8"
            fontWeight="600"
          >
            {formatYearMonth(trendData[i]?.period)}
          </text>
        ))}

        {/* Y축 최대값 레이블 */}
        <text
          x={PAD.left - 4}
          y={toY(maxVal) + 4}
          textAnchor="end"
          fontSize="9"
          fill="#94a3b8"
          fontWeight="600"
        >
          {Math.round(maxVal)}
        </text>
      </svg>
    </div>
  );
}
