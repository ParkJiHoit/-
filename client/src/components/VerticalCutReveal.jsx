import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const VerticalCutReveal = forwardRef(function VerticalCutReveal(
  {
    children,
    reverse = false,
    transition = { type: 'spring', stiffness: 190, damping: 22 },
    splitBy = 'words',
    staggerDuration = 0.2,
    staggerFrom = 'first',
    containerClassName,
    wordLevelClassName,
    elementLevelClassName,
    onClick,
    onStart,
    onComplete,
    autoStart = true,
  },
  ref
) {
  const text = typeof children === 'string' ? children : String(children ?? '');
  const [isAnimating, setIsAnimating] = useState(false);

  const splitIntoCharacters = (str) => {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
      return Array.from(seg.segment(str), ({ segment }) => segment);
    }
    return Array.from(str);
  };

  const elements = useMemo(() => {
    const words = text.split(' ');
    if (splitBy === 'characters') {
      return words.map((word, i) => ({
        characters: splitIntoCharacters(word),
        needsSpace: i !== words.length - 1,
      }));
    }
    if (splitBy === 'words') return text.split(' ');
    if (splitBy === 'lines') return text.split('\n');
    return text.split(splitBy);
  }, [text, splitBy]);

  const getStaggerDelay = useCallback(
    (index) => {
      const total =
        splitBy === 'characters'
          ? elements.reduce((acc, w) => acc + w.characters.length, 0)
          : elements.length;
      if (staggerFrom === 'first') return index * staggerDuration;
      if (staggerFrom === 'last') return (total - 1 - index) * staggerDuration;
      if (staggerFrom === 'center') return Math.abs(Math.floor(total / 2) - index) * staggerDuration;
      if (staggerFrom === 'random') return Math.abs(Math.floor(Math.random() * total) - index) * staggerDuration;
      return Math.abs(staggerFrom - index) * staggerDuration;
    },
    [elements, splitBy, staggerFrom, staggerDuration]
  );

  const startAnimation = useCallback(() => {
    setIsAnimating(true);
    onStart?.();
  }, [onStart]);

  useImperativeHandle(ref, () => ({ startAnimation, reset: () => setIsAnimating(false) }));

  useEffect(() => { if (autoStart) startAnimation(); }, [autoStart]);

  const variants = {
    hidden: { y: reverse ? '-100%' : '100%' },
    visible: (i) => ({
      y: 0,
      transition: { ...transition, delay: ((transition?.delay) || 0) + getStaggerDelay(i) },
    }),
  };

  const wordObjs = (
    splitBy === 'characters'
      ? elements
      : elements.map((el, i) => ({ characters: [el], needsSpace: i !== elements.length - 1 }))
  );

  return (
    <span
      className={`${containerClassName ?? ''} flex flex-wrap whitespace-pre-wrap${splitBy === 'lines' ? ' flex-col' : ''}`}
      onClick={onClick}
    >
      <span className="sr-only">{text}</span>
      {wordObjs.map((wordObj, wordIndex, array) => {
        const prevCount = array.slice(0, wordIndex).reduce((s, w) => s + w.characters.length, 0);
        return (
          <span key={wordIndex} aria-hidden="true" className={`inline-flex overflow-hidden ${wordLevelClassName ?? ''}`}>
            {wordObj.characters.map((char, charIndex) => (
              <span key={charIndex} className={`whitespace-pre-wrap relative ${elementLevelClassName ?? ''}`}>
                <motion.span
                  custom={prevCount + charIndex}
                  initial="hidden"
                  animate={isAnimating ? 'visible' : 'hidden'}
                  variants={variants}
                  onAnimationComplete={
                    wordIndex === wordObjs.length - 1 && charIndex === wordObj.characters.length - 1
                      ? onComplete
                      : undefined
                  }
                  className="inline-block"
                >
                  {char}
                </motion.span>
              </span>
            ))}
            {wordObj.needsSpace && <span> </span>}
          </span>
        );
      })}
    </span>
  );
});

export default VerticalCutReveal;
