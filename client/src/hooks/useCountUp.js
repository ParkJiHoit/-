import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

// 숫자가 바뀔 때(최초 마운트 포함) 0(또는 이전 값)에서 목표값까지 부드럽게
// 세어 올라가는 훅. target이 null/undefined면 그대로 통과시킨다(카드에
// "—" 같은 플레이스홀더가 올 수 있어서).
export default function useCountUp(target, duration = 0.8) {
  const [value, setValue] = useState(typeof target === 'number' ? 0 : target);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (typeof target !== 'number') { setValue(target); return; }
    const controls = animate(prevTarget.current, target, {
      duration, ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setValue(Math.round(v)),
    });
    prevTarget.current = target;
    return () => controls.stop();
  }, [target, duration]);

  return value;
}
