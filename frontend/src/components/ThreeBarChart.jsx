import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ThreeBarChart({ history }) {
  const mountRef = useRef(null);
  const tooltipRef = useRef(null);
  const sceneRef = useRef({});

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const W = el.clientWidth;
    const H = el.clientHeight || 340;

    // Clean up previous
    const prev = sceneRef.current;
    if (prev.renderer) {
      cancelAnimationFrame(prev.animId);
      prev.renderer.dispose();
      if (el.contains(prev.renderer.domElement)) el.removeChild(prev.renderer.domElement);
    }

    if (!history || history.length === 0) return;

    const scene    = new THREE.Scene();
    scene.fog      = new THREE.FogExp2(0x0a1410, 0.08);
    scene.background = new THREE.Color(0x0a1410);

    const camera   = new THREE.PerspectiveCamera(52, W / H, 0.1, 200);
    camera.position.set(0, 7, 16);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0x4ade80, 0.4);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(8, 18, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    scene.add(dirLight);

    // Grid
    const grid = new THREE.GridHelper(40, 40, 0x1a2e1a, 0x1a2e1a);
    grid.receiveShadow = true;
    scene.add(grid);

    // Bars
    const recent = history.slice(-10);
    const maxFP  = Math.max(...recent.map((r) => r.footprint_kg), 1);
    const gap    = 2.2;
    const offset = (recent.length - 1) * gap * 0.5;
    const GLOBAL_AVG = 4.7;

    const bars = [];
    recent.forEach((rec, i) => {
      const norm    = rec.footprint_kg / maxFP;
      const targetH = Math.max(norm * 6, 0.15);
      const isHigh  = rec.footprint_kg > GLOBAL_AVG;

      const color = isHigh
        ? new THREE.Color().lerpColors(new THREE.Color(0x4ade80), new THREE.Color(0xfbbf24), Math.min((rec.footprint_kg - GLOBAL_AVG) / 5, 1))
        : new THREE.Color(0x4ade80);

      const geo = new THREE.BoxGeometry(1.4, 0.01, 1.4);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.12,
        emissive: color,
        emissiveIntensity: 0.08,
      });
      const bar = new THREE.Mesh(geo, mat);
      bar.castShadow = true;
      bar.receiveShadow = true;
      bar.position.x = i * gap - offset;
      bar.position.y = 0;
      bar.userData  = { targetH, index: i, record: rec };
      scene.add(bar);

      // Glowing cap
      const capGeo = new THREE.BoxGeometry(1.42, 0.08, 1.42);
      const capMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.3,
      });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.x = bar.position.x;
      cap.position.y = 0;
      cap.userData = { isCap: true, barIndex: i };
      scene.add(cap);

      bars.push({ bar, cap, targetH, currentH: 0.01 });
    });

    // Tooltip handling
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();
    const tip       = tooltipRef.current;
    let hovered = null;

    const onMouseMove = (e) => {
      const rect = el.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(bars.map((b) => b.bar));
      if (hits.length > 0) {
        const { record } = hits[0].object.userData;
        if (tip) {
          tip.style.opacity = "1";
          tip.style.left    = e.clientX + 12 + "px";
          tip.style.top     = e.clientY - 28 + "px";
          tip.textContent   = `📅 ${record.record_date}  ·  ${record.footprint_kg} kg CO₂`;
        }
        hovered = hits[0].object;
      } else {
        if (tip) tip.style.opacity = "0";
        hovered = null;
      }
    };
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseleave", () => { if (tip) tip.style.opacity = "0"; });

    // Animate
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      bars.forEach(({ bar, cap, targetH }, i) => {
        const delay = i * 80;
        setTimeout(() => {
          bar.userData.growing = true;
        }, delay);
        if (bar.userData.growing && bar.scale.y < targetH / 0.01) {
          bar.scale.y = Math.min(bar.scale.y + 0.05 * targetH, targetH / 0.01);
          bar.position.y = (bar.scale.y * 0.01) / 2;
          cap.position.y = bar.position.y + bar.scale.y * 0.01 / 2 + 0.04;
        }
        if (hovered === bar) {
          bar.material.emissiveIntensity = 0.35;
        } else {
          bar.material.emissiveIntensity = 0.08;
        }
      });
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      const nw = el.clientWidth;
      const nh = el.clientHeight || 340;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    sceneRef.current = { renderer, animId };

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      el.removeEventListener("mousemove", onMouseMove);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [history]);

  const hasData = history && history.length > 0;

  return (
    <div className="three-wrapper">
      <div ref={mountRef} className="three-container" />
      {!hasData && (
        <div className="three-empty">
          <span>📊</span>
          <p>Log your first entry to see 3D bars</p>
        </div>
      )}
      <div ref={tooltipRef} className="tooltip" />
    </div>
  );
}
