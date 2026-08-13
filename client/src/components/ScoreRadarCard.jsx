import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { RadarChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([RadarChart, TooltipComponent, SVGRenderer]);

const FONT_STACK = "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif";

// 블로그 진단 "항목별 점수"를 축마다 만점이 다른 레이더(스파이더) 차트로 보여준다.
// breakdown: { key: value }, labels: { key: label }, max: { key: maxValue }
export default function ScoreRadarCard({ breakdown, labels, max, color, height = 320 }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!elRef.current) return undefined;
    const chart = echarts.init(elRef.current, null, { renderer: 'svg' });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => chart.resize());
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
        radius: '58%',
        center: ['50%', '52%'],
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

  return <div ref={elRef} style={{ width: '100%', height }} />;
}
