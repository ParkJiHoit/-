// 하드웨어 가속이 꺼져 있거나 샌드박스 브라우저 등에서는 WebGL 컨텍스트 생성 자체가
// 실패한다 — 이 경우 Three.js 배경 애니메이션을 그냥 건너뛰어야지, 에러를 그대로
// 던지면 useEffect 밖으로 새어나가 React 트리 전체가 언마운트되어 버린다(빈 화면).
export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}
