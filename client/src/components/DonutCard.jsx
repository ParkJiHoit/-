import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([PieChart, TooltipComponent, LegendComponent, SVGRenderer]);

const FONT_STACK = "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif";

// 도넛 차트 카드 — 블로그 구조 분석 화면에서 쓰는 분포 시각화.
// segments: [{ key, label, color, value }]
export default function DonutCard({ title, segments, total }) {
  const chartElRef = useRef(null);
  const chartRef = useRef(null);
  const filtered = segments.filter(s => s.value > 0);

  useEffect(() => {
    if (!chartElRef.current) return undefined;
    const chart = echarts.init(chartElRef.current, null, { renderer: 'svg' });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(chartElRef.current);

    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption({
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: 'rgba(28,28,30,0.94)',
        borderWidth: 0,
        padding: [8, 12],
        textStyle: { color: '#fff', fontSize: 12, fontFamily: FONT_STACK },
        extraCssText: 'box-shadow:0 8px 28px rgba(0,0,0,0.4); border-radius:8px;',
        formatter: p => `${p.marker} ${p.name} &nbsp; <b>${p.value}</b>건 (${p.percent}%)`,
      },
      legend: {
        bottom: 2,
        left: 'center',
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 16,
        textStyle: { color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, fontFamily: FONT_STACK },
      },
      series: [{
        type: 'pie',
        radius: ['56%', '82%'],
        center: ['50%', '43%'],
        avoidLabelOverlap: false,
        silent: filtered.length === 0,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderColor: 'var(--bg-elevated)',
          borderWidth: 3,
          borderRadius: 6,
        },
        emphasis: {
          scale: true,
          scaleSize: 4,
        },
        data: filtered.map(s => ({ name: s.label, value: s.value, itemStyle: { color: s.color } })),
        animationDuration: 650,
        animationEasing: 'cubicOut',
      }],
    });
  }, [filtered, total]);

  return (
    <div className="mac-card-glass" style={{
      padding: '18px 20px 14px',
      borderTop: '1px solid rgba(10,132,255,0.25)',
      aspectRatio: '1 / 1',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 4px' }}>
        {title}
      </p>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div ref={chartElRef} style={{ position: 'absolute', inset: 0 }} />
        <div style={{
          position: 'absolute', top: '43%', left: '50%', transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', fontFamily: FONT_STACK, lineHeight: 1 }}>
            {total}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginTop: 4 }}>
            TOTAL
          </div>
        </div>
      </div>
    </div>
  );
}
