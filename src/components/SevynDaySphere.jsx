import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Cinematic hero: a wireframe sphere woven from great-circle meridians — every
// loop passes through the same two poles, evenly rotated around the polar axis —
// floating in a dark, foggy, star-flecked void. At rest the poles sit on a
// diagonal so the characteristic lens-shaped gap of empty space opens through
// the middle, with individual translucent oval loops bundled on each side. On
// first load it spins up, then eases into a slow idle as the SEVYNDAY wordmark
// materializes from its core. Drag to rotate.
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
    // Background stays null and the canvas clears fully transparent, so the
    // starfield renders across the ENTIRE canvas over the container's dark navy
    // rather than being masked by an opaque fill. Fog still fades the sphere's
    // far meridians toward the backdrop colour for depth (custom star shader is
    // unaffected, so distant stars stay visible).
    scene.fog = new THREE.FogExp2(SCENE_COLOR, 0.045);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0); // fully transparent clear
    mount.appendChild(renderer.domElement);

    // --- Starfield: a deep, wide, multi-layer field so the void reads as a
    // real universe. Per-point size + brightness come from BufferAttributes, so
    // most stars are tiny and dim while a ~3% subset reads as bright, closer
    // foreground stars. Three depth layers drift at different speeds for
    // parallax, with the near layer noticeably larger/brighter than the far.
    const starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#dce8ff') }, // silver / ice-blue
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uFar: { value: 160.0 }, // max camera-space depth (≈ camera z + far spread)
      },
      vertexShader: `
        attribute float aSize;
        attribute float aBrightness;
        uniform float uPixelRatio;
        uniform float uFar;
        varying float vBrightness;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          // Proximity: 0 when far, 1 as the star reaches the camera. Squared so
          // both size and brightness ramp up (accelerate) as it approaches —
          // this is what sells the travel-toward-viewer illusion.
          float p = clamp(1.0 - (-mvPosition.z) / uFar, 0.0, 1.0);
          p = p * p;
          gl_PointSize = aSize * uPixelRatio * (1.0 + p * 3.5);
          vBrightness = aBrightness * (0.9 + p * 0.4);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vBrightness;
        void main() {
          // Soft round point with a slightly brighter core.
          float d = length(gl_PointCoord - vec2(0.5));
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(uColor, a * vBrightness);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const rand = (a, b) => a + Math.random() * (b - a);
    const starLayers = [];

    function makeStarLayer({ count, zNear, zFar, spread, size, big, bright, speed }) {
      const positions = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const brights = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        // Symmetric, centered volume in x/y (scaled to the layer's depth so the
        // field fills the frame at every layer while still spilling past the
        // viewport edges); depth within this layer's band.
        positions[i * 3] = rand(-spread, spread);
        positions[i * 3 + 1] = rand(-spread, spread);
        positions[i * 3 + 2] = rand(zFar, zNear); // both negative (behind camera target)
        const isBig = Math.random() < 0.03; // ~3% brighter, larger foreground stars
        sizes[i] = isBig ? rand(big[0], big[1]) : rand(size[0], size[1]);
        brights[i] = isBig ? 1.0 : rand(bright[0], bright[1]);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
      geo.setAttribute('aBrightness', new THREE.BufferAttribute(brights, 1));
      const points = new THREE.Points(geo, starMaterial);
      points.frustumCulled = false; // very wide spread; never cull the field
      scene.add(points);
      // Keep the raw position array + params so the frame loop can march each
      // star toward the camera and recycle it when it passes the near plane.
      starLayers.push({ geo, positions, count, spread, speed });
    }

    // far (most stars, tiny & dim, widest spread, slowest) -> near (fewer,
    // larger & brighter, narrower spread, fastest so the foreground appears to
    // rush past). The far layer keeps the full ~120 half-extent so recycled
    // stars spill past every edge.
    makeStarLayer({ count: 2200, zNear: -100, zFar: -150, spread: 120, size: [1.0, 1.9], big: [3.0, 4.5], bright: [0.4, 0.65], speed: 0.05 });
    makeStarLayer({ count: 520, zNear: -55, zFar: -100, spread: 78, size: [1.5, 2.6], big: [4.0, 6.0], bright: [0.55, 0.8], speed: 0.09 });
    makeStarLayer({ count: 130, zNear: -15, zFar: -55, spread: 45, size: [2.5, 4.2], big: [6.0, 9.0], bright: [0.8, 1.0], speed: 0.16 });

    // --- The sphere, woven from great-circle meridians ------------------------
    // A single group holds every meridian; its orientation is driven by the
    // figure-eight sweep (and drag) below. The poles lie on the local Z axis so
    // that at rest one pole faces the camera (+Z) — the loops radiate from a
    // single convergence point at the visual centre.
    const group = new THREE.Group();
    scene.add(group);

    const MERIDIAN_COUNT = 20; // few enough that individual loops stay distinct
    const RADIUS = 2;
    const SEGMENTS = 128;

    // Monochrome silver / ice-blue gradient across the loop sequence — premium
    // against the dark navy (near-white -> pale silver-blue -> ice -> steel ->
    // deep navy-blue).
    const colorStops = [
      new THREE.Color('#F5F8FC'),
      new THREE.Color('#C9D9EC'),
      new THREE.Color('#8FB4DE'),
      new THREE.Color('#5A85B8'),
      new THREE.Color('#2E4C74'),
    ];

    function colorAt(t) {
      const scaled = Math.min(Math.max(t, 0), 1) * (colorStops.length - 1);
      const i = Math.min(Math.floor(scaled), colorStops.length - 2);
      const localT = scaled - i;
      return colorStops[i].clone().lerp(colorStops[i + 1], localT);
    }

    const lines = [];
    for (let i = 0; i < MERIDIAN_COUNT; i++) {
      // Meridians span theta 0..PI, each a full great circle through both poles
      // at (0, 0, ±RADIUS), evenly rotated around the polar (z) axis — so the
      // poles sit on the view axis and a pole faces the camera at rest.
      const theta = (Math.PI * i) / MERIDIAN_COUNT;
      const points = [];
      for (let j = 0; j <= SEGMENTS; j++) {
        const t = (2 * Math.PI * j) / SEGMENTS;
        const x = RADIUS * Math.sin(t) * Math.cos(theta);
        const y = RADIUS * Math.sin(t) * Math.sin(theta);
        const z = RADIUS * Math.cos(t);
        points.push(new THREE.Vector3(x, y, z));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: colorAt(i / (MERIDIAN_COUNT - 1)),
        transparent: true,
        // Translucent, with a slight per-loop variance so some loops feel
        // closer/brighter and others recede — adds depth to the sphere itself.
        opacity: 0.5 + Math.random() * 0.35, // ~0.5–0.85
      });
      const line = new THREE.Line(geometry, material);
      group.add(line);
      lines.push({ geometry, material });
    }

    // Slight oval stretch (transverse to the pole axis) so the radiating
    // starburst reads as an ellipse rather than a perfect disc.
    group.scale.set(1, 1.15, 1);

    // Idle motion: a slow Lissajous (1:2) figure-eight sweep of the orientation,
    // applied as small yaw/pitch offsets around the resting pole-forward base
    // (baseYaw / basePitch, both 0 at rest, nudged by drag). figureTime starts
    // at PI/2 so cos()/sin(2·) are both 0 — the pole begins dead-centre.
    // Figure-eight state. Amplitudes tuned against the SEVYNDAY text so the
    // convergence dot's sweep roughly matches its dimensions: the vertical
    // sweep sits just beyond the text height, and the horizontal sweep fills
    // most of the width (the sphere's projected diameter is the hard ceiling —
    // it can't reach past the text edges). `time` starts at PI/2 so yaw/pitch
    // are both 0 and the pole begins dead-centre.
    // `speed` is the slow baseline; `boost` accelerates the sweep through the
    // centre crossing where the two convergence poles overlap. speed·(1+boost)
    // ≈ 0.01 keeps the centre burst the same while the slow part runs a touch
    // quicker than before.
    const fig = { ampX: 0.79, ampY: 0.2, speed: 0.0035, boost: 1.85, time: Math.PI / 2 };
    let baseYaw = 0;
    let basePitch = 0;
    let spinZ = 0; // intro spin-up around the pole (view) axis

    let autoRotate = true; // figure-eight advancing (idle)
    let dragging = false;
    let prevX = 0;
    let prevY = 0;
    let velX = 0;
    let velY = 0;
    let idleTimeout = null;

    function onPointerDown(e) {
      dragging = true;
      autoRotate = false; // freeze the figure-eight time while dragging
      prevX = e.clientX;
      prevY = e.clientY;
      renderer.domElement.setPointerCapture?.(e.pointerId);
      clearTimeout(idleTimeout);
    }
    function onPointerMove(e) {
      if (!dragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      // Drag nudges the base orientation the figure-eight oscillates around, so
      // on release the sweep resumes from here with no snap.
      baseYaw += dx * 0.006;
      basePitch += dy * 0.006;
      velX = dx * 0.00025;
      velY = dy * 0.00025;
      prevX = e.clientX;
      prevY = e.clientY;
    }
    function onPointerUp() {
      dragging = false;
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        autoRotate = true; // resume the figure-eight from the current time offset
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

    // progress 0 = tight, glowing, blurred cluster of light at the sphere's core;
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
    const FAST_SPEED = 0.08; // rad/frame: opening spin-up around the pole axis
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

      // Travel-through-space: march every star toward the camera along +Z. When
      // one passes the near plane, recycle it to the far distance at a fresh
      // x/y within its layer's spread, so the tunnel is seamlessly replenished.
      // (Size/brightness ramp with proximity happens in the star shader.)
      const NEAR_Z = -2;
      const RESET_Z = -150;
      for (const layer of starLayers) {
        const pos = layer.positions;
        for (let i = 0; i < layer.count; i++) {
          const zi = i * 3 + 2;
          let z = pos[zi] + layer.speed;
          if (z > NEAR_Z) {
            z = RESET_Z;
            pos[i * 3] = rand(-layer.spread, layer.spread);
            pos[i * 3 + 1] = rand(-layer.spread, layer.spread);
          }
          pos[zi] = z;
        }
        layer.geo.attributes.position.needsUpdate = true;
      }

      const elapsed = introStart !== null ? now - introStart : Infinity;
      const introSpinning = playIntro && elapsed < INTRO_SPIN_MS;

      // Intro: spin the starburst around its pole (view) axis, easing to a stop.
      // This leaves the pole dead-centre while the wordmark materializes.
      if (introSpinning) {
        const p = elapsed / INTRO_SPIN_MS;
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        spinZ += FAST_SPEED * (1 - eased);
      }

      // Advance the figure-eight only once the intro spin is done and the sweep
      // is active (paused while dragging and during the post-release hold).
      if (!introSpinning && autoRotate && !dragging) {
        // Slow (25%) through the side-on extremes, quicker through the centre
        // crossing where the poles overlap. |cos(time)| is 1 at the extremes and
        // 0 at the crossing, so nearCentre ramps 0 -> 1 approaching centre.
        const nearCentre = 1 - Math.abs(Math.cos(fig.time));
        fig.time += fig.speed * (1 + fig.boost * nearCentre * nearCentre);
      } else if (!introSpinning && !dragging) {
        // Inertia carries the dragged base for a beat, then settles.
        baseYaw += velX;
        basePitch += velY;
        velX *= 0.94;
        velY *= 0.94;
      }

      // Figure-eight: yaw = A·cos(t), pitch = B·sin(2t) → horizontal infinity.
      group.rotation.z = spinZ;
      group.rotation.y = baseYaw + fig.ampX * Math.cos(fig.time);
      group.rotation.x = basePitch + fig.ampY * Math.sin(2 * fig.time);

      // Materialize the wordmark from the sphere's core as the spin settles.
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
      lines.forEach(({ geometry, material }) => {
        geometry.dispose();
        material.dispose();
      });
      starLayers.forEach(({ geo }) => geo.dispose());
      starMaterial.dispose();
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
