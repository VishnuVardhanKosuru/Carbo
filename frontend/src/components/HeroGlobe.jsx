import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function HeroGlobe() {
  const mountRef = useRef(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const w = el.clientWidth || 480;
    const h = el.clientHeight || 480;

    // Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 0, 3);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    // Globe wireframe
    const globeGeo = new THREE.IcosahedronGeometry(1, 4);
    const globeMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globe);

    // Inner solid glow sphere
    const innerGeo = new THREE.SphereGeometry(0.97, 32, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x052e16,
      transparent: true,
      opacity: 0.7,
    });
    scene.add(new THREE.Mesh(innerGeo, innerMat));

    // Surface dots
    const dotGeo = new THREE.BufferGeometry();
    const dotCount = 280;
    const positions = new Float32Array(dotCount * 3);
    for (let i = 0; i < dotCount; i++) {
      const theta = Math.acos(1 - 2 * Math.random());
      const phi   = Math.random() * Math.PI * 2;
      positions[i * 3]     = 1.01 * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = 1.01 * Math.cos(theta);
      positions[i * 3 + 2] = 1.01 * Math.sin(theta) * Math.sin(phi);
    }
    dotGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const dotMat = new THREE.PointsMaterial({ color: 0x4ade80, size: 0.022, sizeAttenuation: true });
    scene.add(new THREE.Points(dotGeo, dotMat));

    // Orbit ring
    const ringGeo = new THREE.TorusGeometry(1.25, 0.005, 8, 100);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.35 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.5;
    scene.add(ring);

    // Rim light
    const rimGeo = new THREE.SphereGeometry(1.04, 32, 32);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.05 });
    scene.add(new THREE.Mesh(rimGeo, rimMat));

    // Ambient particle cloud
    const cloudGeo = new THREE.BufferGeometry();
    const cloudN = 600;
    const cloudPos = new Float32Array(cloudN * 3);
    for (let i = 0; i < cloudN; i++) {
      const r = 1.4 + Math.random() * 0.6;
      const theta = Math.acos(1 - 2 * Math.random());
      const phi   = Math.random() * Math.PI * 2;
      cloudPos[i * 3]     = r * Math.sin(theta) * Math.cos(phi);
      cloudPos[i * 3 + 1] = r * Math.cos(theta);
      cloudPos[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
    }
    cloudGeo.setAttribute("position", new THREE.BufferAttribute(cloudPos, 3));
    const cloudMat = new THREE.PointsMaterial({ color: 0x86efac, size: 0.008, transparent: true, opacity: 0.5 });
    scene.add(new THREE.Points(cloudGeo, cloudMat));

    // Animation
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      globe.rotation.y += 0.003;
      ring.rotation.z  += 0.004;
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      const nw = el.clientWidth;
      const nh = el.clientHeight || nw;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} id="heroGlobe" />;
}
