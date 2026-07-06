import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function HeroScene({ className, dark = true }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // 라이트 배경에서는 옅은 하늘색 파티클이 거의 안 보여서, 테마에 따라
    // 파티클 색/크기/불투명도를 다르게 준다(와이어프레임 색은 두 배경 모두에서
    // 잘 보여 그대로 둔다).
    const particleColor = dark ? 0x93c5fd : 0x2563eb;
    const particleSize = dark ? 0.035 : 0.05;
    const particleOpacity = dark ? 0.7 : 0.85;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // 바깥쪽 + 안쪽 와이어프레임 정이십면체를 하나의 그룹으로 겹쳐 배치
    const group = new THREE.Group();

    const outerGeometry = new THREE.IcosahedronGeometry(3.3, 1);
    const outerWireframe = new THREE.WireframeGeometry(outerGeometry);
    const outerLine = new THREE.LineSegments(
      outerWireframe,
      new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.55 })
    );
    group.add(outerLine);

    const innerGeometry = new THREE.IcosahedronGeometry(1.7, 0);
    const innerWireframe = new THREE.WireframeGeometry(innerGeometry);
    const innerLine = new THREE.LineSegments(
      innerWireframe,
      new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4 })
    );
    group.add(innerLine);

    scene.add(group);

    // 별처럼 흩뿌려진 파티클 — 그룹을 감싸는 -12~12 큐브 범위
    const particleCount = 500;
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

    const clock = new THREE.Clock();
    let frameId;
    const animate = () => {
      const t = clock.getElapsedTime();
      // 좌우로 살짝 흔들리는 건 그룹 전체(바깥+안쪽)가 함께 공유하고, Y축 회전은
      // 각자 따로 줘서 안쪽이 바깥과 명확히 반대 방향으로 돌게 한다.
      group.rotation.x = Math.sin(t * 0.1) * 0.3;
      outerLine.rotation.y = t * 0.11;
      innerLine.rotation.y = -t * 0.18;
      particles.rotation.y = t * 0.02;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
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
      outerGeometry.dispose();
      outerWireframe.dispose();
      outerLine.material.dispose();
      innerGeometry.dispose();
      innerWireframe.dispose();
      innerLine.material.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [dark]);

  return <div ref={mountRef} className={className} />;
}
