import { useEffect, useState } from 'react';

// 조건부 렌더 `{open && (...)}`는 닫힐 때 DOM이 즉시 사라져서 CSS exit
// 애니메이션이 재생될 시간이 없다. 이 훅은 isOpen이 false가 된 뒤에도
// delayMs만큼 더 렌더링을 유지해서, 그 사이 CSS로 exit 트랜지션을 재생할
// 수 있게 해준다. 반환하는 isClosing을 data-closing 속성에 연결해서 쓴다.
export default function useDelayedUnmount(isOpen, delayMs = 120) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }
    if (!shouldRender) return;
    setIsClosing(true);
    const timer = setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return { shouldRender, isClosing };
}
