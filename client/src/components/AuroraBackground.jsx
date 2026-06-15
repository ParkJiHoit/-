import { useCallback, useEffect, useRef, useState } from 'react';

const CONFIG = {
  primaryColor: '10, 132, 255',
  secondaryColor: '64, 156, 255',
  sphereRotationDuration: '240s',
  wireframeOpacity: 0.55,
  coreBlur: 180,
  parallaxDepth: 20,
  lerpFactor: 0.06,
  sphereDensity: 12,
};

const lerp = (a, b, t) => a + (b - a) * t;

export default function AuroraBackground({ theme, hidden = false }) {
  const [smoothPos, setSmoothPos] = useState({ x: 0, y: 0 });
  const targetPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const rafRef = useRef();
  const isDark = theme === 'dark';

  const animate = useCallback(() => {
    currentPos.current.x = lerp(currentPos.current.x, targetPos.current.x, CONFIG.lerpFactor);
    currentPos.current.y = lerp(currentPos.current.y, targetPos.current.y, CONFIG.lerpFactor);
    setSmoothPos({ x: currentPos.current.x, y: currentPos.current.y });
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  useEffect(() => {
    const onMove = (e) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetPos.current = {
        x: (e.clientX - cx) / cx,
        y: (e.clientY - cy) / cy,
      };
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const { x, y } = smoothPos;
  const d = CONFIG.parallaxDepth;

  // 브랜드 컬러 #0A84FF 기반
  const primary   = '10, 132, 255';
  const secondary = '64, 156, 255';
  const tertiary  = '0, 180, 255';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(139,92,246,0.07)';
  const wireColor = `rgba(${primary}, ${isDark ? CONFIG.wireframeOpacity : 0.4})`;
  const coreOpacity = isDark ? 0.4 : 0.3;
  const bloomOpacity = isDark ? 0.85 : 0.6;

  const sphereRings = Array.from({ length: CONFIG.sphereDensity }, (_, i) => {
    const step = 90 / (CONFIG.sphereDensity / 2);
    const angle = i * step;
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `1px solid ${wireColor}`,
          boxShadow: `0 0 ${isDark ? 8 : 5}px 1px rgba(${primary}, ${isDark ? 0.4 : 0.25})`,
          transform: i % 2 === 0 ? `rotateY(${angle}deg)` : `rotateX(${angle}deg)`,
        }}
      />
    );
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: isDark ? '#08080f' : 'var(--bg-base)',
        overflow: 'hidden',
      }}
    >
      {/* 구체/애니메이션 요소 — 분석 페이지에서는 숨김 */}
      <div style={{ opacity: hidden ? 0 : 1, transition: 'opacity 0.6s ease' }}>
      {/* 인라인 CSS 애니메이션 */}
      <style>{`
        @keyframes sphere-spin {
          from { transform: rotateY(0deg) rotateX(10deg); }
          to   { transform: rotateY(360deg) rotateX(10deg); }
        }
        @keyframes grid-pan {
          from { transform: translate(0, 0); }
          to   { transform: translate(40px, 40px); }
        }
        @keyframes core-pulse {
          0%, 100% { opacity: ${coreOpacity}; transform: translate(-50%, -50%) scale(1); }
          50%       { opacity: ${coreOpacity * 0.6}; transform: translate(-50%, -50%) scale(1.12); }
        }
      `}</style>

      {/* Grid */}
      <div style={{
        position: 'absolute', inset: '-40px',
        backgroundImage: `repeating-linear-gradient(to right, ${gridColor} 1px, transparent 1px),
                          repeating-linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        animation: 'grid-pan 8s linear infinite',
        transform: `translate3d(${-x * (d / 2)}px, ${-y * (d / 2)}px, 0)`,
      }} />

      {/* Haze */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle at 50% 50%, rgba(${primary}, ${isDark ? 0.12 : 0.08}) 0%, transparent 55%)`,
        filter: 'blur(120px)',
        transform: `translate3d(${x * (d / 2)}px, ${y * (d / 2)}px, 0)`,
      }} />

      {/* Deep base */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(at 50% 50%, rgba(${primary}, ${isDark ? 0.07 : 0.04}) 0%, transparent 80%)`,
        transform: `translate3d(${x * d}px, ${y * d}px, 0)`,
      }} />

      {/* Core glow */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: 360, height: 360,
        borderRadius: '50%',
        backgroundImage: `radial-gradient(circle, rgba(${secondary}, ${coreOpacity}) 0%, transparent 70%)`,
        filter: `blur(${CONFIG.coreBlur}px)`,
        animation: 'core-pulse 25s ease-in-out infinite',
        transform: 'translate(-50%, -50%)',
      }} />

      {/* Wireframe sphere */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: 780, height: 780,
        marginLeft: -390, marginTop: -390,
        transformStyle: 'preserve-3d',
        perspective: 800,
        transform: `translate3d(${x * d}px, ${y * d}px, 0)`,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          transformStyle: 'preserve-3d',
          animation: `sphere-spin ${CONFIG.sphereRotationDuration} linear infinite`,
        }}>
          {sphereRings}
        </div>
      </div>

      {/* Bloom */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: isDark
          ? `radial-gradient(circle at 50% 50%, rgba(${primary}, 0.3) 0%, transparent 50%),
             radial-gradient(circle at 10% 10%, rgba(${secondary}, 0.2) 0%, transparent 30%)`
          : `radial-gradient(circle at 50% 50%, rgba(${primary}, 0.28) 0%, transparent 45%),
             radial-gradient(circle at 80% 20%, rgba(${tertiary}, 0.22) 0%, transparent 35%),
             radial-gradient(circle at 15% 75%, rgba(${secondary}, 0.2) 0%, transparent 35%)`,
        mixBlendMode: isDark ? 'screen' : 'multiply',
        filter: 'blur(80px)',
        opacity: bloomOpacity,
        transform: `translate3d(${x * d}px, ${y * d}px, 0)`,
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: isDark
          ? 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)'
          : 'radial-gradient(ellipse at center, transparent 40%, rgba(200,200,220,0.5) 100%)',
      }} />
      </div>{/* end 구체/애니메이션 wrapper */}
    </div>
  );
}
