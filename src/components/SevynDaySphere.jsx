import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Cinematic hero: a wireframe sphere woven from great-circle meridians — every
// loop passes through the same two poles, on the camera's view axis — floating
// in a dark, travelling starfield. On load a staged reveal plays: a solo "7"
// fades in and holds, the SEVYNDAY letters fan out from behind it, then the
// sphere emerges pole-on from a point of light and hands off into a slow
// figure-eight idle sweep. Drag rotates.
//
// Module-scoped so the intro sequence plays only ONCE per page load — a remount
// (route change back to home, or React StrictMode's dev double-invoke) skips
// straight to the settled state rather than replaying.
let hasIntroPlayed = false;

const SCENE_COLOR = '#05070D';

export default function SevynDaySphere() {
  const mountRef = useRef(null);
  const wordmarkRef = useRef(null);
  const sevenRef = useRef(null);

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
      // Translucent, with a slight per-loop variance so some loops feel
      // closer/brighter and others recede. baseOpacity is the settled value;
      // the intro fades from 0 up to it.
      const baseOpacity = 0.5 + Math.random() * 0.35; // ~0.5–0.85
      const material = new THREE.LineBasicMaterial({
        color: colorAt(i / (MERIDIAN_COUNT - 1)),
        transparent: true,
        opacity: baseOpacity,
      });
      const line = new THREE.Line(geometry, material);
      group.add(line);
      lines.push({ geometry, material, baseOpacity });
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

    // --- Intro reveal (once per page load) ------------------------------------
    // One staged sequence, driven off the frame clock so it stays in sync and
    // survives React re-renders / timer throttling:
    //   1) a solo "7" fades in slowly, then holds       (0    -> 2100ms)
    //   2) the letters fan out from behind the 7 as it   (2100 -> ~3860ms)
    //      fades away, assembling the wordmark
    //   3) sphere emerges: pole-on, scales from a        (2900 -> 5300ms)
    //      point of light + fades in (loops grow out)
    //   4) handoff: ease into the figure-eight idle      (5300 -> 5800ms)
    const playIntro = !hasIntroPlayed;
    // Mark the intro played on a *later* frame rather than synchronously, so
    // React StrictMode's mount → cleanup → remount (dev) doesn't set the flag
    // during the throwaway first mount and skip the visible play. A real
    // remount (route return) happens after this fires, so it still skips there.
    let introFlagRaf = requestAnimationFrame(() => {
      hasIntroPlayed = true;
    });

    const S1_FADE_MS = 1600; // stage 1: solo "7" fades in slowly
    const S1_HOLD_MS = 300; // brief hold on just the 7 once visible
    const S2_START = S1_FADE_MS + S1_HOLD_MS; // 2100: letters begin fanning out
    const S2_DUR = 1200; // base per-letter spread duration (~2x prior)
    const S2_STAGGER = 300; // extra start delay for the outermost letters
    const S2_FAR_DUR = 260; // extra duration for the outermost letters
    const SEVEN_FADE_MS = 650; // the 7 fades out as the letters take over
    const S3_START = 2900; // stage 3: sphere begins emerging (overlaps stage 2)
    const S3_DUR = 2400; // ~2x prior — slower circular emerge
    const S4_START = S3_START + S3_DUR; // 5300: handoff into idle
    const S4_DUR = 500;
    const EMERGE_SCALE = 0.05; // starting group scale — a near-point of light
    const easeOut = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);

    // Measure each letter's final offset from the wordmark centre, then give the
    // outermost letters a slightly later start and longer travel so the spread
    // reads organic rather than mechanical.
    const letters = [];
    if (wordmarkRef.current) {
      const spans = Array.from(wordmarkRef.current.querySelectorAll('[data-letter]'));
      // Clear any prior imperative transform (e.g. a previous StrictMode mount
      // left the letters stacked) so we measure the true final layout.
      spans.forEach((s) => (s.style.transform = 'none'));
      const wmRect = wordmarkRef.current.getBoundingClientRect();
      const wmCentre = wmRect.left + wmRect.width / 2;
      let maxOff = 1;
      const raw = spans.map((elm) => {
        const r = elm.getBoundingClientRect();
        return { el: elm, offsetX: r.left + r.width / 2 - wmCentre };
      });
      raw.forEach((L) => (maxOff = Math.max(maxOff, Math.abs(L.offsetX))));
      raw.forEach((L) => {
        const nd = Math.abs(L.offsetX) / maxOff; // 0 at centre, 1 at the edges
        letters.push({
          el: L.el,
          offsetX: L.offsetX,
          delay: nd * S2_STAGGER,
          dur: S2_DUR + nd * S2_FAR_DUR,
        });
      });
    }

    const sevenEl = sevenRef.current;

    // Stage 2: letters stay hidden behind the 7 through stage 1 (opacity 0,
    // stacked at centre), then fade in as they fan out to their final slots.
    // Opacity ramps a touch faster than the travel so each letter is clearly
    // visible on the way out rather than only at its destination.
    function applyLetters(t) {
      for (const L of letters) {
        const rel = t - S2_START - L.delay;
        const spread = easeOut(rel / L.dur);
        const op = easeOut(rel / (L.dur * 0.6));
        L.el.style.opacity = String(op);
        L.el.style.transform = `translateX(${(-L.offsetX * (1 - spread)).toFixed(2)}px)`;
      }
    }

    // Stage 1: the solo "7" fades in slowly, holds, then fades out gracefully as
    // the letters take its place (no abrupt disappearance).
    function applySeven(t) {
      if (!sevenEl) return;
      const op =
        t < S2_START
          ? easeOut(t / S1_FADE_MS) // fade in (clamps to 1 through the hold)
          : 1 - easeOut((t - S2_START) / SEVEN_FADE_MS); // fade out
      sevenEl.style.opacity = String(Math.max(0, op));
    }

    // Stage 3: sphere grows from a point of light (scale) and fades in (opacity).
    function applySphere(t) {
      const p = easeOut((t - S3_START) / S3_DUR);
      const s = EMERGE_SCALE + (1 - EMERGE_SCALE) * p;
      group.scale.set(s, s * 1.15, s);
      for (const L of lines) L.material.opacity = L.baseOpacity * p;
    }

    let introStart = null;
    let introLocked = false;
    if (playIntro) {
      applySeven(0); // begins invisible, fades in first
      applyLetters(0); // hidden, stacked behind the 7
      applySphere(0); // a near-invisible point
    } else {
      // Remount (StrictMode / route return): jump straight to the settled state.
      applySeven(1e6); // 7 gone
      applyLetters(1e6);
      applySphere(1e6);
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

      const seqT = playIntro ? now - introStart : 1e6;

      // Stages 1-3: drive the letters and the sphere emerge. Clamp to S4_START
      // so the final frame locks exactly at the settled state, then stop.
      // Drive the letters + sphere emerge until the sequence locks at the
      // settled state. Clamp to S4_START so even a first frame that arrives late
      // (e.g. a backgrounded tab during load) snaps to the full settled state
      // rather than leaving the hero hidden.
      if (playIntro && !introLocked) {
        const st = Math.min(seqT, S4_START);
        applySeven(st);
        applyLetters(st);
        applySphere(st);
        if (seqT >= S4_START) introLocked = true;
      }

      // Stage 4+: figure-eight idle, eased in over the handoff window so it
      // departs the pole-on emerge orientation smoothly rather than snapping.
      // During stages 1-3 fig.time is held at PI/2 → rotation (0,0,0), pole-on.
      const handoff = playIntro ? easeOut((seqT - S4_START) / S4_DUR) : 1;
      if (seqT >= S4_START && autoRotate && !dragging) {
        // Slow through the side-on extremes, quicker through the centre crossing
        // where the poles overlap.
        const nearCentre = 1 - Math.abs(Math.cos(fig.time));
        fig.time += fig.speed * (1 + fig.boost * nearCentre * nearCentre) * handoff;
      } else if (seqT >= S4_START && !dragging) {
        // Inertia carries the dragged base for a beat, then settles.
        baseYaw += velX;
        basePitch += velY;
        velX *= 0.94;
        velY *= 0.94;
      }

      // Figure-eight: yaw = A·cos(t), pitch = B·sin(2t) → horizontal infinity.
      group.rotation.z = 0;
      group.rotation.y = baseYaw + fig.ampX * Math.cos(fig.time);
      group.rotation.x = basePitch + fig.ampY * Math.sin(2 * fig.time);

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
      cancelAnimationFrame(introFlagRaf);
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
          The intro reveals a solo "7" first, then fans the letter spans out from
          behind it (both driven imperatively from the effect above). */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <h1
            ref={wordmarkRef}
            aria-label="SEVYNDAY"
            className="inline-flex select-none items-baseline font-semibold text-white"
            style={{
              fontSize: 'clamp(2.5rem, 8vw, 6rem)',
              gap: '0.3em',
              textShadow:
                '0 0 24px rgba(120,160,255,0.55), 0 0 52px rgba(90,130,255,0.4), 0 2px 12px rgba(255,255,255,0.25)',
            }}
          >
            {'SEVYNDAY'.split('').map((ch, i) => (
              <span
                key={i}
                data-letter
                aria-hidden="true"
                // Starts hidden; the effect drives opacity + translateX. Never
                // set here after mount, so a React re-render can't revert them.
                className="inline-block opacity-0"
                style={{ willChange: 'transform, opacity' }}
              >
                {ch}
              </span>
            ))}
          </h1>
          {/* Solo "7" — same font/colour/glow, centred over the wordmark box and
              stacked above the letters. Fades in first, then out (effect-driven). */}
          <span
            ref={sevenRef}
            aria-hidden="true"
            className="absolute inset-0 z-10 flex select-none items-center justify-center font-semibold text-white"
            style={{
              fontSize: 'clamp(2.5rem, 8vw, 6rem)',
              opacity: 0,
              willChange: 'opacity',
              textShadow:
                '0 0 24px rgba(120,160,255,0.55), 0 0 52px rgba(90,130,255,0.4), 0 2px 12px rgba(255,255,255,0.25)',
            }}
          >
            7
          </span>
        </div>
      </div>
    </div>
  );
}
