import { useRef, useEffect } from 'react';

const TEXTS = [
  '안녕하세요!',
  'RANKLET 입니다.',
  '키워드를 먼저 차지하세요.',
];

export default function GooeyText({
  texts = TEXTS,
  morphTime = 1.2,
  cooldownTime = 1.8,
  color = '#F5F5F7',
  fontSize = '2rem',
}) {
  const text1Ref = useRef(null);
  const text2Ref = useRef(null);

  useEffect(() => {
    let textIndex = texts.length - 1;
    let time = Date.now();
    let morph = 0;
    let cooldown = cooldownTime;
    let frameId;

    const setMorph = (fraction) => {
      if (!text1Ref.current || !text2Ref.current) return;
      const blur2 = Math.min(8 / fraction - 8, 100);
      text2Ref.current.style.filter = `blur(${blur2}px)`;
      text2Ref.current.style.opacity = `${Math.pow(fraction, 0.4)}`;

      const inv = 1 - fraction;
      const blur1 = Math.min(8 / inv - 8, 100);
      text1Ref.current.style.filter = `blur(${blur1}px)`;
      text1Ref.current.style.opacity = `${Math.pow(inv, 0.4)}`;
    };

    const doCooldown = () => {
      morph = 0;
      if (!text1Ref.current || !text2Ref.current) return;
      text2Ref.current.style.filter = '';
      text2Ref.current.style.opacity = '1';
      text1Ref.current.style.filter = '';
      text1Ref.current.style.opacity = '0';
    };

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const now = Date.now();
      const dt = (now - time) / 1000;
      time = now;

      const wasCooldown = cooldown > 0;
      cooldown -= dt;

      if (cooldown <= 0) {
        if (wasCooldown) {
          textIndex = (textIndex + 1) % texts.length;
          if (text1Ref.current && text2Ref.current) {
            text1Ref.current.textContent = texts[textIndex % texts.length];
            text2Ref.current.textContent = texts[(textIndex + 1) % texts.length];
          }
        }
        morph -= cooldown;
        cooldown = 0;
        let fraction = morph / morphTime;
        if (fraction > 1) {
          cooldown = cooldownTime;
          fraction = 1;
        }
        setMorph(fraction);
      } else {
        doCooldown();
      }
    };

    // 초기 텍스트 설정
    if (text1Ref.current && text2Ref.current) {
      text1Ref.current.textContent = texts[textIndex % texts.length];
      text2Ref.current.textContent = texts[(textIndex + 1) % texts.length];
    }

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [texts, morphTime, cooldownTime]);

  const spanStyle = {
    position: 'absolute',
    display: 'inline-block',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    fontSize,
    fontWeight: 700,
    color,
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    userSelect: 'none',
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* SVG gooey filter */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <filter id="gooey-threshold">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>

      {/* 텍스트 컨테이너 */}
      <div style={{
        position: 'relative',
        height: `calc(${fontSize} * 2)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: 'url(#gooey-threshold)',
      }}>
        <span ref={text1Ref} style={{ ...spanStyle, opacity: 0 }} />
        <span ref={text2Ref} style={{ ...spanStyle, opacity: 1 }} />
      </div>
    </div>
  );
}
