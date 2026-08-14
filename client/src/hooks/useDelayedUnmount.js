import { useEffect, useState } from 'react';

// 조건부 렌더 `{open && (...)}`는 닫힐 때 DOM이 즉시 사라져서 CSS exit
// 애니메이션이 재생될 시간이 없다. 이 훅은 isOpen이 false가 된 뒤에도
// delayMs만큼 더 렌더링을 유지해서, 그 사이 CSS로 exit 트랜지션을 재생할
// 수 있게 해준다. 반환하는 isClosing을 data-closing 속성에 연결해서 쓴다.
//
// isEntering은 열리는 순간 true로 마운트됐다가 다음 프레임에 false로 바뀐다 —
// CSS transition은 두 상태 사이를 보간하는 방식이라 "숨김→보임"을 트랜지션시키려면
// 첫 프레임엔 숨김 상태로 그렸다가 곧바로 보임 상태로 넘어가야 하기 때문.
// 이 덕분에 열림/닫힘 모두 transition으로 처리할 수 있어, 닫히는 도중 다시 열어도
// (keyframe animation과 달리) 현재 상태에서 자연스럽게 되돌아간다.
export default function useDelayedUnmount(isOpen, delayMs = 120) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [isEntering, setIsEntering] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      setIsEntering(true);
      const frame = requestAnimationFrame(() => setIsEntering(false));
      return () => cancelAnimationFrame(frame);
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

  return { shouldRender, isClosing, isEntering };
}
