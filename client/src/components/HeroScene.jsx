import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { isWebGLAvailable } from '../utils/webgl';

// intensity(0~1)는 데이터 위주 페이지(순위 추적 등)에서 배경이 콘텐츠를 방해하지
// 않도록 불투명도와 회전 속도를 함께 낮추는 용도 — 랜딩 화면(기본값 1)은 그대로 둔다.
// showSpheres=false면 와이어프레임 정이십면체 두 개는 아예 만들지 않고 파티클만 남긴다
// (텍스트가 많은 페이지 뒤에서 구체가 시선을 뺏지 않게 하는 용도, 예: 가이드 페이지).
export default function HeroScene({ className, dark = true, particleCount = 500, intensity = 1, showSpheres = true }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !isWebGLAvailable()) return;

    // 라이트 배경에서는 옅은 하늘색 파티클이 거의 안 보여서, 테마에 따라
    // 파티클 색/크기/불투명도를 다르게 준다(와이어프레임 색은 두 배경 모두에서
    // 잘 보여 그대로 둔다).
    const particleColor = dark ? 0x93c5fd : 0x2563eb;
    const particleSize = dark ? 0.035 : 0.05;
    const particleOpacity = (dark ? 0.7 : 0.85) * intensity;
    const outerOpacity = 0.55 * intensity;
    const innerOpacity = 0.4 * intensity;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.z = 8;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      console.warn('[HeroScene] WebGL 렌더러 생성 실패, 배경 애니메이션을 건너뜁니다:', err.message);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // 바깥쪽 + 안쪽 와이어프레임 정이십면체를 하나의 그룹으로 겹쳐 배치(showSpheres일 때만)
    const group = new THREE.Group();
    let outerGeometry, outerWireframe, outerLine, innerGeometry, innerWireframe, innerLine;

    if (showSpheres) {
      outerGeometry = new THREE.IcosahedronGeometry(3.3, 1);
      outerWireframe = new THREE.WireframeGeometry(outerGeometry);
      outerLine = new THREE.LineSegments(
        outerWireframe,
        new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: outerOpacity })
      );
      group.add(outerLine);

      innerGeometry = new THREE.IcosahedronGeometry(1.7, 0);
      innerWireframe = new THREE.WireframeGeometry(innerGeometry);
      innerLine = new THREE.LineSegments(
        innerWireframe,
        new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: innerOpacity })
      );
      group.add(innerLine);

      scene.add(group);
    }

    // 별처럼 흩뿌려진 파티클 — 그룹을 감싸는 -12~12 큐브 범위
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 24;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: particleColor, size: particleSize, transparent: true, opacity: particleOpacity,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // 회전이 계속되는 배경은 전정 장애가 있는 사용자에게 불편할 수 있어, OS의
    // reduced-motion 설정을 존중해 정적인 프레임 한 장만 렌더링하고 루프를 멈춘다.
    const prefersReducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const clock = new THREE.Clock();
    let frameId;
    const animate = () => {
      if (!prefersReducedMotion) {
        const t = clock.getElapsedTime();
        // 좌우로 살짝 흔들리는 건 그룹 전체(바깥+안쪽)가 함께 공유하고, Y축 회전은
        // 각자 따로 줘서 안쪽이 바깥과 명확히 반대 방향으로 돌게 한다.
        if (showSpheres) {
          group.rotation.x = Math.sin(t * 0.1) * 0.3;
          outerLine.rotation.y = t * 0.11 * intensity;
          innerLine.rotation.y = -t * 0.18 * intensity;
        }
        particles.rotation.y = t * 0.02 * intensity;
      }
      renderer.render(scene, camera);
      if (!prefersReducedMotion) frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (showSpheres) {
        outerGeometry.dispose();
        outerWireframe.dispose();
        outerLine.material.dispose();
        innerGeometry.dispose();
        innerWireframe.dispose();
        innerLine.material.dispose();
      }
      particleGeometry.dispose();
      particleMaterial.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [dark, particleCount, intensity, showSpheres]);

  return <div ref={mountRef} className={className} />;
}
