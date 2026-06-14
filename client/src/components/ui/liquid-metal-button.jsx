import { liquidMetalFragmentShader, ShaderMount } from '@paper-design/shaders';
import { Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export function LiquidMetalButton({
  label = 'Get Started',
  onClick,
  viewMode = 'text',
  height: customHeight,
  width: customWidth,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [ripples, setRipples] = useState([]);
  const shaderRef = useRef(null);
  const shaderMount = useRef(null);
  const buttonRef = useRef(null);
  const rippleId = useRef(0);

  const dimensions = useMemo(() => {
    const h = customHeight ?? (viewMode === 'icon' ? 46 : 46);
    const w = customWidth ?? (viewMode === 'icon' ? 46 : 142);
    return {
      width: w,
      height: h,
      innerWidth: w - 4,
      innerHeight: h - 4,
      shaderWidth: w,
      shaderHeight: h,
    };
  }, [viewMode, customHeight, customWidth]);

  useEffect(() => {
    const styleId = 'shader-canvas-style-exploded';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .shader-container-exploded canvas {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          border-radius: 100px !important;
        }
        @keyframes ripple-animation {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.6; }
          100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    if (shaderRef.current) {
      if (shaderMount.current?.destroy) shaderMount.current.destroy();
      try {
        shaderMount.current = new ShaderMount(
          shaderRef.current,
          liquidMetalFragmentShader,
          {
            u_repetition: 4,
            u_softness: 0.5,
            u_shiftRed: 0.3,
            u_shiftBlue: 0.3,
            u_distortion: 0,
            u_contour: 0,
            u_angle: 45,
            u_scale: 8,
            u_shape: 1,
            u_offsetX: 0.1,
            u_offsetY: -0.1,
          },
          undefined,
          0.6,
        );
      } catch (err) {
        console.error('[LiquidMetalButton] shader error:', err);
      }
    }

    return () => {
      if (shaderMount.current?.destroy) {
        shaderMount.current.destroy();
        shaderMount.current = null;
      }
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
    shaderMount.current?.setSpeed?.(1);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsPressed(false);
    shaderMount.current?.setSpeed?.(0.6);
  };

  const handleClick = (e) => {
    if (shaderMount.current?.setSpeed) {
      shaderMount.current.setSpeed(2.4);
      setTimeout(() => {
        shaderMount.current?.setSpeed?.(isHovered ? 1 : 0.6);
      }, 300);
    }

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const ripple = { x: e.clientX - rect.left, y: e.clientY - rect.top, id: rippleId.current++ };
      setRipples((prev) => [...prev, ripple]);
      setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== ripple.id)), 600);
    }

    onClick?.();
  };

  const { width, height, innerWidth, innerHeight, shaderWidth, shaderHeight } = dimensions;

  return (
    <div className="relative inline-block">
      <div style={{ perspective: '1000px', perspectiveOrigin: '50% 50%' }}>
        <div style={{ position: 'relative', width, height, transformStyle: 'preserve-3d', transition: 'all 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}>

          {/* Label layer */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width, height,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transformStyle: 'preserve-3d',
            transform: 'translateZ(20px)',
            zIndex: 30, pointerEvents: 'none',
          }}>
            {viewMode === 'icon' && (
              <Sparkles size={16} style={{ color: '#666', filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.5))' }} />
            )}
            {viewMode === 'text' && (
              <span style={{
                fontSize: 13, color: '#777', fontWeight: 500,
                textShadow: '0px 1px 2px rgba(0,0,0,0.5)', whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            )}
          </div>

          {/* Inner dark pill layer */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width, height,
            transformStyle: 'preserve-3d',
            transform: `translateZ(10px) ${isPressed ? 'translateY(1px) scale(0.98)' : 'translateY(0) scale(1)'}`,
            transition: 'all 0.8s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s ease',
            zIndex: 20,
          }}>
            <div style={{
              width: innerWidth, height: innerHeight, margin: 2,
              borderRadius: 100, background: 'linear-gradient(180deg,#202020 0%,#000 100%)',
              boxShadow: isPressed ? 'inset 0px 2px 4px rgba(0,0,0,0.4)' : 'none',
              transition: 'box-shadow 0.15s ease',
            }} />
          </div>

          {/* Shader shell layer */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width, height,
            transformStyle: 'preserve-3d',
            transform: `translateZ(0px) ${isPressed ? 'translateY(1px) scale(0.98)' : 'translateY(0) scale(1)'}`,
            transition: 'all 0.8s cubic-bezier(0.34,1.56,0.64,1)',
            zIndex: 10,
          }}>
            <div style={{
              height, width, borderRadius: 100,
              boxShadow: isPressed
                ? '0px 0px 0px 1px rgba(0,0,0,0.5), 0px 1px 2px 0px rgba(0,0,0,0.3)'
                : isHovered
                  ? '0px 0px 0px 1px rgba(0,0,0,0.4), 0px 12px 6px 0px rgba(0,0,0,0.05), 0px 8px 5px 0px rgba(0,0,0,0.1), 0px 4px 4px 0px rgba(0,0,0,0.15), 0px 1px 2px 0px rgba(0,0,0,0.2)'
                  : '0px 0px 0px 1px rgba(0,0,0,0.3), 0px 9px 9px 0px rgba(0,0,0,0.12), 0px 2px 5px 0px rgba(0,0,0,0.15)',
              transition: 'box-shadow 0.15s ease',
              background: 'transparent',
            }}>
              <div
                ref={shaderRef}
                className="shader-container-exploded"
                style={{
                  borderRadius: 100, overflow: 'hidden', position: 'relative',
                  width: shaderWidth, maxWidth: shaderWidth, height: shaderHeight,
                }}
              />
            </div>
          </div>

          {/* Click target */}
          <button
            ref={buttonRef}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            aria-label={label}
            style={{
              position: 'absolute', top: 0, left: 0, width, height,
              background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none',
              zIndex: 40, transformStyle: 'preserve-3d', transform: 'translateZ(25px)',
              transition: 'all 0.8s cubic-bezier(0.34,1.56,0.64,1)',
              overflow: 'hidden', borderRadius: 100,
            }}
          >
            {ripples.map((r) => (
              <span key={r.id} style={{
                position: 'absolute', left: r.x, top: r.y, width: 20, height: 20,
                borderRadius: '50%', pointerEvents: 'none',
                background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%)',
                animation: 'ripple-animation 0.6s ease-out',
              }} />
            ))}
          </button>
        </div>
      </div>
    </div>
  );
}
