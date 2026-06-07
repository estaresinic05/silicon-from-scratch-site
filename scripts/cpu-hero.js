/* =========================================================================
   Silicon From Scratch — cpu-hero.js
   Phase 3: two photoreal CPUs sharing one stage.

   Both chips live in a SINGLE renderer / scene / canvas that spans the whole
   section. One shared canvas (rather than one per chip) means:
     - no clip seam where the chips meet — there's no canvas edge between them;
     - they depth-sort against each other, so they can genuinely overlap;
     - the transparent canvas sits over the text, so the chips overlap it too.

   Motion (driven by GSAP ScrollTrigger, already loaded for the rest of the
   site). As the section climbs from the bottom of the screen to the top:
     - chip A (left) runs the turntable: a full-ish spin landing lid-up, tilted
       toward the camera (BASE_TILT);
     - chip B (right) starts in the model's raw default pose and sweeps +90° on
       both Y and X.
   No pinning — the page scrolls straight through; stop and the chips hold pose.

   Safety / progressive enhancement (mirrors scroll.js):
   - A static circuit emblem fills the stage by default (it doubles as the load
     state). We only hide it (add `.cpu-ready` to <html>) once the chips are
     rendered. Any failure — no WebGL, blocked CDN, no GSAP, ignored ES
     modules — leaves that emblem in place with no layout shift.
   - prefers-reduced-motion (or no GSAP): we still show the chips, but in a
     clean static framing with no scroll animation.

   The GLB uses EXT_meshopt_compression + KHR_mesh_quantization, so we wire up
   MeshoptDecoder (quantization is handled by GLTFLoader automatically).
   ========================================================================= */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

(function () {
  "use strict";

  var root = document.documentElement;
  var layout = document.querySelector("[data-cpu-layout]");
  if (!layout) return;
  var stage = layout.querySelector(".cpu-stage__stage"); // mobile canvas home

  var prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function lerp(a, b, t) { return a + (b - a) * t; }

  var MODEL_URL = "assets/cpu_ryzen_7600x.glb";

  /* ----- motion tuning (the knobs to fine-tune) ----- */
  var BASE_TILT = -0.52;             // chip A's fixed lid-toward-camera tilt (radians)
  var APPROACH_START  = "top bottom"; // section just entering at the bottom
  var APPROACH_END    = "top top";    // section top reaches the top of the screen
  // Chip A (turntable). Lands with the front face 25° short of vertical toward
  // the camera; effective pitch = BASE_TILT + spin.x, so back out BASE_TILT.
  var LAND_PITCH = (65 * Math.PI) / 180 - BASE_TILT;
  var APPROACH_X_FROM = -1.6 * Math.PI;  var APPROACH_X_TO = LAND_PITCH;
  var APPROACH_Y_FROM = -Math.PI;        var APPROACH_Y_TO = 0.35;
  var STATIC_YAW   = 0.35;            // chip A rest pose (reduced motion)
  var STATIC_PITCH = LAND_PITCH;
  // Chip B (right) — starts tilted slightly back (negative X shows its back),
  // then turns to its front-facing end pose after only a little scroll, holding
  // there for the rest of the approach. The end pose (Y/X = 90°) is unchanged.
  // End poses (…_TO) are locked — these are the "perfect" landings. To make the
  // right chip rotate around more on the way in, only the start (…_FROM) moves;
  // starting a full turn before the end means it spins 360° and lands identically.
  var SPIN_Y_TO   = (-15 * Math.PI) / 180;                 // locked end pose
  var SPIN_Y_FROM = SPIN_Y_TO - 2 * Math.PI;               // a full extra Y revolution in
  var SPIN_X_FROM = -0.4;  var SPIN_X_TO = (75 * Math.PI) / 180;   // back → front, stops short
  // Chip B holds its back-facing start pose until SPIN_START of the approach
  // (so the back is on screen first), then turns to its end pose by SPIN_END and
  // holds. Both are fractions of the approach scroll; the window between them is
  // the "little bit of scroll" over which it flips.
  var SPIN_START  = 0.35;
  var SPIN_END    = 1;     // finish at the end of the approach, like the left chip
  var SCRUB      = 0.6;               // scrub smoothing (seconds of catch-up; 0 = exact)

  /* ----- placement tuning (single shared scene) -----
     World units. Each chip is normalised so its largest dimension is CHIP_SIZE.
     The camera looks at the origin from `camDist`; x=0 is the centre of the
     stage. Larger camDist = smaller chips. Nudge aX/bX toward each other to
     overlap more, or negative to spill left over the text. */
  var CHIP_SIZE = 2.4;
  /* Two placements, swapped at the 768px breakpoint by applyPlacement().
     DESKTOP keeps both chips off to the right so they clear the 36%-wide text
     column and can overlap it. On phones the section stacks (text above, stage
     below) and the canvas is mounted into the stage box ONLY, so the chips can
     never cover the text; there we re-centre the pair around x=0 and pull the
     camera back a touch so both fit the narrower, squarer stage. */
  var DESKTOP = { camDist: 8,   aX: 0.5,  aY: 0, bX: 3.3, bY: 0 };
  var MOBILE  = { camDist: 9.5, aX: -1.4, aY: 0, bX: 1.4, bY: 0 };

  /* ----- renderer (bail to static fallback if WebGL is unavailable) ----- */
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    return; // emblem stays put
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;          // bright enough for the metal to read
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  var canvas = renderer.domElement;
  canvas.classList.add("cpu-stage__canvas");
  // The canvas is mounted by applyPlacement(): the whole layout on desktop (so
  // the chips can overlap the text), or the stage box alone on phones.

  var scene = new THREE.Scene();

  /* Image-based lighting + three directionals so the brushed-metal lid stays
     bright and metallic across the turn (env alone leaves it dark). */
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  function addLight(intensity, x, y, z) {
    var l = new THREE.DirectionalLight(0xffffff, intensity);
    l.position.set(x, y, z);
    scene.add(l);
  }
  addLight(2.0, 2.5, 4, 3);    // key
  addLight(1.0, -3, 1.5, -2);  // fill
  addLight(1.2, 0, 5, 0.5);    // top

  var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, DESKTOP.camDist);   // overwritten by applyPlacement()
  camera.lookAt(0, 0, 0);

  /* Each chip is a small group hierarchy:
       outer (world placement) > [tilt] > spin (scroll-driven) > model
     Chip A carries the lid-toward-camera tilt; chip B reads flat. */
  var outerA = new THREE.Group(); scene.add(outerA);   // placed by applyPlacement()
  var tiltA  = new THREE.Group(); tiltA.rotation.x = BASE_TILT; outerA.add(tiltA);
  var spinA  = new THREE.Group(); tiltA.add(spinA);

  var outerB = new THREE.Group(); scene.add(outerB);   // placed by applyPlacement()
  var spinB  = new THREE.Group(); outerB.add(spinB);

  var loaded = false;

  /* Mount the canvas + place the chips/camera for the current breakpoint. The
     canvas only changes parent when we actually cross the breakpoint, so normal
     resizes (or scrolling) don't churn the DOM. */
  var mount = null;          // the canvas's current parent element
  var currentMobile = null;  // last breakpoint we mounted for (null = unmounted)

  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function applyPlacement() {
    var mobile = isMobile();
    var P = mobile ? MOBILE : DESKTOP;
    outerA.position.set(P.aX, P.aY, 0);
    outerB.position.set(P.bX, P.bY, 0);
    camera.position.z = P.camDist;

    if (mobile !== currentMobile) {
      currentMobile = mobile;
      var target = (mobile && stage) ? stage : layout;
      if (target !== mount) {
        mount = target;
        mount.appendChild(canvas);
      }
    }
  }

  function poseA(yaw, pitch) { spinA.rotation.y = yaw; spinA.rotation.x = pitch; }
  function poseB(yaw, pitch) { spinB.rotation.y = yaw; spinB.rotation.x = pitch; }
  function render() { renderer.render(scene, camera); }

  function normalise(model) {
    // Centre + normalise size regardless of source units, and brighten the
    // metal's environment reflections.
    var box = new THREE.Box3().setFromObject(model);
    var size = box.getSize(new THREE.Vector3());
    model.position.sub(box.getCenter(new THREE.Vector3()));
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    model.scale.setScalar(CHIP_SIZE / maxDim);
    model.traverse(function (o) {
      if (o.isMesh && o.material) o.material.envMapIntensity = 2.6;
    });
  }

  function resize() {
    var el = mount || layout;                   // size to whatever the canvas lives in
    var w = el.clientWidth || 1;
    var h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (loaded) render();
  }
  // Re-evaluate the breakpoint (may re-mount + re-place) before re-sizing.
  window.addEventListener("resize", function () { applyPlacement(); resize(); });

  function gsapReady() { return window.gsap && window.ScrollTrigger; }

  /* Scroll choreography (no pinning): scrub both chips' rotation as the section
     climbs from the bottom of the screen up to the top, landing on the chosen
     poses. The page scrolls straight through — nothing ever sticks. */
  function setupScroll() {
    gsap.registerPlugin(ScrollTrigger);

    var ap = { p: 0 };
    gsap.to(ap, {
      p: 1,
      ease: "none",
      onUpdate: function () {
        poseA(lerp(APPROACH_Y_FROM, APPROACH_Y_TO, ap.p),
              lerp(APPROACH_X_FROM, APPROACH_X_TO, ap.p));
        // Chip B holds its back pose until SPIN_START, then turns to its end
        // pose over the short [SPIN_START, SPIN_END] window and holds.
        var span = (SPIN_END - SPIN_START) || 1;
        var bp = Math.min(Math.max((ap.p - SPIN_START) / span, 0), 1);
        poseB(lerp(SPIN_Y_FROM, SPIN_Y_TO, bp),
              lerp(SPIN_X_FROM, SPIN_X_TO, bp));
        render();
      },
      scrollTrigger: {
        trigger: layout.closest(".cpu-stage") || layout,
        start: APPROACH_START,
        end: APPROACH_END,
        scrub: SCRUB
      }
    });

    poseA(APPROACH_Y_FROM, APPROACH_X_FROM); // initial pre-roll poses
    poseB(SPIN_Y_FROM, SPIN_X_FROM);
    render();
    // Re-measure once everything (fonts/images/this canvas) has settled.
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  }

  /* ----- load the model (once) and clone it for the second chip ----- */
  var loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    MODEL_URL,
    function (gltf) {
      var modelA = gltf.scene;
      var modelB = modelA.clone(true);   // shares geometry/material; own transform
      normalise(modelA);
      normalise(modelB);
      spinA.add(modelA);
      spinB.add(modelB);

      applyPlacement();   // mount the canvas + place chips for this breakpoint
      resize();
      loaded = true;
      root.classList.add("cpu-ready");

      if (prefersReduced) {
        poseA(STATIC_YAW, STATIC_PITCH);   // clean static framing, no scroll
        poseB(SPIN_Y_TO, SPIN_X_TO);       // front-facing end pose
        render();
      } else if (gsapReady()) {
        setupScroll();
      } else {
        // GSAP not loaded yet — try again once the page has fully loaded.
        poseA(STATIC_YAW, STATIC_PITCH);
        poseB(SPIN_Y_TO, SPIN_X_TO);       // front-facing end pose
        render();
        window.addEventListener("load", function () {
          if (gsapReady()) setupScroll();
        });
      }
    },
    undefined,
    function (err) {
      console.warn("[cpu-hero] model failed to load:", err);
    }
  );
})();
