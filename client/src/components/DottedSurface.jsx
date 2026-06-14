import { useEffect, useRef } from 'react';

const AMOUNTX = 40;
const AMOUNTY = 60;
const SEPARATION = 150;

export default function DottedSurface({ theme }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const isDark = theme === 'dark';

    let width, height;
    let count = 0;

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Camera-like projection: 3D → 2D perspective
    const fov = 500;
    const camY = 355;
    const camZ = 1220;

    const project = (x3, y3, z3) => {
      const dz = camZ - z3;
      const scale = fov / (fov + dz);
      const x2 = x3 * scale + width / 2;
      // y축 반전: 점들이 화면 하단에 위치하도록
      const y2 = (y3 - camY) * scale + height / 2;
      return { x: x2, y: y2, scale };
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          const x3 = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
          const y3 =
            Math.sin((ix + count) * 0.3) * 50 +
            Math.sin((iy + count) * 0.5) * 50;
          const z3 = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;

          const { x, y, scale } = project(x3, y3, z3);

          // skip dots that are out of view
          if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;

          const radius = Math.max(0.5, scale * 4);
          const alpha = isDark
            ? Math.min(0.85, scale * 0.9)
            : Math.min(0.55, scale * 0.6);

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = isDark
            ? `rgba(180, 200, 220, ${alpha})`
            : `rgba(80, 110, 150, ${alpha})`;
          ctx.fill();
        }
      }

      count += 0.07;
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 1,
      }}
    />
  );
}
