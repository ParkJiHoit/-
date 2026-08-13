import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { RadarChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import InfoTip from './InfoTip';

echarts.use([RadarChart, TooltipComponent, SVGRenderer]);

const FONT_STACK = "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif";
const CENTER = [0.5, 0.52];
const RADIUS_RATIO = 0.58;       // 데이터 폴리곤 반지름 — radar.radius와 맞춰서 쓴다
const ICON_RADIUS_RATIO = 1.18;  // 축 이름표 바깥쪽에 설명 아이콘을 놓는 반지름

// 블로그 진단 "항목별 점수"를 축마다 만점이 다른 레이더(스파이더) 차트로 보여준다.
// breakdown: { key: value }, labels: { key: label }, tips: { key: 설명 }, max: { key: maxValue }
export default function ScoreRadarCard({ breakdown, labels, tips = {}, max, color, height = 320 }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!elRef.current) return undefined;
    const chart = echarts.init(elRef.current, null, { renderer: 'svg' });
    chartRef.current = chart;

    const ro = new ResizeObserver(entries => {
      chart.resize();
      const rect = entries[0]?.contentRect;
      if (rect) setBox({ w: rect.width, h: rect.height });
    });
    ro.observe(elRef.current);

    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const keys = Object.keys(breakdown);
    const indicator = keys.map(k => ({ name: labels[k] || k, max: max[k] || 10 }));
    const values = keys.map(k => breakdown[k]);

    chart.setOption({
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: 'rgba(28,28,30,0.94)',
        borderWidth: 0,
        padding: [8, 12],
        textStyle: { color: '#fff', fontSize: 12, fontFamily: FONT_STACK },
        extraCssText: 'box-shadow:0 8px 28px rgba(0,0,0,0.4); border-radius:8px;',
      },
      radar: {
        indicator,
        radius: `${RADIUS_RATIO * 100}%`,
        center: [`${CENTER[0] * 100}%`, `${CENTER[1] * 100}%`],
        splitNumber: 4,
        nameGap: 32,
        axisName: {
          color: 'var(--text-secondary)',
          fontSize: 15,
          fontWeight: 700,
          fontFamily: FONT_STACK,
        },
        axisLine: { lineStyle: { color: 'var(--border)' } },
        splitLine: { lineStyle: { color: 'var(--border)' } },
        splitArea: { show: false },
      },
      series: [{
        type: 'radar',
        data: [{
          name: '항목별 점수',
          value: values,
          areaStyle: { color, opacity: 0.22 },
          lineStyle: { color, width: 2 },
          itemStyle: { color, borderWidth: 2, borderColor: 'var(--bg-elevated)' },
          label: {
            show: true,
            formatter: '{c}',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: FONT_STACK,
          },
        }],
        animationDuration: 700,
        animationEasing: 'cubicOut',
      }],
    });
  }, [breakdown, labels, max, color]);

  const keys = Object.keys(breakdown);
  const n = keys.length;
  const rPx = ICON_RADIUS_RATIO * (Math.min(box.w, box.h) / 2);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={elRef} style={{ position: 'absolute', inset: 0 }} />
      {box.w > 0 && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {keys.map((k, i) => {
            const theta = -i * (2 * Math.PI / n);
            const x = box.w * CENTER[0] + rPx * Math.sin(theta);
            const y = box.h * CENTER[1] - rPx * Math.cos(theta);
            return (
              <div key={k} style={{
                position: 'absolute', left: x, top: y,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'auto',
              }}>
                <InfoTip text={tips[k]} placement={y > box.h * 0.6 ? 'bottom' : 'top'} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
