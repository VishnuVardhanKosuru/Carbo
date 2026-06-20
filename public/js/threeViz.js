// threeViz.js – Premium 3D emissions bar chart with Three.js
// Features: OrbitControls, shadow mapping, fog, ground grid, bar grow animation,
//           hover tooltips, responsive resize, and a hero globe visualization.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/controls/OrbitControls.js";

/* ================================================================
   DASHBOARD 3D BAR CHART
   ================================================================ */
let scene, camera, renderer, controls, barsGroup, raycaster, mouse, clock;
let animationId = null;

export function initThree(container, history = []) {
  if (renderer) {
    // Re-init: remove old canvas
    container.innerHTML = "";
    cancelAnimationFrame(animationId);
  }

  showLoading(true);

  const w = container.clientWidth || 600;
  const h = container.clientHeight || 340;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071209);
  scene.fog = new THREE.FogExp2(0x071209, 0.018);

  // Clock for animations
  clock = new THREE.Clock();

  // Camera
  camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 500);
  camera.position.set(0, 14, 26);
  camera.lookAt(0, 2, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;
  controls.minDistance = 8;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI * 0.48;

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
  sun.position.set(12, 22, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.radius = 4;
  scene.add(sun);

  const fillLight = new THREE.DirectionalLight(0x4ade80, 0.6);
  fillLight.position.set(-10, 8, -10);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0x22d3ee, 0.8, 60);
  rimLight.position.set(0, 20, -15);
  scene.add(rimLight);

  // Ground
  buildGround();

  // Bars group
  barsGroup = new THREE.Group();
  scene.add(barsGroup);

  // Raycaster
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  container.addEventListener("mousemove", onMouseMove);
  container.addEventListener("mouseleave", hideTooltip);

  updateBars(history);

  // Resize
  const ro = new ResizeObserver(() => {
    const nw = container.clientWidth;
    const nh = container.clientHeight || 340;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
  ro.observe(container);

  // Loop
  function loop() {
    animationId = requestAnimationFrame(loop);
    controls.update();
    const t = clock.getElapsedTime();
    rimLight.intensity = 0.6 + Math.sin(t * 0.8) * 0.2;
    renderer.render(scene, camera);
  }
  loop();

  showLoading(false);
}

function buildGround() {
  // Dark reflective ground plane
  const geo = new THREE.PlaneGeometry(60, 60);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0d1f10,
    roughness: 0.85,
    metalness: 0.1,
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid helper (green tinted)
  const grid = new THREE.GridHelper(60, 30, 0x1a4025, 0x122418);
  grid.position.y = 0.01;
  scene.add(grid);
}

function createBar(targetH, x, info, delay = 0) {
  const geo = new THREE.BoxGeometry(0.85, 1, 0.85);
  // Shift pivot to bottom
  geo.translate(0, 0.5, 0);

  // Color based on footprint magnitude
  const hue = 141 - (info.ratio * 30); // green→yellow-green
  const sat = 55 + info.ratio * 20;
  const lig = 38 + info.ratio * 18;
  const color = new THREE.Color(`hsl(${hue}, ${sat}%, ${lig}%)`);

  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.18,
    emissive: color,
    emissiveIntensity: 0.05,
  });

  const bar = new THREE.Mesh(geo, mat);
  bar.position.set(x, 0, 0);
  bar.castShadow = true;
  bar.receiveShadow = true;
  bar.scale.y = 0.001;
  bar.userData = { ...info, targetH };
  barsGroup.add(bar);

  // Top glow cap
  const capGeo = new THREE.BoxGeometry(0.9, 0.06, 0.9);
  const capMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(`hsl(${hue}, ${sat + 10}%, ${lig + 20}%)`),
    emissive: new THREE.Color(`hsl(${hue}, 70%, 55%)`),
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.4,
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.userData.isCap = true;
  bar.add(cap);
  cap.position.y = 1.0; // top of bar (before scale)

  // Animate growth with delay
  const startTime = performance.now() + delay;
  function grow(now) {
    if (now < startTime) { requestAnimationFrame(grow); return; }
    const elapsed = (now - startTime) / 600; // 600ms duration
    const t = Math.min(elapsed, 1);
    const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
    bar.scale.y = 0.001 + ease * (targetH - 0.001);
    if (t < 1) requestAnimationFrame(grow);
  }
  requestAnimationFrame(grow);
}

export function updateBars(history) {
  if (!barsGroup) return;
  // Clear
  while (barsGroup.children.length) {
    const c = barsGroup.children[0];
    barsGroup.remove(c);
    c.geometry?.dispose();
    c.material?.dispose();
  }

  const isEmpty = !history || history.length === 0;
  const threeEmpty = document.getElementById("threeEmpty");
  if (threeEmpty) threeEmpty.classList.toggle("hidden", !isEmpty);
  if (isEmpty) return;

  const max = Math.max(...history.map(r => r.footprint), 1);
  const spacing = 1.6;
  const startX = -((history.length - 1) * spacing) / 2;

  history.forEach((rec, i) => {
    const ratio = rec.footprint / max;
    const h = ratio * 14 + 0.4;
    createBar(h, startX + i * spacing, { date: rec.date, value: rec.footprint, ratio }, i * 80);
  });
}

function onMouseMove(event) {
  const container = document.getElementById("threeContainer");
  if (!container) return;
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(barsGroup.children, true);
  const tip = document.getElementById("tooltip");
  if (hits.length) {
    let obj = hits[0].object;
    if (obj.userData.isCap) obj = obj.parent;
    const { date, value } = obj.userData;
    if (date && value !== undefined) {
      tip.textContent = `📅 ${date} · ${value} kg CO₂`;
      tip.style.left = `${event.clientX + 14}px`;
      tip.style.top  = `${event.clientY - 38}px`;
      tip.style.opacity = "1";
      // Highlight
      obj.material.emissiveIntensity = 0.35;
      return;
    }
  }
  // Reset all emissive
  barsGroup.children.forEach(b => { if (b.material) b.material.emissiveIntensity = 0.05; });
  hideTooltip();
}

function hideTooltip() {
  const tip = document.getElementById("tooltip");
  if (tip) tip.style.opacity = "0";
}

export function showLoading(flag) {
  const s = document.getElementById("threeSpinner");
  if (s) s.style.display = flag ? "block" : "none";
}

/* ================================================================
   HERO GLOBE (decorative rotating wireframe sphere)
   ================================================================ */
let heroRenderer, heroScene, heroCamera, heroAnimId;

export function initHeroGlobe(container) {
  const w = container.clientWidth || 480;
  const h = container.clientHeight || 480;

  heroScene = new THREE.Scene();
  heroCamera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
  heroCamera.position.set(0, 0, 4.5);

  heroRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  heroRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  heroRenderer.setSize(w, h);
  heroRenderer.setClearColor(0x000000, 0);
  container.appendChild(heroRenderer.domElement);

  // Globe wireframe
  const sphGeo = new THREE.SphereGeometry(1.6, 48, 48);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x4ade80,
    wireframe: true,
    opacity: 0.18,
    transparent: true,
  });
  const globe = new THREE.Mesh(sphGeo, wireMat);
  heroScene.add(globe);

  // Glowing inner sphere
  const innerGeo = new THREE.SphereGeometry(1.55, 32, 32);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0x052e0c,
    transparent: true,
    opacity: 0.85,
  });
  heroScene.add(new THREE.Mesh(innerGeo, innerMat));

  // Particle dots on surface
  const dotCount = 220;
  const dotGeo = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < dotCount; i++) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const r = 1.62;
    positions.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
  }
  dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const dotMat = new THREE.PointsMaterial({ color: 0x86efac, size: 0.05, transparent: true, opacity: 0.9 });
  heroScene.add(new THREE.Points(dotGeo, dotMat));

  // Glowing ring
  const ringGeo = new THREE.TorusGeometry(1.75, 0.015, 12, 120);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.45 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI * 0.18;
  heroScene.add(ring);

  // Ambient + point
  heroScene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const hp = new THREE.PointLight(0x4ade80, 2.5, 12);
  hp.position.set(3, 4, 3);
  heroScene.add(hp);

  const ro = new ResizeObserver(() => {
    const nw = container.clientWidth;
    heroCamera.aspect = nw / nw;
    heroCamera.updateProjectionMatrix();
    heroRenderer.setSize(nw, nw);
  });
  ro.observe(container);

  const hclock = new THREE.Clock();
  function heroLoop() {
    heroAnimId = requestAnimationFrame(heroLoop);
    const t = hclock.getElapsedTime();
    globe.rotation.y = t * 0.18;
    globe.rotation.x = Math.sin(t * 0.12) * 0.12;
    ring.rotation.z = t * 0.12;
    hp.intensity = 2.2 + Math.sin(t * 1.2) * 0.5;
    heroRenderer.render(heroScene, heroCamera);
  }
  heroLoop();
}
