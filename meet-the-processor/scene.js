/* =========================================================================
   Inside the Die — scroll-driven descent through a Ryzen 5 9600X
   PROTOTYPE. Standalone: imports only the vendored three.js beside it.

   Scale: 1 unit = 1 mm. The AM5 package is 40 mm square; the Zen 5 CCD is
   9.07 x 7.78 mm. The die's position on the substrate was measured from the
   delid photograph (67.53 px/mm), so the 3D die sits exactly on top of its
   photographic twin and the hand-off between them is seamless.

   The metal stack is the one deliberate exaggeration: it is scaled ~400x
   vertically, because real back-end-of-line wiring is a few micrometres tall
   on a die millimetres wide and would otherwise be invisible.

   CONTENTS
   1. Constants & stage script
   2. Renderer, scene, environment
   3. Textures
   4. Package: substrate, contact pads, IHS lid
   5. Die: silicon, surfaces, region overlays, metal stack, transistors
   6. Hit regions & label anchors
   7. Camera path
   8. Scroll, labels, picking
   9. Per-scroll scene state
  10. Loop
   ========================================================================= */

import * as THREE from 'three';

/* ------------------------------------------------------------------ *
   1. CONSTANTS & STAGE SCRIPT
 * ------------------------------------------------------------------ */

const DIE_W = 9.07;
const DIE_H = 7.78;
/* True to life for a thinned CCD, and left that way. An earlier pass pushed it
   to 1.65 to make the die's edge read during the low sweep across the floorplan;
   that worked but it made the dies wrong everywhere else. The edge is kept
   visible by where the CAMERA sits and by the side material below, not by
   inflating the object. */
const DIE_T = 0.62;

const PKG = 40;               // AM5 package, 40 mm square
const PKG_T = 2.0;

/* Measured off the delid photo relative to the package centre. The package
   square is 2653 px across in all three photographs (x 150–2803, y 148–2802),
   i.e. 66.33 px/mm — NOT the 2701 px used earlier, which stretched every
   package texture by ~1.8% and left the dies sitting off their photographs. */
const DIE_OFF_X = 4.82;
const DIE_OFF_Z = 8.80;
/* I/O die, measured the same way. 12.51 x 9.70 mm works out to 121.4 mm²
   against the ~122 mm² published for the Granite Ridge I/O die — an
   independent check that the px/mm mapping is right. */
const IOD_X = 0.02, IOD_Z = -3.35, IOD_W = 12.74, IOD_H = 9.88;

/* IHS: 38.12 x 37.81 mm, centred on the package. Its silhouette and the
   outline of its raised platform are traced from the photograph and live in
   assets/lid-outline.json — see shapeFromPoints() for why.

   Read the lid as a SQUARE with eight fins hanging off it: four corner arms
   and four mid-edge tabs. The raised platform covers that square (29.03 x
   28.98 mm) AND reaches out into every fin, stopping where the grey changes:
   each outer edge carries a darker, coarser band that is the lower flange
   face. Along every edge the two share — the square runs and both flanks of
   every tab — the platform is FLUSH, its step face being the lid's edge.

   The step is one machined 1.49 mm all the way round (measured per fin: tabs
   1.28-1.58, arms 1.40-1.70). The platform is the flange intersected with the
   lid's outer perimeter — taken as the CONVEX HULL of the outline, so the
   notches are bridged straight — inset by that step, with each tab then cut by
   its own measured line so its flanks stay flush. Where that cut meets each
   flank the platform is filleted 0.25 mm, deliberately slighter than the
   0.70 mm on the flange's own tab corners. Boundary vertices within
   0.08 mm of the flange are pinned onto the flange polyline itself, so 66% of
   the platform outline is literally the flange's own.

   Audited over the whole perimeter, not just the square runs: it resolves into
   16 alternating runs, 8 flush and 8 inset, none shorter than 0.5 mm, with the
   two edges a mean 0.0015 mm apart across the 110 mm of flush perimeter. The
   square runs are 100% flush and dead straight — the outline had picked up a
   0.27 mm bulge from the capacitor bank sitting against the right edge, since
   those parts are bright AND desaturated and so pass the lid test.

   The outline is also trimmed off the substrate — as traced it ran ~0.45 mm
   wide of the real metal on both flanks of every mid-edge tab, which textured
   teal onto the fin sides — and then low-passed along arc length at
   sigma 0.30 mm, which takes curvature sign changes from 2.91/mm to 0.78/mm
   and cleans up the lumpy fin edges.

   The four mid-edge tabs are then BUILT rather than traced: rounded
   rectangles at the measured width and reach, 0.70 mm fillet on all four
   corners. Note they are not all one size — left/right are 8.18 mm wide
   against 3.75 mm for top/bottom. The corner arms stay traced.

   Because those built corners sit slightly outside the real metal, ihs.jpg is
   edge-extended: everything outside the lid is replaced by its nearest metal
   colour, so the silhouette comes from the geometry alone and no teal can
   leak onto a fin. See the README. */
const LID_W = 37.83, LID_H = 37.75;
const LID_CX = -0.10, LID_CZ = -0.08;

const FLANGE_T = 1.2;
const PLATEAU_RISE = 1.7;

// Package centre in world space (the die itself sits at the world origin).
const PCX = -DIE_OFF_X, PCZ = -DIE_OFF_Z;

const N_METAL = 15;
const LAYER_GAP = 0.30;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = window.matchMedia('(max-width: 860px)').matches;

/* One caption per arrow stop, so the counter, the rail ticks and the arrows all
   agree. There used to be nine, which made a single press of the forward arrow
   jump the counter by two.

   Stages 03 and 04 used to end with "Click any region to read about it". They no
   longer do. The affordance layer says it in three places already — the hint
   line under the nav, the tag on the block, and the demonstration itself — and a
   fourth telling, in the one piece of prose on screen whose job is to explain
   what you are looking at, was the one that could be given up.

   Each `t` is its stop's t exactly, so the card swaps on ARRIVAL: the caption
   always describes where you are, never where you are heading. Collapsing nine
   into seven meant merging rather than dropping — "The lid comes off" and "Two
   dies, not one" both fell inside the leg that ends at bare silicon, so their
   substance is folded into that card. */
const STAGES = [
  { t: 0.000, num: '01', title: 'The Packaged Chip',
    body: 'A Ryzen 5 9600X as it arrives: a 40 mm square of fibreglass and copper under a nickel-plated lid. Nothing you can see yet does any computing.' },
  { t: 0.398, num: '02', title: 'Bare Silicon',
    body: 'The lid lifts away, and underneath sit two separate pieces of silicon: a compute die carrying the cores, and an I/O die handling memory and PCIe. Up close both are just polished silicon, scratched and dusty, because you are looking at the back of the die. Everything that matters is buried beneath this surface.' },
  { t: 0.512, num: '03', title: 'The Floorplan Beneath',
    /* "along the edge facing the I/O die", not "beneath them": the photograph
       is laid down a half turn round so the IFOP PHY faces the die it talks to,
       and the strip is now at the far edge of the frame rather than the near
       one. See the half turn above CORE_U. */
    body: 'The underside of the compute die is where the magic happens. Eight Zen 5 cores flank a shared 32 MB L3 cache, and a strip of support logic runs the width of the die along the edge facing the I/O die. On a 9600X, six of those eight cores are enabled.' },
  { t: 0.800, num: '04', title: 'Inside One Core',
    body: 'A single core is a complete computer in miniature. It keeps its own private L1 and L2 caches close at hand, its own logic for fetching instructions and predicting branches, its own registers, and separate execution units for integer work, for vector and floating point calculations, and for the loads and stores that reach out to memory. All of it is repeated eight times across the die.' },
  { t: 0.888, num: '05', title: 'The Metal Stack',
    body: 'A transistor does nothing until something connects it, and that job belongs to the copper stacked overhead. The lowest tiers are thin and packed tightly together for short hops inside a block, while the highest are thick and widely spaced so they can carry power and the clock clear across the die. Each tier runs at right angles to the one beneath it, which is what lets wires cross without ever touching. The short pillars standing between the tiers are vias, and they are the only way a signal changes level. The balls settling on top at the end are solder bumps, where the finished die is joined face down to its package.' },
  { t: 0.966, num: '06', title: 'The Cell Rows',
    body: 'The stack folds back down onto the lowest layer of metal, and underneath it the design stops being wiring and becomes logic. Every gate in the processor is one of a few hundred prebuilt tiles taken from a standard cell library, and each of those tiles is drawn to exactly the same height so that it can be dropped into a row and pushed up against its neighbours with nothing wasted in between. Power and ground run the length of every row boundary and are shared by the rows above and below, which is why one row is the mirror of the next.' },
  { t: 0.990, num: '07', title: 'A Closer Look',
    /* Upper and lower here describe the SCREEN, not the scene's z axis. The
       camera at this stop puts VDD along the bottom of the frame, so the PMOS
       half sits low and the NMOS half sits high, which is the reverse of the
       way a standard cell is conventionally drawn on paper. The caption has to
       match the picture the reader is looking at. */
    body: 'This is a CMOS inverter, the smallest arrangement of transistors that still counts as a logic gate. The lower half sits inside an n-well and carries the PMOS transistors, tied to the supply rail running beneath them, while the upper half carries the NMOS, tied to the ground rail above. A single strip of poly crosses both halves as one shared gate. Drive the input high and the NMOS conducts while the PMOS shuts off, so the output is pulled down to ground. Drive it low and the pair swap jobs and the output is pulled up to the supply. Every gate on this die, and every 2x1 multiplexer built out of them, is that same complementary pair repeated.' },
];

/* ------------------------------------------------------------------ *
   2. RENDERER, SCENE, ENVIRONMENT
 * ------------------------------------------------------------------ */

const canvas = document.getElementById('gl');
/* This scene is FILL-RATE bound, not geometry bound, and every performance
   decision below follows from that one measurement: the floorplan stage draws 152
   triangles and costs more per frame than the metal stack's 33,114. Draw calls
   peak at 142 and triangles at 33k, both trivial. What costs is fragments —
   large transparent surfaces with expensive shaders, several deep.

   So: do not bother batching geometry or merging meshes here. Spend the effort on
   fragment count, shader cost per fragment, and overdraw. `verify/perf.py` walks
   every stage and prints draws / triangles / frame time; re-run it after touching
   any of this rather than assuming.

   MSAA is now ON UNCONDITIONALLY, and this is a deliberate reversal.

   The rule used to be `antialias: DPR < 1.5`, on the argument that MSAA and
   supersampling buy the same anti-aliasing, so above a 1.5 device ratio the
   extra samples already smooth edges and multisampling on top pays twice. The
   argument is sound about AVERAGE quality and wrong about the worst case. They
   are not equivalent on a silhouette: downsampling a 2x buffer gives an edge
   three intermediate levels, where 4x MSAA gives it five, and it does so only
   where geometry actually crosses a pixel rather than everywhere. On this scene
   that difference is visible, because the whole piece is high-contrast
   silhouettes — bright slabs and a lit die against a near-black background — at
   raking angles, which is the case supersampling handles least well. The edges
   read as stepped on a 1.5 or 2.0 ratio display, which is most laptops, and that
   is exactly where the old rule turned MSAA off.

   It is bought with fragments, which the note above rightly says there is no
   room for, so measure rather than assume: verify/perf.py walks every stage. */
const DPR = Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2);
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance',
  /* Transparent canvas, so the PAGE is the backdrop rather than the scene.
     The site's ambient violet field lives in CSS on a fixed layer; with an
     opaque clear colour the canvas covered the whole viewport and that layer
     could never be seen. Now empty space shows the page ground and its hue,
     and only actual geometry is drawn by WebGL. Fog still fades distant
     geometry to the same ground colour, so the two meet seamlessly. */
  alpha: true,
});
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
/* Capped at 8, not the driver's maximum. Anisotropic filtering earns its keep on
   these die photographs — they are viewed at raking angles for most of the piece,
   which is exactly what it is for — but the maximum is 16 on most GPUs, i.e. 16
   texture samples per fragment on surfaces that fill the screen. Halving it is
   not something the eye can find at these angles and this is a fill-rate bound
   scene. */
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;

const scene = new THREE.Scene();
/* No scene.background: the canvas is transparent (see the renderer above) and
   the page behind it supplies the ground. Fog keeps the site's ground colour so
   geometry receding into the distance meets the CSS backdrop without a seam. */
// far enough out that the 40 mm package, viewed from ~80 units, stays clear
scene.fog = new THREE.Fog(0x08080b, 130, 400);

const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.05, 600);

function buildEnvironment() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new THREE.Scene();
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.deleteAttribute('uv');

  const shell = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ side: THREE.BackSide }));
  shell.scale.set(140, 90, 140);
  room.add(shell);

  const panel = (w, h, d, x, y, z, intensity, color) => {
    const m = new THREE.Mesh(box, new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: new THREE.Color(color), emissiveIntensity: intensity,
    }));
    m.scale.set(w, h, d); m.position.set(x, y, z);
    room.add(m);
  };
  panel(70, 2, 70,  10, 42, -8, 5.4, 0xffffff);
  panel(2, 40, 60, -66, 14,  0, 2.2, 0x9fc4ff);
  panel(2, 40, 60,  66, 14,  8, 1.6, 0xffd9b0);
  panel(60, 2, 60,   0, -34, 0, 0.7, 0x5566aa);

  const env = pmrem.fromScene(room, 0.035).texture;
  pmrem.dispose();
  return env;
}
scene.environment = buildEnvironment();
scene.environmentIntensity = 0.55;

const key = new THREE.DirectionalLight(0xffffff, 1.15);
key.position.set(20, 46, 26);
scene.add(key);
const rim = new THREE.DirectionalLight(0x8fa6ff, 0.34);
rim.position.set(-30, 14, -26);
scene.add(rim);
scene.add(new THREE.AmbientLight(0x3d4557, 0.35));

/* ------------------------------------------------------------------ *
   3. TEXTURES
 * ------------------------------------------------------------------ */

const loader = new THREE.TextureLoader();
const loadTex = (url, srgb = true) => new Promise((res, rej) => {
  loader.load(url, (t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = ANISO;
    res(t);
  }, undefined, rej);
});

function routingTexture(tier) {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');

  const t = tier / (N_METAL - 1);
  const pitch = 7 + Math.pow(t, 1.7) * 62;
  const width = 2 + Math.pow(t, 1.6) * 26;
  const horizontal = tier % 2 === 0;

  /* Wire colour by level. The lowest levels are barely copper to the eye — thin,
     dull, closer to tungsten — and each level up is warmer and brighter. Tinting
     the MATERIAL cannot do this, because a tint multiplies an already-orange map
     and everything stays orange; the colour has to go into the texture. This is
     what lets the eye read HEIGHT from appearance instead of counting sheets. */
  const mix = (a, b, u) => '#' + [0, 1, 2].map((k) => {
    const av = parseInt(a.slice(1 + k * 2, 3 + k * 2), 16);
    const bv = parseInt(b.slice(1 + k * 2, 3 + k * 2), 16);
    return Math.round(av + (bv - av) * u).toString(16).padStart(2, '0');
  }).join('');
  g.fillStyle = mix('#8e8a85', '#d98a44', Math.pow(t, 0.75));
  for (let p = pitch * 0.5; p < S; p += pitch) {
    let a = 0;
    while (a < S) {
      const seg = 40 + Math.random() * (120 + t * 260);
      const gapLen = 6 + Math.random() * 22;
      const len = Math.min(seg, S - a);
      if (horizontal) g.fillRect(a, p - width / 2, len, width);
      else g.fillRect(p - width / 2, a, width, len);
      a += len + gapLen;
    }
  }
  g.fillStyle = mix('#bdb9b3', '#f2c78e', Math.pow(t, 0.75));
  const padStep = pitch * (1.6 + t * 2.2);
  for (let x = padStep * 0.5; x < S; x += padStep) {
    for (let y = padStep * 0.5; y < S; y += padStep) {
      if (Math.random() < 0.55) {
        const s = width * 0.95 + 1.5;
        g.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const rep = 5 - t * 3.2;
  tex.repeat.set(rep * (DIE_W / DIE_H), rep);
  tex.anisotropy = ANISO;
  return tex;
}

/* ------------------------------------------------------------------ *
   4. PACKAGE
 * ------------------------------------------------------------------ */

/* assembly's own origin is the PACKAGE centre, so the flip in stage 02
   rotates about the package rather than about the die. Offsetting the whole
   assembly then puts the die itself at the world origin, which is what every
   later camera key is written against. */
const assembly = new THREE.Group();
assembly.position.set(PCX, 0, PCZ);
scene.add(assembly);

const pkg = new THREE.Group();
assembly.add(pkg);

const pkgTopMat = new THREE.MeshPhysicalMaterial({
  transparent: true, roughness: 0.55, metalness: 0.1, clearcoat: 0.25,
});
const pkgSideMat = new THREE.MeshStandardMaterial({
  color: 0x0d5f6b, roughness: 0.7, metalness: 0.1, transparent: true,
});

/* The top photographic face sits just OUTSIDE the body, and the body is inset
   behind it, so the two do not z-fight. PKG_BOT_Y is still the underside of the
   laminate and still positions the body; there is simply no face on it now that
   the package is never turned over. */
const PKG_TOP_Y = -DIE_T;
const PKG_BOT_Y = -DIE_T - PKG_T;

/* The package has a semicircular cutout bitten out of two of its edges — real
   through-holes, so you see straight past them. Measured on the boundary of
   the retail photo and again on substrate.jpg, which agree: chord 2.25 mm,
   depth ~1.0 mm, both centred 2.78 mm off the middle of their edge and on the
   same side. Modelled as a true half circle of r = chord/2.

   There are TWO, not one per edge. Scanning the whole perimeter of both photos
   finds indentations only on the pair of edges that map to world ∓Z; the other
   two are clean. */
const NOTCH_R = 1.125;
const NOTCH_X = -2.78;

function packageShape() {
  const h = PKG / 2;
  const s = new THREE.Shape();
  s.moveTo(-h, -h);
  // arcs run clockwise so each bites INTO the laminate rather than bulging out
  s.lineTo(NOTCH_X - NOTCH_R, -h);
  s.absarc(NOTCH_X, -h, NOTCH_R, Math.PI, 0, true);
  s.lineTo(h, -h);
  s.lineTo(h, h);
  s.lineTo(NOTCH_X + NOTCH_R, h);
  s.absarc(NOTCH_X, h, NOTCH_R, 0, Math.PI, true);
  s.lineTo(-h, h);
  s.closePath();
  return s;
}
const PKG_SHAPE = packageShape();

/* ShapeGeometry's default UVs are the raw shape coordinates, which here run
   -20..20; remap them to 0..1 so the photographs land where they should.

   This used to take a flipUV flag, because the underside wore pads.jpg and that
   photograph needed both axes negated to line its pin-1 triangle and its notches
   up with the real ones. The underside is gone with the flip, so the flag and
   the reasoning behind it went with it. */
function shapeFace(mat, y, rot, pick) {
  const geo = new THREE.ShapeGeometry(PKG_SHAPE, 24);
  planarUV(geo, PKG, PKG);
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = rot;
  m.position.y = y;
  if (pick) m.userData.pick = pick;
  pkg.add(m);
  return m;
}

const pkgTop = shapeFace(pkgTopMat, PKG_TOP_Y, -Math.PI / 2);  // die rests here

/* The body is extruded from the same outline, so the laminate edge wraps the
   inside of each cutout and the hole reads as a real hole. Only the side walls
   are drawn — the caps would z-fight the two photographic faces — and a group
   whose material is invisible is skipped by the renderer. */
const pkgBody = new THREE.Mesh(
  new THREE.ExtrudeGeometry(PKG_SHAPE, {
    depth: PKG_T - 0.06, bevelEnabled: false, curveSegments: 24,
  }),
  [new THREE.MeshBasicMaterial({ visible: false }), pkgSideMat]
);
pkgBody.rotation.x = -Math.PI / 2;         // shape XY → world XZ, extrude → +Y
pkgBody.position.y = PKG_BOT_Y + 0.03;
pkg.add(pkgBody);

/* --- IHS lid ---------------------------------------------------------
   A rounded square with two notches bitten out of each edge, extruded to a
   thin flange, plus a raised central plateau — the stepped profile visible
   in the packaging photograph. */
// The lid's flat underside sits just clear of the dies, whose tops are at
// y = 0. Any higher and you can see daylight under the heat spreader.
const LID_REST = 0.08;


/* The lid silhouette is TRACED from the photograph, not approximated. Every
   analytic attempt — rounded square, notch fractions, corner radius — either
   overhangs onto substrate or, once alpha-tested to fix that, leaves ragged
   edges and orphaned extrusion walls. assets/lid-outline.json holds the real
   contour and an eroded copy for the raised platform, both in millimetres
   about the lid centre. */
function shapeFromPoints(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

/* Planar UVs over the FULL lid footprint, so the flange and the plateau
   each show the correct part of the same photograph with no cropping maths. */
function planarUV(geo, w, h) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + w / 2) / w;
    uv[i * 2 + 1] = (pos.getY(i) + h / 2) / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/* Geometry ∩ photo-mask. The extruded shape supplies the depth, and the
   cleaned lid mask supplies the exact silhouette — so wherever the analytic
   outline overhangs onto substrate, the mask cuts it away. Neither alone is
   enough: the mask on its own also caught the substrate capacitors, and the
   geometry on its own cannot match the real outline exactly. */
// No alpha map: the traced contour IS the silhouette.
const lidMat = new THREE.MeshPhysicalMaterial({
  transparent: true, roughness: 0.36, metalness: 0.88, clearcoat: 0.28,
});
/* The step riser and outer walls. Kept only part-metal: a fully metallic
   near-vertical face has nothing bright to reflect here and goes black. */
const lidEdgeMat = new THREE.MeshPhysicalMaterial({
  color: 0xc4c7cc, transparent: true, roughness: 0.5, metalness: 0.45,
});

const lid = new THREE.Group();
lid.position.set(LID_CX, LID_REST, LID_CZ);
pkg.add(lid);

function buildLid(outline) {
  // dimensions come from the traced file itself, so texture and geometry
  // can never drift apart if the outline is regenerated
  const w = outline.lidW, h = outline.lidH;
  const part = (pts, depth, y) => {
    const geo = new THREE.ExtrudeGeometry(shapeFromPoints(pts),
      { depth, bevelEnabled: false });
    planarUV(geo, w, h);                 // same footprint → same photo region
    const mesh = new THREE.Mesh(geo, [lidMat, lidEdgeMat]);
    mesh.rotation.x = -Math.PI / 2;      // shape XY → world XZ, extrude → +Y
    mesh.position.y = y;
    mesh.userData.pick = 'ihs';
    lid.add(mesh);
  };
  part(outline.outer, FLANGE_T, 0);
  part(outline.plateau, PLATEAU_RISE, FLANGE_T);
}

/* --- I/O die -----------------------------------------------------------
   Modelled in 3D like the CCD so the two dies read as the same kind of
   object, but it keeps its bare silicon backside throughout: we never
   descend into it, and delayering it would promise otherwise. */
const iodGroup = new THREE.Group();
iodGroup.position.set(IOD_X, 0, IOD_Z);
pkg.add(iodGroup);

const iodSiliconMat = new THREE.MeshPhysicalMaterial({
  color: 0x2b3038, metalness: 0.55, roughness: 0.42,
  clearcoat: 0.5, clearcoatRoughness: 0.35, transparent: true,
});
const iodBody = new THREE.Mesh(new THREE.BoxGeometry(IOD_W, DIE_T, IOD_H), iodSiliconMat);
iodBody.position.y = -DIE_T / 2;
iodBody.userData.pick = 'iod';
iodGroup.add(iodBody);

/* Each die's photographic face is a separate plane 2 µm above the box's top,
   which is far too fine for the depth buffer to resolve at package distance:
   with near 0.05 / far 600 the two surfaces are 0.35 LSB apart at t 0.225 and
   0.87 at t 0.30 — i.e. they quantise to the SAME depth value and fight. They
   only separate (5.8 LSB) once the camera drops to die level at t 0.36, which
   is exactly where the flicker used to stop.

   polygonOffset fixes it independently of distance: -8 units biases the plane
   8 LSB toward the viewer, so it wins the depth test everywhere. Moving the
   plane physically higher would work too, but it would open a visible gap at
   the die edges during the low rake across the backside. */
const DIE_FACE_OFFSET = { polygonOffset: true, polygonOffsetFactor: -1,
                          polygonOffsetUnits: -8 };

const iodTopMat = new THREE.MeshPhysicalMaterial({
  transparent: true, opacity: 1, depthWrite: false, ...DIE_FACE_OFFSET,
  metalness: 0.45, roughness: 0.26, clearcoat: 0.7, clearcoatRoughness: 0.18,
});
const iodTop = new THREE.Mesh(new THREE.PlaneGeometry(IOD_W, IOD_H), iodTopMat);
iodTop.rotation.x = -Math.PI / 2;
iodTop.position.y = 0.002;
iodTop.renderOrder = 1;
iodTop.userData.pick = 'iod';
iodGroup.add(iodTop);

/* The I/O die gets delayered too, at the same moment the CCD does. It is never
   the subject — the camera never turns to it and it carries no highlights — but
   letting it keep its polished backside while the die beside it resolves into a
   floorplan made it read as a dead grey slab. It gets its own die shot, held a
   little dimmer than the CCD, and fades out on its own well after the camera
   has committed to the compute die. */
const iodFloorMat = new THREE.MeshPhysicalMaterial({
  transparent: true, opacity: 0, depthWrite: false, ...DIE_FACE_OFFSET,
  metalness: 0.12, roughness: 0.52, clearcoat: 0.3, clearcoatRoughness: 0.3,
});
const iodFloor = new THREE.Mesh(new THREE.PlaneGeometry(IOD_W, IOD_H), iodFloorMat);
iodFloor.rotation.x = -Math.PI / 2;
iodFloor.position.y = 0.003;
iodFloor.renderOrder = 2;
iodFloor.userData.pick = 'iod';
iodGroup.add(iodFloor);

/* Each die wears its own name, drawn onto the silicon rather than floating on
   a leader line. At this point in the descent the two dies ARE the subject, so
   a name lying on the face reads as part of the object instead of as chrome
   pointing at it. Kept on the same polygon offset as the face planes. */
function faceLabelTexture(text, aspect, scale) {
  const CW = 2048, CH = Math.max(64, Math.round(CW / aspect));
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  const size = CW * scale;
  g.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
  // wide tracking is what sells it as silkscreen rather than a caption
  if ('letterSpacing' in g) g.letterSpacing = `${size * 0.18}px`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = size * 0.3;
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillText(text.toUpperCase(), CW / 2, CH / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ANISO;
  return tex;
}

function faceLabel(w, h, text, scale, y) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
    map: faceLabelTexture(text, w / h, scale),
    transparent: true, opacity: 0, depthWrite: false, ...DIE_FACE_OFFSET,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.renderOrder = 6;
  return m;
}

const iodFace = faceLabel(IOD_W, IOD_H, 'I/O die', 0.105, 0.006);
iodGroup.add(iodFace);

/* ------------------------------------------------------------------ *
   5. DIE
 * ------------------------------------------------------------------ */

const chip = new THREE.Group();
chip.position.set(DIE_OFF_X, 0, DIE_OFF_Z);   // local to assembly → world origin
assembly.add(chip);

const silicon = new THREE.Mesh(
  new THREE.BoxGeometry(DIE_W, DIE_T, DIE_H),
  new THREE.MeshPhysicalMaterial({
    /* The sides have to read as silicon rather than as a black void. At the
       original value the die's edge vanished into the background during the low
       sweep across the floorplan, which is the one shot where the slab is
       supposed to be legible. The small emissive keeps the wall off pure black
       when no light reaches it. */
    color: 0x596373, emissive: 0x0d1016,
    metalness: 0.28, roughness: 0.5,
    clearcoat: 0.45, clearcoatRoughness: 0.35,
  })
);
silicon.position.y = -DIE_T / 2;
chip.add(silicon);

const planeGeo = new THREE.PlaneGeometry(DIE_W, DIE_H);

function surface(y, renderOrder, opts = {}) {
  const m = new THREE.Mesh(planeGeo, new THREE.MeshPhysicalMaterial({
    transparent: true, opacity: 0, depthWrite: false, ...DIE_FACE_OFFSET, ...opts,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.renderOrder = renderOrder;
  chip.add(m);
  return m;
}

const sBack = surface(0.002, 1, {
  metalness: 0.45, roughness: 0.26, clearcoat: 0.7, clearcoatRoughness: 0.18,
});
const sFloor = surface(0.004, 2, {
  /* No iridescence. It was 0.14 — under the die photograph, essentially
     invisible — and it compiles a whole extra block into the fragment shader of
     a plane that fills the screen. Clearcoat stays; that is the polished-silicon
     sheen and it is actually visible. */
  metalness: 0.12, roughness: 0.52, clearcoat: 0.32, clearcoatRoughness: 0.3,
});

const ccdFace = faceLabel(DIE_W, DIE_H, 'Core Complex Die', 0.072, 0.008);
chip.add(ccdFace);

/* --- the die photograph is laid down a half turn round ----------------
   The die shot is published with the IFOP PHY and the test/debug band along
   its BOTTOM edge, and the scene used to lay it on the die that way up. Image
   v runs to the die's +z, so that put the PHY on the NEAR edge — pointing away
   from the I/O die it exists to talk to, which sits at IOD_Z -3.35 against this
   die's +8.80 and is therefore a long way to -z. The photograph is turned half
   a turn on the way into the scene, which faces the PHY and the test/debug band
   at the I/O die where they belong and starts the cores at the near edge.

   This turns the CONTENT, not the slab. The die keeps its measured place on the
   substrate, the package is untouched, and every camera key is left exactly as
   it was written. It does move what is ON the die, which is the point: the
   region tiles land the other way up, and the one core stage 04 descends into
   travels from the die's near-left corner to its far-right one. The camera
   follows it there for free, because every key in that stage is written against
   coreCX / coreCZ rather than in absolute coordinates.

   Everything traced on the photograph turns with it, by the point reflection
   (u,v) -> (1-u,1-v). The measurements below are left EXACTLY as measured, in
   the published frame, and turned once here — every comment in this file cites
   a texture-energy step, a traced edge or a luminance peak in that frame, and
   re-typing three hundred coordinates would strand all of it. The two
   photographs themselves are turned by a uv transform for the same reason: the
   files on disk stay the frame the measurements were taken in.

   A point reflection is a ROTATION, not a mirror, so winding is preserved and
   insetRing and ExtrudeGeometry see every outline exactly as they saw it. */
const turnSpan = ([a, b]) => [1 - b, 1 - a];
const turnPt = (p) => [1 - p[0], 1 - p[1]];
const turnRegion = (r) => ({
  ...r,
  ...(r.u ? { u: turnSpan(r.u), v: turnSpan(r.v) } : null),
  ...(r.polys ? { polys: r.polys.map((ring) => ring.map(turnPt)) } : null),
  ...(r.at ? { at: turnPt(r.at) } : null),
});
/* Applied where the two die photographs are loaded. center must be set with it:
   a texture rotates about its uv origin otherwise, which for a half turn puts
   the whole image outside [0,1] and leaves the clamp smearing one corner texel
   across the surface. */
const turnTex = (t) => { t.center.set(0.5, 0.5); t.rotation = Math.PI; return t; };

/* The photograph's bottom-left core, the one the annotated reference documents.
   The half turn carries it to the die's far-right corner. */
const CORE_U = turnSpan([0.015, 0.350]), CORE_V = turnSpan([0.6193, 0.8176]);
const coreW = (CORE_U[1] - CORE_U[0]) * DIE_W;
const coreH = (CORE_V[1] - CORE_V[0]) * DIE_H;
const coreCX = -DIE_W / 2 + (CORE_U[0] + CORE_U[1]) / 2 * DIE_W;
const coreCZ = -DIE_H / 2 + (CORE_V[0] + CORE_V[1]) / 2 * DIE_H;

const sCore = new THREE.Mesh(
  new THREE.PlaneGeometry(coreW, coreH),
  new THREE.MeshPhysicalMaterial({
    transparent: true, opacity: 0, depthWrite: false,
    metalness: 0.12, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.3,
  })
);
sCore.rotation.x = -Math.PI / 2;
sCore.position.set(coreCX, 0.006, coreCZ);
sCore.renderOrder = 3;
chip.add(sCore);

/* --- region highlight overlays -------------------------------------
   Measured region boundaries: the core row seams were located from the
   reddish separator bands in the die photograph, and the column extents
   from where blue core logic gives way to the darker central L3 array. */
/* Bottom strip, all four values re-measured from traced outlines. This photo
   has no thin boundary lines the way the core shot does — its regions differ by
   how BUSY they are — so these come off a texture-energy profile (mean absolute
   luminance difference along the scan) rather than a line detector.

     STRIP_TOP  the bright separator under the core rows, luminance 140 against
                a 70-90 field
     STRIP_MID  texture steps from 4-6 to 14-20 here, and it does so at BOTH
                ends of the die, which is what settles the layout below
     STRIP_BOT  where the busy content stops, short of the seal ring at 0.983 */
const STRIP_TOP = 0.8195, STRIP_MID = 0.8737, STRIP_BOT = 0.9815;
/* Boundaries sit on the CENTRE of each measured separator so neighbouring
   regions share an edge exactly — no gaps, no overlaps. */
const IFOP_SPLIT = 0.6520;   // centre of a dead-flat divider, u 0.6458-0.6582
const TEST_R = 0.3376;       // dark quiet column; texture jumps 9 -> 26 across it

/* --- core rows and columns ------------------------------------------ */
const ROWS = [[0.0106, 0.2184], [0.2184, 0.4190], [0.4190, 0.6193], [0.6193, STRIP_TOP]];
/* The die content runs edge to edge, stopping at the bright seal ring. An
   earlier version pulled these in to 0.022/0.964 on the strength of dark bands
   measured in the BOTTOM STRIP — those bands are local to that row and do not
   exist across the core rows, so the cores ended up not covering their own
   blocks. The seal is different: sampled in the strip, in two separate core
   rows and across the middle of L3, it ends at 0.0078 and resumes at 0.9925
   every time, so it really is die-wide and these are safe to share. */
const DIE_L = 0.0078, DIE_R = 0.9925;
const COL_L = [DIE_L, 0.352];
/* The right column starts at 0.645, not 0.745. The darker band at u 0.63–0.75
   is the right cores' own L2 cache, mirroring the L2 band at u 0.29–0.36 on
   the left; reading it as part of L3 made L3 overrun the right-hand cores. */
const COL_R = [0.645, DIE_R];

/* Die-face regions are named in Title Case. The blocks inside a single core
   stay in sentence case — they are a different register, one level down.

   How the strip divides. The three traced outlines overlapped each other: SMU
   was drawn across the full width, and test/debug down the full height of the
   left end, so one of them had to give. The die decides it. The texture step at
   STRIP_MID is present at the LEFT end (4-6 above, 19 below) exactly as it is at
   the right end (3-4 above, 20 below), so the upper band is one continuous
   region running the whole width. Scanning the other way, the left end's LOWER
   band has a hard vertical boundary at TEST_R (texture 9 -> 26) while its UPPER
   band has only a mild dip across the same u (11 -> 6 -> 7) and no boundary. So
   SMU keeps the full width and test/debug is the lower band only. */
const REGIONS = [
  ...ROWS.map((v, i) => ({ id: `core-l${i + 1}`, u: COL_L, v, group: 'cores', color: '#ff5f42', label: 'Zen 5 Core' })),
  ...ROWS.map((v, i) => ({ id: `core-r${i + 1}`, u: COL_R, v, group: 'cores', color: '#ff5f42', label: 'Zen 5 Core' })),
  { id: 'l3',    u: [0.356, 0.641],       v: [0.0106, STRIP_TOP],    group: 'l3',    color: '#5b8cf0', label: 'L3 Cache', sub: '32 MB' },
  { id: 'smu',   u: [DIE_L, DIE_R],       v: [STRIP_TOP, STRIP_MID], group: 'strip', color: '#c9891f', label: 'SMU / Power Management & I/O Interconnect' },
  { id: 'test',  u: [DIE_L, TEST_R],      v: [STRIP_MID, STRIP_BOT], group: 'strip', color: '#9b6cf0', label: 'Test / Debug' },
  { id: 'ifop1', u: [TEST_R, IFOP_SPLIT], v: [STRIP_MID, STRIP_BOT], group: 'strip', color: '#1d9a7d', label: 'IFOP PHY' },
  { id: 'ifop2', u: [IFOP_SPLIT, DIE_R],  v: [STRIP_MID, STRIP_BOT], group: 'strip', color: '#1d9a7d', label: 'IFOP PHY' },
].map(turnRegion);   // measured in the published frame, drawn in the turned one

const GROUPS = ['cores', 'l3', 'strip'];

/* --- section gaps ---------------------------------------------------
   Boundaries here are measured flush on purpose: neighbouring regions share an
   edge exactly, so a partitioned band reads as one band rather than as separate
   tiles. That is right for the measurement and, it turns out, wrong for the
   look — the die's own core column and L3 happen to sit 0.004 uv apart, and
   that hairline is what makes those two read as separate objects.

   So the flush outlines stay the truth, and a gap is opened at DRAW time by
   insetting each region half a gap on every side. Nothing measured moves.

   GAP is in WORLD units, not uv, and it has to be: a region's u spans 9.07 mm
   of die and its v spans 7.78, so one uv inset applied to both axes would put a
   noticeably wider gap along one of them. */
const GAP = 0.036;             // = the die's own cores <-> L3 hairline, 0.004 uv

/* Inset a closed ring by d, in any space where x and y carry the same units —
   world shape coordinates or canvas pixels, not uv. Every edge slides d along
   its own inward normal and consecutive edges are re-intersected, which is
   exact for the rectilinear outlines traced here.

   Rejects an inset it cannot trust: a duplicate vertex, two parallel
   consecutive edges with no intersection, a result that turned inside out or
   lost most of its area, or — the one that matters — ANY EDGE THAT REVERSED.

   That last check is not optional and an area test does not substitute for it.
   Vector execution's outline has notch arms about 0.010 world units across, and
   at a 0.0062 inset per side those arms turn inside out while the ring keeps
   ~90% of its area, so the area test passed them happily. The resulting ring
   self-intersects, which ExtrudeGeometry will still happily build walls along
   but ShapeGeometry cannot triangulate — so the block drew its coloured edges
   and no cap at all, losing its fill and its name while looking, at a glance,
   merely "hard to read".

   On rejection the inset is retried at half, then a quarter, so a block with
   one thin feature still gets whatever gap it can carry instead of none. If
   even a quarter will not take, returns null and the caller keeps the flush
   outline. Callers work in different units — world for geometry, canvas pixels
   for the overlay — but both checks are scale-invariant and the retry ladder is
   proportional, so the two independently arrive at the same outline. */
function insetRing(pts, d, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const r = insetRingOnce(pts, d / (1 << i));
    if (r) return r;
  }
  return null;
}

function insetRingOnce(pts, d) {
  const n = pts.length;
  const area = (p) => {
    let a = 0;
    for (let i = 0; i < n; i++) {
      const q = p[i], r = p[(i + 1) % n];
      a += q[0] * r[1] - r[0] * q[1];
    }
    return a / 2;
  };
  const A = area(pts);
  const s = A > 0 ? 1 : -1;      // interior lies left of each edge when A > 0
  const lines = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % n];
    let dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return null;
    dx /= len; dy /= len;
    lines.push([p0[0] - dy * s * d, p0[1] + dx * s * d, dx, dy]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n], b = lines[i];
    const den = a[2] * b[3] - a[3] * b[2];
    if (Math.abs(den) < 1e-9) return null;
    const t = ((b[0] - a[0]) * b[3] - (b[1] - a[1]) * b[2]) / den;
    out.push([a[0] + a[2] * t, a[1] + a[3] * t]);
  }
  const A2 = area(out);
  if (A2 * A <= 0 || Math.abs(A2) < Math.abs(A) * 0.2) return null;
  /* Every edge must still run the way it did. An edge whose offset overshot a
     thin feature comes back pointing the other way, which is a self-intersection
     the area test cannot see. */
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if ((out[j][0] - out[i][0]) * (pts[j][0] - pts[i][0]) +
        (out[j][1] - out[i][1]) * (pts[j][1] - pts[i][1]) <= 0) return null;
  }
  return out;
}

/* One canvas per group per look. The "fill" canvas mimics the annotated
   reference; the "outline" canvas keeps the naming but hands the silicon
   back to the viewer.

   `inset` is in CANVAS PIXELS and must match the inset applied to the tile
   geometry, or the fill and its white boundary stroke will not line up with the
   slab carrying them. Canvas pixels are safe to inset uniformly because CH is
   derived from CW through the region's own aspect, so both axes carry the same
   pixels per world unit. */
function overlayTexture(list, mode, aspect, glow = 1, wash = 1, inset = 0) {
  const CW = 1600, CH = Math.round(CW / aspect);
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const g = c.getContext('2d');

  list.forEach((r) => {
    const color = r.color;
    /* A region is either an axis-aligned box (the floorplan above) or a
       polygon (the blocks inside a core, which are mostly not rectangles).
       Both paths below share the same fill / outline / name-plate treatment. */
    const polys = r.polys;
    const flat = polys ? polys.flat() : null;
    const us = flat ? flat.map((p) => p[0]) : r.u;
    const vs = flat ? flat.map((p) => p[1]) : r.v;
    const u0 = Math.min(...us), u1 = Math.max(...us);
    const v0 = Math.min(...vs), v1 = Math.max(...vs);
    const x = u0 * CW, y = v0 * CH;
    const w = (u1 - u0) * CW, h = (v1 - v0) * CH;
    /* A block can be several disjoint pieces — the vector unit is two lanes,
       and fetch+decode is split by the L1i$ arrays sitting between its halves —
       so each piece is its own subpath of one path. */
    const trace = () => {
      g.beginPath();
      if (polys) {
        polys.forEach((poly) => {
          const ring = poly.map((p) => [p[0] * CW, p[1] * CH]);
          const cut = inset ? (insetRing(ring, inset) || ring) : ring;
          cut.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
          g.closePath();
        });
      } else {
        g.rect(x + inset, y + inset, w - 2 * inset, h - 2 * inset);
      }
    };

    /* No inset: neighbouring regions must share their edges exactly, so the
       strip reads as one partitioned band rather than separate tiles. The
       stroke is drawn centred on the boundary, which both sides share. */
    if (mode === 'fill') {
      /* `wash` thins the colour flood WITHOUT thinning the name drawn over it
         later, which dimming the whole layer through material opacity cannot
         do. The lifted floorplan tiles need a light flood so the silicon reads
         through them, and a name you can still read. */
      g.fillStyle = color;
      g.globalAlpha = 0.62 * wash;
      trace(); g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 2.5;
      trace(); g.stroke();
    } else {
      /* The glow has to be scaled to how densely the group tiles its area.
         At the floorplan's 13 big regions a 20px bloom reads as a halo; at the
         core's 29 small ones, every region blooms into its neighbours and the
         whole core fills in with a flat grey wash. */
      g.strokeStyle = color;
      g.lineWidth = 6 * glow;
      g.shadowColor = color;
      g.shadowBlur = 20 * glow;
      trace(); g.stroke();
      g.shadowBlur = 0;
    }

    /* Name plate. The strip regions are short and wide, so the type has to
       be driven by height as well as width or it vanishes down there. */
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    /* Concave shapes have no useful centroid — the middle of an L is outside
       it — so a polygon carries its own anchor, the point furthest from any
       edge (pole of inaccessibility), computed when the shape was traced.

       That anchor maximises an inscribed CIRCLE, but type is a wide rectangle,
       so it is only a starting guess: fit the actual text box inside the actual
       path. Walk the size down, and at each size try the anchor first and then
       a ring of offsets around it, taking the first that lands wholly inside. */
    let big = Math.max(15, Math.min(h * 0.42, w * 0.11, 54));
    let cx = r.at ? r.at[0] * CW : x + w / 2;
    let cy = r.at ? r.at[1] * CH : y + h / 2;
    /* `fit: false` opts a region out of the inside-the-path search and just
       centres the type on its anchor at the size the bounding box allows. That
       is what you want when a region is two pieces with a channel between them
       and the name belongs across both: the true centre is in the gap, so the
       fitter would reject every candidate and fall back to the 14 px floor. */
    if (polys && r.fit !== false) {
      trace();                       // path to hit-test against
      const inside = (px, py) => g.isPointInPath(px, py);
      const fits = (tx, ty, tw, th) => {
        for (let i = 0; i <= 4; i++) {
          for (let j = 0; j <= 2; j++) {
            const px = tx - tw / 2 + (tw * i) / 4;
            const py = ty - th / 2 + (th * j) / 2;
            if (!inside(px, py)) return false;
          }
        }
        return true;
      };
      const step = Math.max(6, Math.min(w, h) * 0.05);
      let placed = false;
      for (let s = big; s >= 14 && !placed; s *= 0.92) {
        g.font = `600 ${s}px ui-sans-serif, system-ui, sans-serif`;
        const tw = Math.max(g.measureText(r.label).width,
                            r.sub ? g.measureText(r.sub).width : 0) + s * 0.5;
        const th = s * (r.sub ? 2.25 : 1.35);
        for (let ring = 0; ring < 6 && !placed; ring++) {
          for (let a = 0; a < (ring ? 12 : 1) && !placed; a++) {
            const ang = (a / 12) * Math.PI * 2;
            const px = cx + Math.cos(ang) * ring * step;
            const py = cy + Math.sin(ang) * ring * step;
            if (fits(px, py, tw, th)) { cx = px; cy = py; big = s; placed = true; }
          }
        }
      }
      if (!placed) big = 14;
    }
    const small = big * 0.72;

    /* No plate behind the name in outline mode. It used to draw a dark rounded
       slab so the type stayed legible once the fill faded, but it reads as a
       black box sitting on the silicon rather than as part of the annotation. */
    g.font = `600 ${big}px ui-sans-serif, system-ui, sans-serif`;
    g.fillStyle = '#ffffff';
    g.fillText(r.label, cx, r.sub ? cy - small * 0.55 : cy);
    if (r.sub) {
      /* Solid white, not the 0.88 it used to be. The second line is often part
         of the name rather than a spec — "and Decode", "Scheduling", "Predictor",
         "Interconnect" — and holding it back read as the type being faded rather
         than as a hierarchy. Size and face already carry the hierarchy: 0.72 of
         the headline, monospace against sans. */
      g.font = `500 ${small}px ui-monospace, monospace`;
      g.fillStyle = '#ffffff';
      g.fillText(r.sub, cx, cy + small * 0.75);
    }
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ANISO;
  return tex;
}

/* --- rippling a group in as real tiles ------------------------------
   Each region becomes a thin slab of its own rather than a patch of one flat
   plane, so the reveal is a wave of tiles LIFTING OUT of the die and settling
   back, not a wash of colour crossing a diagram. Same trick the core blocks
   use one stage down: the tile wears the group's shared overlay canvas through
   a planar uv, clipped to its own outline, so thirteen independently animated
   tiles still cost two textures per group and no extra canvases.

   The fill and the outline are separate caps stacked on the tile's top face
   and crossfaded, which is what the single plane used to do with its opacity. */
/* --- what may occlude what -------------------------------------------
   Depth writing follows OPACITY, and only the walls ever write:

     walls, opacity >= 0.995   depthWrite ON    exact, order-independent
     walls, mid-fade           depthWrite OFF   everything blends
     top face, caps, die       never

   Both halves are load-bearing and each was learned from a bug.

   A TRANSLUCENT surface that writes depth hard-rejects whatever is drawn after
   it. So while the walls wrote depth unconditionally, the moment a slab began
   fading, whether you saw another slab's walls through it came down to which of
   the two the transparent sort put first — and that order flips as the camera
   moves. That was the SMU fade.

   But turning it off unconditionally is just as wrong, because AT REST these
   walls are opaque, and opaque geometry that does not write depth falls back on
   the transparent sort for occlusion — which sorts per OBJECT, by centroid. A
   big concave block like instruction fetch has a centroid that says little about
   which of its arms is nearest, so a small neighbour's edge drew over it from
   some angles and not others. That was the L2 ITLB edge showing through
   instruction fetch.

   Tying the flag to opacity gets both: exact per-pixel occlusion whenever the
   walls are solid enough for it to matter, and a clean blend while they are not.
   The threshold is invisible because a wall at 0.995 already hides what is
   behind it. depthWrite is a GL state, not a shader define, so flipping it per
   frame costs nothing and triggers no recompile.

   The die plane is outrun with renderOrder rather than with depth: a slab's
   walls are their own mesh drawn AFTER the die surfaces, so nothing paints over
   them. The top face stays on the NEAR side of the die plane, which is what
   keeps it reading as glass — the plane paints over it, so you see the silicon
   lying flat under the slab rather than a second copy of it floating at the
   slab's own height. */
/* --- sorting transparent tiles ---------------------------------------
   Every tile in this file — the floorplan's regions and the core's blocks — is
   glass: `transparent: true` with `depthWrite: false`, so the depth buffer
   cannot decide what is in front. Order of drawing is the only thing that can,
   and three.js decides that by sorting transparent meshes back to front on the
   distance to each mesh's ORIGIN.

   Which means the origin has to be somewhere meaningful. It was not. Every tile
   was built with its position baked into the vertices and its mesh left at the
   group origin, so all 29 core blocks reported the same distance, the sort tied
   on all of them, and three.js fell back to the stable tiebreak: creation order.
   The blocks were therefore painted in the order CORE_BLOCKS happens to list
   them, which has nothing to do with where they are.

   Flat on the die that is invisible, because the tiles are disjoint and never
   overlap on screen. It becomes visible the moment one LIFTS: a raised block
   covers its neighbours, and any neighbour listed later in the array paints
   straight back over it. Hovering Branch put L1 BTB — a block strictly behind
   it — on top of it, and the periodic jump hit the same thing wherever the
   dice landed on a block declared early with something behind it declared late.

   So: geometry is centred on its own origin, and the position is carried by the
   MESH. Then the sort has real distances to work with and back-to-front is
   simply correct, at every camera angle, for the lift and the hover and the
   jump alike, with no per-case handling anywhere. Any new tile built here must
   go through centreGeometry for the same reason. */
function centreGeometry(geo) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const ox = (bb.min.x + bb.max.x) / 2;
  const oy = (bb.min.y + bb.max.y) / 2;
  geo.translate(-ox, -oy, 0);
  /* The mesh is laid flat by a -90° rotation about x, which sends shape-y to
     world -z, so this is the parent-space offset that puts the tile back
     exactly where its vertices used to be. z stays put: it is the extrude
     depth, and it is what the lift animates. */
  return [ox, -oy];
}

const RO_WALLS = 10;           // after sBack 1 / sFloor 2 / sCore 3
/* Splits one extruded body into two meshes over one geometry: each draws only
   its own group, the other being suppressed by an invisible material. Same
   trick the package body uses to extrude an outline without its caps. */
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false });

const TILE_T = 0.16;           // a slab, but a glass one — see the edge AND
                               // the silicon through it
const TILE_PEAK = 0.55;        // how far out of the die the wave lifts one
const TILE_REST = 0.20;        // ...and where it settles, leaving a raised mosaic
/* Share of its group's window one tile occupies, so also how long a single slab
   takes to rise: widening it overlaps neighbours more and slows each one.

   It also, and this is the catch, controls the SEPARATION between slabs: a tile
   that occupies more of the window overlaps further into its neighbour. Raising
   it to 0.60 slowed each slab nicely and pushed the four strip regions to within
   136 ms of each other, which is slower motion and less legible sequence at the
   same time. Back at 0.44 with a longer leg underneath, both are had at once —
   the leg buys the duration, this buys the gap.

   PER GROUP, because one constant could not serve three groups of very different
   size. As a single number it sets how much of a group's window ONE slab spends
   rising, so a group of eight and a group of one both rose over 34% of their own
   window — and L3's window is the smallest of the three, being one slab. The L3
   therefore snapped up in 495 ms while its neighbours took 800 to 1400, which is
   what made it look like it popped.

   The right value depends entirely on how many slabs share the window. Eight
   cores need a low number, because this doubles as their SEPARATION: a tile that
   occupies more of the window overlaps further into the next one. A lone slab
   has nothing to separate from and can simply take the whole window, which is
   what 1.0 means here.

   `k` below is scaled by (1 - RIPPLE[grp]), so the last tile of a group still
   finishes exactly when the group's ramp reaches 1 whatever these are set to:
   the reveal cannot spill past the stop it is pinned to. Macro regions only; the
   core blocks in stage 05 have their own CORE_FADE. */
const RIPPLE = {
  cores: 0.34,      // 8 slabs — low, so they stay distinct as they ripple
  l3:    1.00,      // 1 slab — nothing to stagger against, so take the lot
  strip: 0.34,      // 4 slabs
};

/* Ripple order within each group. The cores zig-zag ACROSS THE FRAME, starting
   at the die's far edge and coming toward the camera, left column then right
   within each row, so the wave reads as crossing the die rather than as two
   columns filling independently.

   Both orders below are written on the DRAWN position, not on the id or on the
   photograph. The ids number the photograph's rows and columns, and the half
   turn above CORE_U reverses both on screen: core-l1 is drawn at the near
   right, core-r4 at the far left, and the strip's test/debug end swaps sides
   with its second IFOP PHY. Ranking on where a tile actually is keeps the wave
   running the way it always has. Ranks must stay CONSECUTIVE INTEGERS: k is
   raw/max, so a gappy rank would space the beats unevenly. */
const RIPPLE_ORDER = {
  cores: (r) => {
    const row = +r.id.slice(-1) - 1;
    return (3 - row) * 2 + (r.id.startsWith('core-l') ? 1 : 0);
  },
  l3: () => 0,
  strip: (r) => ['smu', 'ifop2', 'ifop1', 'test'].indexOf(r.id),
};

const overlays = {};
const tiles = [];
const tileGroup = new THREE.Group();
chip.add(tileGroup);

GROUPS.forEach((grp) => {
  const list = REGIONS.filter((r) => r.group === grp);
  const raw = RIPPLE_ORDER[grp];
  const max = Math.max(...list.map(raw));
  /* Only the bottom strip is inset. Its four regions were measured flush so the
     band would read as one partitioned band, and that is exactly what made SMU,
     Test / Debug and the two IFOP PHYs read as one object rather than four. The
     core column and L3 above them already sit a hairline apart in the measured
     data and are left alone. */
  const gap = grp === 'strip' ? (GAP / 2) * (1600 / DIE_W) : 0;
  const fillTex = overlayTexture(list, 'fill', DIE_W / DIE_H, 1, 1, gap);
  const lineTex = overlayTexture(list, 'outline', DIE_W / DIE_H, 1, 1, gap);
  overlays[grp] = { fillTex, lineTex };

  const g2 = grp === 'strip' ? GAP / 2 : 0;
  list.forEach((r) => {
    const x0 = (r.u[0] - 0.5) * DIE_W + g2, x1 = (r.u[1] - 0.5) * DIE_W - g2;
    const y0 = (0.5 - r.v[0]) * DIE_H - g2, y1 = (0.5 - r.v[1]) * DIE_H + g2;
    const shape = new THREE.Shape();
    shape.moveTo(x0, y0); shape.lineTo(x1, y0);
    shape.lineTo(x1, y1); shape.lineTo(x0, y1);

    const planar = (geo) => {
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        uv.setXY(i, p.getX(i) / DIE_W + 0.5, p.getY(i) / DIE_H + 0.5);
      }
      return geo;
    };
    const col = new THREE.Color(r.color);
    // walls: no depth write, drawn after the die plane instead — see RO_WALLS
    const side = new THREE.MeshStandardMaterial({
      color: col, emissive: col.clone().multiplyScalar(0.3),
      metalness: 0.2, roughness: 0.5, transparent: true, opacity: 0,
      depthWrite: false,
    });
    /* The tile's top face is CLEAR. It used to carry the die photograph, on the
       theory that the slab would then read as glass with the silicon lying flat
       underneath — but a slab wearing a copy of the die reads as a slab wearing
       a copy of the die, and the effect was the opposite of transparent: the
       region appeared to lift its own piece of the photograph up with it.

       Now it is a thin sheen and nothing else, so you look straight through to
       the real die below. The region still reads, because its colour and its
       name live on the caps below and its walls are coloured; the top face is
       only there to catch a highlight and give the glass a surface. */
    const face = new THREE.MeshPhysicalMaterial({
      transparent: true, opacity: 0, depthWrite: false,
      color: 0xdfe6f2,
      metalness: 0.0, roughness: 0.22, clearcoat: 0.55, clearcoatRoughness: 0.18,
    });
    const geo = planar(
      new THREE.ExtrudeGeometry(shape, { depth: TILE_T, bevelEnabled: false }));
    /* Centre the geometry on its own origin and carry the position on the MESH.
       See "sorting transparent tiles" above RO_WALLS — this is the whole reason
       a raised tile draws in front of the ones behind it. uv is written by
       planar() first, because it reads the untranslated coordinates. */
    const [ox, oz] = centreGeometry(geo);
    const mkPart = (mats, order) => {
      const m = new THREE.Mesh(geo, mats);
      m.rotation.x = -Math.PI / 2;
      m.position.set(ox, 0, oz);
      m.renderOrder = order;
      m.userData.pick = r.id;
      tileGroup.add(m);
      return m;
    };
    const body = mkPart([face, HIDDEN], 0);          // caps, before the die plane
    const walls = mkPart([HIDDEN, side], RO_WALLS);  // walls, after it

    // highlight and name ride on top of that face, and crossfade there
    /* Coplanar with the tile's top face rather than floating a hair above it,
       so the highlight is painted ON the silicon instead of hovering over it.
       The polygon offset is what stops that from z-fighting. */
    const mkCap = (map, order) => {
      const cap = planar(new THREE.ShapeGeometry(shape));
      centreGeometry(cap);          // same shape, so the same origin as the body
      const m = new THREE.Mesh(cap,
        new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0,
                                      depthWrite: false, ...DIE_FACE_OFFSET }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(ox, 0, oz);
      m.renderOrder = order;
      tileGroup.add(m);
      return m;
    };
    const fillCap = mkCap(fillTex, 45);
    const lineCap = mkCap(lineTex, 46);


    /* pick() needs to know whether this tile is currently visible, because the
       raycaster does not. Every mesh points back at its own record. */
    /* `color` is carried on the record purely so the block tag can take its
       accent from the block it is naming rather than from the page palette. */
    const rec = { body, walls, face, side, fillCap, lineCap, color: r.color,
                 fill: fillCap.material, line: lineCap.material,
                 grp, k: (max > 0 ? raw(r) / max : 0) * (1 - RIPPLE[grp]) };
    body.userData.live = walls.userData.live = rec;
    tiles.push(rec);
  });
});

/* --- one core, block by block --------------------------------------
   The same language as the floorplan above: colour fills that bloom in and
   settle to glowing outlines, rather than callouts on leader lines.

   Boxes measured from the annotated core reference, ccd-dieshot-bottom-left-
   detail.jpg. Its orientation matches core-detail.jpg directly with no flip —
   checked on the banded regfile columns down the left and the CPL block at the
   bottom right, which land the same way in both.

   These are TRACED BY HAND in trace.html, not inferred. Three rounds of
   deriving them — from the annotation's washes, from an edge-snapped
   rectangle, and from the die's own smooth-field sections — each landed close
   but wrong, so the outlines now come straight from clicked vertices and are
   used verbatim.

   Coordinates are u,v on core-detail.jpg. A block may hold several polygons
   (a region split by the arrays running through it); each becomes a subpath of
   one canvas path, so fill and outline treat them as one region. `at` is the
   label anchor: the point furthest from any edge, since a concave shape's
   centroid can fall outside it.

   Standing rule: where a new region runs alongside one already placed, its
   edge is SNAPPED flush onto the existing edge. Traced edges are axis-aligned,
   so an edge is (orientation, coordinate, span); it snaps only when an existing
   edge is parallel, within 0.008 uv, and their spans actually overlap —
   otherwise a distant edge that happens to share a coordinate would drag it
   sideways. Load/store arrived 0.0015–0.0044 uv off L1d on three edges and was
   snapped onto all three. */
const CORE_BLOCKS = [
  /* --- the core's outer boundary -----------------------------------------
     All four sides are single straight lines and every region touching a side
     sits on it. Left is 0.0076 and right is 1, both already shared. Top is
     0.0269 and bottom 0.9952, each confirmed under every span that claims it:

       top     vector regfiles 128 | L1d 167 | L2 DTLB 200 | load/store 200
               | L2 upper 199   — all peaking on the same row
       bottom  vector regfiles 158 | everything else 204

     An earlier note here claimed the top genuinely stepped, because the L2 DTLB
     was traced on 0.0269 while L1d sat at 0.0243 and load/store at 0.0288. That
     was wrong: only the TLB happened to be traced on the line, and the other
     three were slop. The regfiles were the odd ones out for a different reason
     — 0.0361 is where their ARRAY starts, with about 9 px of channel between it
     and the core edge; they now run to the edge like everything else.

     Bottom edge corrected 0.2403 -> 0.2409 when the regfile and scheduling
     arrived under it: 0.2403 is a dark row, the line is at 0.2409 (peak 103). */
  { label: 'L1D Cache', sub: '48 KB', color: '#e0492e', at: [0.4609, 0.1423],
    polys: [
      [[0.2652,0.0269], [0.2652,0.2409], [0.429,0.2409], [0.429,0.2803],
       [0.4944,0.2803], [0.4944,0.2389], [0.6296,0.2389], [0.6296,0.0269]],
    ] },
  { label: 'Load / Store', color: '#4a76d9', at: [0.6514, 0.3683],
    polys: [
      [[0.6702,0.0776], [0.7235,0.0776], [0.7235,0.2329], [0.7693,0.2329],
       [0.7693,0.0269], [0.7866,0.0269], [0.7866,0.3513], [0.7183,0.3513],
       [0.7183,0.4667], [0.7303,0.4667], [0.7303,0.5007], [0.4944,0.5007],
       [0.4944,0.2389], [0.6296,0.2389], [0.6296,0.1294], [0.6702,0.1294]],
    ] },
  /* Three edges nudged onto their lines when scheduling wrapped this block's
     lower-left notch: 0.3942 -> 0.3952 (peak 123), 0.5747 -> 0.5750 (peak 120),
     and the right edge 0.5379 -> 0.5386, the dark seam that instruction fetch
     was already using further down. */
  { label: 'Integer Execution', color: '#1d9a7d', at: [0.3882, 0.4837],
    polys: [
      [[0.429,0.2803], [0.4944,0.2803], [0.4944,0.5007], [0.5386,0.5007],
       [0.5386,0.5481], [0.4455,0.5481], [0.4455,0.5750], [0.3426,0.5750],
       [0.3426,0.3952], [0.429,0.3952]],
    ] },
  /* The two L2 halves share their x extent exactly and are labelled
     separately, as the reference labels each half. */
  { label: 'L2 Cache ½', sub: '512 KB', color: '#c9891f', at: [0.8569, 0.1510],
    polys: [
      [[0.7929,0.0269], [0.7929,0.2788], [1,0.2788], [1,0.0269]],
    ] },
  /* Bottom edge corrected from the traced 0.7954 to 0.7981 when CPL arrived
     underneath it: 0.7954 sits in a dead band (min-channel 6.5 across the whole
     span) while 0.7981 is the real line at 172.7. The two are now flush. */
  { label: 'L2 Cache ½', sub: '512 KB', color: '#c9891f', at: [0.8574, 0.6663],
    polys: [
      [[0.7929,0.539], [1,0.539], [1,0.7981], [0.7929,0.7981]],
    ] },
  /* The tag array, and the control logic wrapping it. Traced as two overlapping
     rectangles; the control block is the outer one MINUS the tags, which comes
     out as a C open to the right rather than a ring, because both right edges
     land on the die edge. Same amber family as the data arrays above and below,
     lighter for the tags and deeper for the control. */
  { label: 'L2 Cache Tags', color: '#9c6a2a', at: [0.9345, 0.4124],
    polys: [
      [[0.869,0.3010], [0.869,0.5237], [1,0.5237], [1,0.3010]],
    ] },
  /* Named "L2 control / interconnect" rather than spelled out: the only part of
     the C wide enough to hold type is the left column, 122 px on the overlay
     canvas, and the full name only fits there at the 14 px floor. */
  /* Second, detached piece below the L2: same region, same colour, one label.
     Its left edge is 0.7929, the L2 column's own left edge — the traced 0.794
     sits just past a bright wiring channel (0.7876-0.7920, peak 95) that
     separates it from instruction fetch, so the two correctly do not meet. */
  { label: 'L2 Control', sub: 'Interconnect', color: '#7a4a1c',
    at: [0.8310, 0.4089],
    polys: [
      [[0.7929,0.2788], [1,0.2788], [1,0.3010], [0.869,0.3010],
       [0.869,0.5237], [1,0.5237], [1,0.539], [0.7929,0.539]],
      [[0.7929,0.7981], [0.8486,0.7981], [0.8486,0.9952], [0.7929,0.9952]],
    ] },
  /* Staircase filling the two notches load/store was traced around, so the two
     share every edge between them. Its top was the only one of the five along
     the core's upper edge that was traced on the line (0.0269, min-channel 200);
     the rest have since been brought onto it. */
  /* Green. The two TLBs and the branch predictor used to be three shades of the
     same violet — the TLBs were literally the same hex, and the predictor 26 Lab
     away, which is not a difference you can name across a die. They are now
     chosen against the blocks they actually sit beside: this one's neighbours
     are L1d's red-orange, load/store's blue and L2's gold, all far from green,
     which is why the green went here and the teal went to the iTLB rather than
     the other way round — the iTLB sits against a green L1i cache.
     Green vs deep teal is 58 Lab apart, and 110 and 54 from the predictor. */
  /* "L2 DTLB", not "L2d TLB". The i/d belongs to TLB, not to the level: ITLB and
     DTLB are the acronyms and the level is a separate prefix, which is how AMD's
     own Zen 5 optimization guide writes them ("an 8-way set associative L2 ITLB
     with 2048 entries", "a unified 16-way L2 DTLB with 4096 entries" — the same
     2K and 4K quoted on these two blocks, which is the second confirmation that
     these are the right structures).

     The cache labels follow the same guide: it writes "a 32-Kbyte L1 instruction
     cache, often denoted as L1I" and "a 48-Kbyte L1 data cache, denoted as L1D",
     so they are "L1I Cache" and "L1D Cache" here, not L1i/L1d. Lowercase
     modifiers are common elsewhere — lscpu, most die annotations — but AMD's own
     document for this exact part uses caps, and caps also match every other
     acronym on this die: BTB, TLB, PHY, SMU, CPL, FADD.

     Note the two are built differently even though they now look alike. For
     caches the letter binds to the LEVEL — L1I and L1D are two distinct
     level-one caches, which is why there is no L2I: L2 is unified. For TLBs the
     letter binds to TLB and the level qualifies the pair. */
  { label: 'L2 DTLB', sub: '4K entries', color: '#d71dd7', at: [0.6995, 0.0522],
    polys: [
      [[0.6296,0.0269], [0.6296,0.1294], [0.6702,0.1294], [0.6702,0.0776],
       [0.7235,0.0776], [0.7235,0.2329], [0.7693,0.2329], [0.7693,0.0269]],
    ] },
  /* Two edges of this block moved as its neighbours arrived. The step in the
     left boundary went 0.7974 -> 0.7981 for the microcode ROM: a strong line
     (121), and the same one CPL's top and the L2 lower half's bottom sit on, so
     it runs most of the width of the die. The top of the notch went
     0.8567 -> 0.8625 for L1i and the L2 ITLB, which fill that notch exactly.
     0.8567 had nothing under it anywhere; 0.8625 is a 129-peak line under the
     iTLB half, and under the L1i half the die is a smooth field with no
     boundary at all between v 0.844 and 0.878. */
  /* Anchor sits on the polygon's own area centroid horizontally (u 0.4961) and
     just below the wide band's top edge at v 0.8321. The old anchor was up in
     the narrow left column, which reads as off to one side of an L-shaped
     block. Dropping it into the wide band also lets the fitter keep the type
     large: the widest rectangle the path admits is 0.227 x 0.063 uv centred
     here, against 0.20 x 0.056 at the old spot, and anything straddling
     v 0.8321 gets clipped on the right where the column ends at u 0.5386. */
  { label: 'Instruction Fetch', sub: 'and Decode', color: '#c93f90',
    at: [0.4961, 0.8636],
    polys: [
      [[0.3216,0.6692], [0.3216,0.7981], [0.3307,0.7981], [0.3307,0.8958],
       [0.4181,0.8958], [0.4181,0.9451], [0.4613,0.9451], [0.4613,0.9952],
       [0.6448,0.9952], [0.6448,0.8625], [0.7817,0.8625], [0.7817,0.9674],
       [0.7403,0.9674], [0.7403,0.9952], [0.7885,0.9952], [0.7885,0.8321],
       [0.5386,0.8321], [0.5386,0.6692]],
    ] },
  /* Was a muted lavender, which sat too close to the two TLB purples (#8f5fd0)
     and read as washed out against the die's blue field. Rose is the one hue
     nothing else in the core claims: the nearest neighbours are gold above,
     brown to the left and green across the notch, and it is well clear of
     instruction fetch's magenta, which does not touch this block anyway.
     Deepened from a first pass at #ff5c8a: that scored 3.99 against white type,
     the worst in the core, where this sits mid-pack at 5.06. */
  { label: 'CPL', color: '#ea3a6e', at: [0.9243, 0.8967],
    polys: [
      [[0.8486,0.7981], [0.8486,0.9952], [1,0.9952], [1,0.7981]],
    ] },
  /* Label keeps the user's question mark: this one is an educated guess from
     the block's position and banding, not read off an annotation. */
  { label: 'Integer Regfile?', color: '#b08a20', at: [0.3858, 0.3181],
    polys: [
      [[0.3426,0.2409], [0.3426,0.3952], [0.429,0.3952], [0.429,0.2409]],
    ] },
  /* Wraps integer execution's lower-left notch, sharing all three of its edges
     there. Its right edge, the regfile's left edge and integer execution's left
     edge are now one straight run at 0.3426 from v 0.2409 down to 0.5750 — the
     die shows no boundary line anywhere along it (min-channel never clears 9
     against a 2-5 background), so the three were made to agree rather than
     measured. */
  { label: 'Scheduling', color: '#2090bd', at: [0.4019, 0.6221],
    polys: [
      [[0.3426,0.2409], [0.2652,0.2409], [0.2652,0.6692], [0.5386,0.6692],
       [0.5386,0.5481], [0.4455,0.5481], [0.4455,0.5750], [0.3426,0.5750]],
    ] },
  /* The ~0.590 vertical is a DARK seam, not a bright line — min-channel bottoms
     out at 0.4 there against a 3-5 field — so it reads on the same profile, just
     inverted. Both of this block's near-0.590 edges sit on it. */
  /* Three pieces, one label. The tall strip runs down the left of the L2 BTB
     against the 0.5386 vertical, which integer execution, scheduling and
     instruction fetch already share between them over exactly this v range.
     The traced right side of that strip was a slow diagonal, 0.5563 drifting to
     0.5521 over 0.26 in v; the L2 BTB traced the same boundary as a step, and
     the diagonal passes straight through it, so it is built as the step. */
  { label: 'Branch', sub: 'Predictor', color: '#7358e0', at: [0.6278, 0.6248],
    polys: [
      [[0.5903,0.5736], [0.6881,0.5736], [0.6881,0.6051], [0.6653,0.6051],
       [0.6653,0.7094], [0.6004,0.7094], [0.6004,0.676], [0.5903,0.676],
       [0.5903,0.6404], [0.5796,0.6404], [0.5796,0.6093], [0.5903,0.6093]],
      [[0.5541,0.8321], [0.5386,0.8321], [0.5386,0.5007], [0.5903,0.5007],
       [0.5903,0.5346], [0.5725,0.5346], [0.5725,0.5739], [0.5566,0.5739],
       [0.5566,0.6707], [0.5541,0.6707]],
      /* The top-right section, as TWO pieces rather than the single hook it was
         traced as twice before. Same ground, but split at v 0.4667/0.4650 where
         L1 BTB's array finger comes between them: the upper piece sits above the
         finger, the lower one runs down its right side past the L2 BTB. Traced
         separately by the user, which is the better description — the hook was
         one outline pretending two disconnected areas were one shape.

         Every edge landed on a neighbour within 0.0024: L1 BTB above and right,
         L2 BTB below, load/store on the outside. */
      [[0.7275,0.4667], [0.7275,0.4036], [0.7866,0.4036], [0.7866,0.3513],
       [0.7183,0.3513], [0.7183,0.4667]],
      [[0.7303,0.4650], [0.7303,0.5007], [0.7505,0.5007], [0.7505,0.5315],
       [0.7571,0.5315], [0.7571,0.4650]],
    ] },
  /* --- vector regfile, four quarters on one grid -------------------------
     Two x pairs and two y pairs, so the top two share their y and the bottom
     two share theirs, while both rows sit on the same two column positions:

       xL0 0.0076   xL1 0.1277  |  xR0 0.1394   xR1 0.2595
       vT0 0.0269   vT1 0.2269  |  vB0 0.7952   vB1 0.9952

     The x values and the inner y values are measured. These arrays read DARK in
     the min channel and the wiring channels between them read bright, so every
     edge is a bright/dark transition.

     The OUTER y values are the core's own top and bottom edge, not the arrays'.
     The arrays measurably start at 0.0361 and end at 0.9851, leaving about 9 px
     of channel at each end; these four are the only regions along those two
     sides, so they now run to the edge like every other edge block rather than
     stopping short and leaving a sliver belonging to nobody.

     That costs a pixel of congruence. Measured, the rows would be 0.1996 and
     0.2005 tall — so the inner edges are set to make both exactly 0.2000, which
     moves vT1 and vB0 half a pixel each off their transitions and keeps all four
     quarters identical at 0.1201 x 0.2000.

     xL0 is the one value with nothing under it — no transition anywhere near
     the crop edge. It was traced at 0.0086, but the FADD/FMAC lanes below share
     these same columns and have to come out congruent, so it is set to 0.0076,
     making both columns exactly 0.1201 wide. There is a faint bump there to
     support it; the equal-width argument is doing most of the work. */
  { label: 'Vector Regfile ¼', color: '#5f8f2a', at: [0.0677, 0.1269],
    polys: [[[0.0076,0.0269], [0.0076,0.2269], [0.1277,0.2269], [0.1277,0.0269]]] },
  { label: 'Vector Regfile ¼', color: '#5f8f2a', at: [0.1995, 0.1269],
    polys: [[[0.1394,0.0269], [0.1394,0.2269], [0.2595,0.2269], [0.2595,0.0269]]] },
  { label: 'Vector Regfile ¼', color: '#5f8f2a', at: [0.0677, 0.8952],
    polys: [[[0.0076,0.7952], [0.0076,0.9952], [0.1277,0.9952], [0.1277,0.7952]]] },
  { label: 'Vector Regfile ¼', color: '#5f8f2a', at: [0.1995, 0.8952],
    polys: [[[0.1394,0.7952], [0.1394,0.9952], [0.2595,0.9952], [0.2595,0.7952]]] },

  /* --- FADD + FMAC lanes, four congruent blocks -------------------------
     Each is a body on the regfile's column grid with a narrower cap on the end
     facing the middle of the die. The bottom pair is the top pair mirrored in v.

       body   0.1201 wide x 0.1704 tall      cap  0.1133 wide x 0.0075 tall
       cap inset 0.0034 per side (measured 0.0031 / 0.0034)

     Anchored on the four strong outer edges — top 0.2293, cap ends 0.4072 and
     0.6149, bottom 0.7928 — which give a total lane height of 0.1779 in BOTH
     rows, to four decimals, measured independently. The internal step between
     body and cap has no line under it at all (peak 11 against a 3-8 field) so
     it is placed by that height split rather than measured; the result lands
     within a pixel of every one of the eight traced values.

     Note the lanes do NOT touch the regfiles: a wiring channel runs between
     them, bright at 130 / 119, so the ~3 px gap at v 0.2265-0.2293 and
     0.7928-0.7947 is real and deliberately left open. */
  { label: 'FADD + FMAC', sub: '256-bit lane', color: '#ff7b12', at: [0.0677, 0.3145],
    polys: [[[0.0076,0.2293], [0.1277,0.2293], [0.1277,0.3997], [0.1243,0.3997],
             [0.1243,0.4072], [0.0110,0.4072], [0.0110,0.3997], [0.0076,0.3997]]] },
  { label: 'FADD + FMAC', sub: '256-bit lane', color: '#ff7b12', at: [0.1995, 0.3145],
    polys: [[[0.1394,0.2293], [0.2595,0.2293], [0.2595,0.3997], [0.2561,0.3997],
             [0.2561,0.4072], [0.1428,0.4072], [0.1428,0.3997], [0.1394,0.3997]]] },
  { label: 'FADD + FMAC', sub: '256-bit lane', color: '#ff7b12', at: [0.0677, 0.7076],
    polys: [[[0.0110,0.6149], [0.0110,0.6224], [0.0076,0.6224], [0.0076,0.7928],
             [0.1277,0.7928], [0.1277,0.6224], [0.1243,0.6224], [0.1243,0.6149]]] },
  { label: 'FADD + FMAC', sub: '256-bit lane', color: '#ff7b12', at: [0.1995, 0.7076],
    polys: [[[0.1428,0.6149], [0.1428,0.6224], [0.1394,0.6224], [0.1394,0.7928],
             [0.2595,0.7928], [0.2595,0.6224], [0.2561,0.6224], [0.2561,0.6149]]] },

  /* Vector execution scheduling: one region, two pieces. Each piece is the
     exact complement of the lanes inside the band between them — the full
     column 0.3997 to 0.6224, minus the two cap rectangles the lanes occupy —
     so every edge it shares with a lane is literally that lane's edge. The
     traced outlines agreed with that complement to within 0.0026 everywhere,
     which is the reason to define it this way rather than snap edge by edge.

     ONE BLOCK PER COLUMN, not one two-piece block. It used to be a single region
     carrying both columns with `fit: false`, because the combined centre lands in
     the channel between them and the fitter would have rejected every candidate.
     That drew the name across both — and the channel, plus the section gap now
     inset on either side of it, cut a 25 px white slice straight through
     "Ex|ecution" and "Sche|duling". Dumping the fill canvas is what showed it.

     Split, each column fits its own name inside its own path at about 20 px,
     which is what the four regfiles and four FADD/FMAC lanes beside them already
     do. They share a label, so `together: true` in CORE_ORDER raises them as one
     and the split is invisible in the animation. */
  { label: 'Vector Execution', sub: 'Scheduling', color: '#3f5fd0',
    at: [0.0677, 0.5111],
    polys: [
      [[0.0076,0.3997], [0.0110,0.3997], [0.0110,0.4072], [0.1243,0.4072],
       [0.1243,0.3997], [0.1277,0.3997], [0.1277,0.6224], [0.1243,0.6224],
       [0.1243,0.6149], [0.0110,0.6149], [0.0110,0.6224], [0.0076,0.6224]],
    ] },
  { label: 'Vector Execution', sub: 'Scheduling', color: '#3f5fd0',
    at: [0.1995, 0.5111],
    polys: [
      [[0.1394,0.3997], [0.1428,0.3997], [0.1428,0.4072], [0.2561,0.4072],
       [0.2561,0.3997], [0.2595,0.3997], [0.2595,0.6224], [0.2561,0.6224],
       [0.2561,0.6149], [0.1428,0.6149], [0.1428,0.6224], [0.1394,0.6224]],
    ] },

  /* Its right boundary is instruction fetch's left boundary, edge for edge:
     0.3216 down to the step at 0.7981, then 0.3307. The 0.0027 the trace left
     between them at the upper run has nothing in it — no line anywhere in that
     window, min-channel never clears 6.5 — so the two were made flush. */
  { label: 'Microcode', sub: 'ROM', color: '#8a5a3a', at: [0.2980, 0.8322],
    polys: [
      [[0.2652,0.6692], [0.2652,0.9952], [0.3307,0.9952], [0.3307,0.7981],
       [0.3216,0.7981], [0.3216,0.6692]],
    ] },

  /* These two fill instruction fetch's notch exactly, side by side: L1i takes
     the full height of the left part, the iTLB the upper part of the right.
     Every edge of both is an edge fetch already had. */
  { label: 'L1I Cache', sub: '32 KB', color: '#1d1dd7', at: [0.6926, 0.9289],
    polys: [
      [[0.6448,0.8625], [0.6448,0.9952], [0.7403,0.9952], [0.7403,0.8625]],
    ] },
  /* Deep teal. It used to share the L2 DTLB's exact purple on the grounds that
     they are two halves of one structure, which made them impossible to tell
     apart and both of them hard to tell from the branch predictor. Teal because
     this one's neighbours are L1i's green, CPL's rose and instruction fetch's
     magenta; it is the darkest of the three at 7.02 against white type. */
  { label: 'L2 ITLB', sub: '2K entries', color: '#195776', at: [0.7610, 0.9150],
    polys: [
      [[0.7403,0.8625], [0.7817,0.8625], [0.7817,0.9674], [0.7403,0.9674]],
    ] },

  /* Wraps the branch predictor completely: this outline traverses the whole of
     that block's boundary in reverse, so the two share every edge of it. Where
     the two traces of that boundary disagreed the die settled it, and both
     times in favour of the outline already placed — the top at 0.5736 (the
     texture changes there: 5-14 outside, 1.3-1.7 inside) and the tab bottom at
     0.6760, against 0.5650 and 0.6680 from this trace, ~8 px each. */
  /* Fills the staircase notch left by instruction fetch and the microcode ROM.
     All six of its edges already existed — nothing here needed measuring, and
     nothing else moved. */
  { label: 'Microcode Cache?', sub: '6K entries', color: '#b3805c',
    at: [0.3944, 0.9702],
    polys: [
      [[0.3307,0.8958], [0.4181,0.8958], [0.4181,0.9451], [0.4613,0.9451],
       [0.4613,0.9952], [0.3307,0.9952]],
    ] },
  /* Lighter green than the L2 BTB below it: same structure one level up, the
     way the L2 cache, its tags and its control share the amber family. */
  { label: 'L1 BTB?', sub: '16K entries', color: '#8f2d4a', at: [0.6704, 0.7708],
    polys: [
      [[0.5541,0.7094], [0.7571,0.7094], [0.7571,0.4650], [0.7275,0.4650],
       [0.7275,0.4036], [0.7866,0.4036], [0.7866,0.8321], [0.5541,0.8321]],
    ] },
  { label: 'L2 BTB?', sub: '8K entries', color: '#3aa06a', at: [0.7112, 0.6573],
    polys: [
      [[0.5903,0.5007], [0.7505,0.5007], [0.7505,0.5315], [0.7571,0.5315],
       [0.7571,0.7094], [0.6653,0.7094], [0.6653,0.6051], [0.6881,0.6051],
       [0.6881,0.5736], [0.5903,0.5736], [0.5903,0.6093], [0.5796,0.6093],
       [0.5796,0.6404], [0.5903,0.6404], [0.5903,0.6760], [0.6004,0.6760],
       [0.6004,0.7094], [0.5541,0.7094], [0.5541,0.6707], [0.5566,0.6707],
       [0.5566,0.5739], [0.5725,0.5739], [0.5725,0.5346], [0.5903,0.5346]],
    ] },
].map(turnRegion);   // traced on core-detail.jpg, drawn on it turned

/* Slab thickness for every piece of core geometry — the stage-07 tiles and the
   stage-08 lift blocks alike. The core is 0.335 of the die's width and the
   camera closes in by about as much, so this is the floorplan's TILE_T seen at
   core scale (0.16 x 0.34). Sharing one value between the two stages is also
   what lets the handover between them gain no visible step in thickness. */
const LIFT_T = 0.055;
const CORE_SCALE = LIFT_T / TILE_T;
/* The floorplan's 0.34 would be wrong here. That is a WAVE — eight tiles, each
   occupying a third of the window, so three or four are in motion at once and
   what you read is the front, not the tiles. This is a SEQUENCE of 29 named
   blocks meant to be followed one at a time, so each takes a tenth of the
   window: a new block starts every 0.033 of it and about three are moving at
   any moment, which is enough overlap that the motion never stops dead and
   little enough that each block still gets its own beat. */
const CORE_FADE = 0.10;

/* Shape space is the core plane before its -90 deg rotation, so x is the
   texture's u and y its v inverted; the extrusion depth then becomes world up.
   Same convention PlaneGeometry uses, which is what lets the planar UV below
   line the photograph up exactly with the core underneath. */
/* Every core block is inset by half a gap, scaled by CORE_SCALE so the hairline
   subtends the same angle from a camera three times closer as the die's own
   cores-to-L3 gap does from the floorplan's. Insetting happens AFTER the uv to
   world conversion, because u spans 3.04 mm here and v only 1.54 — the same uv
   inset on both axes would put a gap twice as wide along one of them. */
const GAP_CORE = GAP * CORE_SCALE;
const coreShapes = (r) => r.polys.map((ring) => {
  const world = ring.map((p) => [(p[0] - 0.5) * coreW, (0.5 - p[1]) * coreH]);
  const cut = insetRing(world, GAP_CORE / 2) || world;
  const s = new THREE.Shape();
  cut.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
  return s;
});

/* ExtrudeGeometry keeps the shape's coordinates in x,y for the side walls too,
   so one planar pass covers every vertex. The walls are painted a flat colour
   and never sample the map, so their uv does not matter. */
const corePlanar = (geo) => {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, p.getX(i) / coreW + 0.5, p.getY(i) / coreH + 0.5);
  }
  return geo;
};

/* --- one core, block by block, as real tiles -------------------------
   Exactly the floorplan's construction at the core's scale: every block is its
   own slab of thick glass that lifts out of the die on a sine and settles to a
   standing offset, so the reveal is a wave crossing the core with a raised
   mosaic behind it.

   This used to be two flat planes over the core photograph, crossfading fill
   into outline. That made stage 04 the one reveal in the piece that was a
   diagram being coloured in rather than silicon coming apart, and it did not
   match the language stage 03 had already established one stage earlier. */
const coreTiles = [];
const coreTileGroup = new THREE.Group();
chip.add(coreTileGroup);
{
  /* Glow is turned right down for this group. At the floorplan's 13 big regions
     a 20 px bloom reads as a halo; at 29 small ones every region blooms into its
     neighbours and the whole core fills in with a flat grey wash. */
  /* Only the fill canvas. The floorplan builds an outline canvas too and
     crossfades to it, handing the silicon back once its regions have been read;
     the core does NOT, because a block here keeps its colour for the whole
     stage. That also avoids drawing every name twice — both canvases carry the
     name plate, so stacking them at full opacity double-strikes the type. The
     fill canvas is self-contained anyway: colour flood, white boundary stroke
     and the name, all in one. */
  const fillTex = overlayTexture(CORE_BLOCKS, 'fill', coreW / coreH, 0.22, 1,
                                 (GAP_CORE / 2) * (1600 / coreW));

  CORE_BLOCKS.forEach((r) => {
    const shapes = coreShapes(r);
    const col = new THREE.Color(r.color);
    /* Materials copied from the floorplan tiles, and split the same way: caps on
       the near side of the core plane so it paints over them and they read as
       glass, walls after it so nothing erases their edges. Neither writes depth
       — see RO_WALLS. */
    const side = new THREE.MeshStandardMaterial({
      color: col, emissive: col.clone().multiplyScalar(0.3),
      metalness: 0.2, roughness: 0.5, transparent: true, opacity: 0,
      depthWrite: false,
    });
    const face = new THREE.MeshPhysicalMaterial({
      transparent: true, opacity: 0, depthWrite: false,
      metalness: 0.12, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.3,
    });
    const geo = corePlanar(
      new THREE.ExtrudeGeometry(shapes, { depth: LIFT_T, bevelEnabled: false }));
    /* Centred on its own origin so the transparent sort has a real distance to
       work with — see "sorting transparent tiles" above RO_WALLS. This is the
       group where it matters most: 29 blocks packed edge to edge, any of which
       can be lifted by a hover or by the periodic jump. */
    const [ox, oz] = centreGeometry(geo);
    const mkPart = (mats, order) => {
      const m = new THREE.Mesh(geo, mats);
      m.rotation.x = -Math.PI / 2;
      m.position.set(coreCX + ox, 0.008, coreCZ + oz);
      m.renderOrder = order;
      /* A core block's identity is its label — there is no id for these — so the
       pick reads 'blk:<label>'. SUBJECT_OF maps that to a sheet. */
    m.userData.pick = 'blk:' + r.label;
      coreTileGroup.add(m);
      return m;
    };
    const body = mkPart([face, HIDDEN], 0);
    const walls = mkPart([HIDDEN, side], RO_WALLS);

    /* Coplanar with the top face rather than floating above it, so the highlight
       is painted ON the silicon; the polygon offset is what stops that
       z-fighting. */
    const mkCap = (map, order) => {
      const cap = corePlanar(new THREE.ShapeGeometry(shapes));
      centreGeometry(cap);          // same shapes, so the same origin as the body
      const m = new THREE.Mesh(cap,
        new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0,
                                      depthWrite: false, ...DIE_FACE_OFFSET }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(coreCX + ox, 0, coreCZ + oz);
      m.renderOrder = order;
      coreTileGroup.add(m);
      return m;
    };
    const fillCap = mkCap(fillTex, 50);

    const rec = { label: r.label, at: r.at, body, walls, face, side, fillCap,
                  color: r.color, fill: fillCap.material, k: 0 };
    body.userData.live = walls.userData.live = rec;
    coreTiles.push(rec);
  });

  /* Reveal order. NOT spatial — the blocks come up in the order an instruction
     meets them, so watching the stage is watching one instruction go through a
     core. That is the whole point of the sequence, and it is why the wave that
     used to cross the core on a geometric diagonal is gone.

     The first ten are the path itself: fetch and decode, the cache that fed
     them, the registers the operands come from, the units that do the work, the
     machinery that talks to memory, and the cache hierarchy standing behind it.
     After that the reveal fills in what the path depends on — how an address
     became a physical one, how the core knew what to fetch next, how a complex
     instruction decodes, how operations get ordered — then the second execution
     engine that runs alongside all of it, and finally the support logic that is
     not a stage at all.

     Entries are labels, and several blocks share one: L2 is two halves, and the
     vector regfiles and FADD/FMAC lanes are four each. A shared label expands
     into consecutive slots ordered top-to-bottom then left-to-right, so a set
     fills in as a set instead of jumping around the core. */
  const CORE_ORDER = [
    // the path an instruction takes
    'Instruction Fetch', 'L1I Cache', 'Integer Regfile?', 'Integer Execution',
    'Load / Store', 'L1D Cache',
    'L2 Cache ½', 'L2 Cache Tags', 'L2 Control',
    // turning a virtual address into a physical one
    'L2 DTLB', 'L2 ITLB',
    // how the front end knew what to fetch in the first place
    'Branch', 'L1 BTB?', 'L2 BTB?',
    // what decode leans on
    'Microcode Cache?', 'Microcode',
    // what decides when any of it actually runs
    'Scheduling',
    /* The other execution engine, in the same order as the integer side. These
       three rise as SETS: the four regfiles together, then the four FADD/FMAC
       lanes together, then the scheduling that feeds them. Four identical lanes
       arriving one after another reads as four separate ideas when it is one
       idea repeated four times — the vector unit is wide, and the width is the
       point. `together` is what collapses a label's blocks into one beat. */
    { label: 'Vector Regfile ¼', together: true },
    { label: 'FADD + FMAC', together: true },
    { label: 'Vector Execution', together: true },   // one block per column
    // support logic, not a stage the instruction flows through
    'CPL',
  ];

  /* One entry becomes one BEAT, and a beat may hold several blocks. Blocks
     sharing a beat share a k, so they rise as one; otherwise a label's blocks
     take consecutive beats, ordered top-to-bottom then left-to-right. */
  const beats = [];
  CORE_ORDER.forEach((entry) => {
    const label = entry.label || entry;
    const set = coreTiles.filter((tl) => tl.label === label)
      .sort((a, b) => (a.at[1] - b.at[1]) || (a.at[0] - b.at[0]));
    if (!set.length) console.warn(`CORE_ORDER names a block that does not exist: ${label}`);
    if (entry.together) beats.push(set); else set.forEach((tl) => beats.push([tl]));
  });
  const placed = beats.flat();
  if (placed.length !== coreTiles.length) {
    const named = new Set(placed);
    console.warn('CORE_ORDER misses:',
      coreTiles.filter((tl) => !named.has(tl)).map((tl) => tl.label));
  }
  beats.forEach((set, i) => {
    const k = (i / (beats.length - 1)) * (1 - CORE_FADE);
    set.forEach((tl) => { tl.k = k; });
  });
}

/* Stage 08 used to live here: the same blocks again as a second, solid set,
   lifted one at a time in instruction order. It is gone. The reveal above now
   carries that sequence itself, so a second pass over the same blocks was the
   piece saying the same thing twice — and it cost a duplicate 28-mesh group
   that existed only to be lifted out of the set already standing. */

/* --- metal stack ------------------------------------------------------
   Fifteen tiers of copper lifting apart, with vias standing between them, bond
   bumps capping the top, and a pulse of light climbing the whole thing.

   Five things carry this stage, and each is here for a reason:

   TIER GRADING. A real stack is not fifteen copies of one thing. The lowest
   levels are thin, tightly pitched and duller — barely copper to look at — and
   each level up is thicker, sparser and warmer until the top ones are effectively
   power rails and clock distribution. routingTexture already varies pitch and
   width; this adds the colour and the finish, so the eye can read HEIGHT from
   appearance alone rather than having to count.

   CASCADE. The tiers used to separate all at once. Now each GAP opens on its own
   ramp, bottom first, so the stack peels upward the way a deck lifts from the
   bottom card. `y` of a tier is therefore a running sum of the gaps below it,
   not a multiple of one global spread — which is what makes the motion read as
   fifteen separate sheets rather than one accordion.

   THE PULSE. A gaussian of light climbing the tiers, on emissiveIntensity so it
   brightens the copper's own colour. This is the only part of the stage that says
   what the wiring is FOR: without it, fifteen beautiful sheets of metal are just
   sheets of metal. Vias light as the wave passes them, a little ahead of the
   tiers, so the signal reads as travelling UP through the connections.

   NEAR-FADE. The camera now flies up through the stack, which means it passes
   through tiers. A textured plane crossing the near plane is a full-screen flash
   of copper. Each tier therefore fades as the camera approaches its plane, so a
   crossing reads as passing through a veil. Without this the immersive camera is
   unusable.

   THE FOLD. Having been taken apart, the stack goes back together, top first,
   onto a resting pitch rather than onto nothing, and leaves the lowest gap open
   as a room to stand in. This is the stage's exit and it is also the entrance to
   the two that follow it: the copper does not fade away to make space for the
   cells, it becomes the ceiling above them. The argument for each of those three
   choices sits with gapClose and gapSpan below. */

const stack = new THREE.Group();
stack.visible = false;
chip.add(stack);

/* How each tier looks, low to high: dull and cool at M1, warm copper at M15.
   Kept as a curve rather than a table so N_METAL can change. */
const tierLook = (i) => {
  const u = i / (N_METAL - 1);
  return {
    /* The PLANE's hue lives in its texture, so its tint only lifts the upper
       tiers slightly: higher metal is thicker and catches more light. */
    color: new THREE.Color().setScalar(THREE.MathUtils.lerp(0.82, 1.06, u)),
    /* The BARS have no map, so they can be graded here directly — tungsten-grey
       at M1 through to copper at the top. This is the tint that could not work on
       the plane: a material colour multiplies, so it can never desaturate an
       already orange texture toward grey. With no texture there is nothing to
       fight, and the same grading finally works as a colour. */
    bar: new THREE.Color().setHSL(
      THREE.MathUtils.lerp(0.075, 0.055, u),
      THREE.MathUtils.lerp(0.06, 0.50, u),
      THREE.MathUtils.lerp(0.50, 0.66, u)),
    rough: 0.34 - u * 0.2,                            // upper tiers more mirror-like
  };
};

const metalLayers = [];
for (let i = 0; i < N_METAL; i++) {
  const look = tierLook(i);
  const mesh = new THREE.Mesh(planeGeo, new THREE.MeshPhysicalMaterial({
    map: routingTexture(i), transparent: true, opacity: 0,
    color: look.color,
    emissive: new THREE.Color(0xff9c4a), emissiveIntensity: 0,
    metalness: 1.0, roughness: look.rough,
    side: THREE.DoubleSide, depthWrite: false,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 10 + i;
  mesh.userData.pick = `metal-${i}`;
  stack.add(mesh);
  metalLayers.push(mesh);
}

/* --- 3D structure within a tier ---------------------------------------
   A tier used to be one textured plane. Read from inside the stack that is a
   picture of wiring rather than wiring: it has no thickness, no side to catch
   light, and nothing to occlude the tier below.

   So every tier now also carries real geometry — parallel bars spanning the die,
   in a single routing direction, ALTERNATING per tier. That alternation is not a
   stylistic choice: real stacks route one layer horizontally and the next
   vertically precisely so a signal can turn a corner, and it is also what makes
   the stack read as a lattice from inside instead of as a stack of combs.

   Everything about a bar is graded by height, and the grading is the same story
   the texture already tells: many thin closely pitched bars at M1, a handful of
   fat ones at the top that are power and clock rather than signal. Thickness
   grades too, which is the part a plane could never show.

   The textured plane stays, underneath, as the fine field. Bars carry the depth,
   the plane carries the detail neither one alone would give.

   Bars are drawn SOLID (depthWrite on at full opacity) rather than blended like
   the plane. A blended box shows its own back faces through its front ones and
   stops reading as metal; and the see-through quality this stage wants comes from
   the gaps BETWEEN bars, which is structural, not material. */
const barGeo = new THREE.BoxGeometry(1, 1, 1);
/* Local scratch, not the shared _m/_q/_s/_t: those are declared further down the
   file, and this loop runs at module load, so reaching for them here is a TDZ
   error rather than a reuse. */
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion();
const _bs = new THREE.Vector3(), _bt = new THREE.Vector3();
const metalBars = [];
for (let i = 0; i < N_METAL; i++) {
  const u = i / (N_METAL - 1);
  const look = tierLook(i);
  const alongX = i % 2 === 0;
  const span = alongX ? DIE_W : DIE_H;      // the axis a bar runs along
  const across = alongX ? DIE_H : DIE_W;    // the axis they are pitched across
  const n = Math.max(4, Math.round(THREE.MathUtils.lerp(
    isSmall ? 26 : 44, 8, Math.pow(u, 0.85))));
  const pitch = across * 0.97 / n;
  const w = pitch * THREE.MathUtils.lerp(0.42, 0.62, u);   // fatter fill higher up
  const th = THREE.MathUtils.lerp(0.012, 0.070, Math.pow(u, 1.15));
  /* Jogs: short perpendicular hops, a third as many as the bars. Without them a
     single tier seen edge-on is a comb, and real routing does not run unbroken
     from one side of a die to the other. */
  const nj = Math.round(n * 0.34);
  const items = [];
  for (let k = 0; k < n; k++) {
    const c = ((k + 0.5) / n - 0.5) * across * 0.97;
    items.push(alongX ? { sx: span * 0.97, sz: w, x: 0, z: c }
                      : { sx: w, sz: span * 0.97, x: c, z: 0 });
  }
  for (let k = 0; k < nj; k++) {
    const len = pitch * THREE.MathUtils.lerp(1.6, 3.4, Math.random());
    /* Clamped so a jog cannot hang off the edge of the die. The centre used to be
       drawn across 0.9 of the span with no regard for the jog's own length, and a
       long one placed near the rim stuck out past the silicon — most visibly on
       the top tiers, where the pitch is widest and a jog can be nearly half the
       die deep. The half-length has to come out of the range, not be added to it. */
    const lim = (v, half) => (Math.random() - 0.5) * 2 * Math.max(v * 0.485 - half, 0);
    const a = lim(across, len / 2);
    const b = lim(span, w / 2);
    items.push(alongX ? { sx: w, sz: len, x: b, z: a }
                      : { sx: len, sz: w, x: a, z: b });
  }
  const mat = new THREE.MeshPhysicalMaterial({
    color: look.bar, emissive: new THREE.Color(0xff9c4a), emissiveIntensity: 0,
    metalness: 1.0, roughness: look.rough,
    transparent: true, opacity: 0, depthWrite: false,
  });
  const im = new THREE.InstancedMesh(barGeo, mat, items.length);
  im.renderOrder = 10 + i;
  im.userData.pick = `metal-${i}`;
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    _bt.set(it.x, 0, it.z);
    _bs.set(it.sx, th, it.sz);
    _bm.compose(_bt, _bq, _bs);
    im.setMatrixAt(k, _bm);
  }
  im.instanceMatrix.needsUpdate = true;
  stack.add(im);
  metalBars.push(im);
}

/* Gap g, between tier g and g+1, opens on its own window. Bottom gap first; the
   whole cascade takes GAP_SPAN and each gap itself opens in GAP_DUR. */
const GAP_T0 = 0.832, GAP_DUR = 0.028, GAP_STEP = 0.0032;
const gapOpen = (g, t) => ramp(t, GAP_T0 + g * GAP_STEP,
                                  GAP_T0 + g * GAP_STEP + GAP_DUR);

/* ...and then it folds back up, TOP first, which is not the opening cascade
   played backwards and must not be written as one. Three things differ, and each
   of them is the difference between a fold and a rewind:

   IT CLOSES FROM THE TOP. The open peels upward from M1 because M1 is what the
   stack is anchored to, and the fold has to come back DOWN onto M1 for the same
   reason: the last thing to move must be the thing the camera is about to stand
   on. Running gapOpen in reverse would fold M1 into M2 first and leave the top
   of the stack hanging in the air with nothing under it.

   IT IS QUICKER AND TIGHTER. 0.026 of t against the open's 0.077, with the gaps
   overlapping three times as hard. A shape the eye already knows does not need
   the reading time the first reveal needed, and the camera is descending with it
   anyway, so the motion is already being paid for twice.

   AND IT DOES NOT CLOSE TO ZERO. Fifteen coplanar transparent planes is not a
   stack, it is a z-fight with fifteen times the overdraw in one band, and "M1 is
   the floor" means nothing if M15 is also the floor. CLOSED_FRAC leaves a real
   pitch. That is also the more honest reading of the two: the exploded view was
   the exaggeration, and this is closer to what the stack is.

   CLOSED_FRAC is 0.28 and not the 0.10 it started at, and the number is set by
   the VIAS rather than by how the copper looks. A via is exactly as tall as the
   gap it crosses, so at 0.10 the folded gaps were 0.03 and every via in them
   disappeared into the slab halfway through the move — the fold read as the
   connections being deleted rather than as the layers closing up. At 0.28 the
   gap is 0.084, the upper vias are wider than they are tall and read as studs
   between the sheets, and nothing ever vanishes. It is still a 3.5x compression,
   which is more than enough to read as a fold. */
const CLOSE_T0 = 0.926, CLOSE_DUR = 0.012, CLOSE_STEP = 0.0011;
const CLOSED_FRAC = 0.28;                 // resting pitch, as a share of LAYER_GAP
const gapClose = (g, t) => (g === 0 ? 0 : ramp(
  t, CLOSE_T0 + (N_METAL - 2 - g) * CLOSE_STEP,
     CLOSE_T0 + (N_METAL - 2 - g) * CLOSE_STEP + CLOSE_DUR));

/* Gap 0 is the exception, and it is the point of the whole stage. The fold
   closes the fourteen gaps above it and leaves this one — widened — as the room
   the reader is left standing in: M1 underfoot, the other fourteen tiers
   compacted into a ceiling overhead, and the cell rows showing through the floor.

   There is no other way to be under the copper and above the cells at the same
   time. The camera's near plane is 0.05 and a folded gap is 0.03, so a camera
   between two folded tiers is inside both of them. */
const ROOM = 1.50;
const roomOpen = (t) => ramp(t, 0.930, 0.952);

/* The height of gap g right now: opened, then folded back toward its resting
   pitch, except gap 0 which is opened further into the room. Written as a pure
   function of BOTH ramps rather than as a switch on which phase we are in, so
   that scrubbing backwards through the fold is exact rather than approximately
   reversible. */
const gapSpan = (g, t) => {
  const o = gapOpen(g, t);
  if (g === 0) return LAYER_GAP * o + (ROOM - LAYER_GAP) * roomOpen(t);
  const c = gapClose(g, t);
  return LAYER_GAP * (o * (1 - c) + CLOSED_FRAC * c);
};

/* Running height of each tier, given how far every gap below it has opened.
   Written into this array once per frame and read by the tiers, the vias and the
   bumps, so the three can never disagree about where a tier is. */
const tierY = new Float32Array(N_METAL);

/* Vias. Denser and finer in the lower gaps, sparser and fatter higher up, which
   is the same story the tier grading tells and the reason a real stack is built
   this way: thousands of short local connections at the bottom, a handful of fat
   power pillars at the top. */
const viaGeo = new THREE.BoxGeometry(1, 1, 1);
/* depthWrite stays ON, unlike most transparent things here, and that is what
   makes a via read as a solid rod rather than a coloured film. It was turned off
   once to stop a column hiding the inverter and the cure was far worse than the
   disease: every via in the stack and every column in the room went see-through
   at the same time. The cell is kept in front by disabling depth TESTING on the
   cell instead, which is a property of the thing that needs to win rather than
   of every object it might lose to. */
const viaMat = new THREE.MeshStandardMaterial({
  color: 0xd79a5f, emissive: new THREE.Color(0xff8a3c), emissiveIntensity: 0,
  metalness: 0.72, roughness: 0.34, transparent: true, opacity: 0,
});
/* Placed with a seeded generator rather than Math.random, unlike the bar jogs
   above, which are right to use it. The difference is what the gap-0 vias become
   once the stack folds: the fold leaves that gap open as a room, so those vias
   stretch into the columns the stop 06 camera stands among, and they are the
   most prominent geometry in that shot. A composed shot cannot have its
   foreground rearrange itself on every reload, and the video renderer diffs
   frames. The jogs are never anybody's subject; these are. */
const viaRnd = (() => {
  let s = 0x9e3779b1 >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
})();
const viaSeeds = [];
for (let g = 0; g < N_METAL - 1; g++) {
  const u = g / (N_METAL - 2);
  /* Gap 0 carries a fifth of what the others do, and it is thinned HERE at build
     time rather than during the fold. It is the gap the stack leaves open as a
     room, so its vias are the only ones that end up metres tall and standing
     where the camera walks: at the density the other gaps use, the room is a
     forest and the nearest columns are seventy pixels wide.

     An earlier pass kept the full count and shrank the surplus away as the room
     opened. That was worse, and visibly so: the fold is watched from outside,
     and five sixths of the columns quietly evaporating mid-flight reads as the
     scene breaking. Nothing here disappears now. There are simply fewer of them,
     from the first frame to the last. */
  let n = Math.round((isSmall ? 70 : 150) * (1 - 0.62 * u));     // fewer, higher up
  if (g === 0) n = Math.round(n / 5);
  const w = 0.026 + 0.10 * Math.pow(u, 1.5);                     // fatter, higher up
  for (let k = 0; k < n; k++) {
    /* Gap 0 is the one the fold leaves open, so these are the vias that become
       the room's columns. Only a sample of them stays: at the density that is
       right for the stack — thousands of short local connections, which is the
       whole point being made there — a camera standing INSIDE the gap is inside
       a forest, and the near ones are 70px wide and wall off the frame. The rest
       retire as the room opens. The room is a 500x exaggeration of a 30nm gap;
       drawing a representative few of its vias is the same order of licence, and
       it is the only version you can see the floor through. */
    viaSeeds.push({ gap: g, w,
      x: (viaRnd() - 0.5) * DIE_W * 0.94,
      z: (viaRnd() - 0.5) * DIE_H * 0.94 });
  }
}
const vias = new THREE.InstancedMesh(viaGeo, viaMat, viaSeeds.length);
vias.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
/* Frustum culling OFF, and this is not an optimisation being declined — it is a
   correctness fix for a mesh whose instances move.

   three.js culls an InstancedMesh against a boundingSphere it computes ONCE, the
   first time it needs one, from wherever the instances happened to be at that
   moment. These are re-composed every frame and travel the whole height of the
   stack as the gaps open, so the cached sphere is stale within a frame of being
   made and describes a volume the geometry has long since left. The renderer
   then culls the mesh whenever the camera looks at where the instances actually
   are, and it reappears when the camera swings back over the stale sphere. */
vias.frustumCulled = false;
vias.userData.pick = 'metal-via';
stack.add(vias);

/* Bond bumps above the top tier: where the die finally meets the package, and
   the thing the whole stack has been climbing toward. They arrive last, once the
   cascade has finished, which gives the stage an ending rather than a stop. */
const BUMP_NX = 9, BUMP_NZ = 8;
const bumpMat = new THREE.MeshPhysicalMaterial({
  color: 0xe8b98a, metalness: 0.9, roughness: 0.22,
  transparent: true, opacity: 0, clearcoat: 0.5,
});
const bumps = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.17, 16, 12), bumpMat, BUMP_NX * BUMP_NZ);
/* Same stale-boundingSphere problem as the vias above, and this is the one that
   was visible: the bumps ride the top tier from y 0.02 up to 4.22 as the stack
   opens, so a sphere computed while they were still down at the bottom culls
   them for the whole climb. Panning up gave a bare top, and they "spawned" the
   moment the camera moved far enough for that old sphere to re-enter the
   frustum. Nothing was wrong with the fade — they were being drawn correctly and
   then thrown away. */
bumps.frustumCulled = false;
bumps.userData.pick = 'metal-bump';
stack.add(bumps);
const bumpSeeds = [];
for (let ix = 0; ix < BUMP_NX; ix++) {
  for (let iz = 0; iz < BUMP_NZ; iz++) {
    bumpSeeds.push({
      x: ((ix + 0.5) / BUMP_NX - 0.5) * DIE_W * 0.86,
      z: ((iz + 0.5) / BUMP_NZ - 0.5) * DIE_H * 0.86,
    });
  }
}

/* --- the standard cell rows -------------------------------------------
   The stack stage says what the copper IS. This one says what it is for.

   Beneath the lowest layer of metal the design stops being wiring and starts
   being logic, and the first surprising thing about that logic is how regular it
   looks. There is no sea of bespoke transistors down here. There is a field of
   prebuilt tiles, every one of them the same height, snapped into rows and
   pushed up against its neighbours with nothing in between.

   Three properties carry the stage, and only three, because the camera stands
   three units off a field eight units across and anything finer than this is a
   shimmer at that distance:

   ONE HEIGHT, MANY WIDTHS. The rows are identical and the cells inside them are
   not. That contrast IS the teaching point. A fixed height is what lets a tile
   be dropped anywhere in any row; a free width is what lets an inverter cost a
   quarter of the area an adder does.

   RAILS ON EVERY BOUNDARY. Power and ground run the full length of each row
   edge and are SHARED between the row above and the row below, which is why real
   rows alternate their orientation and why a row height is a hard number in the
   library rather than a preference.

   ABUTMENT, NOT SPACING. The cells touch. A field of tiles with air between them
   is a picture of a floorplan; a field with no air is a picture of a standard
   cell row, and that difference is the entire point of the stage. The 0.006 gap
   below is a seam, not a space: without it neighbouring cells fuse into one long
   bar and the row stops having cells in it at all.

   SEEDED DETERMINISTICALLY, unlike the vias and the bar jogs above, which reach
   for Math.random() at module load and are right to. Nothing in the piece
   composes a shot against an individual via, so it does not matter where they
   land. A camera key DOES aim at one named cell here, and both shot.py and the
   video renderer diff frames against previous captures, so a field that
   reshuffled on every reload would slide the subject out from under the lens and
   make every capture a different picture. */
const cellField = new THREE.Group();
cellField.visible = false;
chip.add(cellField);

/* ROW_N is odd at BOTH breakpoints deliberately, and the rows are laid out from
   the centre outward rather than from one edge, so there is always a row centred
   exactly on z = 0 however many of them there are. That is what lets the hero
   cell be a fixed world point instead of an index into a field whose spacing
   changes with the viewport — the stop 06 camera key has to aim at the same
   object on a phone as it does on a desktop. */
const ROW_N     = isSmall ? 13 : 21;
const ROW_PITCH = DIE_H * 0.92 / ROW_N;
/* A cell is as tall as its row, and EXACTLY as tall — no seam. That is not a
   detail, it is the definition: the library picks one height, every cell is drawn
   to it, and the power rails run along the top and bottom edges where they are
   shared with the row above and below.

   The 0.97 this carried, matching the sliver the widths use, was wrong for a
   reason worth recording. Cells within a row are separate objects and the seam
   between them is what makes them read as separate. Rows are not: a row boundary
   is where two cells ABUT, and the rail sits on that line. Left 3% short, every
   boundary opened a gap the rail was then laid over, and the void showed as a
   faint grey line running the length of each rail and taking its colour with it. */
const CELL_H    = ROW_PITCH;
const CELL_T    = 0.070;                     // how far a cell stands proud
/* The device layer, below M1 at 0.02. The exact depth is set by the stage that
   follows rather than by this one: the output via at stop 07 has to climb from
   the cell's own metal up into M1, and at anything shallower than this that
   climb is a couple of pixels and the pulse has nowhere to travel. */
const CELL_Y    = -0.160;
const CELL_UNIT = 0.082;                     // one track pitch; widths are multiples
const CELL_W_U  = [2, 3, 3, 4, 4, 6, 8];     // an inverter is 2 wide, an adder is 8
const CELL_GAP  = 0.006;                     // a seam, not a space. See above.
const FIELD_X   = DIE_W * 0.46;
const rowZ = (r) => (r - (ROW_N - 1) / 2) * ROW_PITCH;

/* The hero cell is AUTHORED rather than looked up out of the generated field,
   for the reason given above: a camera key has to be written against a fixed
   point. Six tracks wide, which is a realistic inverter once its well taps are
   counted, and wide enough to read at the standoff stop 07 lands at. */
const HERO_ROW = (ROW_N - 1) / 2;
const CELL_W   = CELL_UNIT * 6;
const CELL_C   = new THREE.Vector3(0.60, CELL_Y, rowZ(HERO_ROW));
const HERO_L   = CELL_C.x - CELL_W / 2;
const HERO_R   = CELL_C.x + CELL_W / 2;

/* A plain 32-bit LCG. Deliberately not Math.random: see the note above. */
const cellRnd = (() => {
  let s = 0x2f6e2b1 >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
})();
const cellW = () => CELL_UNIT * CELL_W_U[Math.floor(cellRnd() * CELL_W_U.length)];

const cellSeeds = [];
for (let r = 0; r < ROW_N; r++) {
  const z = rowZ(r);
  if (r === HERO_ROW) {
    /* The hero row is packed OUTWARD from the hero cell in both directions, so
       that its two neighbours abut it exactly. Packing this row left to right
       like the others and jumping over the reserved slot would leave a ragged
       hole against the one cell the camera actually lands on, and a hole in a
       row of abutted cells reads as a mistake rather than as a gap. */
    for (let x = HERO_R + CELL_GAP, w = cellW(); x + w <= FIELD_X; x += w + CELL_GAP, w = cellW())
      cellSeeds.push({ x: x + w / 2, z, w, g: cellRnd() });
    for (let x = HERO_L - CELL_GAP, w = cellW(); x - w >= -FIELD_X; x -= w + CELL_GAP, w = cellW())
      cellSeeds.push({ x: x - w / 2, z, w, g: cellRnd() });
    continue;
  }
  for (let x = -FIELD_X, w = cellW(); x + w <= FIELD_X; x += w + CELL_GAP, w = cellW())
    cellSeeds.push({ x: x + w / 2, z, w, g: cellRnd() });
}

/* One draw call for every cell in the field. The file's own note above says this
   scene is fill-rate bound rather than geometry bound, and five hundred small
   boxes lying nearly flat is close to free: they cover the lower half of the
   frame once, at almost no overdraw, which is a fraction of what a single
   floorplan tile costs. */
const _cellCol = new THREE.Color();
const cellMat = new THREE.MeshStandardMaterial({
  metalness: 0.15, roughness: 0.55, transparent: true, opacity: 0,
  depthWrite: false,
});
const cells = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1), cellMat, cellSeeds.length);
/* renderOrder is explicit rather than left to the distance sort, here and on the
   rails, because the idle camera drift perturbs every distance a little on every
   frame, and a floor that occasionally sorts behind its own ceiling is not
   something to leave to a tiebreak. */
cells.renderOrder = 5;
cells.frustumCulled = false;
cellField.add(cells);
{
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const tv = new THREE.Vector3(), sv = new THREE.Vector3();
  for (let k = 0; k < cellSeeds.length; k++) {
    const c = cellSeeds[k];
    tv.set(c.x, CELL_Y, c.z);
    sv.set(c.w, CELL_T, CELL_H);
    cells.setMatrixAt(k, m.compose(tv, q, sv));
    /* A narrow spread of cool grey. Wider than this and the field reads as a
       mosaic of different MATERIALS, when the thing that actually differs
       between two cells is only what they compute.

       Bright, though, and that is not a taste call. The cells are seen THROUGH
       the gaps between M1's bars from a camera above them, so they are competing
       with lit copper for the same pixels; at the lightness this started at they
       lost, and the floor read as a sheet of metal with a dark basement under it
       rather than as a field of tiles. */
    cells.setColorAt(k, _cellCol.setHSL(0.58, 0.10, 0.42 + c.g * 0.13));
  }
  cells.instanceMatrix.needsUpdate = true;
  cells.instanceColor.needsUpdate = true;
}

/* Supply is warm and ground is cool, and these two constants are the only place
   that is decided. The inverter's own straps read them straight out of here, so
   the rail running along the top of the hero cell is the same colour as the rail
   running along the top of every other cell in the field, and a reader crossing
   from the floor to the cell is not asked to learn a second scheme. */
const VDD_COL = 0xd9924e, GND_COL = 0x7f8fa8;

/* The rails: one per row BOUNDARY, hence ROW_N + 1 of them, alternating supply
   and ground. Sharing them is the reason a row is worth having — two adjacent
   rows draw their power from the same strip of metal, which is also why every
   other row is mirrored top to bottom in a real layout. */
const RAIL_H = ROW_PITCH * 0.15;
/* How thick a rail is drawn. 0.010 and not the 0.026 it started at, because at
   0.026 the rail's own near side face was almost as tall on screen as its top
   face was deep, and the edge between the two landed about two thirds of the way
   across — a faint dark line running the length of every rail that read as a
   seam in the metal rather than as the side of a bar.

   Thin is also the truer reading. M1 is a FILM, and the cell's own pads on the
   same layer are 0.007; a rail four times thicker than the metal it is part of
   was the odd one out. At 0.010 the side is a hairline and the top reads as one
   continuous colour. It also lifts the rail clear of the cell tops, which it had
   been intersecting by 0.003. */
/* A rail is a thin BAR, and the two numbers under it are the whole story of a
   dark line that took three attempts to kill.

   The line was the rail's own near side face. At metalness 0.72 a face turned
   away from the single key light in this scene falls to almost black, so every
   rail carried a hard dark edge that read as a seam in the floor. Thinning the
   box from 0.026 to 0.010 shrank it without removing it — thickness was never
   what made it dark. Flattening it to a plane removed it completely and took the
   rail's depth with it, which is worse: a power rail is a bar of metal and it
   should look like one.

   The fix is the FINISH, not the form. At 0.40 the side face is lit enough by
   the ambient and the environment to read as copper in shadow rather than as a
   black line, and the rail keeps an edge to catch the key light along its top.
   The cell boxes underneath have been proving this the whole time: they sit at
   metalness 0.15 and their sides have always read correctly. */
const RAIL_T = 0.011;
const railGeo = new THREE.BoxGeometry(1, 1, 1);
/* How far above a cell's own body the M1 layer sits. The field's rails and the
   inverter's straps both read this, so the metal in the hero cell lines up with
   the metal running past it instead of floating a hair above or below it.

   ABOVE THE DEVICES, not resting on them, because that is where metal one is: the
   gate and the diffusion are silicon and poly, M1 is the first layer of wiring
   over the top of them, and the contacts are the posts that climb from one to the
   other. A rail level with the gate it is insulated from is not a wiring layer,
   it is a kerb.

   0.060 clears the gate at 0.053. It sat at 0.037 for one commit while the dark
   line alongside every rail was being chased, and it was the wrong lever: the
   line was the rail box own side face, and the rail is a plane now, which is what
   actually fixed it. A plane has no underside to look into, so the height is free
   to be whatever the stack says it should be. */
const RAIL_Y_OFF = 0.060;
const railMat = new THREE.MeshStandardMaterial({
  metalness: 0.40, roughness: 0.34, transparent: true, opacity: 0,
  depthWrite: false,
});
/* Unbroken, all the way across, including past the hero cell. The cell does not
   draw rails of its own and never should have: a standard cell has no power
   straps, it has the ROW's rails running along its top and bottom edges, shared
   with the row above and the row below. That sharing is half the reason a row
   exists. Drawing a second pair over the hero cell said the opposite, and cutting
   a notch for them only made the seam tidier without making the claim true.

   So the inverter reaches UP AND OUT to these instead. Its power connections stop
   at rail height and run in z to meet the line, which is also why the metal lift
   at stop 07 raises only the signal metal: the rails are not the cell's to lift. */
const rails = new THREE.InstancedMesh(railGeo, railMat, ROW_N + 1);
rails.renderOrder = 6;
rails.frustumCulled = false;
cellField.add(rails);
{
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const tv = new THREE.Vector3(), sv = new THREE.Vector3();
  for (let b = 0; b <= ROW_N; b++) {
    tv.set(0, CELL_Y + RAIL_Y_OFF, rowZ(b) - ROW_PITCH / 2);
    sv.set(FIELD_X * 2, RAIL_T, RAIL_H);
    rails.setMatrixAt(b, m.compose(tv, q, sv));
    /* Which boundary is supply is fixed RELATIVE TO THE HERO ROW rather than by
       the raw index, so the rail along that cell's PMOS edge is always the supply
       one. Keyed off b % 2 it depended on ROW_N's parity. */
    const vdd = (((b - HERO_ROW) % 2) + 2) % 2 === 1;
    rails.setColorAt(b, _cellCol.set(vdd ? VDD_COL : GND_COL));
  }
  rails.instanceMatrix.needsUpdate = true;
  rails.instanceColor.needsUpdate = true;
}

/* The hero cell's own tile, drawn as a separate mesh with its footprint left
   empty in the instanced field above. It exists so the inverter at stop 07 can
   crossfade OUT of a plain tile, which is the whole rhetorical move of that
   stage: the thing you were looking at all along turns out to be a gate. Doing
   that with one instance of a shared mesh would mean scaling it away on a
   threshold and hoping the sort held. */
const heroMat = new THREE.MeshStandardMaterial({
  color: 0x9aa8bd, metalness: 0.15, roughness: 0.50,
  transparent: true, opacity: 0, depthWrite: false,
});
const heroCell = new THREE.Mesh(
  new THREE.BoxGeometry(CELL_W, CELL_T, CELL_H), heroMat);
heroCell.position.copy(CELL_C);
heroCell.renderOrder = 5;
cellField.add(heroCell);

/* --- one cell, one gate ------------------------------------------------
   The last stage, and the only one on the whole descent that shows something
   DOING rather than something being.

   This is the same `fets` group the page has always had, re-parameterised rather
   than replaced. It used to be a free-floating patch of fins and crossed gate
   bars at no stated scale, sitting in space with no relationship to anything the
   viewer had just been shown. Now it is the inside of one tile in the field
   above, at that tile's real size and in that tile's real place, and the plain
   box drawn there crossfades out from underneath it. That is the whole move of
   the stage: the thing you were looking at all along turns out to be a gate.

   It is an inverter because an inverter is the smallest thing that is still
   honestly CMOS. Two devices, complementary, sharing one gate. Everything larger
   on the die is this argument repeated.

   Note on hygiene, because two of the file's own rules look like they apply here
   and do not:

   · centreGeometry is NOT called on any of this. Its contract is re-origining an
     extruded tile that gets laid flat by a -90 degree rotation about x, and it
     returns the parent-space offset that rotation implies. Every object below is
     an origin-centred BoxGeometry and none of them is rotated, so a call would
     silently translate the cell rather than fix it.
   · DIE_FACE_OFFSET is used on the n-well and nowhere else, because the n-well
     is the only genuinely coplanar pair in here. The metal pads sit at their own
     height above the contacts and do not need it. */
const fets = new THREE.Group();
fets.visible = false;
fets.position.copy(CELL_C);
chip.add(fets);

/* Local space is the cell's own: x across its width, z across its height, y up
   from the middle of its body. M1 sits at world 0.02, so it is at local M1_Y. */
const INV_W = CELL_W, INV_H = CELL_H;
const M1_Y  = 0.02 - CELL_Y;

/* --- the two devices ---------------------------------------------------
   Each transistor is drawn the way the reference draws it: two doped blocks
   with a gate standing between them, rather than as an array of fins.

   The fins were more accurate to N4P and less legible than anything else in the
   piece. Four ridges per device, at a size where the whole cell is half a unit
   wide, read as texture rather than as structure — and the thing this stage has
   to say is not what a fin is, it is which terminal is which and what each one
   is wired to. The caption two stops earlier already spent its words on the
   process. Here, one block per terminal.

   SOURCE AND DRAIN ARE THE SAME OBJECT, deliberately. In a MOSFET they are
   physically identical and interchangeable; what makes one a source and the
   other a drain is only what it is connected to. So they are drawn identically
   and the WIRING tells them apart: the sources reach out to the rails, the two
   drains are strapped to each other and that junction is the output. Colouring
   them differently would be inventing a distinction the silicon does not have.

   The colour coding is the reference's: P-type green, N-type a teal blue, the
   gate salmon, and a thin band of gate oxide in yellow between the gate and the
   channel it controls. The N-type is pushed toward teal rather than the
   reference's flat blue so that it cannot be read as the cool GND rail, which
   is a colour this page had already committed to. */
const DEV_Z  = INV_H * 0.255;          // centre of each device band
const DEV_D  = INV_H * 0.30;           // how deep a band runs in z
const DEV_X  = INV_W * 0.265;          // source and drain, either side of the gate
const DEV_W  = INV_W * 0.34;
const DEV_Y  = 0.010, DEV_T = 0.040;

const PMOS_COL = 0x4c9e5c, NMOS_COL = 0x2f8fa8;

/* One mesh, four blocks: PMOS source and drain, then NMOS source and drain. The
   split is by index and the switching loop walks it, so there is one array to
   keep in step rather than two meshes to keep in agreement. */
const DEVS = [
  [-DEV_X,  DEV_Z], [ DEV_X,  DEV_Z],
  [-DEV_X, -DEV_Z], [ DEV_X, -DEV_Z],
];
const DEV_PER = 2;                     // blocks per device, so index < 2 is PMOS
const devMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, metalness: 0.12, roughness: 0.48,
  transparent: true, opacity: 0, clearcoat: 0.3,
});
const devs = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1), devMat, DEVS.length);
devs.userData.pick = 'fets';
fets.add(devs);
{
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const tv = new THREE.Vector3(), sv = new THREE.Vector3();
  sv.set(DEV_W, DEV_T, DEV_D);
  for (let i = 0; i < DEVS.length; i++) {
    tv.set(DEVS[i][0], DEV_Y, DEVS[i][1]);
    devs.setMatrixAt(i, m.compose(tv, q, sv));
  }
  devs.instanceMatrix.needsUpdate = true;
  devs.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(DEVS.length * 3), 3);
}
const _dc = new THREE.Color();
const DEV_BASE = [PMOS_COL, PMOS_COL, NMOS_COL, NMOS_COL].map((hex) => {
  _dc.set(hex);
  return [_dc.r, _dc.g, _dc.b];
});
/* Conducting is the same colour lifted past 1.0 rather than a different hue.
   ACES rolls the overshoot into a highlight, so a channel that turns on reads as
   the same silicon carrying current instead of as a lamp swapped in behind it.

   MOSTLY MULTIPLIED, barely offset, and the balance between those two numbers is
   the whole thing. A flat offset lifts every channel by the same amount, which is
   the definition of desaturating toward white — at +0.95 a conducting PMOS came
   out near enough white that the green was gone, and since the cell RESTS with
   the PMOS on, that was most of the time. Multiplying preserves the ratios
   between the channels, so a bright green stays green. */
const DEV_HOT = DEV_BASE.map((c) => c.map((v) => v * 3.2 + 0.06));

/* Three strips of poly, and only the middle one is the gate. The other two sit
   on the cell boundaries, which is what a real cell carries: a dummy strip at
   each edge so the device beside the boundary sees the same neighbourhood as one
   in the middle of a row. They are also what makes the abutment legible from
   inside a cell.

   Salmon, and standing taller than the blocks it crosses, because the gate is
   the one part of this picture that is doing something. */
const GATE_N = 3;
const GATE_COL = 0xdd6a4a;
const gateMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, metalness: 0.25, roughness: 0.42,
  transparent: true, opacity: 0,
});
const gates = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1), gateMat, GATE_N);
gates.userData.pick = 'fets';
fets.add(gates);
{
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const tv = new THREE.Vector3(), sv = new THREE.Vector3();
  sv.set(INV_W * 0.12, 0.066, INV_H * 0.92);
  for (let i = 0; i < GATE_N; i++) {
    tv.set((i - 1) * INV_W * 0.5, 0.020, 0);
    gates.setMatrixAt(i, m.compose(tv, q, sv));
  }
  gates.instanceMatrix.needsUpdate = true;
  gates.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(GATE_N * 3), 3);
}
const GATE_LIVE = 1;                    // the middle strip is the one being driven
const GATE_BASE = (() => { _dc.set(GATE_COL); return [_dc.r, _dc.g, _dc.b]; })();
const GATE_HOT  = GATE_BASE.map((v) => v * 2.4 + 0.30);
/* The two dummies are a dull grey-brown, not a dimmer salmon. Dimming alone was
   not enough: three salmon strips across a cell read as three gates, and this
   cell has exactly one. Poly is poly in a real layout and these really are the
   same material, but only one of them is connected to anything, and that is the
   distinction worth drawing here. */
const GATE_DIM = (() => { _dc.set(0x6b5c57); return [_dc.r, _dc.g, _dc.b]; })();

/* Gate oxide: the sliver of insulator that is the entire reason a MOS gate
   works. It is a couple of atoms thick in reality and it is drawn at a
   thousand times that here, for the same reason the metal stack is exaggerated
   400x — a layer you cannot see is a layer nobody learns. Yellow, as the
   reference has it, and the only warm-light colour in the cell that is not
   copper. */
const OXIDE_N = 2;
const oxideMat = new THREE.MeshPhysicalMaterial({
  color: 0xe9c25c, metalness: 0.0, roughness: 0.55,
  transparent: true, opacity: 0,
});
const oxides = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1), oxideMat, OXIDE_N);
fets.add(oxides);
{
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const tv = new THREE.Vector3(), sv = new THREE.Vector3();
  sv.set(INV_W * 0.022, 0.050, INV_H * 0.92);
  for (let i = 0; i < OXIDE_N; i++) {
    tv.set((i === 0 ? -1 : 1) * INV_W * 0.077, 0.014, 0);
    oxides.setMatrixAt(i, m.compose(tv, q, sv));
  }
  oxides.instanceMatrix.needsUpdate = true;
}

/* The n-well: the tub the PMOS sits in, and the reason the PMOS half of every
   cell in the field is the PMOS half. Coplanar with the cell body it lies on,
   hence the polygon offset. */
const nwell = new THREE.Mesh(
  new THREE.BoxGeometry(INV_W, 0.008, INV_H * 0.46),
  new THREE.MeshPhysicalMaterial({
    color: 0x38507a, metalness: 0.1, roughness: 0.62,
    transparent: true, opacity: 0, ...DIE_FACE_OFFSET,
  })
);
nwell.position.set(0, -0.004, DEV_Z);
fets.add(nwell);

/* Contacts. Neutral grey and nothing else — this is the "different grey metal"
   the local wiring is made of, and keeping every connection one colour is what
   lets the two RAILS keep theirs. One contact per terminal, four in all; the
   well and substrate taps that used to sit out at the cell edge are gone,
   because they are a detail of a real layout that the reference does not draw
   and that only added two more posts to tell apart. */
const CONTACT_COL = 0xb8c0c9;
/* The same metal as the contacts, two stops darker, and the difference is a
   rendering one rather than a design one. The posts are a PHYSICAL material and
   are lit; the straps above them are a BASIC material and are not, because they
   have to be driven past 1.0 when the cell switches and only an unlit material
   can be. Given the same hex the unlit ones came out visibly paler and the
   circuit looked like it was made of two different greys. This is the value that
   renders as the same grey the lit posts do. */
const SIGNAL_COL = 0x6f777f;
const contactMat = new THREE.MeshPhysicalMaterial({
  color: CONTACT_COL, metalness: 0.5, roughness: 0.4,
  transparent: true, opacity: 0,
});
/* {x, z, from, lift}. `from` is the top of whatever it stands on, and `lift`
   says whether it chases the signal metal upward or stops at rail height. The
   two SOURCE posts are short and end on the rails; the two DRAIN posts and the
   gate post stretch with the lift, because that is where the signal metal went.

   That difference is not incidental — it is the clearest statement in the cell
   of which terminal is which. The short posts go to power, the tall ones go to
   the circuit. */
const CONTACTS = [
  { x: -DEV_X, z:  DEV_Z, from: 0.026, lift: false },   // PMOS source -> VDD
  { x:  DEV_X, z:  DEV_Z, from: 0.026, lift: true  },   // PMOS drain  -> Y
  { x: -DEV_X, z: -DEV_Z, from: 0.026, lift: false },   // NMOS source -> GND
  { x:  DEV_X, z: -DEV_Z, from: 0.026, lift: true  },   // NMOS drain  -> Y
  { x: 0,      z:  0,     from: 0.050, lift: true  },   // the gate     -> A
];
const contacts = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1), contactMat, CONTACTS.length);
fets.add(contacts);


/* The cell's own metal, in the order the pin labels name them: supply, ground,
   input, output. Basic rather than physical, and driven past 1.0 by the
   switching loop, which is the same trick the travelling bead used: ACES rolls
   the overshoot off into a highlight instead of clipping it flat.

   Y is a strap running the full height of the cell because that is what an
   output has to be — it has to reach the drain of the PMOS at the top and the
   drain of the NMOS at the bottom and tie them together. A is a short stub over
   the middle of the gate, in the channel between the two device bands, which is
   the only place in the cell where there is room for it. */
const PIN_Y = RAIL_Y_OFF;
/* Six pieces of metal, and between them they are the whole circuit.

   The two RAILS run along the cell's top and bottom edges, which is the row
   boundary, which is where the field's own rails run — same place, same colour,
   because they are the same rails. They overhang the cell slightly at each end
   for the same reason a real one does: it carries on into the cell next door.

   The two TIES are the point of this arrangement and were missing before. A rail
   overhead does nothing until something joins it to a device, so each rail drops
   a strap down to the SOURCE of the transistor it feeds: supply to the PMOS
   source, ground to the NMOS source. That is the connection the whole gate is
   built on, and drawing the rails without it left two bars hanging over a cell
   they had no relationship to.

   Then A over the gate, and Y as a strap running the height of the cell to tie
   the two DRAINS together. Source to the rails, drains to each other: that
   sentence is the inverter. */
const RAIL_Z = ROW_PITCH / 2;          // where the row's rails actually run
const TIE_X  = -DEV_X;
/* Four pieces of metal, and NONE of them is a rail.

   A and Y are the SIGNAL metal and they are grey, the same grey as the contacts
   under them. Everything carrying logic is one material; everything carrying
   power keeps its rail colour. That split is the fastest way to read the cell:
   the two coloured bars are the row's supply and ground, and every grey thing
   between them is the circuit.

   The two TIES are the whole point of the arrangement. Each runs in z from a
   source out to the rail line and stops there — the connection the gate is built
   on, made to the rail that was already there rather than to a private copy of
   it.

   `lift` is what separates them. The signal metal rises at stop 07 so it stops
   covering the devices it is wired to; the ties do not, because they end on a
   rail that is not going anywhere. Power stays down at the row, signal lifts out
   for inspection, and the difference in height is itself the explanation. */
const M1_PINS = [
  { x: 0, z: 0, sx: INV_W * 0.15, sz: INV_H * 0.09, col: SIGNAL_COL, lift: true },
  { x: DEV_X, z: 0, sx: INV_W * 0.10, sz: INV_H * 0.46, col: SIGNAL_COL, lift: true },
];
const PIN_A = 0, PIN_Y_ = 1;
/* Base colours, unpacked once. m1Mat is a BASIC material, so instanceColor is
   the final pixel and these are read straight off the same two constants the
   field's rails use rather than being matched by eye. */
const _mc = new THREE.Color();
const M1_BASE = M1_PINS.map((pin) => {
  _mc.set(pin.col);
  return [_mc.r, _mc.g, _mc.b];
});
/* Lit is derived FROM the base rather than being one shared bright value, so a
   conducting ground rail goes bright blue and a conducting supply rail goes
   bright copper. Shared, they both washed to the same warm white the moment they
   switched, which threw away the colour the previous stage had just spent the
   whole floor establishing — and the lit rail is exactly the moment you most
   want to know which rail it is. The lift past 1.0 is the usual trick: ACES
   rolls it off into a highlight instead of clipping — weighted toward the
   multiply, for the reason spelled out at DEV_HOT: a large flat offset is
   desaturation by another name, and the output strap rests LIT, so it spent most
   of the loop as a white bar. */
const M1_HOT = M1_BASE.map((c) => c.map((v) => v * 2.2 + 0.45));

/* Every contact is tinted by the NET it carries rather than by the metal it is
   made of, and that one change is what makes the wiring readable. Drawn all the
   same tungsten grey, six identical posts stood between the metal and the
   silicon and gave no clue which belonged to which: you could see THAT the
   supply rail came down somewhere and THAT the output strap went down
   somewhere, but not that they went to different terminals of different
   devices. Coloured, the path reads in one look — warm rail, warm strap, warm
   post, into the source of the PMOS; and the same story in cool for ground.

   The output's two posts take the signal colour, which is what says the thing
   the schematic says: the two drains are tied together and that junction IS the
   output. */
/* The contacts are no longer tinted per net. Tinting them was the right call
   when the local straps were all one cream colour and the posts were the only
   thing that could say which net was which; now the straps themselves carry it —
   the rails are coloured, the signal metal is grey — and colouring the posts as
   well made a cell of five different metals. One grey for everything that
   connects, which is what the reference does. */
const m1Mat = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, depthWrite: false,
});
const m1pins = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1), m1Mat, M1_PINS.length);
m1pins.renderOrder = 210;
fets.add(m1pins);
/* Thin. Metal one is a FILM, and a pad drawn as a slab reads as a girder lying
   across the devices rather than as the top layer of them. Placed by layoutCell
   below, because its height is not a constant. */
m1pins.instanceColor = new THREE.InstancedBufferAttribute(
  new Float32Array(M1_PINS.length * 3), 3);

/* The two power connections, and they are not the cell's metal at all — they are
   the ROW'S RAILS, carried inward to the source they feed.

   So they are built from railMat itself rather than from a matching colour: the
   same material, the same instanceColor, the same height above the cell and the
   same thickness. Given a hand-matched colour on the signal material they read as
   a near miss, which is worse than an obvious difference — a strap that is almost
   the rail's colour looks like a mistake, where one that is exactly it looks like
   the rail. They overlap the rail's near half in z so there is no seam to see.

   They are also the reason nothing here lifts: a rail is not the cell's to raise,
   so these stay put while the signal metal above them rises. */
const TIE_LEN = RAIL_Z - DEV_Z + RAIL_H * 0.5;
/* railMat ITSELF, not a clone. These are the row's rails carried inward, so they
   should be lit and faded by exactly the same numbers, and sharing the material
   is the only way that cannot drift. A clone was tried while the cell was
   skipping depth tests and it was invisible for its whole life: cloning copies
   the opacity at that instant, which is 0, and nothing was updating it after. */
const ties = new THREE.InstancedMesh(railGeo, railMat, 2);
ties.renderOrder = 6;
fets.add(ties);
{
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const tv = new THREE.Vector3(), sv = new THREE.Vector3();
  sv.set(INV_W * 0.09, RAIL_T, TIE_LEN);
  for (let i = 0; i < 2; i++) {
    const dir = i === 0 ? 1 : -1;
    tv.set(TIE_X, RAIL_Y_OFF, dir * (DEV_Z + TIE_LEN / 2));
    ties.setMatrixAt(i, m.compose(tv, q, sv));
  }
  ties.instanceMatrix.needsUpdate = true;
  ties.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(6), 3);
  ties.setColorAt(0, _dc.set(VDD_COL));
  ties.setColorAt(1, _dc.set(GND_COL));
  ties.instanceColor.needsUpdate = true;
}

/* There is no output via and no wire leading away from it. The cell's output is
   the Y strap and nothing else — a pin, which is all a standard cell publishes.
   The long run of metal that used to leave here was describing the NEXT cell's
   problem, and at this magnification it read as part of this one. */


/* Places everything that moves with the lift: the pads, the contacts holding
   them up, and the output via bridging whatever gap is left to M1. Recomputed
   only when the lift actually changes, which is across sixteen thousandths of t
   and then never again. */
let liftDrawn = -1;
function layoutCell(lift) {
  if (Math.abs(lift - liftDrawn) < 1e-5) return;
  liftDrawn = lift;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const tv = new THREE.Vector3(), sv = new THREE.Vector3();
  const pinY = PIN_Y + lift;

  for (let i = 0; i < M1_PINS.length; i++) {
    const pin = M1_PINS[i];
    tv.set(pin.x, pin.lift ? pinY : PIN_Y, pin.z);
    sv.set(pin.sx, 0.007, pin.sz);
    m1pins.setMatrixAt(i, m.compose(tv, q, sv));
  }
  m1pins.instanceMatrix.needsUpdate = true;

  /* A contact is however tall it has to be to still reach what it feeds. That is
     what a contact IS, and it is the same rule the stack's vias follow. */
  for (let i = 0; i < CONTACTS.length; i++) {
    const c = CONTACTS[i];
    const top = (c.lift ? pinY : PIN_Y) - 0.0035;
    const len = Math.max(top - c.from, 0.004);
    tv.set(c.x, c.from + len / 2, c.z);
    sv.set(INV_W * 0.065, len, INV_H * 0.085);
    contacts.setMatrixAt(i, m.compose(tv, q, sv));
  }
  contacts.instanceMatrix.needsUpdate = true;


  /* A label rides whatever it is written on, and sits a hair above ITS OWN
     surface — derived from that surface's thickness rather than hand-set, which
     is what stops the two drifting apart. The 0.017 this used to carry was the
     clearance a 0.026-thick rail needed; once the rail became a 0.010 film the
     label was left floating 0.012 above it, and a plane hovering over a strip
     projects offset from it at any angle but straight down, so VDD and GND read
     as sitting off their rails rather than on them. */
  for (const l of cellLabels) {
    l.position.y = l.userData.lift ? pinY + 0.006 : RAIL_Y_OFF + RAIL_T / 2 + 0.003;
  }

}

/* --- the metal lifts off ------------------------------------------------
   Everything above the devices rises clear of them as the stage resolves, and
   the contacts stretch to stay joined to it.

   This is the one change that made the cell readable. Drawn flat, it is honest
   and illegible at the same time: the supply and ground straps run the full
   width of the tile and the output strap runs its full height, so between them
   the metal covers most of the devices it is connected to — and the relationship
   between those two things is the entire point of the stage. There is no camera
   angle that shows the metal and the silicon at once while they are touching.

   Lifting it is not a new idea here either. It is the language the page has been
   speaking since the floorplan tiles rose as glass slabs and the fifteen tiers
   peeled apart: a layer moving away from the thing beneath it is how this piece
   has already said "these are separate layers" three times, and the contacts
   stretching to follow is exactly what the stack's vias do.

   0.058 is about a tenth of the cell's width. Enough to see daylight under the
   metal at the angle stop 07 parks at, and not so much that the cell stops
   reading as one object. */
/* Whether the cell switches at all. It was off for a while, on the grounds that a
   light running around the layout competes with a reader still working out which
   post goes where — and that was right while the layout itself was still being
   settled. Now that it reads, the switch is the payoff, and it is occasional
   rather than continuous precisely so it does not go back to being wallpaper.
   See the timing in updateScene.

   Every term in the loop is multiplied by swA, so setting this to false resolves
   the whole thing to its rest state with no other edit, and verify/cell-switch.py
   reports the flag rather than failing. */
const CELL_SWITCHING = true;

const LIFT = 0.058;
const liftAt = (t) => LIFT * ramp(t, 0.970, 0.986);



/* The substrate the whole thing is built into. Kept from the old patch, resized:
   it was a floating slab there and it is the p-type bulk here, which is what the
   n-well above is a well IN. */
const wafer = new THREE.Mesh(
  new THREE.BoxGeometry(INV_W, 0.030, INV_H),
  new THREE.MeshPhysicalMaterial({
    color: 0x2a2f38, metalness: 0.4, roughness: 0.46,
    transparent: true, opacity: 0,
  })
);
wafer.position.y = -0.020;
fets.add(wafer);

/* The cell draws after the copper, and otherwise renders like everything else in
   the scene: depth testing ON, occluding itself correctly, sorted by distance
   within the group.

   It briefly did the opposite — depth testing off across the whole group with a
   hand-written painter's order per layer — to stop a via column blending over the
   top of it. That worked and cost more than it bought: with no depth test the
   cell stopped occluding ITSELF, and eight flat layers drawn in a fixed order
   read as cut paper rather than as an object. The occlusion problem is solved
   where it belongs instead, by switching the columns off entirely at the stop
   where they are not the subject. */
fets.traverse((o) => { if (o.isMesh) o.renderOrder = 220 + (o.renderOrder > 200 ? 1 : 0); });

/* --- the words, etched on the metal ------------------------------------
   Four labels, drawn ON the thing they name instead of floating beside it in
   HTML. The DOM tags they replace had to be projected every frame, clamped back
   inside the viewport when they fell off the edge, and hidden entirely on a
   phone; a plane lying on the strap has none of those problems and reads as part
   of the object, which is what a pin name on a layout actually is.

   Each one sits on a piece of metal that RUNS THE WAY THE TEXT READS. That is
   why OUT is on the output wire rather than on the Y strap it continues: the
   strap runs in z and the word would be sideways. Same reason VDD and GND sit on
   the rails, which run the full width of the die. */
const cellLabels = [];
function cellLabel(text, w, h, x, z, lift, turn, scale) {
  const m = faceLabel(w, h, text, scale || 0.30, 0);
  /* `turn` spins a label a quarter turn in its own plane, for metal that runs the
     wrong way for the word. The output strap runs in z, so OUT reads along it
     rather than across a piece four times narrower than the text. */
  if (turn) m.rotation.set(-Math.PI / 2, 0, turn);
  m.position.set(x, 0, z);
  m.renderOrder = 224;
  m.userData.lift = lift;
  m.userData.word = text;               // for __die.cellFrame
  fets.add(m);
  cellLabels.push(m);
  return m;
}
/* All four sit close in to the cell. The first placement pushed VDD and GND out
   to where the rails leave the frame and OUT nearly off the right edge, which is
   where there is most room on the metal and least on the screen. A label is only
   useful beside the thing it names. */
const LBL_IN  = cellLabel('in',  INV_W * 0.20, INV_H * 0.085, 0, 0, true);
/* On the Y strap itself now. It used to sit on the output wire, which was the
   right home for a horizontal word and is gone: the cell publishes a pin, not a
   route. */
const LBL_OUT = cellLabel('out', INV_H * 0.34, INV_W * 0.10,
                          DEV_X, 0, true, Math.PI / 2);
/* The two on the rails take a smaller face than the two on the signal straps, and
   the reason is faceLabel's own arithmetic rather than taste. It sets the font to
   `scale` of the canvas WIDTH, and the canvas height is width over aspect — so on
   a plane five times wider than it is tall, a 0.30 face is drawn taller than the
   canvas and the glyphs run off the top and bottom of the rail they are lying on.
   0.17 is the size that fits inside a rail's own depth. */
const LBL_VDD = cellLabel('vdd', INV_W * 0.40, RAIL_H * 0.78, -INV_W * 0.34,  RAIL_Z, false, 0, 0.17);
const LBL_GND = cellLabel('gnd', INV_W * 0.40, RAIL_H * 0.78, -INV_W * 0.34, -RAIL_Z, false, 0, 0.17);

/* Once at build, so nothing is ever drawn on an identity matrix: the warm-up
   pass renders every material in the scene before the first real frame.

   THIS CALL MUST STAY LAST IN THE SECTION. layoutCell reaches for the pads, the
   contacts, the output via, the output wire and now the labels, and every one of
   those is a `const` declared above it — a const cannot be read before its own
   declaration runs, so moving this call up kills the module on load with a
   temporal-dead-zone error rather than a warning. It has been moved up by
   accident three times. If you add something to layoutCell, add it above here. */
layoutCell(0);


/* ------------------------------------------------------------------ *
   6. HIT REGIONS & PANEL COPY
 * ------------------------------------------------------------------ */

const uvToWorld = (u, v) => new THREE.Vector3(
  -DIE_W / 2 + u * DIE_W, 0, -DIE_H / 2 + v * DIE_H
);
const coreUV = (u, v) => uvToWorld(
  CORE_U[0] + u * (CORE_U[1] - CORE_U[0]),
  CORE_V[0] + v * (CORE_V[1] - CORE_V[0])
);

/* hitGroup is gone. It was a set of invisible flat proxies, one per floorplan
   region, that made regions clickable — but it was invisible AND pickable, which
   meant a region answered a click at every point in the descent. Harmless when a
   click merely opened a side panel; not harmless now that a click freezes the
   page. The tiles are real geometry over the same ground and carry their own
   opacity, so picking tests that instead. See pick(). */

/* ------------------------------------------------------------------ *
   8. CAMERA PATH, SCROLL AND CAPTION
 * ------------------------------------------------------------------ */

/* The camera is keyframed against t, not free-running. Check any change to this
   array with verify/camera-speed.py: sampleCamera eases with a smoothstep INSIDE
   each segment, so the camera comes to REST at every key, which means a short
   segment between two distant keys is not a fast move, it is a lurch. */
const KEYS = [
  // --- package ---
  // A 40 mm package needs ~75 units of standoff at fov 34 to sit in frame
  // with margin; these are sized from 20/tan(fov/2), not eyeballed.
  /* The opening frame. It used to sit 46 degrees up, dead centre, at the same
     34 degree lens as everything else — a parts-catalogue three-quarter, even
     and flat. Now it comes down to 30 degrees so the lid's fins and the
     package's own edge catch the light, sits on a longer 29 degree lens for
     the compression that reads as filmic, and aims a little left and low of
     the chip so the object lands up and to the right with the caption's
     corner left open. Standoff is up to 90 to pay for the longer lens.

     Aiming BELOW the chip is what lifts it in frame — at 96 units of standoff
     and a 29 degree lens, dropping the target 5.5 units raises the subject
     about a tenth of the frame height. */
  { t: 0.000, p: [PCX + 56, 48, PCZ + 62], l: [PCX - 5, -5.0, PCZ - 2], f: 29 },
  /* One key between the opening frame and the bare-silicon shot, and it is a
     straight descent onto the package. There used to be four, swinging the
     camera out to PCX-13 and back to PCX+24 while the package turned over to
     show its pads. That orbit existed to give the flip something to be seen
     from, and with the flip gone it was travel for its own sake: all three axes
     reversed at 0.150, so the camera slowed almost to a stop mid-leg to change
     direction, with nothing happening to cover it. The approach is now
     monotonic on every axis but a slight easing in x.

     At 0.200 this key split the leg almost exactly in half by TIME, and the two
     halves are not halves by anything else: dropping onto the package from 103
     units out turns the camera 0.83 rad, and the pan down from there to eye
     level beside the dies turns it 1.08. So the second half was doing 56.5% of
     the turning in 49.8% of the time, which is why the descent after the two die
     names appear was the fast part of the opening. At 0.160 the time follows the
     arc instead. */
  { t: 0.160, p: [PCX +  9, 34, PCZ + 26], l: [PCX, 0, PCZ], f: 34 },
  // --- down onto the bare die ---
  /* The low rake across the die backside: the eye-level shot next to the dies.
     POSITION IS FIXED. [7.2, 3.0, 15.0] aiming at [0, 0, 3.0] is the shot, and it
     is not a free parameter — a previous pass moved it out to x 17 to fix the
     velocity of the segment leaving it, which did fix the velocity and destroyed
     the shot, turning the eye-level view of the dies into a side view. If this
     segment needs work again, change its TIMING, not its position.

     WHY THE TIMING IS 0.398 AND NOT 0.360. From here the camera has only about
     3.8 units to travel before the floorplan sweep begins at 0.415 — the eye-level
     shot and the sweep's first key are nearly the same place. At 0.360 that tiny
     hop was given 0.055 of scroll, which is 70 units per unit t against 370 on
     the descent before it and 138-151 across the sweep after. Since sampleCamera
     eases to rest at every key, it read as a dive, then a crawl, then a sweep:
     the sluggish patch just before the regions bloom. Arriving at 0.398 instead
     gives the descent 0.098 for its 31 units and the hop 0.017 for its 3.8, so
     the whole run decelerates monotonically — 370, 319, 225, 151, 143, 138, 134 —
     with no dip to recover from. Same shot, later arrival. */
  { t: 0.398, p: [7.2, 3.0, 15.0], l: [0, 0, 3.0], f: 32 },
  { t: 0.415, p: [9.79, 4.36, 12.53], l: [0, -0.78, 0], f: 34 },
  /* --- floorplan ---
     A LOW sweep across the front of the die, right to left, so the tiles lifting
     out of the surface and the die's own thickness both read as depth rather than
     as a flat diagram being coloured in.

     That was always the intent, and for a long time the keys did not deliver it.
     The elevations ran 21, 46, 19: the camera climbed to a near birds-eye view at
     0.442, right as the first regions bloomed, then dropped 26 degrees back down.
     Azimuth wandered as well, 36 -> 18 -> 28, stepping back to the right in the
     middle of a right-to-left sweep. Together they read as eye level, then over
     the top, then level again.

     Now it is one continuous rising arc, ROTATING as it climbs: elevation 16, 21,
     26, 30, 34 while the azimuth carries +38 round to -18. Both monotonic, both
     moving at once, so the shot never doubles back on itself.

     A first correction went too far the other way and held the elevation almost
     flat, 17 through 22. That removed the spike and the life with it. +18 degrees
     spread over four keys is 4 to 5 per key: felt as a climb, nowhere near the
     +25 in one step that read as going over the top.

     Radius is solved per key so the die's four corners span 0.74 of the frame the
     whole way, which is what the one key that always looked right was already
     doing. So the die holds its size while the camera arcs, and what changes is
     how much of the floorplan opens up: its on-screen aspect goes 0.47 to 0.87 as
     the regions fill in. Segments run 134-151, a 1.13x spread — tighter than the
     flat version managed.

     Do not raise a key here without re-running verify/camera-elevation.py. A
     spike is very hard to see while scrubbing and very obvious in motion. */
  { t: 0.442, p: [ 5.91, 5.38, 13.28], l: [0, -0.78, 0], f: 35 },
  { t: 0.468, p: [ 2.41, 6.56, 13.66], l: [0, -0.78, 0], f: 35 },
  { t: 0.494, p: [-0.96, 7.77, 13.78], l: [0, -0.78, 0], f: 34 },
  { t: 0.520, p: [-3.88, 8.26, 11.93], l: [0, -0.78, 0], f: 35 },
  /* This key moved in and down (it was [-5.0, 7.4, 8.4]) to even out the run
     into the core: at 5.4 and 4.8 units against the 5.6 before it, the approach
     is three segments of roughly equal speed instead of a slow one and a fast.

     The look-at used to drift onto the core here, at [coreCX * 0.45, 0,
     coreCZ * 0.45], leading the camera into the move. The half turn above
     CORE_U put the core in the OPPOSITE corner from this key, so that lead
     became a swing across the die: it flattened the shot from 30 to 23 degrees
     and dropped the die's near edge out of frame, ending the floorplan on a low
     pass rather than on the whole die held. Holding the sweep's own look point
     one key longer restores it exactly — 30.1 degrees against the 30.0 it had —
     and the drift onto the core simply happens over the next leg instead. */
  { t: 0.565, p: [-4.54, 4.27,  7.42], l: [0, -0.78, 0], f: 36 },
  /* --- one core ---
     This used to arrive at 7.6 units of height over 2.6 of standoff and hold
     there: 71 degrees of elevation, all but straight down. Every slab lifting
     out of the core was therefore a rectangle very slightly changing size, and
     the glass had no edge to be read at. The floorplan one stage up does the
     opposite — it sweeps LOW across the front, at 19 degrees — and that is what
     makes its tiles read as tiles.

     Then it orbits, which the reveal needs and the floorplan never did: the
     floorplan is over in 0.09 of the timeline and the core sequence runs for
     0.24, so a locked-off camera would sit still through two thirds of the
     stage. A single sweep across the front, azimuth +32 to -38 degrees, not a
     there-and-back — the floorplan crosses its die once and so does this, and a
     return leg would have nothing left to reveal.

     Elevation is NOT constant, and a first pass that held it at the floorplan's
     18.4 was wrong. The die is nearly square, so a low angle still leaves it
     legible; the core is already 2:1, and at 18 degrees dead in front of it the
     1.54 of depth collapsed to 0.28 of frame height — a letterbox slit. The
     sweep therefore rises to 33 degrees through the middle, where the core is
     most foreshortened, and comes back to 20 at the ends where the azimuth is
     showing its diagonal anyway.

     Both the radius and the elevation were solved, not chosen. Every key sits at
     whatever radius puts the core's four corners across 0.94 of the frame — the
     core is the subject here, where the die was the subject of the floorplan's
     0.74-0.77, so it is framed tighter on purpose. On-screen aspect comes out
     0.41-0.68 against the floorplan's own 0.44 and 0.33.

     Watch the units if you re-solve this. Projecting to NDC gives a frame that
     spans 2.0, not 1.0, and a first pass read 1.44 NDC as "1.44 frame widths"
     and concluded the framing was generous when it was actually 0.72 and loose.
     Halve the NDC extent before comparing it to anything.

     Radii come out 3.00-3.16, so the sweep is very nearly circular and the eight
     segments run 17-21 units of camera travel each at even dt — near enough
     constant that the orbit reads as one move rather than as eight, which
     matters because sampleCamera eases INSIDE each segment and comes to rest at
     every key. Camera height stays between 1.20 and 2.02, well clear of slabs
     that peak at 0.20. */
  /* The approach used to arrive at 42 degrees and then drop 22 into the orbit,
     which is the same climb-over-the-top-and-fall-back the floorplan had. At 28
     it still reads as a descent onto the core, and the sequence through the
     handover only ever eases: 22, 30, 28, 20.

     Radius is solved so the core arrives spanning 0.74 of the frame — the same
     fraction the DIE occupied through the sweep, so the cut from one subject to
     the next keeps its scale — and the orbit then closes in to 0.94. Pulling it
     closer than this also unbalances the handover: at 0.94 the last leg into the
     orbit collapses to a twentieth of the speed of the leg before it. */
  { t: 0.640, p: [coreCX + 2.443, 2.07, coreCZ + 2.911], l: [coreCX, 0.05, coreCZ], f: 36 },
  { t: 0.674, p: [coreCX + 1.672, 1.21, coreCZ + 2.676], l: [coreCX, 0.06, coreCZ], f: 37 },
  { t: 0.693, p: [coreCX + 1.150, 1.53, coreCZ + 2.848], l: [coreCX, 0.06, coreCZ], f: 37 },
  { t: 0.711, p: [coreCX + 0.642, 1.85, coreCZ + 3.020], l: [coreCX, 0.06, coreCZ], f: 37 },
  { t: 0.728, p: [coreCX + 0.107, 2.02, coreCZ + 3.057], l: [coreCX, 0.06, coreCZ], f: 37 },
  { t: 0.743, p: [coreCX - 0.422, 2.00, coreCZ + 2.999], l: [coreCX, 0.06, coreCZ], f: 37 },
  { t: 0.759, p: [coreCX - 0.926, 1.80, coreCZ + 2.850], l: [coreCX, 0.06, coreCZ], f: 37 },
  { t: 0.777, p: [coreCX - 1.422, 1.51, coreCZ + 2.674], l: [coreCX, 0.06, coreCZ], f: 37 },
  { t: 0.795, p: [coreCX - 1.927, 1.20, coreCZ + 2.466], l: [coreCX, 0.06, coreCZ], f: 37 },
  // and rise off it, so the core is last seen whole before the surfaces clear
  { t: 0.816, p: [coreCX - 2.987, 4.21, coreCZ + 3.093], l: [coreCX, 0.05, coreCZ], f: 36 },
  /* --- metal stack ---
     Down to the die's own level before the stack grows, so the tiers rise PAST
     the camera rather than being looked down on, and then straight up through
     them. The old path watched the whole thing from outside and above, which is
     the one vantage that makes a fifteen-layer stack look like a diagram.

     0.888 and 0.902 sit INSIDE the footprint, in a gap, with tiers above and
     below — that is the immersive beat, and it is what the near-fade in
     updateScene exists to make possible: the camera crosses roughly five tiers on
     the way up, and a textured plane crossing the near plane is otherwise a
     full-screen flash of copper.

     Both inside keys look very slightly UP, so the undersides of the tiers above
     read rather than the stack collapsing to a set of edge-on lines. The swing
     from -6 degrees inside to +13 on emerging is the largest on the path and is
     deliberate: it is the shot leaving the stack. */
  /* The run starts on the LEFT because that is where the core leaves us. A first
     pass opened on the right and crossed the whole die in 0.018 — 18.5 units,
     1025 on camera-speed.py, the worst lurch the path has ever had. */
  /* These two look at the stack from outside, and they were originally at 3 and
     2 degrees of elevation — near enough level that fifteen HORIZONTAL planes were
     edge-on and simply disappeared, leaving a forest of vias with nothing between
     them. A stack of sheets needs some elevation to read as sheets at all. 16 and
     14 keeps it low without erasing the thing the stage is about. */
  { t: 0.842, p: [-8.20, 4.10,  9.60], l: [ 0.0, 0.55,  0.0], f: 34 },
  { t: 0.866, p: [-1.60, 2.90, 11.20], l: [ 0.0, 1.00,  0.0], f: 34 },
  /* Level here, at the die's own edge, so the stack is seen side-on for a beat:
     fifteen sheets stacked in depth, which is the one read you cannot get from
     either outside or inside. It also halves the elevation step into the stack. */
  { t: 0.888, p: [ 2.20, 1.10,  5.60], l: [-0.6, 1.10, -0.8], f: 36 },
  { t: 0.902, p: [ 0.40, 2.60,  0.90], l: [-2.6, 3.05, -2.2], f: 38 },
  /* Leaving takes TWO keys. One was not enough: a single jump from inside to
     above put the camera still among the tiers at 0.926, below the top of the
     stack and metres from a plane, which read as chaos rather than as emerging.
     0.916 clears the footprint, 0.928 clears the height — and only from up there
     do the bond bumps on top read as the thing the stack was climbing toward.

     Both sit a little earlier and a good deal lower than they used to, and both
     changes are the fold's doing. Earlier, because the bumps now have to be ON
     TOP before the stack starts folding at 0.926, or the thing the climb was
     climbing toward arrives after the climb is over. Lower, because the stack is
     about to lose nine tenths of its height, and a camera framed for the tall
     version spends the whole fold looking at the empty air above a ceiling. */
  { t: 0.918, p: [ 2.60, 4.70,  5.20], l: [ 0.0, 3.40,  0.0], f: 36 },
  { t: 0.930, p: [ 5.60, 6.40,  8.60], l: [ 0.0, 2.90,  0.0], f: 34 },
  /* --- the stack folds, and the camera rides it down ---
     These two are not new vantages. They are the SAME vantage descending with
     the ceiling, and that is the entire point of the beat: the stack does not
     shrink away from the viewer, the viewer comes down with it. The copper
     therefore holds roughly its size in frame for the whole fold while the
     ground rises to meet it, which is what makes the motion read as the stack
     closing rather than as the camera pulling back.

     The five keys from 0.902 to 0.966 are shaped as ONE ARC OVER THE TOP rather
     than as a rise followed by a fall, and that is a correctness constraint, not
     a preference. The first attempt turned around at its apex in all three axes
     at once — out and up, then back and down — and a monotone-cubic spline
     answers a simultaneous reversal with a zero tangent, so the camera came to a
     dead stop for about a fifth of a second in the middle of the fold.
     camera-continuity.py measured it at 0.24 of the leg's median speed. The fix
     is that x keeps climbing straight through the apex while y and z turn over,
     so there is always one axis carrying the motion. Anything moved here has to
     preserve that: check it with camera-continuity.py, not by eye, because a
     stall this brief reads as a stutter rather than as a stop and is very easy
     to talk yourself out of seeing.

     By 0.950 the camera is outside the footprint in both x and z and above the
     folded ceiling, and it descends diagonally INTO the room over the last leg,
     crossing below the ceiling's height before it crosses inside the die's
     edge. That ordering is what stops it clipping through fifteen tiers on the
     way in. */
  { t: 0.948, p: [ 7.20, 2.30,  6.80], l: [ 0.2, 0.80,  0.2], f: 36 },
  /* --- the cell rows ---
     Standing ON M1, under a copper ceiling a little over a unit overhead,
     looking down and across the rows.

     The elevation is about eight degrees, and it is the whole shot. Level, and
     the rows are a set of parallel lines with no depth in them; any steeper and
     the ceiling leaves the top of the frame, which throws away the one thing
     that makes this a room rather than a plan view.

     f 40 is the widest lens anywhere on the path, deliberately. A 34 in a space
     a unit and a half tall reads as a slot; the wider lens is what gets both the
     floor and the roof into one frame from inside.

     y 0.68 is a FLOOR, not a preference. The plane near-fade band in updateScene
     runs 0.05 to 0.70, so a camera lower than this starts dissolving M1 on its
     own, on top of the glass ramp that is already dissolving it deliberately,
     and the floor's opacity ends up somewhere nobody chose. */
  { t: 0.966, p: [ 2.30, 0.68,  3.10], l: [-0.40, 0.02, -0.50], f: 40 },
  /* --- one cell ---
     Two keys, because the standoff collapses from three and a half units to one
     across this leg and that is the largest change of scale anywhere on the
     path. 0.978 picks the hero cell out with its neighbours still around it,
     which is what makes it read as ONE OF the tiles rather than as a new object
     that has just been introduced.

     Both aim at CELL_C, which is authored rather than looked up precisely so
     that these two lines can be written against a fixed point. If the hero cell
     moves, these move with it.

     The camera stays ABOVE M1 and looks down through it. That is not a
     compromise: M1 is translucent by now and the cell is genuinely underneath
     it, so the last shot of the piece is the metal and the logic in the same
     frame, which is what the previous six stops were for. */
  /* The elevation climbs 8, 21, 37 degrees across these three, and that ramp is
     the shot. Stop 06 is nearly level because it is a room being stood in; a
     cell is a LAYOUT, and a layout is read from above. It stops at 37 and not at
     90 because the whole argument of a cell is that it is built in layers, and a
     plan view is the one angle that cannot show a stack — the lift only reads
     from somewhere that can see under it.

     The AZIMUTH matters as much as the elevation and took longer to get right.
     These used to look in along the die's diagonal, which put the cell on screen
     at 45 degrees, and a layout read cornerwise is a diamond of overlapping
     slabs: the fins, the poly crossing them and the straps above all ran in
     three different screen directions and none of them looked like an axis. The
     view is now nearly down -z, so the cell's own width lies across the frame,
     the fins run with it and the poly runs against it. Everything in the picture
     is then either horizontal or vertical, which is what a layout looks like.

     The last two keys sit to the LEFT of what they aim at, about 15 degrees
     round, so the cell is seen a little from its supply side rather than square
     on. Square on was the right correction from the 45-degree diagonal it used
     to have, and it overshot: a layout with no azimuth at all has no near
     corner, so nothing tells you the metal is above the silicon rather than
     printed on it. Fifteen degrees is enough to see under the lifted straps and
     not enough to start rotating the axes back into a diamond.

     The aim still sits left of the cell's centre so the subject lands in the
     right of the frame, where the caption is not. */
  { t: 0.978, p: [ 0.62, 0.80,  2.00], l: [ 0.46, -0.06, 0.05], f: 34 },
  { t: 0.990, p: [ 0.14, 0.70,  1.00], l: [ 0.44, -0.10, -0.02], f: 34 },
  /* sampleCamera needs a key past the last stop for its final Hermite segment;
     this one is never parked on. */
  { t: 1.000, p: [ 0.08, 0.66,  0.92], l: [ 0.44, -0.10, -0.02], f: 34 },
];

const _p = new THREE.Vector3(), _l = new THREE.Vector3();
const smoothstep = (x) => x * x * (3 - 2 * x);
const ramp = (x, a, b) => smoothstep(THREE.MathUtils.clamp((x - a) / (b - a), 0, 1));

/* --- how the path is interpolated ------------------------------------
   This used to smoothstep INSIDE each segment. Every key was therefore a point
   where the camera's velocity passed through zero: it eased in, eased out, and
   started again on the next pair. Strung together that is not a pan, it is a
   series of little hops, and the more keys a leg holds the worse it reads. The
   leg from the macro regions to the core blocks has ELEVEN interior keys, so an
   eleven-second move stopped dead and restarted eleven times. That is the
   steppiness, and no amount of frame-pacing work could have touched it, because
   every one of those frames was being drawn perfectly on time.

   Now the keys are joined by a monotone cubic (Fritsch-Carlson) instead. The
   curve still passes exactly through every key, so every composed shot in the
   array is untouched and the KEYS notes above all still hold — but it arrives
   with a velocity rather than at rest, so the camera flows through a key instead
   of landing on it.

   Monotone specifically, rather than a plain Catmull-Rom, because a Catmull-Rom
   overshoots: it would bulge the path outside the keys around any sharp change
   of direction and swing the camera somewhere nobody composed, which on this
   path means through the die or inside the metal stack. The Fritsch-Carlson
   limiter clamps each tangent so a segment can never leave the interval its two
   keys define. Where the path genuinely reverses on an axis the tangent goes to
   zero there and only there, which is a turn, not a stop.

   Coming to rest at the two ENDS of a leg is still wanted, and still happens:
   that is the leg's own smoothstep in advance(), which is untouched. */
const CH = ['p0', 'p1', 'p2', 'l0', 'l1', 'l2', 'f'];
const chan = (k, c) => (c === 'f' ? k.f : k[c[0]][+c[1]]);

/* One tangent per key per channel, in units per unit t. */
const TAN = (() => {
  const out = {};
  const n = KEYS.length;
  for (const c of CH) {
    const v = KEYS.map((k) => chan(k, c));
    const d = [];                                  // secant slopes
    for (let i = 0; i < n - 1; i++) d.push((v[i + 1] - v[i]) / (KEYS[i + 1].t - KEYS[i].t));
    const m = new Array(n);
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    /* Centred difference. Strict Fritsch-Carlson would force the tangent to zero
       wherever the two secants disagree in sign, and on the package orbit all
       three axes reverse at the same key (t 0.150: x swings out and back, y rises
       then falls, z the same). Zeroing all three at once is a dead stop in the
       middle of a leg, which is the very thing being fixed — it measured a
       velocity of 0.02x the leg median right there. Averaging instead leaves a
       real tangent on whichever axes are still going somewhere, so the camera
       rounds the corner rather than stopping to take it. */
    for (let i = 1; i < n - 1; i++) m[i] = (d[i - 1] + d[i]) / 2;
    /* Cap every tangent at three times the SMALLER of the two secants meeting at
       it. Where the path runs monotonically that is the Fritsch-Carlson bound
       and it guarantees the curve cannot leave the interval its two keys define.
       Where the path reverses it is no longer a monotonicity guarantee, only a
       magnitude bound — deliberately, because forcing the tangent to zero there,
       as strict Fritsch-Carlson does, is what made the camera stop dead at every
       corner. Bounded but non-zero rounds the corner instead.

       Taking the SMALLER of the two secants is what stops a fast segment from
       throwing its speed into the slow one next to it. A long fast approach
       meeting a short slow orbit segment used to hand over a tangent sized for
       the approach, and the short segment then had to travel its small distance
       at that speed and brake hard: a spike of 0.46 rad/s at t 0.646, right as
       the core blocks began appearing, on a leg whose median is 0.15. Capping
       against the slower neighbour makes the camera shed speed BEFORE it
       arrives, which is what arriving somewhere looks like. */
    for (let i = 0; i < n; i++) {
      const dl = Math.abs(d[i > 0 ? i - 1 : 0]);
      const dr = Math.abs(d[i < n - 1 ? i : n - 2]);
      const cap = 3 * Math.min(dl, dr);
      if (Math.abs(m[i]) > cap) m[i] = Math.sign(m[i]) * cap;
    }
    out[c] = m;
  }
  return out;
})();

/* Writes the camera position and look-at into _p and _l, and returns the fov. */
function sampleCamera(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t >= KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const h = b.t - a.t;
  const u = THREE.MathUtils.clamp((t - a.t) / h, 0, 1);   // linear, NOT eased
  const u2 = u * u, u3 = u2 * u;
  /* Cubic Hermite basis. */
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  const at = (c) => h00 * chan(a, c) + h10 * h * TAN[c][i]
                  + h01 * chan(b, c) + h11 * h * TAN[c][i + 1];
  _p.set(at('p0'), at('p1'), at('p2'));
  _l.set(at('l0'), at('l1'), at('l2'));
  return at('f');
}

/* --- the descent is played, not scrolled ------------------------------
   It used to be driven by window.scrollY with `current` chasing `target` on an
   exponential damp. That gave a pleasant feel and two problems: the viewer was
   almost never at a composed shot, and an exponential chase never actually
   ARRIVES, so there was no such thing as being at a defined point.

   Now the journey is seven STOPS and six legs between them. An arrow plays one
   leg with an explicit duration and a smoothstep, so it lands exactly on the next
   stop and parks there. Two consequences follow from that and both are the point
   of the change: every resting frame is a shot somebody composed, and there is a
   well-defined moment — parked — at which the scene can be made interactive.

   Each stop is pinned to a fact about the animation, not to a round number:

     1  0.000  the packaged chip, as the page opens
     2  0.398  eye level beside the dies. This is a camera KEY, the composed
               bare-silicon shot.
     3  0.512  every macro region is in and still at full fill. groupIn.strip
               completes at 0.512 and toOutline starts at 0.512, so this is the
               single instant where all of them are up and none has begun to
               settle to an outline. One frame later and they are fading.
     4  0.800  every core block is in and still at full colour. blockIn reaches 1
               at exactly (0.640 + 0.160).
     5  0.888  inside the stack. A camera key, level and side-on among the tiers.
               NOT the 0.902 key further in: at 0.902 the camera sits 0.12 under a
               tier and it fills the frame. Rendered both; 0.888 is the shot.
     6  0.966  the cell rows, standing on M1 under the folded stack. cellIn
               completes at 0.964 and nothing has begun to fade, which is the
               same rule stops 3 and 4 are pinned by. It is also the first t at
               which the whole picture is up: the fold finishes at 0.951 and the
               room finishes opening at 0.952.
     7  0.990  one cell, a camera key, after invIn completes at 0.984. Not 0.994,
               where the rail tick would sit flush against the end of the rail
               and read as broken rather than as arrived.

   There WAS a stop at 0.130, the package turned over to read its 1718 contact
   pads. It is gone, along with the flip that reached it, so the opening leg now
   runs the whole way from the packaged chip to bare silicon. Nothing else moved:
   the remaining six stops sit on exactly the t they always did, because each is
   pinned to an animation fact rather than to its position in the sequence.

   Leg durations are hand-set rather than derived from distance in t, because the
   legs are not equally full. The third is the whole 29-block core reveal and
   needs three times the fourth, which is one camera move.

   The FIRST is 10500, absorbing the 4500 and 10000 of the two legs it replaces.
   Not their sum: the flip filled the middle of that span and no longer does, so
   paying for its duration would have bought an empty orbit. 10500 keeps the lid
   lift at the speed it played before, which is the beat that still has to read.

   The rest were set by measuring ANGULAR speed rather than world units, which is
   the only way these legs compare honestly. In world units the opening leg is
   the fastest thing in the piece at 32 units a second and the dive into a core
   is the slowest at 4 — and on screen it is the other way round, because the
   opening camera is 90 units off its subject and the core camera is three. Per
   radian, the leg into the transistors was moving 3.8 rad/s, about 215 degrees a
   second, easily the most violent moment here and not one anybody asked about;
   it is 6500 now. verify/camera-pace.py is the harness.

   The THIRD is 14000 rather than its original 3600 because it is the leg that
   has to teach something. THIRTEEN macro regions come up in it — eight core
   slabs rippling down the die, the L3, and the four of the bottom strip, which
   are four DIFFERENT names — and at 3600 ms they arrived faster than anyone
   could read them. Widening RIPPLE
   slowed each individual slab, but the window a slab rises in is bounded at both
   ends: it cannot open before the die photograph has faded in underneath it, and
   it cannot close after 0.512, which stop 04 is pinned to. Once those were spent
   the only honest lever left was the clock. This slows the camera sweep across
   the floorplan by the same factor, which is the trade, and on a leg whose job is
   reading rather than travelling that is the right way round. */
/* The last two legs are authored the same way the first one was, by asking what
   has to happen inside them rather than by measuring how far they travel.

   The FIFTH is 11000, up from the 8000 the traced net used to have. It now
   carries four beats where that carried one: the rise out of the stack, the bond
   bumps landing on top, the entire fifteen-gap fold, and the reveal of the rows
   under M1. Each of those has to be legible on its own, and the fold in
   particular is the one piece of motion in the piece that plays backwards
   against something the viewer has already watched play forwards.

   The SIXTH is 6500, up from 5500, because the inverter now assembles INSIDE it
   rather than simply being arrived at. A gate that resolves faster than it can
   be parsed is a flicker rather than a reveal. The tail still shortens, 11000
   into 6500, which is the rule the legs before it are held to as well. */
const STOPS = [0.000, 0.398, 0.512, 0.800, 0.888, 0.966, 0.990];
const LEG_MS = [10000, 14000, 19000, 5200, 11000, 6500];

let frozen = false;                   // the sheet is open: arrows are inert
/* The click rings key off both of these. parkedAt is when the current stop was
   reached, so they can arrive a beat AFTER the camera settles rather than being
   there the instant it lands, and sheetOpened retires them for good once the
   viewer has opened one: an affordance that keeps pulsing after it has been
   understood is noise, the same reasoning as the nav pill's ring. */
let parkedAt = -1e9;
let sheetOpened = false;
let target = 0, current = 0;
let stopIdx = 0;
let flying = false, flyFrom = 0, flyTo = 0, flyT0 = 0, flyMs = 0;

/* True only when parked at a stop with no sheet open. Everything that lets the
   viewer touch the scene hangs off this. */
const atStop = () => !flying && !frozen;

function goTo(i) {
  i = THREE.MathUtils.clamp(i, 0, STOPS.length - 1);
  if (i === stopIdx || flying) return;
  const back = i < stopIdx;
  flyFrom = current;
  flyTo = STOPS[i];
  /* Reverse uses the same leg's duration as forward — the leg between two stops
     is the same leg whichever way it is travelled. */
  flyMs = LEG_MS[back ? i : i - 1] * (reduceMotion ? 0 : 1);
  flyT0 = now();
  flying = true;
  stopIdx = i;
  hovered = null;                     // whatever was under the cursor is leaving
  syncNav();
}

/* Advance the flight. Returns the t for this frame. Called once per frame before
   anything reads t, so nothing in the scene can see a half-updated state. */
function advance() {
  if (!flying) return current;
  const k = flyMs > 0 ? THREE.MathUtils.clamp((now() - flyT0) / flyMs, 0, 1) : 1;
  current = target = THREE.MathUtils.lerp(flyFrom, flyTo, smoothstep(k));
  if (k >= 1) {
    current = target = flyTo;         // land exactly on the stop, not near it
    flying = false;
    parkedAt = now();
    syncNav();
  }
  return current;
}

const navPrev = document.getElementById('nav-prev');
const navNext = document.getElementById('nav-next');
const navCount = document.getElementById('nav-count');
const navBuild = document.getElementById('nav-build');
const siteBar = document.getElementById('sitebar');
const stageEl = document.getElementById('stage');
function syncNav() {
  /* The forward pill's pulse used to be retired here, once the viewer had moved
     once. It runs for the whole descent now and needs no state to do it: the CSS
     keys off :not(:disabled), so setting `disabled` below is the only thing that
     starts or stops it. See "the forward arrow's pulse" in style.css. */
  navPrev.disabled = flying || frozen || stopIdx === 0;
  navNext.disabled = flying || frozen || stopIdx === STOPS.length - 1;
  navCount.textContent = `${stopIdx + 1} / ${STOPS.length}`;
  /* `stopIdx` is set when a leg STARTS, not when it lands, so `flying` is what
     keeps the hand-off from appearing while the camera is still on its way into
     the last stop. Same guard the keyboard hint uses. */
  const arrived = stopIdx === STOPS.length - 1 && !flying && !frozen;
  navNext.hidden = arrived;
  navBuild.hidden = !arrived;
  stageEl.classList.toggle('flying', flying);
}
/* --- the top bar tucks away once the descent starts --------------------
   It is permanent on arrival and only on arrival. That first screen is where a
   visitor works out whose site this is and how to get back out of it, so the bar
   earns its band of the viewport there. The moment they press forward they have
   answered both questions and the scene should have the whole frame.

   After that it behaves like the browser's own fullscreen chrome: reach the top
   edge and it drops down, leave and it goes away. That is a convention people
   already have, which is the reason for choosing it over a button.

   It tucks on the first FORWARD move only. Arriving at stop 1 by pressing back
   should not re-pin it — the viewer has already been shown the bar, and a bar
   that reappears whenever you retreat turns a piece of chrome into a thing that
   follows you around.

   REVEALED BY COORDINATE, not by pointerenter/pointerleave on the elements. The
   first version armed an invisible strip at the top and listened for enter on it
   and leave on the bar, and it desynced immediately: the bar sliding down under
   a STATIONARY pointer fires no pointerenter, so moving away again fired a leave
   on the strip that nothing was listening for, and the bar stayed down. Two
   stacked elements handing a pointer back and forth is a state machine with
   corners; "is the cursor within 64px of the top" has none.

   The band to hide at is 8px lower than the band to show at. Without that
   hysteresis a pointer resting exactly on the boundary flickers the bar. */
const BAR_SHOW_Y = 64;                 // the bar's own height
const BAR_HIDE_Y = 72;
let barTucked = false;
let barHovering = false;
/* An open block sheet is a full-screen blurred reading surface, and the peek
   draws OVER it. Reaching for the video controls at the top of that sheet was
   enough to pull site chrome down across it, so the peek is suppressed for as
   long as a sheet is open.

   Held as its own flag rather than read off `sheet.hidden` because this runs
   ~300 lines before the sheet element is looked up, and because the block has
   to survive the sheet being closed: see the reset in closeSheet. */
let barBlocked = false;
/* True while the project directory drawer is open. The drawer is site chrome and
   it docks under the bar, so a tucked bar would leave it hanging off the top of
   an empty screen with no way back to the rest of the site. It comes down with
   the drawer and goes away with it. */
let barDrawer = false;
/* Set when the drawer closes, and held until the pointer leaves the reveal band.
   Closing the drawer takes the bar with it, and the gesture that closes it is a
   press on the pill — which leaves the cursor sitting inside the band that
   reveals the bar. Without the latch the next twitch of the mouse would pull the
   bar straight back down and the press would read as having done nothing. */
let barLatch = false;

function syncBar() {
  siteBar.classList.toggle('tucked', barTucked);
  /* An open drawer holds the bar down on its own, independent of the pointer,
     which is the point: Start Building is at the BOTTOM of the screen, so the
     gesture that opens the drawer leaves the cursor nowhere near the reveal
     band. */
  siteBar.classList.toggle('peek',
    barTucked && (barDrawer || (barHovering && !barBlocked)));
}

/* Watch the drawer's own class rather than binding to the controls. It opens
   from two places and closes from four — the pill, Start Building, the backdrop,
   Escape, and following a lesson link — and main.js owns all of them. Observing
   the state it publishes catches every path without this file having to know any
   of them, and cannot fall out of step the way a second list of listeners would. */
function watchDrawer() {
  const menu = document.querySelector('.toc__menu');
  if (!menu) return false;
  const read = () => {
    const open = menu.classList.contains('is-open');
    if (open === barDrawer) return;
    barDrawer = open;
    /* Closing the drawer sends the bar away with it. The pill is a toggle, so the
       second press has to undo the whole of what the first one did — drawer and
       bar both — otherwise the bar is left hanging over the scene with nothing
       under it and no press that will clear it.
       An open drawer holds the bar down on its own, so the pointer state only
       matters again once it closes: reset it there and latch the reveal until the
       cursor has left the band. */
    barHovering = false;
    barLatch = !open;
    /* A clicked pill keeps focus, and `#sitebar.tucked:focus-within` holds the
       bar down as firmly as .peek does — so dropping .peek alone left it exactly
       where it was. Drop the focus too, but only when it came from a pointer:
       :focus-visible is the browser's own answer to "did somebody tab here", and
       a keyboard user's place in the bar is not ours to throw away. */
    if (!open) {
      const held = document.activeElement;
      if (held && siteBar.contains(held) && !held.matches(':focus-visible')) held.blur();
    }
    syncBar();
  };
  new MutationObserver(read).observe(menu, {
    attributes: true, attributeFilter: ['class'],
  });
  read();
  return true;
}
/* main.js is a deferred classic script and this is a module, so it has already
   run and moved the panel to <body>. The load fallback is for the ordering ever
   changing underneath us. */
if (!watchDrawer()) addEventListener('load', watchDrawer, { once: true });
addEventListener('pointermove', (e) => {
  if (!barTucked || barBlocked) return;
  /* Armed again the moment the cursor is clear of the band, using the same lower
     threshold the hysteresis already uses so there is only one boundary here. */
  if (barLatch) {
    if (e.clientY > BAR_HIDE_Y) barLatch = false;
    return;
  }
  const want = barHovering ? e.clientY <= BAR_HIDE_Y : e.clientY <= BAR_SHOW_Y;
  if (want !== barHovering) { barHovering = want; syncBar(); }
});
/* Leaving the window across the top edge never produces a move that clears the
   band, so the bar would be left hanging down over a page nobody is pointing at. */
document.addEventListener('pointerleave', () => {
  /* The cursor being off the page is as good as it being clear of the band, so
     the latch lifts here too — coming back in over the top edge should reveal. */
  barLatch = false;
  if (!barHovering) return;
  barHovering = false;
  syncBar();
});

function tuckBar() {
  if (barTucked) return;
  barTucked = true;
  barHovering = false;
  syncBar();
}

navPrev.addEventListener('click', () => goTo(stopIdx - 1));
navNext.addEventListener('click', () => { tuckBar(); goTo(stopIdx + 1); });
/* Keyboard too. The arrows are the primary control, but a control that can only
   be reached with a mouse is a control some people cannot reach at all. */
addEventListener('keydown', (e) => {
  if (frozen) return;                 // Escape belongs to the sheet while it is up
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { tuckBar(); goTo(stopIdx + 1); e.preventDefault(); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { goTo(stopIdx - 1); e.preventDefault(); }
});
syncNav();

const capEl = document.getElementById('caption');
const capNum = document.getElementById('cap-num');
const capTitle = document.getElementById('cap-title');
const capBody = document.getElementById('cap-body');
const capToggle = document.getElementById('cap-toggle');
const capToggleLabel = capToggle.querySelector('.cap-toggle-label');
document.querySelector('.cap-of').textContent =
  `/ ${String(STAGES.length).padStart(2, '0')}`;

/* One tick per stage down the rail, so it says WHERE you are in the descent and
   not only how far. The lit one is whichever stage the caption is showing. */
const railTicks = document.getElementById('rail-ticks');
const tickEls = STAGES.map((s) => {
  const el = document.createElement('i');
  el.style.top = `${s.t * 100}%`;
  railTicks.appendChild(el);
  return el;
});

let shownStage = -1;
function updateCaption(t) {
  let s = 0;
  for (let i = 0; i < STAGES.length; i++) if (t >= STAGES[i].t) s = i;
  if (s === shownStage) return;
  shownStage = s;
  capNum.textContent = STAGES[s].num;
  capTitle.textContent = STAGES[s].title;
  capBody.textContent = STAGES[s].body;
  capEl.classList.remove('swap');
  void capEl.offsetWidth;             // reflow, so the animation restarts
  capEl.classList.add('swap');
  tickEls.forEach((el, i) => el.classList.toggle('on', i === s));
  /* A new stage closes the body again. Otherwise one press on a long stop
     would leave every stop after it open, and the point of the closed state
     is that arriving at a stage shows the die rather than a wall of text. */
  setCaptionOpen(false);
}

/* --- the caption's phone disclosure -----------------------------------
   On a phone the caption is two states: number and title alone, or those
   raised with the body underneath. The CSS does the motion — the body's
   max-height carries it, and the block is bottom-anchored so the title rises
   on its own — and this does nothing but hold the state.

   `capBody.scrollTop = 0` on close. The body scrolls internally once it is
   past the 42vh ceiling, and a stage left scrolled halfway down reopens
   mid-sentence on the next stop that happens to be long.

   Desktop never calls this with `true`: the button is display:none there, so
   there is no control to press, and the class it would add has no rules
   outside the phone block. */
function setCaptionOpen(open) {
  capEl.classList.toggle('cap-open', open);
  capToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  capToggleLabel.textContent = open ? 'Close' : 'Read more';
  if (!open) capBody.scrollTop = 0;
}

capToggle.addEventListener('click', (e) => {
  e.stopPropagation();          // the caption sits over pickable die
  setCaptionOpen(!capEl.classList.contains('cap-open'));
});

/* --- how much room the stage block gets -------------------------------
   On a phone the bottom row is stage block, back, forward, credit, and the
   first cell may only have what the rest leave it. That is not a constant:
   at stop 7 the forward arrow is swapped for the "Start Building" CTA, which
   is sized by its label, and the nav grows by about 70px. A percentage tuned
   on the other six stops overlaps on that one.

   So it is measured off the nav's real left edge and published as --cap-room,
   which the phone block reads. A ResizeObserver rather than a call at each
   stage change: the nav's width changes for reasons the stage index does not
   describe — the CTA swap, a font landing late, an orientation change — and
   the observer catches all of them without a list.

   Written on :root and consumed only inside the phone media query, so at
   desktop widths the property is set and nothing reads it. */
const capNav = document.getElementById('nav');
/* CAP_GAP, not GAP. `GAP` is already a module-level const up at the region
   geometry — the die's own cores-to-L3 hairline in world units — and
   redeclaring it is a SyntaxError that takes the entire scene down, not a
   shadowed variable. The page rendered black with `window.__die` undefined. */
const CAP_GAP = 10;

function publishCapRoom() {
  const navLeft = capNav.getBoundingClientRect().left;
  const inset = parseFloat(getComputedStyle(capEl).left) || 0;
  const room = Math.max(0, Math.round(navLeft - inset - CAP_GAP));
  document.documentElement.style.setProperty('--cap-room', room + 'px');
  /* Below a readable measure the row stops being worth holding. At stop 7 the
     CTA leaves 72px at 390 and 26px at 320, and a two-line title in 26px is a
     column of broken words — the layout would be intact and the content
     illegible. The class moves the stage block onto its own line above the
     buttons, which is the same block, unsqueezed, one row higher.

     120px is where "The Floorplan Beneath" stops fitting in two lines at this
     size, i.e. measured from the longest string it has to hold, not picked. */
  document.documentElement.classList.toggle('cap-cramped', room < 120);
}

new ResizeObserver(publishCapRoom).observe(capNav);
addEventListener('resize', publishCapRoom);
publishCapRoom();

/* --- the block sheet -------------------------------------------------
   Clicking a block STOPS the descent and opens a sheet: the block's name and
   description on the left, a video player on the right, both sitting on the
   blurred scene. Dismissed with the X, Escape, or a click on the backdrop.

   SUBJECTS is keyed by slug, one entry per NAME rather than per polygon: all
   eight Zen 5 cores open the same sheet, as do both L2 halves and both IFOP
   PHYs. Videos are expected at assets/video/<slug>.mp4; HAVE_VIDEO lists the
   ones that exist and the player stays blank for the rest.

   The copy is lifted from the live site's Meet the Processor page so the two
   tell the same story in the same voice. Em dashes in the source are recast as
   commas or sentence breaks to match this project's prose rule, and its
   parenthetical asides are folded into the sentence for the same reason; the
   wording is otherwise the site's.

   Three blocks have no counterpart there yet, because that page stops at "coming
   soon" before reaching them: instruction fetch, integer execution and
   load/store. Their copy is written here and should be replaced when the page
   catches up, so the two do not drift. */
const SUBJECTS = {
  'zen5-core': { title: 'Zen 5 Core', body: [
    'Surrounding the cache are the Zen 5 cores themselves, the parts of the processor responsible for executing instructions and doing the actual work of computation. Whether rendering graphics, compiling code, simulating physics, or running a game, nearly every task performed by the processor ultimately passes through these cores.',
    'On the die photograph, the cores appear as large, complex blocks filled with smaller structures dedicated to specific jobs: fetching instructions, making decisions about what comes next, performing calculations, and moving data where it needs to go. Together, billions of transistors work in concert, turning streams of electrical signals into the software and experiences we interact with every day.',
  ] },
  'l3-cache': { title: 'L3 Cache', body: [
    'The first major structure that stands out is the L3 cache, a shared pool of 32 MB of ultra-fast memory sitting at the center of the CCD. Rather than storing long-term data, the cache acts as the processor’s working memory, keeping frequently used instructions and information close at hand so the cores don’t have to wait for data to arrive from elsewhere in the system.',
    'On the die photograph, the L3 cache appears as large, orderly blocks of repeating patterns, dense arrays of tiny memory cells packed together with incredible precision. While the cores do the thinking, the cache keeps the information flowing, quietly feeding data to the processor fast enough to keep billions of operations moving every second.',
  ] },
  'ifop-phy': { title: 'IFOP PHY', body: [
    'Situated along the edge of the CCD is the IFOP PHY, short for Infinity Fabric On-Package Physical Layer. This high-speed interface links the compute die to the rest of the processor, carrying requests for memory, data destined for the graphics card, and information traveling to and from the I/O die.',
    'On the die photograph, the IFOP PHY appears as a collection of tightly packed circuitry dedicated not to computation, but communication. While the cores perform calculations and the cache keeps data nearby, the IFOP PHY serves as the CCD’s gateway, ensuring information can move quickly and reliably between the processor’s many pieces.',
  ] },
  'test-debug': { title: 'Test / Debug', body: [
    'Tucked away among the larger functional blocks of the CCD is the Test/Debug circuitry, a collection of specialized hardware used during the processor’s development and manufacturing rather than during everyday operation. Before a processor ever runs an operating system or launches an application, engineers rely on these interfaces to verify that billions of transistors are functioning exactly as intended.',
    'The Test/Debug logic provides a window into the processor’s inner workings, allowing engineers to inspect signals, validate designs, and diagnose problems that would otherwise be impossible to observe once the chip is sealed beneath its heat spreader. For example, if a newly manufactured processor fails to boot or produces an unexpected result during testing, engineers can use this circuitry to observe how instructions move through the cores, verify that data is reaching the cache, or confirm that communication between the CCD and I/O die is operating correctly.',
  ] },
  'smu': { title: 'SMU / Power Management & I/O Interconnect', body: [
    'Sandwiched in the middle is the SMU, or System Management Unit, the part of the processor responsible for power management and overall coordination of how the chip behaves. The SMU is constantly monitoring temperature, power draw, and workload, making real-time decisions about how fast the processor should run and which parts should be active at any given moment. This continuous balancing act helps the processor stay efficient while still delivering performance when it is needed.',
    'The I/O interconnect is the internal communication network that ties the major functional blocks of the processor together. It moves data between the cores, cache, memory controllers, and other on-die components, allowing them to operate as a single coordinated system. This is different from the IFOP PHY, which specifically handles high-speed communication between the CCD and the separate I/O die outside of it, while the I/O interconnect focuses on traffic within the die itself.',
  ] },
  'l2-cache': { title: 'L2 Cache', body: [
    'The L2 cache is a core’s private mid-level memory. Each core gets its own 1 MB that it can access without having to compete with any other core. Because L2 belongs to a single core, it’s built directly onto that core rather than in a shared region of the die. Keeping it close minimizes the distance signals travel, which is what keeps it fast.',
    'You’ll also notice the 1 MB isn’t one solid block but two 512 KB banks. Splitting the array shortens the wiring inside each half, so accesses are quicker and draw less power than one large block would.',
  ] },
  'l2-cache-tags': { title: 'L2 Cache Tags', body: [
    'A cache holds copies of data pulled from main memory, and every stored line carries a tag, a small label recording which memory address it came from. The cache then uses the tag to determine if it actually holds what the core is asking for.',
    'In our example, the L2 has a dedicated block set aside just for tags, whereas the L3 most likely distributed its tags across its individual slices, each slice tracking the lines it holds.',
  ] },
  'l1i-cache': { title: 'L1I Cache', body: [
    'The L1 cache is the smallest and fastest memory on the core, and the first place the core looks for any instruction or piece of data. Unlike the L2 and L3, it isn’t a single pool. It is split into an instruction cache, the L1i, holding the code the core is about to run, and a data cache, the L1d, holding the values that code operates on. That split exists because the core does both at once: while the front of the core pulls in the next instructions, other parts are busy reading and writing data. Giving each stream its own cache lets the core fetch and move data in parallel instead of competing for the same access.',
    'The L1i holds 32 KB of ultra-fast memory, while the L1d holds 48 KB, both tiny compared to the L2, which is more than ten times larger. But what L1 gives up in capacity it makes up in speed, running roughly three times faster than the L2 below it. That’s the bargain of the whole hierarchy: the closer a cache sits to the core, the smaller and faster it gets.',
  ] },
  'l1d-cache': { title: 'L1D Cache', body: [
    'The L1 cache is the smallest and fastest memory on the core, and the first place the core looks for any instruction or piece of data. Unlike the L2 and L3, it isn’t a single pool. It is split into a data cache, the L1d, holding the values the code operates on, and an instruction cache, the L1i, holding the code the core is about to run. That split exists because the core does both at once: while the front of the core pulls in the next instructions, other parts are busy reading and writing data. Giving each stream its own cache lets the core fetch and move data in parallel instead of competing for the same access.',
    'The L1d holds 48 KB of ultra-fast memory, while the L1i holds 32 KB, both tiny compared to the L2, which is more than ten times larger. But what L1 gives up in capacity it makes up in speed, running roughly three times faster than the L2 below it. That’s the bargain of the whole hierarchy: the closer a cache sits to the core, the smaller and faster it gets.',
  ] },
  /* No counterpart on Meet the Processor yet. Replace when it gets there. */
  /* The first subject with `links`. This block is the one place on the die where
     the site already teaches the whole idea end to end, so the sheet offers the
     way across. Ordered as the course orders them: what an instruction IS before
     what the core does with it. */
  'instruction-fetch': { title: 'Instruction Fetch and Decode', body: [
    'This is where an instruction begins its journey through the core. The block works out which instruction comes next, pulls its bytes from the L1 instruction cache beside it, and decodes them into the smaller internal operations that the rest of the core actually executes.',
    'Decoding is harder than it sounds. x86 instructions vary in length, so before the core can decode anything it has to work out where each instruction even starts, which is why this part of the die is so much denser than the arithmetic that follows it.',
  ], links: [
    { href: '../single-cycle-cpu/basics-of-instructions/',
      img: '../assets/single-cycle-cpu/r-type.jpg',
      title: 'The Basics of Instructions' },
    { href: '../single-cycle-cpu/fetch-decode-execute/',
      img: '../assets/single-cycle-cpu/fde.jpg',
      title: 'Fetch, Decode, Execute' },
  ] },
  'integer-execution': { title: 'Integer Execution', body: [
    'These are the units that do the actual work on whole numbers: adding, comparing, shifting, and computing the addresses that loads and stores will use. Most instructions in most programs end up here.',
    'Because nearly everything passes through it, this block sits at the centre of the core with the integer register file immediately beside it, keeping the distance between where values are stored and where they are operated on as short as possible.',
  ] },
  'load-store': { title: 'Load / Store', body: [
    'This is the machinery that moves data between the core’s registers and memory. It turns the addresses a program uses into the physical addresses the hardware needs, and it talks directly to the L1 data cache sitting next to it.',
    'It also keeps order. A modern core is allowed to finish work out of sequence for speed, but a program must never be able to tell, so the load/store logic tracks every outstanding access and makes sure the results appear in an order the program would consider legal.',
  ] },

  /* --- the rest of one core -------------------------------------
     Fourteen blocks that had no sheet at all: clicking them did nothing,
     while their neighbours opened. This copy is written HERE rather than
     lifted from the live site, because that page has not reached these
     yet, and it should be replaced by the site's own words when it does
     so the two do not drift.

     Two carry a question mark on the die annotation and their copy says
     so in its first line rather than presenting a guess as a fact. */
  'l2-control': { title: 'L2 Control', body: [
    'Every cache needs logic that decides what it holds and when. The L2 control block tracks which lines are resident, issues the fills that bring a missing line in from L3 or from memory, and chooses which line to evict when a new one arrives and there is no room left for it.',
    'It also keeps this core\'s view of memory consistent with every other core\'s. When a neighbouring core asks for a line this one has modified, the coherence traffic that resolves the conflict passes through here. That is why the block sits hard against the L2 array rather than out among the rest of the core logic.',
  ] },
  'l2-dtlb': { title: 'L2 DTLB', body: [
    'Programs address memory with virtual addresses, and the hardware has to turn each one into a physical address before it can reach the cache. A translation lookaside buffer keeps recent translations close by so the work does not have to be repeated on every single access.',
    'This is the second and larger level of that structure for data accesses. A hit in the small L1 DTLB in front of it costs almost nothing. A miss falls back to here, and only when this misses too does the core walk the page tables out in memory, which is slower by a wide margin.',
  ] },
  'l2-itlb': { title: 'L2 ITLB', body: [
    'The instruction side needs the same virtual to physical translation the data side does, and it needs it before it can fetch anything at all. The ITLB holds those translations for instruction addresses so that fetching can begin immediately.',
    'This is the second level, larger and slower than the L1 ITLB ahead of it. Code tends to run in long contiguous stretches rather than jumping randomly around memory, so instruction translations have unusually strong locality and a fairly modest structure here catches nearly everything the first level lets through.',
  ] },
  'integer-regfile': { title: 'Integer Regfile', body: [
    'The register file is the small, extremely fast store that the integer units read their operands from and write their results back into. Registers are the only memory the arithmetic hardware touches directly, so everything else has to be loaded into one before it can be worked on.',
    'It is small because it has to be fast, and because it is enormously multiported. Several integer operations issue every cycle and each of them needs its operands in that same cycle, so the array is built to serve many simultaneous reads and writes at once. That costs far more area per bit than a cache pays.',
  ] },
  'scheduling': { title: 'Scheduling', body: [
    'Instructions arrive in program order and do not have to execute in it. The scheduler holds instructions that have been decoded but cannot run yet, watches for the moment each one\'s operands become available, and issues it to a free execution unit as soon as both conditions are satisfied.',
    'This is what keeps the execution units busy. A core that ran instructions strictly in the order they were written would stall every time one waited on a slow load from memory, while a scheduler simply runs whatever else happens to be ready in the meantime. It is among the largest and most power hungry blocks in the core for precisely that reason.',
  ] },
  'branch-predictor': { title: 'Branch Predictor', body: [
    'A core with many instructions in flight at once cannot afford to stop and find out which way a branch goes. The branch predictor guesses, and the front end carries on fetching down the predicted path as though the answer were already known.',
    'Modern predictors are right the overwhelming majority of the time. When one is wrong the core has to throw away everything it executed speculatively after the branch and restart from the correct path, which costs many cycles, so accuracy here turns almost directly into performance.',
  ] },
  'vector-regfile': { title: 'Vector Regfile', body: [
    'The vector register file holds the wide operands that the floating point and vector units work on. Where an integer register holds a single value, a vector register holds a whole row of them side by side, and one instruction operates on every element at once.',
    'It appears on the die as four quarters rather than as one block. Splitting the array shortens the wiring inside each piece, which is the same reasoning that splits the L2 cache into banks. A smaller array is a faster array, and it draws less power every time it is read.',
  ] },
  'fadd-fmac': { title: 'FADD + FMAC', body: [
    'These are the floating point arithmetic units. FADD handles addition and subtraction. FMAC performs a fused multiply accumulate, computing a multiplication and an addition as a single operation with only one rounding step at the very end, which is both faster and more accurate than doing the two separately.',
    'Fused multiply accumulate is the workhorse of almost everything numerically heavy. Matrix multiplication, signal processing, physics simulation and the linear algebra underneath machine learning are all long sequences of multiply and accumulate. Four of these lanes sit on the die, each 256 bits wide, so one instruction keeps all of them working at the same time.',
  ] },
  'vector-execution': { title: 'Vector Execution', body: [
    'Vector execution is the control and datapath wrapped around the floating point units. It takes vector instructions from the scheduler, reads their operands out of the vector register file, steers them into the right lane, and collects the results on the way back.',
    'The point of vectors is throughput. A scalar instruction produces one result, while a vector instruction of roughly the same cost produces a whole row of them, so any workload that applies the same operation across a large array of data runs several times faster through here than it would through the integer units.',
  ] },
  'microcode': { title: 'Microcode', body: [
    'Most x86 instructions are decoded directly into the simple internal operations the core actually executes. A minority are too complex for that, and those are handled by microcode: a small program held inside the processor that expands one complicated instruction into the sequence of simple steps which carry it out.',
    'Microcode is also how a processor is repaired after it has shipped. Because these sequences live in a patchable store rather than in fixed logic, a manufacturer can change the behaviour of an instruction with a firmware update. That is how a great many errata and security fixes reach processors already sitting in people\'s machines.',
  ] },
  'l1-btb': { title: 'L1 BTB', body: [
    'The branch target buffer remembers where branches went last time. The predictor decides whether a branch is taken, and the BTB supplies the address it jumps to, so the front end can begin fetching from the target without waiting for the branch itself to be worked out.',
    'This is the first and fastest level, small enough to answer inside the fetch cycle. Even so it holds on the order of sixteen thousand entries, which makes it a substantial array in its own right and is why it reads as a distinct block on the die rather than disappearing into the fetch logic around it.',
  ] },
  'l2-btb': { title: 'L2 BTB', body: [
    'A second, larger branch target buffer sitting behind the first. When a branch is not found in the L1 BTB, this one is consulted before the core has to fall back on slower means of working out where the branch leads.',
    'The two together form the same kind of hierarchy the caches do: a small fast structure that answers most requests immediately, backed by a larger and slower one that catches what the first misses. Branch prediction hardware is built in levels for exactly the reasons caches are.',
  ] },
  'op-cache': { title: 'Microcode Cache', body: [
    'The question mark on this label is deliberate. The block is identified from its position beside the decode hardware and from the regular array structure visible in the photograph, not from published documentation, so what follows is the reading that best fits rather than a confirmed fact.',
    'A structure in this position holds instructions that have already been decoded, so that running the same code again does not mean decoding it again. Decoding x86 is genuinely expensive, and keeping already decoded operations near the front end saves both the time and the power the decoders would otherwise spend repeating work they have already done.',
  ] },
  'cpl': { title: 'CPL', body: [
    'This is the least certain label on the die. Unlike its neighbours, CPL is not an abbreviation that published material pins down for this core, and the block is small enough that its structure gives little away.',
    'The reading that best fits its size and its position against the core\'s control logic is clock and power management: the circuitry that generates and distributes this core\'s clock and handles its transitions between voltage and frequency states. Every core needs such a block, and it has to sit close to the logic it drives.',
  ] },
};

/* Slugs whose video has actually been uploaded. Add to this as they land; until
   a slug is in here the media half shows "video coming soon" instead of a
   broken player. */
const HAVE_VIDEO = new Set(['zen5-core', 'instruction-fetch', 'scheduling',
                            'load-store', 'integer-execution', 'ifop-phy']);

/* Written, but deliberately NOT in SUBJECT_OF below, so nothing on screen opens
   them yet: only the twelve blocks that were asked for are wired up. The copy is
   kept here rather than deleted because it is the same writing that used to sit
   behind the leader-line callouts, and wiring any of these up later is one line
   in SUBJECT_OF plus a pick id. */
const SUBJECTS_UNWIRED = {
  ihs: { title: 'Integrated heat spreader',
    body: ['The nickel-plated copper lid. It carries no signals at all: its only jobs are to move heat out of the silicon into whatever cooler you bolt on, and to give the fragile dies underneath something to hide behind.'] },
  iod: { title: 'I/O die',
    body: ['The larger of the two dies, and the reason the 9600X is called a chiplet design. It holds the memory controllers, PCIe, and a small integrated GPU. Built on an older, cheaper TSMC N6 process, because none of that logic benefits much from the newest node.'] },
  ccd: { title: 'Zen 5 CCD "Eldora"',
    body: ['The compute die: eight Zen 5 cores and 32 MB of L3 in 70.6 square millimetres of TSMC N4P silicon. This is the only part of the package built on a leading-edge process, which is precisely why AMD separates it from the I/O die.'] },
  metal: { title: 'Copper interconnect',
    body: ['Wiring, not logic. The lowest layers are thin and tightly pitched, carrying signals a few micrometres between neighbouring transistors. Each layer up is thicker and more widely spaced, until the topmost layers are effectively power rails and clock distribution. Layers alternate their preferred routing direction so wires can cross without touching.'] },
  fets: { title: 'The transistors',
    body: ['Beneath all the wiring sit the switches themselves. N4P is a FinFET process: the silicon channel stands up as a fin and the gate wraps over three of its sides. Gate-all-around structures replace this arrangement at the 2 nm generation, but not here.'] },
};


/* pick id -> subject slug. Floorplan regions arrive by id; core blocks arrive as
   'blk:<label>', because a core block's identity is its label, not an id. */
const SUBJECT_OF = {
  'core-l1': 'zen5-core', 'core-l2': 'zen5-core', 'core-l3': 'zen5-core',
  'core-l4': 'zen5-core', 'core-r1': 'zen5-core', 'core-r2': 'zen5-core',
  'core-r3': 'zen5-core', 'core-r4': 'zen5-core',
  l3: 'l3-cache', ifop1: 'ifop-phy', ifop2: 'ifop-phy',
  test: 'test-debug', smu: 'smu',
  'blk:Instruction Fetch': 'instruction-fetch',
  'blk:L1I Cache': 'l1i-cache',
  'blk:L1D Cache': 'l1d-cache',
  'blk:L2 Cache ½': 'l2-cache',
  'blk:L2 Cache Tags': 'l2-cache-tags',
  'blk:Integer Execution': 'integer-execution',
  'blk:Load / Store': 'load-store',
  'blk:L2 Control': 'l2-control',
  'blk:L2 DTLB': 'l2-dtlb',
  'blk:L2 ITLB': 'l2-itlb',
  'blk:Integer Regfile?': 'integer-regfile',
  'blk:Scheduling': 'scheduling',
  'blk:Branch': 'branch-predictor',
  'blk:Vector Regfile ¼': 'vector-regfile',
  'blk:FADD + FMAC': 'fadd-fmac',
  'blk:Vector Execution': 'vector-execution',
  'blk:Microcode': 'microcode',
  'blk:L1 BTB?': 'l1-btb',
  'blk:L2 BTB?': 'l2-btb',
  'blk:Microcode Cache?': 'op-cache',
  'blk:CPL': 'cpl',
};

const sheet = document.getElementById('sheet');
const sheetVideo = document.getElementById('sheet-video');
const sheetLinks = document.getElementById('sheet-links');
const sheetMedia = document.querySelector('.sheet-media');
const sTitle = document.getElementById('sheet-title');
const sBody = document.getElementById('sheet-body');

/* Freezing while the sheet is open. This used to be genuinely awkward: the
   descent was driven by window.scrollY, so holding it still meant stopping the
   page from moving as well as stopping the animation, which took a pinned scroll
   offset plus non-passive wheel and touchmove handlers to cancel the gesture.

   None of that is needed now. The page does not scroll at all, and t only ever
   changes inside advance(), so `frozen` has one job: make the arrows inert. The
   sheet can also only be opened from a stop, so there is never a flight in
   progress to interrupt. */

function openSheet(id) {
  const slug = id && SUBJECT_OF[id];
  if (!slug) return false;             // not a subject: do not touch the scroll
  const sub = SUBJECTS[slug];
  sTitle.textContent = sub.title;
  sBody.replaceChildren(...sub.body.map((text) => {
    const el = document.createElement('p');
    el.textContent = text;
    return el;
  }));
  /* The player is always shown, blank when there is nothing to play: a black
     16:9 frame with its controls, rather than a placeholder standing in for it. */
  /* Lesson cards. Hidden outright when the subject has none, rather than left as
     an empty row: the player below is deliberately shown blank because a missing
     video is a promise, and a missing lesson is not. */
  sheetLinks.replaceChildren(...(sub.links || []).map((link) => {
    const a = document.createElement('a');
    a.className = 'lesson-card';
    a.href = link.href;
    const art = document.createElement('img');
    art.className = 'lesson-card__art';
    art.src = link.img;
    /* Decorative: the title beside it already names the destination, so a screen
       reader announcing the figure as well would read the card twice. */
    art.alt = '';
    art.loading = 'lazy';
    const label = document.createElement('span');
    label.className = 'lesson-card__label';
    const kicker = document.createElement('span');
    kicker.className = 'lesson-card__kicker';
    kicker.textContent = 'Lesson';
    const title = document.createElement('span');
    title.className = 'lesson-card__title';
    title.textContent = link.title;
    label.append(kicker, title);
    const arrow = document.createElement('span');
    arrow.className = 'lesson-card__arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12h13M12 5l7 7-7 7"/></svg>';
    a.append(art, label, arrow);
    return a;
  }));
  sheetLinks.hidden = !(sub.links && sub.links.length);

  const have = HAVE_VIDEO.has(slug);
  sheetMedia.classList.toggle('has-video', have);
  if (have) { sheetVideo.src = './assets/video/' + slug + '.mp4'; sheetVideo.load(); }
  else { sheetVideo.removeAttribute('src'); sheetVideo.load(); }
  sheet.hidden = false;
  frozen = true;
  sheetOpened = true;
  /* Clear the peek as well as blocking it: the click that opened the sheet may
     have been made with the bar already down. */
  barBlocked = true;
  barHovering = false;
  syncBar();
  syncNav();
  document.getElementById('sheet-close').focus();
  return true;
}

function closeSheet() {
  if (sheet.hidden) return;
  sheetVideo.pause();
  sheet.hidden = true;
  frozen = false;
  /* barHovering was left false while blocked, so the bar does not spring down
     the instant the sheet clears under a cursor that is still near the top.
     It waits for a fresh move into the band, which is the deliberate gesture
     the peek is meant to answer. */
  barBlocked = false;
  syncBar();
  syncNav();
}

document.getElementById('sheet-close').onclick = closeSheet;
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
/* Returns the hit tile's userData, not just its id, because hovering needs the
   tile RECORD to raise and pulse it — see hovered below. */
function pick(ev) {
  ptr.x = (ev.clientX / innerWidth) * 2 - 1;
  ptr.y = -(ev.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera(ptr, camera);
  /* Only the two tile groups, and only blocks that are actually on screen.
     Both halves matter now that a click FREEZES the descent: the raycaster
     ignores object visibility, so without the opacity test a Zen 5 Core would be
     clickable — and would stop the page — during the opening shot of a packaged
     chip. hitGroup used to be in this list to make regions pickable; the tiles
     are real geometry over the same ground, so it is redundant as well as
     unguarded. */
  for (const hit of ray.intersectObjects([tileGroup, coreTileGroup], true)) {
    const ud = hit.object.userData;
    if (!ud.pick || !SUBJECT_OF[ud.pick]) continue;
    if (!selectable(ud.live)) continue;
    return ud;
  }
  return null;
}


/* --- parts, not blocks ------------------------------------------------
   Several things on this die are ONE part drawn as several blocks: the Zen 5
   cores, the two L2 halves, the four vector regfile quarters, the four FADD +
   FMAC lanes, the two Vector Execution columns. The floorplan and the core were
   traced that way because that is how the silicon is laid out, and the labels
   say so — "L2 Cache ½", "Vector Regfile ¼".

   SUBJECT_OF already knows which blocks are the same part, because it maps every
   pick id to the sheet it opens and the four quarters all open one sheet. So the
   grouping needs no new table: the part IS the subject.

   Hover used to answer on the single block under the cursor. That was wrong on
   exactly these parts. A viewer moving onto one quarter of the vector regfile
   was shown one quarter reacting, learned that this small rectangle was the
   clickable thing, and then got a panel about the whole register file — and the
   three identical rectangles beside it, which do the same job and open the same
   panel, sat still as though they were something else. The lift is the only
   thing on screen that says what a click is going to act on, so it has to
   outline the part, not the pick. */
const PART = new Map();          // subject slug -> every block that opens it
for (const tl of tiles)     addToPart(tl);
for (const tl of coreTiles) addToPart(tl);
function addToPart(tl) {
  const subj = SUBJECT_OF[tl.body.userData.pick];
  if (!subj) return;             // not wired to a sheet, so not a part
  let set = PART.get(subj);
  if (!set) PART.set(subj, set = []);
  set.push(tl);
}
/* Falls back to the block itself, so anything outside SUBJECT_OF still behaves
   exactly as it did: a part of one. */
const partOf = (tl) => PART.get(SUBJECT_OF[tl.body.userData.pick]) || [tl];
/* Only the blocks that are actually on screen. A part can straddle a boundary
   the descent has already crossed, and a faded block must not be lifted or have
   its fill restored — the same reasoning as the drop in hoverState below. */
const litPart = (tl) => new Set(partOf(tl).filter(selectable));

/* The block under the cursor, if it is one you can open, and every block that
   rises with it. The scene reads hoverSet every frame to lift and pulse — see
   the tile loops in updateScene. `hovered` stays the single record the cursor is
   actually on, because the things that ask about it (the hint line, the attract
   pass standing down, the verify hook) mean the cursor, not the part. */
let hovered = null;
let hoverSet = new Set();
function setHover(tl) {
  if (tl === hovered) return;
  hovered = tl;
  hoverSet = tl ? litPart(tl) : new Set();
}

/* The scene is only touchable while PARKED at a stop — see atStop(). Mid-flight
   the blocks are still arriving, the camera is still moving, and a hit test
   against a half-risen slab is both hard to aim at and meaningless: whatever the
   viewer meant to click has moved by the time they click it. Gating on atStop()
   rather than on individual opacities also gives the interaction one rule the
   viewer can learn: it is live when the chip has come to rest. */
canvas.addEventListener('click', (ev) => {
  if (!atStop()) return;
  const ud = pick(ev);
  if (ud && openSheet(ud.pick)) setHover(null);   // the sheet covers the canvas
});
let hoverRaf = 0;
/* Where the cursor is, and whether it is a cursor at all. The block tag rides
   the pointer, so it needs the position every frame rather than only on the
   throttled pick; and a touch "pointer" must not raise a chip that would sit
   under the finger that summoned it. */
let ptrX = 0, ptrY = 0, ptrTouch = false;
canvas.addEventListener('pointermove', (ev) => {
  ptrX = ev.clientX; ptrY = ev.clientY;
  ptrTouch = ev.pointerType === 'touch';
  if (hoverRaf) return;
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0;
    if (!atStop()) { setHover(null); canvas.style.cursor = 'default'; return; }
    const ud = pick(ev);
    setHover(ud ? (ud.live || null) : null);
    canvas.style.cursor = ud ? 'pointer' : 'default';
  });
});
canvas.addEventListener('pointerleave', () => { setHover(null); });

/* --- hover feedback -------------------------------------------------
   A hovered part rises a little further out of the die and its colour breathes,
   which is the affordance: these slabs already move, so a static highlight would
   not read as "this one is different", but a slab that lifts under the cursor and
   pulses does.

   PART, not block — see the note above setHover. Where a part is several blocks
   they all rise together, which is also why the lift reads as an outline of the
   thing rather than a highlight of a rectangle: four quarters coming up as one
   shape is a picture of how wide the vector unit is, and that width is the point
   the core reveal is already making when it raises them as a single beat.

   HOVER_LIFT is a FRACTION of the block's own settled offset rather than a world
   distance, because the floorplan sits at 0.20 and the core at 0.069 — one fixed
   number would be invisible on one and absurd on the other. */
const HOVER_LIFT = 0.85;     // of the settled rest height
/* Was 0.5, which under a cursor was a nudge you had to be looking for and, once
   the attract pass started driving the same response as a demonstration, was too
   quiet to be the thing that draws the eye in the first place. */
const HOVER_EASE = 0.16;     // per frame, so the rise and fall are not a snap
const PULSE_HZ = 1.15;

/* A block is selectable exactly while its WALLS are still drawing a coloured
   edge, and that is the right signal rather than an accident of implementation:
   the wall is the "coloured block outline" — it is what remains visible through
   the whole outline phase, after the fill has crossfaded away, and it is the last
   thing to go when the overlay clears. So the same number gates picking, hover,
   and whether hover may restore a fill.

   0.15 rather than something smaller: at 0.06 a region was still clickable when
   it was 94% faded and, to the eye, gone. */
const PICKABLE_MIN = 0.15;
const selectable = (tl) => !tl || tl.side.opacity >= PICKABLE_MIN;

/* 0 at rest, 1 while hovered, eased. Returns the pulse too so the caller can
   apply it to whatever reads best on that surface. */
function hoverState(tl) {
  /* Drop the hover if the block has faded out from under a cursor that never
     moved — scrolling can carry a region away while it is still hovered, and
     without this it would keep lifting and pulsing, and worse, keep the fill
     that hover restores, so a cleared region would stay visible.

     A sibling that fades leaves the set on its own; only the block the cursor is
     actually on clears the whole thing. Otherwise one member going see-through
     at the edge of a transition would take the part the viewer is pointing at
     down with it. */
  if (hoverSet.has(tl) && !selectable(tl)) {
    if (tl === hovered) setHover(null); else hoverSet.delete(tl);
  }
  const want = hoverSet.has(tl) ? 1 : 0;
  tl.hov = (tl.hov || 0) + (want - (tl.hov || 0)) * HOVER_EASE;
  if (tl.hov < 0.001) { tl.hov = 0; return 0; }
  return tl.hov;
}
const pulse = () => 0.5 + 0.5 * Math.sin(now() * 0.001 * PULSE_HZ * Math.PI * 2);

/* --- the attract pass -------------------------------------------------
   How the page says "these are clickable" without putting a label on anything.

   Every previous attempt at this added a mark to each block: a pulsing ring, then
   a plus in the corner. Both had the same problem, which is that they are a
   SECOND thing on a slab that is already carrying a colour, a name and a size,
   on top of a photograph that is itself dense with detail. Thirteen of them, or
   twenty-nine, is not a hint; it is a rash.

   So nothing is added. Instead the scene performs its own hover response on a
   block: it rises out of the die and its colour brightens exactly as it would
   under a cursor, then settles. Movement in a still frame is the strongest
   attention cue there is, and what the viewer is shown is precisely what they
   will get when they try it themselves, so the demo IS the instruction. It
   costs no geometry, no material and no new vocabulary.

   The block is chosen AT RANDOM from whatever is selectable at this stop, and
   a new one is chosen every time. That replaces three fixed slots spread evenly
   through the tile arrays, which always lifted the same three blocks in the
   same order — legible as a loop after two passes, and it taught that those
   three were special rather than that all of them are. Random means the cue
   lands somewhere new each time and eventually covers the whole die.

   It runs continuously rather than retiring once the viewer has hovered
   something. A fixed loop had to stop, because a repeating pattern in the
   corner of the eye becomes noise; an unpredictable one every few seconds
   reads as the die being alive. It does pause while the cursor is actually on
   a block, so the demo never fights a real hover. */
const JUMP_MS    = 900;    // one block's whole rise and settle
const JUMP_GAP   = 1700;   // stillness between one jump and the next
const JUMP_FIRST = 700;    // beat after the camera parks before the first

let jumpTile = null;       // the block that was drawn, and stands for its part
let jumpSet  = null;       // every block in the air with it
let jumpLast = null;       // so the same part does not go twice in a row
let jumpT0   = 0;          // when the current jump began
let jumpNext = 0;          // earliest the next one may begin

/* The pool is rebuilt per pick rather than cached, because what is selectable
   changes with the stop: the floorplan's regions at one, a core's blocks at
   another, nothing at all inside the metal stack. Asking `selectable` is the
   same test the picker and the hover use, so the demo can never lift a block
   the viewer could not have clicked.

   One entry per PART, not per block, for the same reason hover lifts the part:
   the demo is a preview of what a cursor does, so a demo that raised a lone
   regfile quarter would be previewing something that cannot happen. Deduping
   also fixes the weighting it would otherwise have — four identical lanes in the
   pool make the vector unit four times likelier to be picked than the block
   beside it, which is the opposite of "eventually covers the whole die". */
function pickJumpTile() {
  const pool = [];
  const taken = new Set();
  const consider = (tl) => {
    if (hoverSet.has(tl) || !selectable(tl)) return;
    const subj = SUBJECT_OF[tl.body.userData.pick];
    if (subj) { if (taken.has(subj)) return; taken.add(subj); }
    pool.push(tl);
  };
  for (const tl of tiles)     consider(tl);
  for (const tl of coreTiles) consider(tl);
  if (!pool.length) return null;
  let pick = pool[(Math.random() * pool.length) | 0];
  /* One retry when the dice repeat. Not a loop: with a pool of two, insisting
     on a different block every time is just alternation, which is the pattern
     this exists to avoid. */
  if (pool.length > 2 && pick === jumpLast) {
    pick = pool[(pool.indexOf(pick) + 1 + ((Math.random() * (pool.length - 1)) | 0)) % pool.length];
  }
  jumpLast = pick;
  return pick;
}

/* Called once per frame, before the tile loops read jumpLevel. */
function updateJump(live) {
  const t = now();
  if (!live) {
    /* Mid-flight, frozen behind a sheet, or the cursor is on a block. Drop any
       jump in progress and hold the next one off, so nothing is in the air the
       instant the camera lands or the sheet closes. */
    jumpTile = null; jumpSet = null;
    jumpNext = t + JUMP_FIRST;
    return;
  }
  if (jumpTile && t - jumpT0 >= JUMP_MS) {
    jumpTile = null; jumpSet = null; jumpNext = t + JUMP_GAP;
  }
  if (!jumpTile && t >= jumpNext) {
    jumpTile = pickJumpTile();
    jumpSet = jumpTile ? litPart(jumpTile) : null;
    jumpT0 = t;
  }
}

/* A sine bump rather than a ramp in and a ramp out: it leaves and arrives at
   exactly zero with zero slope, so the block never twitches at either end. */
function jumpLevel(tl) {
  if (!jumpSet || !jumpSet.has(tl)) return 0;
  return Math.sin(Math.PI * THREE.MathUtils.clamp((now() - jumpT0) / JUMP_MS, 0, 1));
}

/* ------------------------------------------------------------------ *
   8b. THE AFFORDANCE LAYER

   Three things now say "these slabs are yours to touch", and each says a
   different part of it, which is the whole reason there are three:

     the LIFT      says this reacts        (the attract pass, and hover)
     the TAG       says this has a name, and it opens
     the HINT LINE says it, in words, for anyone who has not moved the mouse

   Before this the second was missing entirely. A viewer who hovered a slab
   watched it rise and learned only that the page was alive; nothing anywhere
   connected that movement to the sheet a click would open, so the one sentence
   that did say so had to carry the whole job alone — and it was on screen at
   stage 01, where nothing is clickable, and gone by stage 03, where everything
   is. It was shown exactly when it was false.

   So: the hint lines have independent lifecycles keyed to whether anything is
   ACTUALLY selectable, and hover answers on the OBJECT rather than beside it.

   There used to be a chip here — the block's name plus "click to read about
   it" — riding the cursor, and the same chip pinned over whatever the attract
   pass was demonstrating. Both are gone, and the reason is visible the moment
   you look at one: every block already carries its own name, painted on it, in
   larger type than the chip used. The chip repeated the label it was sitting
   next to and covered two other blocks to do it. Naming was never the missing
   piece; the only thing hover had to add was that the block OPENS.

   That is now said with a ripple: concentric rings that expand and fade on the
   block's own top face, under the cursor. It is drawn in the scene rather than
   over it, so it occludes nothing, needs no text, and repeats nothing.
 * ------------------------------------------------------------------ */
const hintKeys  = document.querySelector('.hint-keys');
const hintClick = document.querySelector('.hint-click');


/* A beat after parking, matching the jump's own JUMP_FIRST, so the
   words and the demonstration arrive together rather than the line appearing
   over a still frame and then something moving underneath it. */
const HINT_DELAY = 700;


/* The hint lines. Each is a separate question.

   KEYBOARD: only at the first stop, where the viewer has not yet worked out that
   the page is played rather than scrolled. Once they have moved, it is answered.

   CLICK: only where something is genuinely selectable, which is asked of the
   tiles themselves rather than hard-coded to a stop number, so it stays true if
   the timeline is ever retimed again. It also stands down while the tag is up,
   since the tag is saying the same thing better and about a specific block, and
   it retires for good once a sheet has been opened. */
function updateHints() {
  hintKeys.classList.toggle('show', stopIdx === 0 && !flying && !frozen);
  const live = atStop() && !sheetOpened && !hovered
            && now() - parkedAt > HINT_DELAY
            && (tiles.some(selectable) || coreTiles.some(selectable));
  hintClick.classList.toggle('show', live);
}

/* --- the credit panel ------------------------------------------------
   Opens upward out of the permanent credit line. Closes on a second press, on
   Escape, and on a click anywhere else, which is the set a viewer will try. */
const creditBtn = document.getElementById('credit-more');
const creditPanel = document.getElementById('credit-panel');
function setCredit(open) {
  creditPanel.hidden = !open;
  creditBtn.setAttribute('aria-expanded', String(open));
}
const creditEl = document.getElementById('credit');
creditBtn.addEventListener('click', () => setCredit(creditPanel.hidden));
/* Scoped to the whole footer rather than to the panel, so the click that OPENED
   it cannot also be the outside-click that closes it again. Relying on
   stopPropagation for that works until something else listens in the capture
   phase, and this does not have to be thought about at all. */
addEventListener('click', (e) => {
  if (!creditPanel.hidden && !creditEl.contains(e.target)) setCredit(false);
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !creditPanel.hidden) setCredit(false);
});

/* ------------------------------------------------------------------ *
   9. PER-SCROLL SCENE STATE
 * ------------------------------------------------------------------ */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _t = new THREE.Vector3();

/* A surface whose texture has not streamed in yet stays hidden. Without this
   a fast scroll past a still-loading stage shows an untextured white plane,
   which is far worse than showing nothing for a moment. */

const mapped = (m) => !!m.map;

function updateScene(t) {
  /* --- package: the lid lifts ---
     The package used to turn a full 180 and back between 0.072 and 0.188 so the
     contact pads could be read, which was stage 02. Both are gone. assembly is
     never pitched now, only yawed, so rotation.x is left at its identity rather
     than being written every frame. */
  assembly.rotation.y = THREE.MathUtils.lerp(0.45, 0, ramp(t, 0.0, 0.20));

  /* The lid comes off almost at once. It used to wait until 0.192, because
     everything before that belonged to the flip; with the flip gone, waiting
     meant a long establishing orbit around a chip that had already been
     established by the opening frame. Pulling the IHS is now the first thing
     that happens, and the leg is the delid from there down to bare silicon. */
  const lidLift = ramp(t, 0.045, 0.150);
  lid.position.y = LID_REST + lidLift * 34;
  lidMat.opacity = lidEdgeMat.opacity = 1 - ramp(t, 0.110, 0.215);
  lid.visible = lidMat.opacity > 0.002;

  /* The substrate leaves as the camera commits to the CCD, and the I/O die
     sitting on it leaves with it, on THIS ramp — not one of its own. To the eye
     they are one object, a die resting on a slab, and fading them on separate
     schedules read as the die hovering over nothing for a moment.

     One shared ramp deliberately, rather than two that happen to line up.
     iodGroup is a CHILD of pkg, so pkg.visible gates it: give the die its own
     later window and it is cut dead the instant pkgOut completes, with its fade
     code still running every frame against something nothing draws. That bug was
     live for a long time. If the die ever needs to outlive the substrate again,
     pkg.visible has to account for both ramps, not just this one. */
  const pkgOut = ramp(t, 0.395, 0.455);
  pkgTopMat.opacity = pkgSideMat.opacity = 1 - pkgOut;
  pkg.visible = pkgOut < 0.999;

  // --- die surfaces ---
  // The die must already be wearing its real silicon texture the moment the
  // lid clears it, otherwise the CCD reads as a bare grey slab sitting next
  // to the photographic I/O die.
  const backIn  = ramp(t, 0.075, 0.145);
  const delayer = ramp(t, 0.405, 0.452);
  const coreIn  = ramp(t, 0.532, 0.566);
  const surfOut = ramp(t, 0.822, 0.854);
  const p = pulse();   // one value per frame, shared by both tile sets
  /* The jump pauses while the cursor is on a block, so the demonstration
     never competes with the thing it is demonstrating. */
  updateJump(atStop() && !frozen && !hovered);

  /* The I/O die shows its own dieshot, and everything about it — silicon, both
     photographs, the slab — leaves together on pkgOut, the substrate's ramp.

     Its dieshot arrives WITH the CCD's, both starting at 0.405 — but over 0.021
     rather than the CCD's 0.047, because this die is being taken away while it
     crossfades and the slower one never actually lands.

     The arithmetic that forces it: the picture can only ever be as opaque as
     (1 - pkgOut), so what matters is not its absolute value but its share of the
     die's own surface at the moment the crossfade completes. Matched to the CCD's
     full 0.047 the dieshot tops out at 0.21 and holds just 52% of that surface,
     so the die leaves as a half-and-half blend of backside and dieshot, never
     having become one thing. At 0.021 it reaches 0.52 and 92% — the dieshot is
     the die's surface, and then the slab carries it off.

     The old 0.88 ceiling is gone with it. It existed to keep this die secondary
     while both were fully visible; now its own fade does that, and the extra
     dimming only fights the request. */
  const iodDelayer = ramp(t, 0.405, 0.426);
  iodSiliconMat.opacity = 1 - pkgOut;
  iodTopMat.opacity   = mapped(iodTopMat)   ? (1 - iodDelayer) * (1 - pkgOut) : 0;
  iodFloorMat.opacity = mapped(iodFloorMat) ? iodDelayer * (1 - pkgOut) : 0;
  iodGroup.visible = pkgOut < 0.999;

  sBack.material.opacity  = backIn * (1 - delayer);
  sFloor.material.opacity = delayer * (1 - surfOut);
  sCore.material.opacity  = coreIn * (1 - surfOut);
  sBack.visible  = sBack.material.opacity  > 0.001 && mapped(sBack.material);
  sFloor.visible = sFloor.material.opacity > 0.001 && mapped(sFloor.material);
  sCore.visible  = sCore.material.opacity  > 0.001 && mapped(sCore.material);

  /* Names on the die faces. In once the lid has cleared and both dies are
     wearing their silicon, and now HELD through the bare-silicon stop at 0.398:
     that is the frame where the viewer is told there are two separate pieces of
     silicon, so it is the one frame where the two of them most need naming. They
     used to fade out across 0.352-0.400 and were down to nothing by the time the
     stop was reached, which named them only in passing on the way past.

     They still go before the die photograph does, which was the original point —
     up close this is meant to read as polished silicon, not as a labelled
     diagram — so the fade now tracks `delayer`, the backside-to-floorplan swap
     just below, and is gone a little ahead of it.

     The arrival moved up with the delid. These waited until 0.250 back when the
     lid did not finish clearing until 0.300, and after the IHS was pulled early
     the dies sat named-less for a stretch with nothing left to wait for. They
     now come in as the lid finishes fading, 0.150 to 0.215, which roughly
     doubles how long the two names are readable before the floorplan swap. */
  const faceA = ramp(t, 0.150, 0.215) * (1 - ramp(t, 0.404, 0.442));
  ccdFace.material.opacity = iodFace.material.opacity = faceA;
  ccdFace.visible = iodFace.visible = faceA > 0.002;
  silicon.visible = t < 0.928;

  // --- region highlights: reveal in order, bloom as fills, settle to outlines ---
  /* The reveal ends exactly at 0.512 and must keep doing so: stop 04 is pinned
     to the instant strip completes and toOutline has not yet begun, which is the
     single frame where every region is up and none has started to settle.

     The windows are allocated by SLAB COUNT. THIRTEEN regions come up here, not
     the seven a reading of REGIONS suggests: `cores` is ROWS.map twice, so it is
     four rows by two columns, EIGHT slabs, rippling L1 R1 L2 R2 down the die.
     Then one L3, then four in the bottom strip.

     Both earlier passes at this mis-sized the groups and starved whichever one
     they undercounted. The strip once had the smallest window for the second
     most slabs, landing its four 136 ms apart when each carries a DIFFERENT name
     (SMU, Test / Debug, and the two IFOP PHYs). Then the cores, the biggest
     group by far, were left on 0.024 and rippled 78 ms apart. The split now
     follows the counts: 0.042 for eight, 0.014 for one, 0.026 for four.

     The total window cannot grow to pay for this. It cannot open before 0.430,
     because the die photograph these slabs highlight regions OF is only 55%
     faded in even there, and it cannot close after 0.512, which stop 04 is
     pinned to. Thirteen slabs in a fixed 0.082 of t is what sets the leg's
     duration below. */
  const groupIn = {
    cores: ramp(t, 0.430, 0.472),      // 4 rows x 2 columns = 8 slabs
    l3:    ramp(t, 0.472, 0.486),      // one slab
    strip: ramp(t, 0.486, 0.512),      // four, each separately named
  };
  const toOutline = ramp(t, 0.512, 0.528);
  const overlayOut = ramp(t, 0.532, 0.560);
  /* Each tile has its own slice of its group's window. It fades in and lifts
     out of the die on a sine, then settles to a small standing offset, so what
     crosses the die is a wave with a trailing raised mosaic behind it. */
  const base = 1 - overlayOut;
  let tilesLive = false;
  for (const tl of tiles) {
    const a = THREE.MathUtils.clamp((groupIn[tl.grp] - tl.k) / RIPPLE[tl.grp], 0, 1);
    const e = smoothstep(a);
    /* The attract pass drives the SAME h the cursor drives, so there is exactly
       one hover response in the file and the demo cannot drift from the real
       thing. max() rather than a sum, so a real hover during the demo does not
       stack into a double-height lift. */
    const al = jumpLevel(tl);
    const h = Math.max(hoverState(tl), al);
    const y = 0.02 + base * (TILE_REST * e + TILE_PEAK * Math.sin(Math.PI * e))
                   + h * TILE_REST * HOVER_LIFT * base;
    tl.body.position.y = tl.walls.position.y = y;
    tl.fillCap.position.y = tl.lineCap.position.y = y + TILE_T;
    /* Glass is read at its edges, not its faces, so the walls sit a little
       stronger than the top. Neither writes depth — that is what keeps the
       die visible through the slab and behind it. */
    tl.face.opacity = e * base * 0.13;   // a sheen, not a surface
    tl.side.opacity = e * base;
    tl.side.depthWrite = tl.side.opacity > 0.995;
    /* Hovering undoes the crossfade to outline, so a region that has gone
       see-through gets its highlighted colour back under the cursor. Note this
       is still multiplied by `base`: once the overlay itself has cleared there is
       nothing to restore, which is what stops hover from resurrecting a region
       the descent has finished with. */
    tl.fill.opacity = Math.min(1, e * base * (1 - toOutline * (1 - h)) * (1 + 0.35 * h * p));
    tl.line.opacity = Math.min(1, e * base * toOutline * (1 + 0.35 * h * p));
    /* The breathing lives on emissiveIntensity, which brightens the walls'
       own colour rather than washing them toward white the way opacity would. */
    /* The pulse floors at 0.45 rather than 0: a raised block whose glow drops
       right back to unlit every cycle reads as flickering, and during the
       attract pass it could sit at the bottom of the beat for the whole lift. */
    tl.side.emissiveIntensity = 1 + 1.6 * h * (0.45 + 0.55 * p);
    const on = e > 0.002 && base > 0.002 && mapped(sFloor.material);
    tl.body.visible = tl.walls.visible = tl.fillCap.visible = tl.lineCap.visible = on;
    if (on) tilesLive = true;
  }
  tileGroup.visible = tilesLive;

  /* --- one core, block by block: the floorplan's wave at the core's scale ---
     Same slice-of-the-window-per-tile arithmetic as above, with peak and rest
     scaled by CORE_SCALE so the lift reads the same size on screen from a camera
     that is about three times closer. */
  /* The sequence owns the whole of stage 07 now that stage 08 is gone: 29 blocks
     over 0.560-0.800 instead of 29 over 0.028, which is what makes it followable
     rather than a wave. It starts as the camera settles onto the core and the
     floorplan has finished clearing (overlayOut ends 0.560), and finishes with
     the core standing complete for the orbit that carries the rest of the stage.

     There is NO settle to outline here, unlike the floorplan. A block takes its
     colour when it rises and keeps it until the whole core clears. The floorplan
     hands the silicon back because its regions are read once and then got out of
     the way for the descent into a core; this stage is building a picture of a
     datapath, and a block that has faded to a rim is no longer part of it. */
  /* LINEAR, deliberately, where every other timing in this file uses ramp().
     ramp() smoothsteps, which is right for a thing that starts and stops — but
     this is a queue of 29 blocks, and easing the queue's progress means the
     first three and last three crawl while the middle ten rush past. At t 0.600
     the smoothstepped version had reached block 2 of 29 when even spacing puts
     it at block 6. Each block's own rise still eases, just below. */
  const blockIn   = THREE.MathUtils.clamp((t - 0.640) / 0.160, 0, 1);
  // ...then the whole core clears with the die surfaces, ahead of the metal stack
  const blockBase = 1 - surfOut;
  let coreTilesLive = false;
  for (const tl of coreTiles) {
    const a = THREE.MathUtils.clamp((blockIn - tl.k) / CORE_FADE, 0, 1);
    const e = smoothstep(a);
    const al = jumpLevel(tl);
    const h = Math.max(hoverState(tl), al);
    const y = 0.008 + blockBase * CORE_SCALE
                    * (TILE_REST * e + TILE_PEAK * Math.sin(Math.PI * e))
                    + h * CORE_SCALE * TILE_REST * HOVER_LIFT * blockBase;
    tl.body.position.y = tl.walls.position.y = y;
    tl.fillCap.position.y = y + LIFT_T;
    // walls a little stronger than the face — glass is read at its edges
    tl.face.opacity = e * blockBase * 0.88;
    tl.side.opacity = e * blockBase;
    tl.side.depthWrite = tl.side.opacity > 0.995;
    // full colour from the moment it arrives, and it keeps it
    tl.fill.opacity = Math.min(1, e * blockBase * (1 + 0.35 * h * p));
    tl.side.emissiveIntensity = 1 + 1.6 * h * (0.45 + 0.55 * p);
    const on = e > 0.002 && blockBase > 0.002 && !!tl.face.map;
    tl.body.visible = tl.walls.visible = tl.fillCap.visible = on;
    if (on) coreTilesLive = true;
  }
  coreTileGroup.visible = coreTilesLive;

  /* --- the cell switches, continuously ---------------------------------
     The one thing a picture of a gate cannot say is what a gate DOES, so it does
     it: the input rises, one device opens while the other shuts, the output
     falls, and then the whole thing runs back the other way. Forever.

     ONE DEVICE IS ALWAYS CONDUCTING. That is the requirement this is built to,
     and it is what a complementary pair means: sigY = 1 - sigA, so the two
     brightnesses sum to 1 in every frame and neither half is ever dark. There is
     no rest state and no envelope.

     This replaced an occasional switch that spent seven of every sixteen seconds
     fully unlit, on the argument that a gate blinking on a loop becomes wallpaper
     while a rare event stays an event. That reasoning was sound and is recorded
     here because it is the thing being traded away: a continuously switching cell
     does read as more decorative. It is also the only version that is true at
     every instant rather than only during the switch, and an inverter sitting
     with BOTH halves dark is a state no real inverter is ever in.

     The plateaus are 4400 ms each, which is where the previous revision's doubled
     NMOS window landed, so the pace of a single switch is unchanged. Only the
     dead time is gone.

     The two devices DO cross over during an edge, for 484 ms, and that is not a
     bug to design out: both halves conducting briefly is what actually happens in
     silicon on a switching edge. Shortening SW_EDGE sharpens it; taking it to 0
     would give an instantaneous swap and a visible pop.

     Everything below is a pure function of the phase. No edge detection, no
     comparison against the last frame, so seeking straight to a t gives exactly
     the same frame every time and the video renderer's clock override still
     makes this a function of the frame index. */
  const SW_PERIOD = 8800;                 // one full loop; there is no rest in it
  const SW_EDGE   = 0.055;                // share of the period one edge takes, = 484 ms
  /* Runs 0..1 across the whole loop and wraps. It does NOT clamp or hold: the
     hold at 1 was what created the rest window. */
  const swPh = (now() % SW_PERIOD) / SW_PERIOD;
  /* A rises at phase 0 and falls at 0.5, so each level holds for half the loop.
     At the wrap both terms are 1 and cancel to 0, which is the same value the
     rise starts from, so phase 1 and phase 0 agree and the seam is invisible. */
  const sigA = smoothstep(THREE.MathUtils.clamp(swPh / SW_EDGE, 0, 1))
             - smoothstep(THREE.MathUtils.clamp((swPh - 0.5) / SW_EDGE, 0, 1));
  const sigY = 1 - sigA;

  const invIn  = ramp(t, 0.960, 0.984);
  /* Still gated on t so the cell fades up with the stage rather than popping in
     already lit. That is a scene-position fade, not a rest state: once the stage
     is reached this is 1 and stays 1. */
  const swA    = CELL_SWITCHING ? ramp(t, 0.980, 0.988) * invIn : 0;

  /* --- metal stack ---
     Timing, in order: the tiers fade in, the gaps cascade open from the bottom,
     the bumps land on top once the cascade is done, a pulse of light runs up the
     whole thing throughout, and then it all folds back down into a ceiling. */
  const stackIn  = ramp(t, 0.826, 0.868);
  /* The bumps fade in ON EXACTLY THE SAME RAMP AS THE STACK, deliberately sharing
     the variable rather than tracking it. Nothing about them is a separate event.

     Two earlier attempts both popped, and for the same reason. Landing them at
     0.898-0.922 put the arrival inside the window in which the camera rises past
     the top tier. Moving it to 0.888-0.904 looked safe, because at the stop the
     camera is inside the stack looking level — but by 0.902 it has swung upward
     and the top of the stack is back in frame with a couple of hundredths of the
     fade still to run, so the balls still appeared out of nowhere on a bare top.

     There is no window late enough to be "as the leg begins" and early enough to
     be out of sight, because the leg IS the camera going up there. So they
     arrive with the stack instead, while the whole thing is materialising from
     nothing and a fade is what everything on screen is doing. */
  const bumpIn   = stackIn;
  /* There is no stackOut any more, and its absence is deliberate. The stack used
     to fade away to make room for what came next; now it folds instead, and what
     comes next happens UNDERNEATH it. It is the ceiling of the last two stops and
     it is where the output pulse goes, so it has to survive to the end. */
  const stackA = stackIn;
  /* The bumps retire, and only the bumps. They sit on top of a ceiling the
     camera is about to be underneath, so they are out of frame from the moment
     the room opens, and 72 spheres at 16x12 segments are the heaviest geometry
     in the scene.

     The VIAS deliberately do not. An earlier pass retired them alongside, on the
     reasoning that a folded gap is 0.03 tall and a via in it is a sliver worth
     nothing. That is true of thirteen of the fourteen gaps and false of the one
     that matters: gap 0 is the room, so its vias do not shrink, they STRETCH,
     and they become the columns you are standing among. They are the only thing
     in the shot that says the floor and the ceiling are connected — which is
     what a via IS — and without them the room is a floor, a roof, and a gap.
     They also give it the vertical structure it otherwise completely lacks.

     Nothing needs to special-case any of this: a via's length is already its own
     gap's height, so the folded ones collapse to slivers and the ones in the
     room grow to fill it, from the same line of code. */
  const bumpOut = ramp(t, 0.944, 0.960);
  /* The copper stands down so the thing in front of it can be read. This is the
     same mechanism that used to serve the traced net, re-keyed: it LEADS the
     reveal rather than tracking it, because dimming first and then lighting one
     thing into the quiet is the better beat — the stage stops, and then
     something arrives.

     The glow stands down much further than the opacity does, and for the reason
     it always did: two lights climbing the same stack at different speeds is
     just confusing. From here on the only light that moves is the one leaving
     the cell. */
  const ceilingDim = ramp(t, 0.946, 0.962);
  const quiet = 1 - 0.52 * ceilingDim;
  const quietGlow = 1 - 0.88 * ceilingDim;
  /* M1 stops being a layer and becomes a floor. Its PLANE goes translucent so
     the rows show through it; its BARS do not. That distinction is the whole
     trick. A floor that dissolves under you is a hole, and the rows read far
     better through the gaps BETWEEN real bars than through one uniformly faded
     sheet — which is the same argument this stage already makes about
     see-through coming from structure rather than from material. */
  const m1Glass = ramp(t, 0.948, 0.964);
  /* And on the last leg the whole stack steps back again, much harder. This one
     is a matter of scale rather than of emphasis: the copper is authored at die
     scale, where a bar is a hairline, and stop 07 puts the camera one unit from
     a cell half a unit wide. At that distance the same bars are beams, and they
     cross the subject. Fading them to a ghost is the only honest way to keep
     both the gate and the metal above it in one frame, and it is also roughly
     what a real micrograph of this does. */
  const cellFocus = ramp(t, 0.970, 0.986);
  stack.visible = stackA > 0.001;
  if (stack.visible) {
    /* Tier heights first, as a running sum of the gaps below each one, so the
       vias and bumps below can read the same numbers rather than recomputing
       them and drifting. gapSpan carries both the opening cascade and the fold,
       so there is exactly one place that knows where a tier is. */
    let y = 0.02;
    for (let i = 0; i < N_METAL; i++) {
      tierY[i] = y;
      if (i < N_METAL - 1) y += gapSpan(i, t);
    }

    /* The pulse: a gaussian centred on a position that climbs past the top and
       wraps, so light keeps arriving from below rather than strobing in place.
       PULSE_SPAN overshoots N_METAL at both ends so the wave enters and leaves
       off-stack instead of appearing at M1 and vanishing at M15. */
    const PULSE_SPAN = N_METAL + 8;
    const wave = ((now() * 0.00042) % 1) * PULSE_SPAN - 4;

    const camY = camera.position.y;
    for (let i = 0; i < N_METAL; i++) {
      const m = metalLayers[i];
      const floor = i === 0;
      m.position.y = tierY[i];
      /* Fade a tier out as the camera closes on its plane. Without this, flying
         up through the stack fills the frame with copper for a frame or two as
         each plane crosses the near plane. */
      /* Two near-fade bands, because the plane and the bars fail differently.
         The PLANE is a full sheet: at a grazing angle from just below it, it
         washes the entire upper frame in flat orange and buries the structure.
         Its band is therefore wide — a tier within 0.70 of the camera's height is
         on its way out — which costs nothing from outside the stack, where every
         tier is further away than that and stays solid.
         The BARS are slats with gaps, so they can be much closer before they
         become a wall; 0.34 is enough to stop one filling the frame. */
      const nearRaw = THREE.MathUtils.smoothstep(Math.abs(camY - tierY[i]), 0.05, 0.70);
      /* M1 is released from the plane near-fade as the glass comes up. The band
         is 0.70 wide and the camera parks two thirds of a unit above M1, so
         without this there are two systems dissolving the same plane at once and
         nudging the stop's camera down a tenth of a unit would put the floor's
         opacity somewhere nobody chose. */
      const nearPlane = floor ? THREE.MathUtils.lerp(nearRaw, 1, m1Glass) : nearRaw;
      const glassF = floor ? 1 - 0.72 * m1Glass : 1;
      /* The stand-down is mostly the CEILING's. M1 is the surface the reader is
         standing on at stop 06, so it keeps far more of itself than the tiers
         above it do — but not all of it: its bars are opaque slats lying between
         the camera and the cells, and at full strength they win every pixel they
         cover and the floor stops having anything under it. Then cellFocus takes
         everything, floor included, down to a ghost for the last stop. */
      const dim = (floor ? 1 - 0.40 * ceilingDim : quiet) * (1 - 0.80 * cellFocus);
      const near = THREE.MathUtils.smoothstep(Math.abs(camY - tierY[i]), 0.04, 0.34);
      const glow = Math.exp(-Math.pow((i - wave) / 1.9, 2));
      /* The bars ride the same height, glow and near-fade as their plane, but they
         are drawn SOLID: opacity reaches a full 1 in the body of the stage and
         depthWrite comes on with it, so a bar occludes what is behind it and shows
         its own sides. Only the entrance and exit fades blend, which is the one
         moment a blended box's back faces are worth paying for. */
      const bar = metalBars[i], bm = bar.material;
      bar.position.y = tierY[i];
      /* Bar thickness folds with the gap above it. The top tiers are 0.070 thick
         and the folded pitch is 0.084, so without this they interpenetrate and
         the ceiling reads as one solid slab rather than as fifteen sheets. The
         thickness is baked into the instance matrices, so the mesh is scaled
         instead, which is free: the instances all sit at local y 0. */
      bar.scale.y = THREE.MathUtils.lerp(1, 0.30, gapClose(Math.max(i - 1, 0), t));
      bm.opacity = stackA * near * dim;
      bm.depthWrite = bm.opacity > 0.98;
      bm.emissiveIntensity = stackA * (0.05 + 1.05 * glow) * quietGlow;
      bar.visible = bm.opacity > 0.004;
      m.material.opacity = stackA * 0.92 * nearPlane * dim * glassF;
      /* 1.05, not the 2.3 this started at. Emissive stacks on top of an already
         bright metal texture, so the peak was clipping to white and losing the
         copper the whole stage is about. The pulse should read as heat moving
         through metal, not as a lamp. */
      m.material.emissiveIntensity = stackA * (0.05 + 1.05 * glow) * quietGlow;
    }

    /* Vias stretch to whatever their gap currently is, and light a little AHEAD
       of the tiers — the signal is travelling up through the connections, so the
       connection should brighten before the sheet it feeds. */
    const viaGlow = Math.exp(-Math.pow(((wave + 0.55) - 7) / 6.0, 2));
    /* The columns hold more of themselves than the ceiling does, for the same
       reason M1 does: they are in the room rather than above it, and they are
       being looked THROUGH at the rows, which only works if they are solid
       enough to be seen at all. */
    /* The columns go ALL the way out at stop 07, to zero, so `vias.visible` below
       turns the mesh off outright. That is what lets every via in the piece keep
       writing depth — and so keep reading as a solid rod — and still never hide
       the cell: a mesh that is not drawn cannot occlude anything, so the cell
       needs no special pleading of its own. They are the room's structure, and by
       this stop the room is not what is being looked at. */
    viaMat.opacity = stackA * 0.82 * Math.min(1, gapOpen(0, t) * 1.4)
                   * (1 - 0.34 * ceilingDim) * (1 - cellFocus);
    viaMat.emissiveIntensity = stackA * (0.04 + 0.8 * viaGlow) * quietGlow;
    vias.visible = viaMat.opacity > 0.002;
    if (vias.visible) {
      for (let k = 0; k < viaSeeds.length; k++) {
        const s = viaSeeds[k];
        const len = Math.max(tierY[s.gap + 1] - tierY[s.gap], 0.0008);
        _t.set(s.x, tierY[s.gap] + len / 2, s.z);
        _s.set(s.w, len, s.w);
        _m.compose(_t, _q, _s);
        vias.setMatrixAt(k, _m);
      }
      vias.instanceMatrix.needsUpdate = true;
    }

    /* Bumps sit just clear of the top tier and drop the last of the way in. */
    bumpMat.opacity = stackA * bumpIn * quiet * (1 - bumpOut);
    bumps.visible = bumpMat.opacity > 0.002;
    if (bumps.visible) {
      const by = tierY[N_METAL - 1] + 0.17 + (1 - bumpIn) * 0.9;   // settle downward
      for (let k = 0; k < bumpSeeds.length; k++) {
        const s = bumpSeeds[k];
        _t.set(s.x, by, s.z);
        _s.set(1, 1, 1);
        _m.compose(_t, _q, _s);
        bumps.setMatrixAt(k, _m);
      }
      bumps.instanceMatrix.needsUpdate = true;
    }
  }

  /* --- the cell rows --------------------------------------------------
     Nothing here moves. The field is built once and the whole stage is a fade,
     which is the right shape for it: the rows are not arriving, they were always
     there, and the only reason they were not visible is that fifteen layers of
     copper were in the way. The stage is the copper getting out of the way.

     It starts at 0.936 rather than with the fold, because the silicon die body
     is hidden at 0.928 and a field of cells appearing while a solid slab of
     silicon is still standing in the same volume reads as a clipping bug. */
  const cellIn = ramp(t, 0.936, 0.964);
  cellField.visible = cellIn > 0.002;
  if (cellField.visible) {
    cellMat.opacity = railMat.opacity = cellIn;
    /* The neighbouring tiles stand down at stop 07 so the one being read is the
       brightest thing in the frame. Not out, though: "one OF those tiles" is
       half the sentence the stage is making, and a cell alone in the dark is
       back to being the free-floating patch this replaced. Driven on the
       material colour rather than on opacity, because these are the floor and
       dropping their opacity would turn depthWrite off and let the room sort
       through its own ground. */
    const fieldQuiet = 1 - 0.42 * cellFocus;
    cellMat.color.setScalar(fieldQuiet);
    railMat.color.setScalar(fieldQuiet);
    /* Depth write comes back on once they are up, following the same rule the
       tiles and the bars use. These are the floor and they SHOULD occlude: it is
       what keeps the overdraw honest underneath a translucent M1. */
    cellMat.depthWrite = railMat.depthWrite = cellIn > 0.995;
    /* The hero tile hands itself over to the gate it turns out to be. */
    heroMat.opacity = cellIn * (1 - invIn);
    heroMat.depthWrite = heroMat.opacity > 0.995;
    heroCell.visible = heroMat.opacity > 0.004;
  }

  /* --- one cell, one gate ---------------------------------------------
     invIn completes at 0.984, before the stop at 0.990, which is the constraint
     that fixes it: the stop is meant to be the gate fully arrived, not the gate
     still arriving. The switching loop then starts a beat later still, because a
     cell that begins working while it is still assembling has two things to say
     at once and says neither. */
  fets.visible = invIn > 0.001;
  if (fets.visible) {
    devMat.opacity = gateMat.opacity = contactMat.opacity = invIn;
    oxideMat.opacity = invIn;
    wafer.material.opacity = invIn;
    nwell.material.opacity = invIn;
    m1Mat.opacity = invIn;
    for (const l of cellLabels) l.material.opacity = invIn;
    layoutCell(liftAt(t));

    /* One device conducts at a time, and that complement IS the lesson. The
       NMOS band brightens with A and the PMOS band with its inverse, so the eye
       never sees both of them lit and never has to be told which is which. */
    const fc = devs.instanceColor.array;
    for (let i = 0; i < DEVS.length; i++) {
      const lit = swA * (i < DEV_PER ? sigY : sigA);
      const b = DEV_BASE[i], h = DEV_HOT[i];
      fc[i * 3    ] = b[0] + (h[0] - b[0]) * lit;
      fc[i * 3 + 1] = b[1] + (h[1] - b[1]) * lit;
      fc[i * 3 + 2] = b[2] + (h[2] - b[2]) * lit;
    }
    devs.instanceColor.needsUpdate = true;

    /* Only the middle strip is being driven. The two on the cell boundaries are
       dummies and stay dark, which is also the clearest way to say that they are
       not gates. */
    const gc = gates.instanceColor.array;
    for (let i = 0; i < GATE_N; i++) {
      const live = i === GATE_LIVE;
      const base = live ? GATE_BASE : GATE_DIM;
      const lit = live ? swA * sigA : 0;
      for (let k = 0; k < 3; k++) {
        gc[i * 3 + k] = base[k] + (GATE_HOT[k] - base[k]) * lit;
      }
    }
    gates.instanceColor.needsUpdate = true;

    /* The metal says where the current is coming from. With A high the cell is
       pulling its output down, so ground and the input light; with A low it is
       pulling up, so the supply and the output do. */
    /* Supply and its tie light together, ground and its tie light together, so
       the current path reads end to end rather than as a rail and a strap
       happening to be bright at the same time. Each piece brightens from its OWN
       base colour, which is what keeps a lit ground rail cool and a lit supply
       rail warm instead of both washing to the same white. */
    const pc = m1pins.instanceColor.array;
    const pinLit = [sigA, sigY];               // A, Y
    for (let i = 0; i < M1_PINS.length; i++) {
      const lit = swA * pinLit[i], b = M1_BASE[i], h = M1_HOT[i];
      pc[i * 3    ] = b[0] + (h[0] - b[0]) * lit;
      pc[i * 3 + 1] = b[1] + (h[1] - b[1]) * lit;
      pc[i * 3 + 2] = b[2] + (h[2] - b[2]) * lit;
    }
    m1pins.instanceColor.needsUpdate = true;

    /* Each piece of the via reads the gaussian on its own height, which is the
       same way the traced net's pieces read one on their arc length: five boxes
       that flash in sequence are a signal travelling, one box that flashes is a
       light being switched on. */
  }

}

/* ------------------------------------------------------------------ *
   10. LOOP
 * ------------------------------------------------------------------ */

const railFill = document.getElementById('rail-fill');
let drift = !reduceMotion;

/* Wall clock for anything that animates on its own rather than on scroll — the
   copper stack's travelling light, the hover pulse. Overridable, and it has to be:
   the camera drift taught this lesson once already. Wall-clock motion advances by
   however long a frame took to ENCODE during a headless render, so a 40-minute
   video render turns a smooth 1.6-second pulse into jitter. render-video.py sets
   `window.__die.clock = frame / fps * 1000` so the motion is a function of the
   frame index instead. */
let vclock = null;
const now = () => (vclock === null ? performance.now() : vclock);

/* ---- Narrow-viewport fit -------------------------------------------------
   `fov` in three.js is the VERTICAL field of view, so the horizontal spread a
   camera key produces is a function of the viewport's aspect and nothing else
   compensates for it. Measured: 52.1 degrees across at 1440x900, and 16.1 at
   390x844. A phone therefore saw under a third of the width the keys were
   composed against, which cropped the outer cores off the floorplan while
   leaving a band of empty space above the die -- starved on the axis that
   carries the subject, over-covered on the one that does not.

   The fix pulls the camera back along its own view ray rather than widening
   the lens. Matching the desktop width exactly would need a ~100 degree fov,
   which bends the die visibly at the frame edges, or a 3.5x pull, which leaves
   the subject stranded in the middle of a tall frame. A capped pull keeps the
   34 degree lens and every composed key exactly as authored -- this is a
   post-transform on the sampled position, not an edit to the stop model.

   REF is 1.2 deliberately, BELOW every real desktop and laptop aspect (a
   1280x800 or 1440x900 laptop is 1.6, a 1080p window 1.78). So k is exactly 1
   at every width the desktop layout is checked at, and the adaptation cannot
   move a pixel there. It is continuous downward from 1.2, so a window being
   dragged narrow eases into it instead of popping. */
const FIT_REF_ASPECT = 1.2;
const FIT_MAX_PULL   = 2.2;

/* ...and how much of that pull each stop actually wants, because one factor
   across the whole descent was wrong. The pull was tuned on stops 03 and 04,
   where the subject is a wide flat die seen from outside and the narrow frame
   was genuinely cutting it off. Stops 05 and 06 are not that shot at all: the
   camera is INSIDE the metal stack and then down among the cell rows, with the
   geometry wrapping past the frame edge on every side. Nothing there is being
   cropped, so there is nothing for a pull to rescue, and backing out 2.2x does
   the one thing an interior shot cannot survive — it leaves the room. Measured
   at 390x844 it put the die's own edge and the empty background across the
   lower half of stop 05, where the desktop shot is wall-to-wall copper.

   Stop 07 sits between the two. The inverter is a real subject with an extent,
   so it does need a pull, but only about half of one: at k=1 it spans roughly
   120% of a 390px frame and is cropped, and at the full 2.2 it shrinks to half
   the width and reads as a detail seen from across the room rather than the
   thing the stop is about.

   The weight is interpolated along the descent with the same smoothstep the
   legs use, so a leg eases between two weights instead of the camera stepping
   backwards the instant a stop is passed. Every entry here is a multiplier on
   an adaptation that is already exactly 1 at desktop aspects, so none of this
   can move a desktop pixel however it is tuned. */
const FIT_W = [1, 1, 1, 1, 0, 0.5, 0.8];

/* The weight in force at t, eased across each leg. */
function fitWeight(t) {
  if (t <= STOPS[0]) return FIT_W[0];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (t < STOPS[i + 1]) {
      const u = (t - STOPS[i]) / (STOPS[i + 1] - STOPS[i]);
      return THREE.MathUtils.lerp(FIT_W[i], FIT_W[i + 1], smoothstep(u));
    }
  }
  return FIT_W[FIT_W.length - 1];
}

function fitPull(t) {
  const a = camera.aspect;
  if (a >= FIT_REF_ASPECT) return 1;
  const w = fitWeight(t);
  if (w <= 0) return 1;
  return 1 + w * (Math.min(FIT_MAX_PULL, FIT_REF_ASPECT / a) - 1);
}

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();

/* ------------------------------------------------------------------ *
   GPU warm-up

   The descent used to judder in a way that read as the easing stepping rather
   than gliding. It was not the easing. Frames measured a locked 16.7 ms across
   every leg, p50 AND p95 — with one to four isolated stalls of 50 to 380 ms
   buried in each pan. A single 380 ms stall inside a 2 s pan is 23 dropped
   frames in a row, which is exactly what "mini steps" looks like.

   Every stall lined up with a counter ticking over on the frame it happened:

     leg 2->3   progs 7->8    tex  6->9    geo  10->13     50 ms
     leg 3->4                 tex  9->16   geo  13->52    183 ms
     leg 4->5                              geo  52->111    50 ms
     leg 5->6   progs 8->12   tex 16->33                  383 ms
     leg 6->7   progs 12->13                              150 ms

   Three kinds of lazy initialisation, all paid on the first frame that draws a
   thing rather than when the thing is created: WebGL links the shader program,
   uploads the texture, and allocates the vertex buffers. Every object already
   exists at boot — only its GPU-side resources are deferred — so all of it can
   be forced early, while the viewer is parked at a stop reading the caption,
   instead of in the middle of a pan.

   The pass renders the scene with a slice of the meshes forced visible and
   unculled, into a one-pixel scissor on the real canvas. It is a real draw, so
   the program links, the texture uploads and the buffers allocate; it is one
   pixel, so it costs nothing to fill; and the frame's actual render overwrites
   the canvas immediately afterwards inside the same callback, so the compositor
   never sees it.

   It has to be the CANVAS, not an offscreen target, and that is the whole trick.
   The first version drew to a 1x1 WebGLRenderTarget, which warmed the textures
   and the vertex buffers perfectly and did nothing at all for the shaders: three
   applies tone mapping and the output colour space only when rendering to the
   screen, both are part of the program cache key, so an offscreen pass compiles
   a parallel set of programs and leaves the on-screen ones to be compiled later,
   mid-pan, exactly as before. It measured as a boot-time program count of 18
   with legs 5->6 and 6->7 still stalling 350 and 166 ms.

   Two smaller constraints. Culling comes off, or three skips precisely the
   far-away geometry the pass exists to reach. And it renders the whole scene
   rather than the batch as its own subtree, so the light count matches a real
   frame — compile a material against a different light count and the program
   cached is not the one the descent asks for. */
let warmQueue = null;
const _warmView = new THREE.Vector4();

function buildWarmQueue() {
  const meshes = [];
  scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine) meshes.push(o); });
  /* Small batches. The whole scene in one go is a ~600 ms freeze; six at a time
     is a handful of cheap frames, spread across however long the viewer spends
     reading stage 01. */
  const batches = [];
  for (let i = 0; i < meshes.length; i += 6) batches.push(new Set(meshes.slice(i, i + 6)));
  return batches;
}

function warmStep(batch) {
  const snap = [];
  scene.traverse((o) => {
    snap.push([o, o.visible, o.frustumCulled]);
    o.visible = true;
    o.frustumCulled = false;
  });
  scene.traverse((o) => {
    if ((o.isMesh || o.isPoints || o.isLine) && !batch.has(o)) o.visible = false;
  });
  renderer.getViewport(_warmView);
  renderer.setViewport(0, 0, 1, 1);
  renderer.setScissor(0, 0, 1, 1);
  renderer.setScissorTest(true);          // so the auto-clear is one pixel too
  renderer.render(scene, camera);
  renderer.setScissorTest(false);
  renderer.setViewport(_warmView);
  for (let i = 0; i < snap.length; i++) {
    snap[i][0].visible = snap[i][1];
    snap[i][0].frustumCulled = snap[i][2];
  }
}

function frame() {
  requestAnimationFrame(frame);

  /* Only ever while parked. A warm step costs a frame or two, and spending them
     inside a pan is the exact thing this exists to stop. Ahead of advance() so
     updateScene() below re-asserts the real visibility afterwards either way. */
  if (warmQueue && warmQueue.length && !flying) warmStep(warmQueue.shift());

  const t = advance();

  const fov = sampleCamera(t);
  camera.position.copy(_p);
  /* Back off along the view ray on a narrow viewport, before drift, so drift's
     amplitude still scales with the distance actually being flown. k is 1 at
     every desktop aspect — see fitPull. */
  const pull = fitPull(t);
  if (pull !== 1) camera.position.sub(_l).multiplyScalar(pull).add(_l);
  /* A slow drift on top of the keyframed path, so no shot is ever completely
     dead. The amplitude scales with how far the camera stands from its subject,
     which keeps the apparent movement the same whether we are 60 units off a
     package or 3 off a single cell. Held still for reduced motion, and
     switchable from the console so headless captures stay reproducible. */
  if (drift) {
    const d = _p.distanceTo(_l);
    const ph = now() * 0.00013;
    camera.position.x += Math.sin(ph) * d * 0.013;
    camera.position.y += Math.sin(ph * 1.7 + 1.1) * d * 0.007;
    camera.position.z += Math.cos(ph * 0.8) * d * 0.011;
    camera.up.set(Math.sin(ph * 0.55) * 0.016, 1, 0);
  }
  camera.lookAt(_l);
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  updateScene(t);
  updateCaption(t);

  railFill.style.height = `${t * 100}%`;
  /* After updateScene, because both read state it writes: the tag needs whichever
     block the attract pass claimed this frame, and the hint needs the tile
     opacities that decide whether anything is selectable at all. */
  updateHints();
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ *
   BOOT
 * ------------------------------------------------------------------ */

/* Textures stream in by the stage that first needs them.

   Only three things are required to draw stage 01 — the lid outline, the lid
   photograph and the substrate — about 1.5 MB. Waiting on the whole set meant
   holding the first frame for roughly 5.4 MB, and the single biggest item in it
   (die-floorplan.jpg, 2.2 MB) is not wanted until stage 03, several hundred vh
   of scrolling later. The rest is fetched the moment the loop starts and
   applied as each one lands.

   Anything wearing a map that has not arrived yet stays hidden rather than
   flashing an untextured white plane — see mapped() in the update. */
const setMap = (mat, tex) => { mat.map = tex; mat.needsUpdate = true; };
const DEFERRED = [
  ['./assets/die-backside.jpg',  (t) => setMap(sBack.material, t)],
  ['./assets/iod-backside.jpg',  (t) => setMap(iodTopMat, t)],
  /* Turned with the CCD's shot. Nothing is traced on the I/O die — it carries
     no regions, no highlights and no camera of its own — so unlike the CCD this
     is the texture transform alone and nothing downstream has to follow.

     Also unlike the CCD, this one is not settled by the model. The CCD's
     orientation is provable from inside the scene: its IFOP PHY has to face
     this die, and IOD_Z fixes which edge that is. The I/O die's own tell would
     be its two IFOP PHYs sitting side by side along the edge facing the two CCD
     sites, and they are not identifiable in this photograph — the long edges
     carry a row of eleven identical macros on one and repeating groups on the
     other, neither of which reads as a pair. Turned on Elliot's call, 2026-08-05.
     If it ever needs settling, settle it on the photograph, not in here. */
  ['./assets/iod-floorplan.jpg', (t) => setMap(iodFloorMat, turnTex(t))],
  /* Both die photographs go on turned, with the coordinates traced on them —
     see the half turn above CORE_U. */
  ['./assets/die-floorplan.jpg', (t) => {
    setMap(sFloor.material, turnTex(t));
  }],
  ['./assets/core-detail.jpg',   (t) => {
    turnTex(t);
    setMap(sCore.material, t);
    coreTiles.forEach((tl) => setMap(tl.face, t));
  }],
];

Promise.all([
  loadTex('./assets/substrate.jpg'),
  loadTex('./assets/ihs.jpg'),
  fetch('./assets/lid-outline.json').then((r) => r.json()),
]).then(([substrate, ihs, outline]) => {
  buildLid(outline);
  pkgTopMat.map = substrate;
  lidMat.map = ihs;
  [pkgTopMat, lidMat].forEach((m) => { m.needsUpdate = true; });

  /* Fired in one go rather than in sequence: the browser schedules six
     concurrent fetches better than we can, and nothing here gates anything
     else. Order in the array is still first-needed-first so a slow connection
     resolves them roughly in the order the descent asks for them. */
  /* initTexture uploads the moment the image lands rather than on the first
     frame that draws it. A 2 MB die photograph decodes to tens of megabytes of
     texture and that upload was one of the bigger stalls in the descent; doing
     it here staggers the cost naturally, because the six arrive as six separate
     responses rather than together.

     Only when the last one is in is the scene in its final material state —
     assigning a map flips USE_MAP and invalidates the program, so a warm-up
     started before this point would warm programs the descent never asks for —
     so that is where the shader and vertex-buffer pass is armed. */
  let pending = DEFERRED.length;
  const armWarmUp = () => {
    if (--pending !== 0) return;
    /* compileAsync before the batches, not instead of them. It links every
       program through KHR_parallel_shader_compile, so the actual GLSL
       compilation happens on driver threads instead of inside a frame, and the
       batched passes that follow are left with only the vertex buffers to
       allocate. Falls through to the batches either way: without the extension
       this resolves immediately and the passes compile as they draw, which is
       just the previous behaviour. */
    renderer.compileAsync(scene, camera)
      .catch(() => { /* warm the slow way */ })
      .then(() => { warmQueue = buildWarmQueue(); });
  };
  DEFERRED.forEach(([url, apply]) => {
    loadTex(url)
      .then((tex) => { apply(tex); renderer.initTexture(tex); })
      .catch(() => { /* that surface stays hidden */ })
      .finally(armWarmUp);
  });

  window.__die = {
    get t() { return current; },
    set drift(v) { drift = !!v; },      // off for reproducible headless captures
    /* Jump straight to a t. The verify scripts and the video renderer used to do
       this with window.scrollTo, which no longer means anything: nothing scrolls.
       This cancels any flight in progress and snaps, so a headless capture gets
       the frame it asked for and not a frame on the way to it. `stops` is exposed
       alongside so a script can capture exactly the parked shots. */
    seek(v) {
      flying = false;
      parkedAt = now();               // a seek lands, same as a flight landing
      current = target = THREE.MathUtils.clamp(+v, 0, 1);
      let i = 0;
      for (let k = 0; k < STOPS.length; k++) if (current >= STOPS[k]) i = k;
      stopIdx = i;
      syncNav();
    },
    get stops() { return STOPS.slice(); },
    get keyTimes() { return KEYS.map((k) => k.t); },
    /* For verify: the demo lift on each slotted block, and whether it is live. */
    get attract() {
      return { on: atStop() && !frozen && !hovered,
               tile: jumpTile ? (jumpTile.label ||
                                 jumpTile.body.userData.pick || '?') : null,
               lift: +(jumpTile ? jumpLevel(jumpTile) : 0).toFixed(2) };
    },
    /* Stop 07's four pin names, in normalised device coordinates: 0 is the
       middle of the frame and 1 is its edge, so anything over 1 has been cut
       off. The narrow-viewport pull is what decides this, and a screenshot
       cannot tell "OUT just clears the edge" from "it just does not" — one is
       a composition and the other is a missing word. Read after seeking to
       0.99; the labels only rise into place at that stop. */
    get cellFrame() {
      const box = new THREE.Box3(), v = new THREE.Vector3();
      const out = {};
      for (const m of cellLabels) {
        box.setFromObject(m);
        let x = 0, y = 0;
        for (let i = 0; i < 8; i++) {
          v.set(i & 1 ? box.max.x : box.min.x,
                i & 2 ? box.max.y : box.min.y,
                i & 4 ? box.max.z : box.min.z).project(camera);
          x = Math.max(x, Math.abs(v.x));
          y = Math.max(y, Math.abs(v.y));
        }
        out[m.userData.word] = [+x.toFixed(3), +y.toFixed(3)];
      }
      return out;
    },
    /* The camera path at an arbitrary t, without moving the live camera or
       waiting for a frame. seek() only sets t — the camera itself is not written
       until the next frame() — so a harness sampling the path densely in one
       pass cannot read it back from the camera. Safe to call between frames:
       frame() re-samples unconditionally, so the shared _p/_l it borrows are
       rewritten before anything draws. */
    probe(v) {
      const f = sampleCamera(THREE.MathUtils.clamp(+v, 0, 1));
      return { p: _p.toArray(), l: _l.toArray(), f };
    },
    get flying() { return flying; },
    set clock(v) { vclock = (v === null ? null : +v); },  // drive self-animation by frame
    get state() {
      return {
        switching: CELL_SWITCHING,
        bar: barTucked ? (barHovering ? 'peek' : 'tucked') : 'pinned',
        t: +current.toFixed(3),
        back: +sBack.material.opacity.toFixed(2),
        floor: +sFloor.material.opacity.toFixed(2),
        core: +sCore.material.opacity.toFixed(2),
        fill: +tiles[0].fill.opacity.toFixed(2),
        line: +tiles[0].line.opacity.toFixed(2),
        tileY: +tiles[0].body.position.y.toFixed(2),
        pkg: pkg.visible, lidY: +lid.position.y.toFixed(1),
        /* Both halves of the I/O die's exit: whether it is drawn at all, and how
           opaque it is. Kept separate because the failure worth catching is a
           fade that is still running while an ancestor has already hidden it. */
        iodVisible: pkg.visible && iodGroup.visible,
        iodAlpha: +Math.max(iodSiliconMat.opacity, iodTopMat.opacity).toFixed(3),
        stack: stack.visible, fets: fets.visible,
        /* The switching loop, read back off the geometry rather than recomputed,
           so a harness is checking what was DRAWN and not a second copy of the
           same arithmetic. One brightness per family, plus where the pulse has
           got to, which is the only thing here that is not a plain fade. */
        cell: fets.visible ? {
          pmos: +devs.instanceColor.array[1].toFixed(2),
          nmos: +devs.instanceColor.array[DEV_PER * 3 + 1].toFixed(2),
          gate: +gates.instanceColor.array[GATE_LIVE * 3].toFixed(2),
          a: +m1pins.instanceColor.array[PIN_A * 3].toFixed(2),
          y: +m1pins.instanceColor.array[PIN_Y_ * 3].toFixed(2),
        } : false,
        /* How far the core reveal has got: how many of the 29 are standing, and
           how high the tallest one is. The old `lift` reported the stage-08
           slabs, which no longer exist. */
        core07: coreTileGroup.visible
          ? `${coreTiles.filter((x) => x.side.opacity > 0.1).length}/${coreTiles.length}` +
            ` y=${Math.max(...coreTiles.map((x) => x.body.position.y)).toFixed(3)}`
          : false,
        cam: camera.position.toArray().map((v) => +v.toFixed(1)),
        /* Cost of the frame that was just drawn. calls and triangles are
           hardware-independent, so a harness can compare stages on any machine;
           dpr and aa are here because they set the fragment bill, which is what
           actually decides the frame rate on a scene this overdraw-heavy. */
        draws: renderer.info.render.calls,
        tris: renderer.info.render.triangles,
        /* The three things that get created lazily on first draw and stall the
           frame when they do: a shader program, a texture upload, a VBO. If a
           pan judders, watch which of these counters ticks up as it happens. */
        progs: renderer.info.programs.length,
        tex: renderer.info.memory.textures,
        geo: renderer.info.memory.geometries,
        /* What the cursor is on and what the hover is doing to it, so the
           lift and the pulse can be measured rather than eyeballed — a rise of
           a few hundredths of a world unit is not visible in a screenshot. */
        hover: hovered ? {
          label: hovered.label || hovered.body?.userData?.pick || '?',
          y: +hovered.body.position.y.toFixed(4),
          emissive: +hovered.side.emissiveIntensity.toFixed(3),
          fill: +hovered.fill.opacity.toFixed(3),
          wall: +hovered.side.opacity.toFixed(3),
          hov: +(hovered.hov || 0).toFixed(3),
          /* The part the cursor is on, so a harness can prove the OTHER blocks
             of a split part came up too. `part` is how many blocks it has, and
             `lifted` how many of them are actually off the die right now — they
             should agree once the ease has run. */
          part: hoverSet.size,
          lifted: [...hoverSet].filter((x) => (x.hov || 0) > 0.5).length,
          hovs: [...hoverSet].map((x) => +(x.hov || 0).toFixed(2)),
        } : null,
        dpr: +renderer.getPixelRatio().toFixed(2),
        aa: renderer.getContext().getContextAttributes().antialias,
        /* View-projection, so a harness can put a world point on the screen and
           then sample the pixel there. Squinting at a screenshot to decide
           whether a block is drawn is how an hour gets lost. */
        mvp: camera.projectionMatrix.clone()
          .multiply(camera.matrixWorldInverse).toArray(),
      };
    },
  };

  document.getElementById('loader').classList.add('done');
  frame();
}).catch((err) => {
  document.getElementById('loader').innerHTML =
    `<div class="loader-inner">could not load textures — ${err?.message || err}</div>`;
});
