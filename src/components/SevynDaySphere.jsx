import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Cinematic hero: an oval "donut" (torus) built from a stack of individual ring
// loops, floating in a dark, foggy, star-flecked void. Each ring slowly twists
// about the donut's local axis with a phase offset between neighbours, so a wave
// of the form turning itself inside-out travels around the loop while the whole
// group rotates gently. On first load it spins up, then eases into a slow idle
// as the SEVYNDAY wordmark materializes from its core. Drag to rotate.
//
// Module-scoped so the intro sequence plays only ONCE per page load — a remount
// (route change back to home, or React StrictMode's dev double-invoke) skips
// straight to the settled state rather than replaying.
let hasIntroPlayed = false;

const SCENE_COLOR = '#05070D';

export default function SevynDaySphere() {
  const mountRef = useRef(null);
  const wordmarkRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    // Near-black navy void with exponential fog so distant elements dissolve
    // into darkness instead of hitting a flat color wall.
    scene.background = new THREE.Color(SCENE_COLOR);
    scene.fog = new THREE.FogExp2(SCENE_COLOR, 0.045);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    // --- Starfield: a sparse depth cue so the void reads as infinite ----------
    function makeStarTexture() {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      const g = ctx.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, size / 2,
      );
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(210,224,255,0.85)');
      g.addColorStop(0.55, 'rgba(140,170,255,0.22)');
      g.addColorStop(1, 'rgba(140,170,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    }

    const STAR_COUNT = 450;
    const starTexture = makeStarTexture();
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      // Symmetric, centered volume so the field reads evenly on all sides.
      starPositions[i * 3] = (Math.random() * 2 - 1) * 40; // x: [-40, 40]
      starPositions[i * 3 + 1] = (Math.random() * 2 - 1) * 40; // y: [-40, 40]
      starPositions[i * 3 + 2] = -6 - Math.random() * 36; // z: -6 .. -42 (behind)
    }
    starGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(starPositions, 3),
    );
    const starMaterial = new THREE.PointsMaterial({
      size: 0.6,
      map: starTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      color: new THREE.Color('#acc4ff'),
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // --- The oval donut, built from individual ring loops ---------------------
    const group = new THREE.Group();
    scene.add(group);

    const RING_COUNT = 30; // rings swept around the main donut path
    const MAIN_RADIUS = 1.7; // center -> tube-center distance
    const TUBE_RADIUS = 0.5; // radius of each ring (tube cross-section)
    const X_STRETCH = 1.4; // elongate along X so it reads as an oval, not a circle
    const RING_SEGMENTS = 72;

    // Gradient stops sampled from the reference image (blue -> purple -> pink -> orange -> yellow)
    const colorStops = [
      new THREE.Color('#4FA3E3'),
      new THREE.Color('#8C7FDB'),
      new THREE.Color('#D97FC2'),
      new THREE.Color('#E3A15C'),
      new THREE.Color('#E2D95C'),
    ];

    function colorAt(t) {
      const scaled = Math.min(Math.max(t, 0), 1) * (colorStops.length - 1);
      const i = Math.min(Math.floor(scaled), colorStops.length - 2);
      const localT = scaled - i;
      return colorStops[i].clone().lerp(colorStops[i + 1], localT);
    }

    // One shared circle (a ring's cross-section) reused by every ring; each ring
    // is a pivot placed on the oval path and oriented so the circle lies in the
    // torus cross-section plane (spanned by the in-plane normal and the axis).
    const ringPoints = [];
    for (let j = 0; j <= RING_SEGMENTS; j++) {
      const v = (2 * Math.PI * j) / RING_SEGMENTS;
      ringPoints.push(
        new THREE.Vector3(TUBE_RADIUS * Math.cos(v), TUBE_RADIUS * Math.sin(v), 0),
      );
    }
    const ringGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints);

    const axis = new THREE.Vector3(0, 0, 1); // donut's central axis
    const rings = [];
    for (let i = 0; i < RING_COUNT; i++) {
      const u = (2 * Math.PI * i) / RING_COUNT;
      const cosu = Math.cos(u);
      const sinu = Math.sin(u);

      // Elliptical (oval) main path in the XY plane.
      const cx = X_STRETCH * MAIN_RADIUS * cosu;
      const cy = MAIN_RADIUS * sinu;

      // Direction of travel along the path (its tangent) and the in-plane normal.
      const tangent = new THREE.Vector3(
        -X_STRETCH * MAIN_RADIUS * sinu,
        MAIN_RADIUS * cosu,
        0,
      ).normalize();
      const inPlane = new THREE.Vector3(tangent.y, -tangent.x, 0).normalize();
      // Right-handed basis: X = in-plane normal, Y = axis, Z = X × Y.
      const zAxis = new THREE.Vector3().crossVectors(inPlane, axis).normalize();
      const basis = new THREE.Matrix4().makeBasis(inPlane, axis, zAxis);

      const pivot = new THREE.Object3D();
      pivot.position.set(cx, cy, 0);
      pivot.quaternion.setFromRotationMatrix(basis);

      const material = new THREE.LineBasicMaterial({
        color: colorAt(i / (RING_COUNT - 1)),
        transparent: true,
        opacity: 0.9,
      });
      const line = new THREE.Line(ringGeometry, material);
      pivot.add(line);
      group.add(pivot);
      rings.push({ line, material });
    }

    // Tilt so we look at the donut in three-quarter view (its oval hole shows).
    group.rotation.x = 0.62;
    group.rotation.z = 0.12;

    // Per-ring "turning inside out" wave: each ring twists about its local axis
    // (rotation.y in the pivot frame = the donut's central axis), phase-offset
    // by its position so the twist travels around the loop like a wave rather
    // than the form spinning rigidly.
    const TWIST_AMP = 0.85; // radians of flip per ring
    const TWIST_SPEED = 0.00085; // radians per ms
    const TWIST_PHASE = (2 * Math.PI) / RING_COUNT; // one wave crest around the donut

    let autoRotate = true;
    let dragging = false;
    let prevX = 0;
    let prevY = 0;
    let velX = 0.0022;
    let velY = 0.0004;
    let idleTimeout = null;

    function onPointerDown(e) {
      dragging = true;
      autoRotate = false;
      prevX = e.clientX;
      prevY = e.clientY;
      renderer.domElement.setPointerCapture?.(e.pointerId);
      clearTimeout(idleTimeout);
    }
    function onPointerMove(e) {
      if (!dragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      group.rotation.y += dx * 0.006;
      group.rotation.x += dy * 0.006;
      velX = dx * 0.00025;
      velY = dy * 0.00025;
      prevX = e.clientX;
      prevY = e.clientY;
    }
    function onPointerUp() {
      dragging = false;
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        autoRotate = true;
      }, 1200);
    }

    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // --- Intro sequence (once per page load) ----------------------------------
    // Driven entirely from the animation loop against the frame clock — no
    // setTimeout and no CSS transition — so it is immune to React re-render
    // reverts and to timer throttling, and stays in sync with the spin.
    const wordmark = wordmarkRef.current;
    const REVEAL_DELAY = 550; // let the spin get going before the wordmark forms
    const REVEAL_MS = 1200;

    // progress 0 = tight, glowing, blurred cluster of light at the donut's core;
    // progress 1 = crisp, wide, letter-spaced white text in front of it.
    function setWordmark(p) {
      if (!wordmark) return;
      wordmark.style.opacity = String(p);
      wordmark.style.transform = `scale(${(1.15 - 0.15 * p).toFixed(4)})`;
      wordmark.style.filter = `blur(${(16 * (1 - p)).toFixed(2)}px)`;
      wordmark.style.letterSpacing = `${(0.04 + 0.31 * p).toFixed(4)}em`;
    }

    const playIntro = !hasIntroPlayed;
    const INTRO_SPIN_MS = 1500;
    const FAST_SPEED = 0.08; // rad/frame during the opening spin
    const IDLE_SPEED = 0.0028; // gentle resting rotation
    let introStart = null;
    let wordmarkResolved = false;

    if (playIntro) {
      hasIntroPlayed = true;
      setWordmark(0); // begin as the unresolved cluster
    } else {
      // Remount (StrictMode / route return): skip straight to the settled state.
      setWordmark(1);
      wordmarkResolved = true;
    }

    let frameId;
    function animate() {
      frameId = requestAnimationFrame(animate);

      const now = performance.now();

      // Almost-imperceptible starfield drift to sell depth and scale.
      stars.rotation.y += 0.00016;
      stars.rotation.x = Math.sin(now * 0.00004) * 0.02;

      // Per-ring inside-out twist wave.
      for (let i = 0; i < rings.length; i++) {
        rings[i].line.rotation.y =
          TWIST_AMP * Math.sin(now * TWIST_SPEED + i * TWIST_PHASE);
      }

      const elapsed = introStart !== null ? now - introStart : Infinity;

      if (autoRotate) {
        let speed = IDLE_SPEED;
        if (playIntro && elapsed < INTRO_SPIN_MS) {
          const p = elapsed / INTRO_SPIN_MS;
          const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
          speed = FAST_SPEED + (IDLE_SPEED - FAST_SPEED) * eased;
        }
        group.rotation.y += speed;
      } else if (!dragging) {
        group.rotation.y += velX;
        group.rotation.x += velY;
        velX *= 0.94;
        velY *= 0.94;
      }

      // Materialize the wordmark from the donut's core as the spin settles.
      if (playIntro && !wordmarkResolved) {
        const p = Math.min(Math.max((elapsed - REVEAL_DELAY) / REVEAL_MS, 0), 1);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        setWordmark(eased);
        if (p >= 1) wordmarkResolved = true;
      }

      renderer.render(scene, camera);
    }
    introStart = performance.now();
    animate();

    function onResize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    // Fallback for environments where the container mounts at zero width or
    // ResizeObserver fires late (background tabs, deferred layout, the
    // ssr:false hydration swap): poll a few frames until the container has
    // real dimensions, then let onResize size the canvas once.
    let initialSizeRaf;
    function ensureInitialSize() {
      if (mount.clientWidth > 0 && mount.clientHeight > 0) {
        onResize();
        return;
      }
      initialSizeRaf = requestAnimationFrame(ensureInitialSize);
    }
    if (width === 0 || height === 0) ensureInitialSize();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      cancelAnimationFrame(initialSizeRaf);
      clearTimeout(idleTimeout);
      resizeObserver.disconnect();
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      mount.removeChild(el);
      renderer.dispose();
      rings.forEach(({ material }) => material.dispose());
      ringGeometry.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      starTexture.dispose();
    };
  }, []);

  return (
    <div className="relative h-screen min-h-[600px] w-full overflow-hidden bg-[#05070D]">
      <div
        ref={mountRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      />
      {/* Wordmark overlay — non-interactive so drags pass through to the canvas.
          Its animated state is driven imperatively from the effect above. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <h1
          ref={wordmarkRef}
          // Starts hidden via the class (no flash before the effect runs). The
          // animated props — opacity, transform, filter, letter-spacing — are
          // set imperatively from the frame loop and are never in this JSX
          // style prop, so a React re-render can't revert them.
          className="select-none text-center font-semibold text-white opacity-0"
          style={{
            fontSize: 'clamp(2.5rem, 8vw, 6rem)',
            textIndent: '0.35em', // balance the trailing letter-spacing when centered
            textShadow:
              '0 0 24px rgba(120,160,255,0.55), 0 0 52px rgba(90,130,255,0.4), 0 2px 12px rgba(255,255,255,0.25)',
          }}
        >
          SEVYNDAY
        </h1>
      </div>
    </div>
  );
}
