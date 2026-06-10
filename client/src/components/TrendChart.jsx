function formatYearMonth(periodStr) {
  if (!periodStr) return '';
  const parts = String(periodStr).split('-');
  if (parts.length < 2) return periodStr;
  return `${parts[0].slice(2)}.${parts[1]}`;
}

export default function TrendChart({ trendData, trendDirection }) {
  if (!trendData || trendData.length < 2) return null;

  const W = 600;
  const H = 130;
  const PAD = { top: 14, right: 16, bottom: 30, left: 34 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const ratios = trendData.map((d) => Number(d.ratio) || 0);
  const maxVal = Math.max(...ratios, 1);
  const minVal = Math.min(...ratios, 0);
  const range  = maxVal - minVal || 1;

  const toX = (i) => PAD.left + (i / (ratios.length - 1)) * chartW;
  const toY = (v) => PAD.top + chartH - ((v - minVal) / range) * chartH;

  const points = ratios.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const areaPoints = [
    `${toX(0)},${PAD.top + chartH}`,
    ...ratios.map((v, i) => `${toX(i)},${toY(v)}`),
    `${toX(ratios.length - 1)},${PAD.top + chartH}`
  ].join(' ');

  const lineColor =
    trendDirection === '상승' ? '#30D158' :
    trendDirection === '하락' ? '#FF453A' : '#636366';

  const fillColor =
    trendDirection === '상승' ? 'rgba(48,209,88,0.12)' :
    trendDirection === '하락' ? 'rgba(255,69,58,0.12)' : 'rgba(99,99,102,0.1)';

  const gridColor = 'rgba(255,255,255,0.06)';
  const labelColor = '#636366';

  const labelIndices = [0, Math.floor((ratios.length - 1) / 2), ratios.length - 1];
  const yTicks = [minVal, maxVal];

  return (
    <div style={{ marginTop: 12 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 130 }}
        aria-label="검색 트렌드 차트"
      >
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={PAD.left} y1={toY(tick)}
            x2={PAD.left + chartW} y2={toY(tick)}
            stroke={gridColor} strokeWidth="1"
          />
        ))}

        {/* Area fill */}
        <polygon points={areaPoints} fill={fillColor} />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {ratios.map((v, i) => (
          <circle key={i} cx={toX(i)} cy={toY(v)} r="2" fill={lineColor} />
        ))}

        {/* X labels */}
        {labelIndices.map((i) => (
          <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fontSize="9" fill={labelColor} fontWeight="500">
            {formatYearMonth(trendData[i]?.period)}
          </text>
        ))}

        {/* Y max label */}
        <text x={PAD.left - 4} y={toY(maxVal) + 4} textAnchor="end" fontSize="9" fill={labelColor} fontWeight="500">
          {Math.round(maxVal)}
        </text>
      </svg>
    </div>
  );
}
