# Inside the Die — scroll-driven CCD descent (prototype)

A scroll-driven 3D descent through the compute die of an **AMD Ryzen 5 9600X**.

Open `prototypes/cpu-layers/index.html` **through a local web server**, not by
double-clicking it. ES modules and the import map will not load from `file://`.

```
python tools/serve.py
# then visit http://127.0.0.1:8777/prototypes/cpu-layers/
```

Use `serve.py`, not `python -m http.server`. It serves the same site root on the
same port but sends `Cache-Control: no-store`. `http.server` sends no cache header
at all, and with no directive a browser may apply heuristic freshness and serve a
stylesheet from cache without revalidating — which cost real time once: an edit to
`scene.js` was picked up while the matching `style.css` was not, so clicking a
block unhid a completely unstyled panel. The descent froze as designed and nothing
was visible, because the element had no position, no z-index and no size, sitting
far down a 2000vh page.

**Symptom to remember: new behavior, old appearance.** It is almost always this.

## Isolation

This folder is completely self-contained and **cannot affect the live site**:

- imports nothing from `/styles` or `/scripts`
- no page on the site links to it
- `<meta name="robots" content="noindex, nofollow">`
- deleting `prototypes/` removes it entirely

## The seven stages

| # | Stage | What happens |
|---|-------|--------------|
| 01 | The Packaged Chip | The AM5 package under its nickel lid, slowly settling square |
| 02 | Bare Silicon | The IHS rises and drifts away, both dies are revealed, and the camera comes to eye level beside them |
| 03 | The Floorplan Beneath | Delayers, then regions bloom in as flat color; parks with every region up and fully filled |
| 04 | Inside One Core | Descends into the photograph's bottom-left core, which the half turn below draws at the die's far-right corner; its 29 blocks rise as glass slabs a beat at a time, in the order an instruction meets them, while the camera orbits low |
| 05 | The Metal Stack | 15 graded copper tiers cascade apart from the bottom up, a pulse of light climbs them, and the camera flies in among them |
| 06 | The Cell Rows | The stack folds back down, top first, leaving its lowest gap open as a room; M1 turns to glass and a field of standard cell rows shows through the floor |
| 07 | A Closer Look | A dive into one tile, which resolves into a CMOS inverter and then switches, on a loop, driving a pulse up its output via into the copper overhead |

The arrows drive everything — see below. Clicking a region opens a detail panel,
but only while parked at a stop.

### Naming things: three registers, deliberately

- **Leader-line callouts** for parts that are *objects in space* — the heat
  spreader, the contact pads, individual metal tiers, the transistors.
- **Names drawn on the face** for the two dies: "I/O DIE" and "CORE COMPLEX
  DIE" are silkscreened onto the silicon itself, fading in over t 0.25–0.32.
  Where the die is the subject rather than a part being pointed at, a name
  lying on the surface reads as belonging to the object. They fade out again by
  t 0.40, before the delayer strips the CCD — stage 05's line is that up close
  this is just polished silicon, so the name should not still be lying on it.
- **Region highlights** — color fill that blooms in, then settles to a glowing
  outline — for anything that is an *area of a die*: the floorplan's cores, L3
  and bottom strip, and now the blocks within a single core too.

### The region highlight

During stage 03 the regions reveal in sequence — the eight cores, then L3,
then the SMU/IFOP strip — as flat color fills that mimic the annotated
reference die shot, then cross-fade to glowing outlines so the real silicon
comes back before the camera dives into a core.

Region boundaries are **measured, not eyeballed**: the core row seams were
located from the reddish separator bands in the die photograph
(v = 0.011, 0.218, 0.419, 0.619, 0.818).

The column extents need care. Core logic is strongly blue and L3 is darker,
but so is each core's own **L2 cache**, which sits against L3 on both sides —
producing dark bands at u 0.29–0.36 and 0.63–0.75 that are *cores*, not cache.
Reading the right-hand one as L3 makes L3 overrun the right column. Correct
values: cores u 0.015–0.350 and 0.645–0.985, L3 only u 0.358–0.640.

The bottom strip divides into an SMU / power band (v 0.818–0.862, full width)
and a row below it (v 0.862–0.982) holding Test/Debug (u 0.015–0.330) and the
two IFOP PHY blocks (u 0.335–0.640 and 0.655–0.985).

> Note: the annotated delid reference and the straightened die shot differ by a
> **vertical flip**, not a rotation — one of them was flipped in editing. All
> coordinates above are measured in the die-shot texture actually used here,
> which is what governs; don't transplant coordinates between the two images.

### The half turn

Every coordinate in this README and in `scene.js` is stated in the **published
frame** of `die-floorplan.jpg`: IFOP PHY and Test/Debug along the bottom edge,
cores above them. The scene draws the photograph **a half turn round** from
that, and turns everything traced on it with it, by the point reflection
`(u,v) → (1-u,1-v)`.

The reason is the I/O die. Image *v* runs to the CCD's `+z`, so laying the
photograph down as published put the IFOP PHY on the die's near edge, pointing
away from the die it exists to talk to — the I/O die sits at `IOD_Z −3.35`
against this die's `+8.80`, a long way to `−z`. Turned, the PHY and the
Test/Debug band face it, and the cores start at the near edge.

It is one lever, `turnRegion` above `CORE_U`, applied to `REGIONS`,
`CORE_BLOCKS` and `CORE_U`/`CORE_V`, plus a uv transform on the two die
photographs as they load. The measurements are deliberately **left as
measured** — every note in here about a texture-energy step, a traced edge or a
luminance peak cites the published frame, and re-typing three hundred
coordinates would strand all of it. A point reflection is a rotation, not a
mirror, so winding is preserved and `insetRing` and `ExtrudeGeometry` see every
outline exactly as they saw it.

What it moves, and what it does not:

- **The camera path is untouched.** Every key in stage 04 is written against
  `coreCX`/`coreCZ`, so the core shot follows the core to the die's far-right
  corner unchanged. The two legs that *connect* to it cover more ground as a
  result: 0.565→0.640 goes 73 → 158 on `camera-speed.py`, and 0.816→0.842 goes
  206 → 443, both still well under the 520 that counts as a lurch.
- **The reveal waves are ranked on the drawn position**, not on the region ids,
  which number the photograph's rows and columns. See `RIPPLE_ORDER`.
- **Stage 03's caption** says the support strip runs along the edge facing the
  I/O die, because on screen it is no longer beneath the cores.
- **`iod-floorplan.jpg` is turned too**, texture only — nothing is traced on the
  I/O die. That one is not provable from inside the scene the way the CCD's is;
  see the note beside it in `DEFERRED`.

### The blocks inside one core

Stage 07's regions are **traced by hand**, in `trace.html`, and used verbatim.

Three rounds of deriving them automatically each landed close but wrong: from
the annotation's color washes, from rectangles snapped to the die's white
lines, and from the die's own smooth-field sections. The last was the best of
them — texture energy does separate smooth logic (1.7-2.7) from patterned array
(7.7-47.7) cleanly, and the sections it produced agreed with the annotation at
93-94% — but "close" kept not being "right", and each attempt cost a round
trip. Tracing takes about a minute per region and ends the guessing.

**All of them are traced — 29 blocks.** `region-overlap.py` rasterises every
one, erodes 1 px and intersects: no overlap beyond shared boundaries, ~94% of
the core crop annotated. All four sides of the core sit flush on single lines —
left 0.0076, right 1, top 0.0269, bottom 0.9952 — each confirmed under every
span that claims it. `CORE_BLOCKS` in `scene.js` is the list; there is no point
duplicating it here, where it would only go stale.

Blocks that repeat carry one entry each rather than one entry with several
polygons: four vector regfiles, four FADD/FMAC lanes, two L2 halves, and two
vector-execution columns. That last one was a single two-piece block until its
name turned out not to fit — see below.

#### Rules applied to every traced region

**Snap flush to neighbors.** Traced edges are axis-aligned, so an edge is
(orientation, coordinate, span). It snaps onto an existing edge only when that
edge is parallel, within **0.008 uv**, *and their spans overlap* — without the
overlap test a distant edge sharing a coordinate would drag it sideways.
Load/store arrived 0.0015-0.0044 off L1d on three edges; integer execution 0.0007-0.0045 off on four.

> Not every near-miss is a neighbor. The L2 halves sit 0.0063 from Load/store,
> inside tolerance, but the 13 px between them is array texture — the L2$
> control and interconnect column, which the reference names as its own region.
> Snapping there would erase a real block, so check what is in the gap before
> closing it.

**Verify with erosion, not raw intersection.** Flush regions share boundary
pixels, so the raw masks overlap by a few hundred pixels even when correct.
Erode each by 1 px first: across all five regions that gives **0 px** of real
overlap.

**Fit the label to the shape.** The anchor stored per region maximizes an
inscribed *circle*, but type is a wide rectangle, so it is only a starting
guess — "Load / store" spilled straight out of its region. The overlay now
measures the real string, then walks the font size down and tries the anchor
plus a ring of offsets at each size, hit-testing 15 points of the text box
against the path with `isPointInPath`.

**Correct what the mouse could not.** Hand-traced edges that should be
orthogonal often are not: integer execution's top-left edge came in 0.0015 off
vertical, and the lower L2 half's left edge 0.0010. Both were straightened
before snapping.

**The reference used for naming** is `ccd-dieshot-bottom-left-detail.jpg`. Its
orientation matches `core-detail.jpg` **directly, with no flip** — unlike the
delid pair above. Checked on two features that are not symmetric: the banded
regfile columns down the left edge and the CPL block at the bottom right land
the same way in both. Its aspect is 2.006 against the core region's 1.969,
which is the second check that it is the same crop.

### The IHS

Real extruded geometry, 37.15 × 37.48 mm, in two parts: a thin flange and a
raised platform.

**The silhouette is traced, not approximated.** `assets/lid-outline.json`
holds the real contour plus the platform square, both in millimeters about the
lid center, produced by boundary-tracing the cleaned lid mask at 1024 px,
smoothing with Chaikin, and simplifying with Douglas–Peucker. The one
departure from the trace is that the eight notch floors are straightened onto
the platform's four lines — see below for why.
Skipping the Chaikin pass leaves visible staircase steps, because square-kernel
morphology produces axis-aligned edges that survive tracing.

**Despeckle before opening — the order matters more than the sizes.**
The lid's *lower* surfaces (corner wings, tab tips) have a rougher finish that
throws salt-and-pepper holes into the `S<70` mask. Opening a mask in that state
eats the corner wings away entirely, and the traced outline then follows the
step edge across the corner instead of the lid's real edge — which reads as
"jagged" and as "the raised part doesn't wrap the corners". Two passes of
`MedianFilter(9)` plus a small closing first makes the wings solid; after that
the opening is nearly shape-preserving (bbox stays 37.83 × 37.78 mm instead of
shrinking) and the traced edges come out smooth.

**Removing the substrate capacitors needs ~40 px of opening.**
The mid-edge notches expose surface-mount capacitors sitting on whitish
adhesive haze. That haze is bright *and* desaturated, so it passes the `S<70`
lid test and bridges the capacitors to the lid, which then get traced as part
of the silhouette and appear as white rectangles stuck to its sides.

Hue does not separate them: the capacitors read H≈24–34 / S≈30 against the
lid's H≈19 / S≈38. Only **connectivity** does. Measured by sweeping erosion
and watching how far into the notch the mask reaches (the notch bottom is at
x≈530, the lid edge at x≈215):

| erosion | notch reach | verdict |
|---|---|---|
| 16 px | 242 | capacitors still bridged |
| 28 px | 505 | bridge broken |
| 40 px+ | 507 | no further gain, shape shrinks |

So: threshold → 28 px erode → flood-fill from the center → 28 px dilate.

This replaced three failed analytic attempts, and the failures are worth
recording:

1. A rounded square with notch fractions **overhangs** the real outline in
   places, dragging teal substrate onto the lid.
2. Fixing that with an `alphaMap` + `alphaTest` cuts the overhanging *caps*
   but leaves the extrusion's **side walls** standing as stray floating
   blocks, and gives ragged edges wherever the cut crosses at a shallow angle.
3. Widening the notches to stay inside the real outline just moves the
   raggedness elsewhere.

A traced contour has none of these problems and needs no alpha at all.

**Read the lid as a square with eight fins hanging off it** — four corner arms
and four mid-edge tabs. The raised platform covers that square **and reaches
out into every fin**, stopping only where the gray changes: each outer edge
carries a darker, coarser band, and that band is the lower flange face. The
platform is **971 mm², 91% of the lid**, and along every edge it shares — the
square runs and both flanks of every tab — it is flush, its step face *being*
the lid's edge. Reach into the mid tabs, measured from the square line:

| tab | platform reach | tab reach | low band left |
|---|---|---|---|
| top | 2.40 mm | 3.98 mm | 1.58 mm |
| bottom | 2.70 mm | 3.98 mm | 1.28 mm |
| left | 2.65 mm | 3.98 mm | 1.33 mm |
| right | 2.60 mm | 3.98 mm | 1.38 mm |

The two grays are separated by finish, the same way the platform was found in
the first place: machined smooth against rough, split by local standard
deviation.

**The platform's tongue into each tab is filleted 0.25 mm** where its cut meets
the flanks — deliberately slighter than the 0.70 mm on the flange's own tab
corners. Measured on the finished outline, the eight corners come out
0.246–0.309 mm.

> Two things fight this fillet, and both have to be disabled locally. The corner
> carve must be bounded to an r-by-r box: written as an unbounded half-plane
> test it is satisfied far outside the tab, and on the left/right tabs it eats
> **8 mm²** out of the adjoining corner arm. And the fillet must be exempt from
> the flush-pinning: the arc is tangent to the tab flank, so its points near the
> tangency fall within the 0.06 mm pin radius, get snapped onto the flange, and
> the corner comes out square again. Heavy smoothing of the free runs flattens
> them too — 30 passes cost two of the eight corners, 8 passes keep all eight.

**The step is measured once per fin, from a 1-D profile.** For each tab, median
σ across the tab against depth out from the square line; for each arm, median σ
against depth inward from the arm's outer edge. Averaging along the fin's edge
is what makes this reliable — the step then shows up as a single unambiguous
jump:

| fin | step | fin | step |
|---|---|---|---|
| tab top | 1.58 mm | arm TL | 1.60 mm |
| tab bottom | 1.28 mm | arm TR | 1.70 mm |
| tab left | 1.33 mm | arm BL | 1.40 mm |
| tab right | 1.38 mm | arm BR | 1.60 mm |

Median **1.49 mm**, spread 0.42 mm — one machined step all the way round, which
is the cross-check that the profiles found something real.

**Do not try to threshold the texture field per pixel.** σ drifts with the
lighting across the face — 9.3 → 13.4 over 3.5 mm in the bottom-left corner —
so a global threshold trips ~2 mm early there and the platform stops well short
of the transition. A locally adaptive threshold is worse: with the window
mostly one class, it just tracks the drift. Averaging along an edge removes
both problems.

**Construction: bridge the notches, then erode.** The platform is the flange
intersected with the lid's outer perimeter inset by the step. The perimeter
comes from the **convex hull** of the flange outline, and the tabs are then cut
by their own measured lines so their flanks stay flush and each tip gets its
own depth. Being a distance level set, this cannot self-intersect and has no
slivers. 66% of the platform outline is pinned onto the flange polyline; mean
gap on the square runs is **0.0000 mm**.

Three constructions failed first, each in an instructive way:

1. **Threshold the smooth face and trace it.** Loops in the bottom-right
   corner, an S-shaped wander beside the bottom tab, and it fell short wherever
   σ drifted.
2. **Offset each fin's rim inward by a per-region width.** Two strays decided
   it: at the concave fillet where a tab flank meets the notch floor the normal
   swings through radial, so 0.04 mm of arc scored just over the geometric
   "is this rim" test, and each stray stamped a ~2 mm disk into the square run,
   pushing the platform 1.5–2.1 mm off an edge it must be flush with.
   Growing the band as disks also balloons past the ends of a rim run; assigning
   each pixel to its nearest boundary sample fixes that but leaves Voronoi
   slivers where two stretches compete.
3. **Bridge the notches with a morphological closing.** The disk sags into each
   notch — 2.34 mm for a 6 mm disk, not enough to clear the 4.35 mm notch — so
   the eroded boundary lands ~0.5 mm above the notch floor and bows off every
   square run. Radii that do clear it sit in a narrow window just above the
   4.75 mm needed to bridge at all, and the notches differ in width. A hull
   bridges dead straight: no sag, nothing to tune.

> A 6 mm structuring element is 476 px across and `binary_closing` runs out of
> memory on it. Dilate/erode via `distance_transform_edt` thresholds instead.

### Auditing the whole perimeter

Checking the four square runs is not enough — walk every sample of the flange
boundary and classify it, flush or inset:

| region | length | flush | inset | step |
|---|---|---|---|---|
| square runs | 62.2 mm | **100%** | 0% | — |
| tab top | 12.8 mm | 51% | 49% | 1.59 mm |
| tab bottom | 12.8 mm | 54% | 46% | 1.37 mm |
| tab left | 16.8 mm | 39% | 61% | 1.35 mm |
| tab right | 16.8 mm | 38% | 62% | 1.39 mm |
| arms TL/TR/BL/BR | 18.3–20.2 mm | 27–33% | 67–73% | 1.61–1.63 mm |

The perimeter resolves into exactly **16 runs, 8 flush and 8 inset**,
alternating, with no run shorter than 0.5 mm. On the 110 mm of flush perimeter
the two edges are a mean **0.0013 mm** apart, worst case 0.0058 mm.

**That audit found a real defect the area and raster checks could not.** The
flange outline carried **16 direction reversals**, two at each tab base: the
boundary ran out past the base, jumped back, and carried on. They came from the
tab splice, whose zone test was "strictly beyond the square line" — so original
vertices sitting exactly *on* the line survived and the built profile overlapped
them. Being zero-area slivers they cost nothing in area (0.0000 mm²) and are
invisible to a rasterised comparison, but they broke flushness for ~0.25 mm of
arc at all eight tab base corners and left a degenerate outline to extrude.

> Fixing it needs the longest monotone subsequence along each square line, not a
> greedy scan. At each tab base the floor run overshoots past where the profile
> starts, so a greedy scan in the run's overall direction throws away the
> profile's four start points instead of the one overshooting vertex — 20
> vertices dropped and 8 reversals still left. The longest-subsequence version
> drops exactly 8, one per corner, and leaves none.

**One bulge also survived on a square run.** The right run carried a local
excursion **0.2745 mm** outward over 3.61 mm, between the mid tab and the
bottom-right corner, which reads as a bump on the edge. Its cause is the one
this file already warns about: a bank of surface-mount capacitors on whitish
adhesive sits hard against the lid edge there, and being bright *and*
desaturated it passes the `S<70` lid test — measured inside the bulge, S runs
2–23 where the substrate a few millimeters away reads 83.

The straightening pass missed it because its tolerance was 0.15 mm. Widening
that is not the fix: the concave fillet at each tab base departs the line
gradually, so any tolerance wide enough to catch a 0.27 mm bulge also flattens
part of the fillet. Snap only vertices lying **between two vertices already
exactly on the line**, and skip any gap whose excursion exceeds 1 mm so a fin is
never mistaken for a bulge. Ten vertices flattened, 24 duplicates dropped,
flange 1064.87 → 1064.04 mm².

> The arms were 18.3/18.4/18.4/**20.2** mm of perimeter before this and
> 18.3/18.4/18.4/**18.5** after — the odd one out was the bulge being counted
> into the bottom-right arm. Symmetry across four nominally identical features
> is a cheap check worth running.

**The square's lines are measured off the traced outline.** Scanning the lid
boundary along each side gives a bimodal profile — one mode at the fin tips,
one at the notch floors. The notch floors are the square:

| side | fin tips | notch floor (the square) |
|---|---|---|
| top | +18.89 | **+14.51** |
| bottom | −18.86 | **−14.48** |
| left | −18.91 | **−14.56** |
| right | +18.90 | **+14.47** |

That the four independently-measured lines come out square to within 0.05 mm
is the check that the scan found the right mode.

> Watch the sign when scanning: the fin tips sit at the *outward* extreme of
> each side, so excluding them needs the outward direction per side. Getting it
> backwards excludes the notch floors instead and hands back ±18.85 — a
> "square" 37.7 mm wide, i.e. the whole lid.

**The flange's notch floors are straightened onto those same four lines.**
This is the one place the outline is *not* purely traced, and it is deliberate.
The traced floors wobble ~0.1 mm, so a straight platform edge has to either
gap (sit inside the wobble) or overhang (sit outside it, extruding a hairline
wall that floats over teal) — there is no third option while the flange is
wobbly. Pulling the platform in by each side's own overhang was the first
attempt and it is what leaves a visible gap on the bottom edge, which had the
largest excursion at 0.142 mm.

Since the real lid's floors are machined straight, the wobble is tracing noise,
so snapping the flange onto the lines removes the trade-off entirely: both
parts share one line and are flush by construction. Vertices within **0.15 mm**
of a line are snapped — 9/13/18/8 of them per side, moving at most 0.143 mm,
and the flange's area changes by 0.48 mm² (0.04%).

> 0.15 mm is not a round number picked for comfort. The vertex-offset
> distribution is continuous — the contour curves gradually away into each fin
> base, so there is no gap to cut at — and 0.15 chosen to match the
> independently measured raster wobble, whose deepest inward excursion was
> 0.142 mm. Every dip that could cause an overhang is captured; nothing further
> into a fin base is.

**Verified on the raster, not the vertex lists.** At 200 px/mm: **zero**
platform pixels outside the flange, and across the square runs the two
boundaries land on the same pixel — mean gap **0.0000 mm** on all four sides,
worst case 0.010 mm, which is 2 px of quantization.

> When checking a side, exclude scan lines that cross a fin. The notch floor's
> span brackets the mid-edge tab too, so including them measures fin height —
> a very convincing "4.29 mm gap" that is not a gap at all.

### Trimming the outline off the substrate

The traced outline ran **wide of the real metal on both flanks of every
mid-edge tab** — eight overhangs of ~1.9 mm² each, reaching ~0.45 mm inside —
so the extrusion textured teal onto the fin sides. That is the tracing
pipeline's dilation plus the whitish adhesive haze passing the `S<70` lid test,
the same haze that bridges the capacitors.

The fix is per-vertex and local, so the rest of the silhouette is untouched:
densify the outline to 0.12 mm, then march each vertex inward along its own
inward normal until it has **0.04 mm** of real metal beneath it. Metal is
classified by saturation — nickel is desaturated, the substrate is a saturated
teal — median-filtered and hole-filled. 1150 of 1814 vertices moved, mean
0.160 mm, max 0.570 mm. Substrate under the outline falls from **18.76 mm² to
2.83 mm²**, with no remaining blob above 0.04 mm²; the residue is a sub-pixel
fringe along the perimeter plus speckle inside the rough nickel.

The notch floors are then re-straightened and the platform moved with them, so
trimming cannot break flushness. Verified on the written file: 0 platform
pixels outside the flange, mean gap 0.0000 mm on all four square runs.

> The floors need their own inset (top 0.030, bottom 0.023, left 0.114,
> right 0.000 mm), and it must be measured against the metal boundary scan line
> by scan line. Probing *along* the line and skipping zero-depth samples as
> "open air" looks reasonable and is exactly wrong: an overhanging floor reads
> as depth 0, so the test discards the very failure it is checking for and
> reports a confident 0.000 inset while a 0.42 mm² blob of teal survives.

### Smoothing the fin edges

Marching individual vertices got the outline onto metal but could not make it
*smooth* — a per-vertex search is jitter by construction, and it left lumpy fin
flanks, worst on the bottom fin. So the final outline is the traced metal
boundary **low-passed along arc length**: resample to 0.05 mm, then eight
rounds of Gaussian smoothing at **σ = 0.30 mm**, each followed by an inward
projection for any vertex that drifts over substrate.

> Never end on the projection. The inward push is exactly the jitter being
> removed, so running it last undoes the smoothing pass that just ran. Project
> against a slack margin during the loop so the closing smooth cannot drag the
> curve back onto substrate, then finish with a smooth.

σ = 0.30 mm comes from a sweep against fidelity, not from taste:

| σ (mm) | curvature flips/mm | fin-tip shift (mm) |
|---|---|---|
| 0.10 | 0.55 | 0.090 |
| 0.20 | 0.35 | 0.100 |
| 0.25 | 0.22 | 0.115 |
| **0.30** | **0.18** | **0.139** |
| 0.40 | 0.12 | 0.220 |
| 0.50 | 0.09 | 0.344 |

Past 0.30 the fidelity cost climbs much faster than the gain. Measured on the
finished outline, curvature sign changes fall from **2.91/mm to 0.78/mm**.

**Measuring lumpiness is harder than fixing it, and two obvious metrics are
traps.** Deviation-from-smoothing scores genuine corners and fillets as
roughness, so it barely moved across the whole sweep. Flank straightness is
worse: the fins really do flare at the base, so a straight-line fit is
dominated by real geometry and reported smoothing as making things *worse*.
Curvature sign changes per mm work because they are scale-free — a clean edge,
curved or straight, holds its curvature sign, while a lumpy one oscillates.

> Measure it on the dense curve, before decimation. A piecewise-linear polyline
> has impulsive, alternating curvature at every vertex, which scores the
> finished outline at 10.58/mm — far "worse" than the lumpy one it replaced.

Decimation is Douglas–Peucker at **0.002 mm**, giving 783 vertices with a
measured max deviation of 0.005 mm from the dense curve — invisible at any
render scale. `lid-outline.json` is 30 KB, down from 68 KB.

The cost of the smoothing is that the flange shrinks slightly: 1082 → 1065 mm²,
with fin tips pulled in about 0.14 mm.

### The mid-edge tabs are built, not traced

"Smooth" here means *idealised*, not merely de-noised: each of the four
mid-edge tabs is a rounded rectangle — straight parallel flanks, a flat tip,
and a **0.70 mm fillet on all four corners**, convex at the tip and concave
where the tab meets the square. The four corner arms are still traced.

Dimensions are measured, only the shape is idealised. **The tabs are not all
the same size**, which is easy to assume and wrong:

| tab | width | reach beyond the square | center |
|---|---|---|---|
| top | 3.707 mm | 3.980 mm | −0.076 |
| bottom | 3.795 mm | 3.980 mm | +0.057 |
| left | **8.196 mm** | 3.980 mm | −0.063 |
| right | **8.170 mm** | 3.980 mm | +0.101 |

The left and right tabs are more than twice as wide as the top and bottom ones.
All four reach the same 3.980 mm, which is the cross-check that the scan found
real edges: four independent measurements agreeing to 0.001 mm.

### The texture is edge-extended

Idealising the tabs pushes their corners slightly *outside* the traced metal —
the real top and bottom tabs round off by more than 0.70 mm — which would put
teal back on exactly the corners the trim just cleaned. Extending the fins
further would make it much worse.

So `ihs.jpg` is no longer the raw crop. Every pixel outside the metal is
replaced by its nearest metal color, which decouples silhouette from texture:
the outline is now set purely by the geometry, and there is no teal left to
leak. Teal within 3 mm of the lid edge falls from the entire band to **974
pixels, 0.3%**. The pristine crop is kept alongside as `ihs-photo.jpg`, and
`make_texture.py` regenerates the extended version from it.

> Source the fill from an eroded, median-filtered interior, not the raw
> boundary. The lid's rough finish leaves isolated saturated specks and the
> extreme edge is bevel, not face; a nearest-pixel fill straight off that
> boundary smears both into long radial streaks that are still saturated —
> 27 000 of them, worse than useless.

Two earlier attempts are worth recording, because both looked right in
isolation:

1. **A uniform ~1.3 mm inset of the traced outline.** Puts a rim everywhere.
   The photograph does not show one.
2. **Segmenting the raised surface by finish** — the platform is machined
   smooth, the fins are rough, so local σ separates them. This is faithful to
   the photograph, which does show the raised surface reaching a little way
   into each tab and arm, and it does get the straight runs flush. But every
   fin then wears a thin flange rim around the intrusion, and in 3D those read
   as a ledge on all four sides — the very thing being removed. The square is
   the cleaner read and the one the geometry now uses.

> Don't reach for a morphological opening of the outline either. An opening
> does strip the fins, but it also rounds the body's *own* convex corners,
> dragging the platform off the straight edges near every corner; fitting its
> radius against the measured mask chases IoU up to r = 5.6 mm while the
> corners get visibly worse.

## Stage 07 became real slabs

It used to be two flat planes over the core photograph, crossfading a fill
canvas into an outline canvas. That worked, but it made stage 07 the one reveal
in the piece that was a diagram being colored in — one stage after the
floorplan had established that regions come *out of* the die.

It is now the floorplan's construction verbatim, at the core's scale: 28
extruded slabs of thick glass, each wearing the shared overlay canvas through a
planar uv clipped to its own outline, lifting on a sine and settling to a raised
mosaic. Three things had to be got right.

**Thickness is `LIFT_T`, not `TILE_T`.** The core is 0.335 of the die's width
and the camera closes in by about as much, so the floorplan's 0.16 is 0.054 seen
from here — which is already what the stage-08 lift blocks use. Sharing one
constant between the two stages is also what makes the handover gain no visible
step: the block that stops being a stage-07 tile and starts being a stage-08
slab is exactly the same size.

**The wave crosses on a world-space diagonal.** The rank is
`at.u * coreW + at.v * coreH`, not `at.u + at.v` — the crop is nearly 2:1, so
weighting the two axes equally in uv tilts the wavefront and the sweep reads as
two half-hearted passes instead of one. Ranks are continuous rather than an
index; with 29 blocks that gives a smoother front than the floorplan's discrete
order does with 8, and blocks that genuinely sit alongside each other rise
together. The order that falls out runs the vector unit, then the integer side,
then L2 and the front end, ending on CPL in the bottom-right corner.

### …and then stage 08 was deleted into it

Stage 08, "the core comes apart", used to follow: a second solid set of the same
blocks, lifted a few at a time in instruction order. Once stage 07 was real
geometry, the second pass was the piece saying the same thing twice, so the
sequencing moved up into the reveal and the stage went. Nine stages now.

**The order is pedagogical, not spatial.** `CORE_ORDER` lists the blocks in the
order an instruction meets them, so watching the stage is watching one
instruction go through a core: fetch and decode, the cache that fed them, the
registers the operands come from, the units that do the work, the load/store
machinery, and the L2 hierarchy behind it — then what the path depends on
(address translation, branch prediction, microcode, scheduling), then the vector
engine that runs alongside all of it, then CPL, which is support logic and not a
stage at all. A wave crossing the core on a geometric diagonal came first and
was thrown away; it looked good and taught nothing.

Entries are labels, and several blocks share one — L2 is two halves, the vector
regfiles and FADD/FMAC lanes are four each. A shared label expands into
consecutive slots ordered top-to-bottom then left-to-right, so a set fills in as
a set instead of jumping around the core. An entry may also name SEVERAL labels,
through `labels: [...]`, which is how the L2 halves and their tag array rise as
the one part they are.

**`CORE_FADE` is 0.10, not the floorplan's 0.34.** That 0.34 makes a *wave*:
eight tiles each occupying a third of the window, three or four in motion at
once, and what you read is the front rather than the tiles. This is a *sequence*
of 29 named blocks meant to be followed a beat at a time, so each takes a tenth of
the window — a new block every 0.033 of it, about three moving at any moment.

**Some beats hold several blocks.** An entry in `CORE_ORDER` is one beat, and a
beat may raise more than one block: the four vector regfiles rise together, then
the four FADD/FMAC lanes together, then the scheduling that feeds them. Four
identical lanes arriving one after another reads as four separate ideas when it
is one idea repeated four times — the vector unit is wide, and the width is the
point. The L2 array and its tag block rise together for the same reason and one
more: they hover as a set and all three open the L2 Cache sheet, so a viewer
watching the tags land a beat later would have been told they are a separate
thing immediately before being shown they are not. 20 entries become 20 beats
over 29 blocks.

**A name has to fit on one piece.** Vector execution was one region carrying
both of its columns, with `fit: false` so the fitter would not reject a center
that lands in the channel between them. The name was therefore drawn across
both — and the channel, plus the section gap now inset on either side of it, cut
a 25 px white slice straight through "Ex|ecution" and "Sche|duling". It is two
blocks now, each fitting its own name inside its own path at about 20 px, which
is what the regfiles and FADD/FMAC lanes beside it already do; `together: true`
keeps them rising as one, so the split is invisible in the animation.

Worth noting *how* that was found. In the 3D render the label was simply hard to
read, and the tempting diagnoses were occlusion and material opacity — both
wrong. Dumping the fill canvas on its own, by eval'ing `overlayTexture` and
`insetRing` straight out of `scene.js` in a headless browser, showed the cut
immediately. **When type on a region looks wrong, look at the canvas before
looking at the scene.**

**No settle to outline, unlike the floorplan.** A block takes its color when it
rises and keeps it until the whole core clears with the die surfaces. The
floorplan hands the silicon back because its regions are read once and then get
out of the way for the descent into a core; this stage is building a picture of
a datapath, and a block that has faded to a rim is no longer part of it.

That also means the core builds no outline canvas at all — the `fill` canvas is
self-contained (color flood, white boundary stroke, name plate), and stacking
the outline canvas over it at full opacity would double-strike every label,
since both modes draw the name.

**The sequence's progress is linear, and everything else in the file is not.**
`ramp()` smoothsteps, which is right for something that starts and stops, but
easing the progress of a 28-item queue makes the first three and last three
crawl while the middle ten rush. Rendered at t 0.600 the smoothstepped version
had reached block 2 when even spacing puts it at block 6. Each block's own rise
still eases; the queue does not.

### What may occlude what

**Depth writing follows opacity, and only the walls ever write.**

| | depthWrite |
|---|---|
| walls, opacity >= 0.995 | **on** — exact, order-independent |
| walls, mid-fade | off — everything blends |
| top face, caps, die surfaces | never |

Both halves are load-bearing and each came from a bug.

A *translucent* surface that writes depth hard-rejects whatever is drawn after
it. So while the walls wrote depth unconditionally, the moment a slab began
fading, whether you saw another slab's walls through it came down to which of
the two the transparent sort put first — and that order flips as the camera
moves. That was the SMU fade.

But turning it off unconditionally is just as wrong, because **at rest these
walls are opaque**, and opaque geometry that does not write depth falls back on
the transparent sort for occlusion — which sorts per *object*, by centroid. A
big concave block like instruction fetch has a centroid that says little about
which of its arms is nearest, so a small neighbor's edge drew over it from some
angles and not others. That was the L2 ITLB edge showing through instruction
fetch.

Tying the flag to opacity gets both. The threshold is invisible because a wall at
0.995 already hides what is behind it, and `depthWrite` is GL state rather than a
shader define, so flipping it per frame costs nothing.

The die plane is outrun with renderOrder rather than depth. Each slab is two
meshes over one geometry, each drawing only its own group with the other
suppressed by an invisible material — the same trick the package body uses to
extrude an outline without its caps:

| mesh | renderOrder | why |
|---|---|---|
| top face | 0 | *before* the die plane, so the plane paints over it — that is what makes the slab read as glass with the silicon lying flat underneath, instead of a second copy of the photograph floating at the slab's own height |
| walls | 10 | *after* sBack 1 / sFloor 2 / sCore 3, so nothing erases their edges |
| fill / outline caps | 45, 46, 50 | color and name, last |

### A fade that never played

The I/O die's exit ramp, 0.505–0.600, was dead code. `iodGroup` is a **child of
the package group**, and `pkg.visible = pkgOut < 0.999` cut it at t 0.455 — fifty
thousandths before its own fade began. Every opacity below that line was computed
against an object nothing was drawing.

`pkg.visible` now ORs both ramps, and the package's own meshes carry their own
flag instead of relying on the group's. `verify/iod-fade.py` walks the exit and
fails on any frame where the fade and the visibility disagree.

> When a fade "doesn't play", check the ancestors' `visible` flags before
> touching the ramp. Nothing in the fade code looked wrong, because nothing in
> it *was* wrong.

### Section gaps

Boundaries here are measured flush on purpose — neighboring regions share an
edge exactly, so a partitioned band reads as one band. That is right for the
measurement and wrong for the look: the die's own core column and L3 happen to
sit 0.004 uv apart, and that hairline is exactly what makes those two read as
separate objects rather than one field.

The flush outlines stay the truth. A gap is opened at *draw* time instead, by
insetting each region half a gap on every side — `insetRing()` slides every edge
along its own inward normal and re-intersects consecutive edges, which is exact
for the rectilinear outlines traced here. Nothing measured moves.

Applied to the 28 core blocks and to the bottom strip (SMU, Test / Debug, the
two IFOP PHYs), whose four regions were measured flush and consequently read as
one object. The core column and L3 already have their hairline and are untouched.

Two things to get right:

- **The inset is in WORLD units, not uv.** A region's u spans 9.07 mm of die and
  its v spans 7.78, so one uv inset applied to both axes puts a visibly wider
  gap along one of them. Inset after the uv-to-world conversion, or in canvas
  pixels — `CH` is derived from `CW` through the region's aspect, so canvas
  pixels carry the same scale on both axes.
- **The canvas has to be inset by the matching amount.** The fill canvas draws a
  white boundary stroke; leave it at the original outline and it falls outside
  the inset slab carrying it and is clipped away, taking the block's top-face
  edge definition with it.

`insetRing()` refuses an inset it cannot trust — duplicate vertex, parallel
consecutive edges, a result that turned inside out or lost most of its area,
or **any edge that reversed**. On refusal it retries at half the inset, then a
quarter, so a block with one thin feature still gets whatever gap it can carry.

> **The reversed-edge check is not optional, and an area test does not
> substitute for it.** Vector execution's outline has notch arms about 0.010
> world units across; at 0.0062 per side those arms turn inside out while the
> ring keeps ~90% of its area, so the area test passed them. The resulting ring
> self-intersects — which `ExtrudeGeometry` will still happily build walls
> along, but `ShapeGeometry` cannot triangulate. That block therefore drew its
> colored edges and **no cap at all**, silently losing its fill and its name.
> It presented as "the text is hard to read", which sent the first two
> diagnoses (occlusion, material opacity) in entirely the wrong direction.

Callers work in different units — world for geometry, canvas pixels for the
overlay — but both checks are scale-invariant and the retry ladder is
proportional, so the two independently arrive at the same outline.

### The camera was what made the glass read

The slabs were right well before the stage looked right. The reveal camera sat
at 71 degrees of elevation — all but straight down — so a slab lifting out of
the core was a rectangle very slightly changing size, and glass with no visible
edge is just a tinted rectangle. The floorplan one stage up does the opposite,
sweeping low across the front of the die at 19 degrees, and that is what makes
its tiles read as tiles.

Stage 07 now orbits: a single sweep across the front, azimuth +32 to −38
degrees, over the whole reveal. Not a there-and-back — the return leg would have
nothing left to show.

**Elevation is not constant, and a first pass that held it at the floorplan's
18.4 was wrong.** The die is nearly square, so a low angle still leaves it
legible. The core is already 2:1, and at 18 degrees dead in front its 1.54 of
depth collapsed to 0.28 of frame height — a letterbox slit. The sweep rises to
33 degrees through the middle, where the foreshortening is worst, and returns to
20 at the ends, where the azimuth is showing the core's diagonal anyway.

**Radius and elevation were solved, not chosen.** Every key sits at whatever
radius puts the core's four corners across 0.94 of the frame, against the
floorplan's 0.74–0.77 of the die — tighter on purpose, because here the core is
the subject rather than the whole. Radii come out 3.00–3.16, so the sweep is
very nearly circular, and the eight segments run 17–21 units of camera travel
each at even dt. Near-constant speed matters because `sampleCamera` eases
*inside* every segment and comes to rest at each key; uneven spacing would read
as the orbit stopping eight times.

> Watch the units if you re-solve this. Projecting to NDC gives a frame spanning
> 2.0, not 1.0. A first pass read 1.44 NDC as "1.44 frame widths" and concluded
> the framing was generous when it was really 0.72 and loose — and the rendered
> screenshot, which disagreed, was nearly talked out of. Halve the NDC extent
> before comparing it to anything.

## The package cutouts

The substrate has a semicircular cutout bitten out of its edge, and it is a
real through-hole — you can see the background straight through it. Both
photographs agree on the geometry:

| source | chord | depth | center, from mid-edge |
|---|---|---|---|
| retail photo, top edge | 2.23 mm | 1.04 mm | −2.77 mm |
| retail photo, bottom edge | 2.26 mm | 0.98 mm | −2.79 mm |
| `substrate.jpg` | 2.25 mm | — | −2.81 mm |

Modeled as a true half circle, r = 1.125 mm at x = −2.78 mm. The package is
built from a `Shape` carrying both bites: `ShapeGeometry` for the two
photographic faces and an `ExtrudeGeometry` of the same outline for the body,
so the laminate edge wraps the inside of each cutout and the hole reads as a
hole rather than a dark patch.

> **There are two, not one per edge.** Scanning the entire perimeter of both
> photographs finds indentations only on the pair of edges that map to world
> ∓Z; the other two are clean over their whole length. Worth stating because
> the expectation is naturally four — the package looks symmetric.

> Only the extrusion's side walls are drawn. Its caps would sit exactly on the
> two photographic faces and z-fight them; a material-array group whose
> material is `visible: false` is skipped by the renderer, which is cheaper
> than post-processing the geometry's groups.

### The two faces have different UV mappings

`pads.jpg` needs **both uv axes negated** — a 180° rotation — where
`substrate.jpg` does not. The two photographs were taken by flipping the
package left-to-right, so a feature at body *x* sits at image column
`(20-x)/40` on the underside against `(x+20)/40` on top, and the bottom face's
own rotation already reverses *z*.

Two features pin it down, and both check out:

| feature | substrate.jpg | pads.jpg | body |
|---|---|---|---|
| pin-1 gold triangle | top left | top **right** | (−19.2, −19.2) |
| cutouts | column 0.430 | column 0.562 | x = −2.78 |

The predicted underside columns are 1.000 for the triangle and 0.570 for the
cutouts, against 0.98 and 0.562 measured. Both textures' gold markers now
resolve to the *same* body corner.

> Symptom of getting it wrong: the pads photo's own printed notches sit beside
> the real holes instead of in them, and the gold triangle appears on the
> diagonally opposite corner from the one on the substrate side. Check the
> corner numerically — segment the warm/low-blue marker and map it back through
> each texture's own mapping — rather than by eye on a tilted render.

## The dies used to flicker after the delid

Both die faces flickered from the lid lift until the camera dropped to die
level, then stopped. Each die is a solid box with its photographic face as a
separate plane **2 µm** above the box's top — and at package distance the depth
buffer cannot resolve 2 µm. In depth-buffer LSBs, with `near 0.05 / far 600`:

| stage | camera distance | separation | |
|---|---|---|---|
| t 0.225, lid off | 69 | **0.35 LSB** | same depth value → fights |
| t 0.25 | 56 | **0.54 LSB** | fights |
| t 0.30 | 44 | **0.87 LSB** | fights |
| t 0.36, down at die level | 17 | 5.81 LSB | resolved |
| t 0.415 | 16 | 6.55 LSB | resolved |

Below 1 LSB the two surfaces quantize to the *same* value. The crossover falls
exactly at the t 0.36 keyframe where the camera drops to `y = 3.0`, which is
where the flicker was reported to stop — the arithmetic reproduces the symptom
without needing to see it.

Fixed with `polygonOffset` on the face planes (factor −1, **units −8**), which
biases them 8 LSB toward the viewer *independently of distance*. Raising
`camera.near` also works — 0.5 would give 3.5–8.7 LSB — but it only buys margin
rather than removing the dependence, and it risks clipping at the transistor
stage where the camera closes to ~2.4 units. Moving the plane physically higher
would open a visible gap at the die edges during the low rake in stage 05.

> It does show up in a still, as a moiré: a patch of the CCD face carries
> horizontal banding of amplitude **4.55** before and **0.26** after (ripple
> power 291 → 7.6). Worth measuring rather than trusting a glance, since a
> software rasteriser breaks depth ties differently from a real GPU and any
> single frame may happen to look clean.

## Accuracy

Figures in the panels are limited to publicly verified ones: 70.6 mm² die,
8.315 billion transistors, ~117.8 MTr/mm², TSMC N4P, 32 MB L3, 6 of 8 cores
enabled on the 9600X.

Two deliberate departures from reality, both stated in the UI:

- **The metal stack is 15 representative tiers.** TSMC does not publish the
  metal layer count for N4P, so no specific number is claimed.
- **The stack's vertical scale is exaggerated ~400×.** Real back-end-of-line
  wiring is a few micrometers tall on a die millimeters wide; at true scale it
  would be invisible. Horizontal proportions are to scale.

## Assets

Textures in `assets/` are downscaled crops of the source photography, which
is kept outside this repo:

| File | Source | Used for |
|------|--------|----------|
| `ihs-photo.jpg` | lid photo, cropped to the measured lid bbox | source for `ihs.jpg` |
| `ihs.jpg` | the above, edge-extended past the metal | stages 01–03 |
| `pads.jpg` | package underside | stage 02 |
| `substrate.jpg` | delid, cropped to the 40 mm package | stages 03–05 |
| `die-backside.jpg` | delid, true color | stages 03–05 |
| `iod-backside.jpg` | delid, cropped to the I/O die | stages 03–06 |
| `die-floorplan.jpg` | straightened delayered CCD | stages 06, 08 |
| `core-detail.jpg` | crop of the bottom-left core | stage 07 |

Both die shots are stored in their published orientation and turned half a turn
by a uv transform as they load — see **The half turn** above.

Total ≈ 5.2 MB.

**Scale is measured, not assumed.** The package square occupies
**x 150–2803, y 148–2802 (2653 px)** in all three photographs — they share a
framing. At 40 mm wide that is **66.33 px/mm**.

> Getting this wrong is not subtle. An earlier crop assumed 2701 px, which
> stretched every package texture by ~1.8% and left the 3D dies visibly off
> their photographic twins. Measure the teal square in each photo; don't
> assume a crop box.

The I/O die measures 12.74 × 9.88 mm = 125.8 mm² against ~122 mm² published
for the Granite Ridge I/O die — a ~3% overshoot that reflects the hand-read
die bounds, not the scale mapping.

> **Check before this ever ships publicly:** confirm the license/attribution
> for the die photography. Fine for a local prototype; needs sorting out if it
> becomes a live page.

## trace.html — the region tracer

A second page in this folder, not part of the descent and linked from nowhere.
It exists to define stage 07's regions by hand:

```
http://127.0.0.1:8777/prototypes/cpu-layers/trace.html
```

Click each vertex; hold **shift** to keep an edge exactly horizontal or
vertical; click the **first point** again to close the shape (it grows a ring,
green when the click will close rather than extend). Wheel zooms, right-drag
pans, backspace undoes a point. The sidebar emits `{name, poly}` in u,v on
`core-detail.jpg`, ready to paste into `CORE_BLOCKS`.

A rubber band follows the cursor, turning blue while shift is held, because the
orthogonal constraint is hard to use blind.

## Dependencies

three.js r180, vendored in `vendor/` (`three.module.js` + `three.core.js`,
~2 MB). No CDN, no build step, works offline.

## Stage 08, rebuilt: what makes the copper cinematic

The first version separated fifteen identical planes all at once and looked at
them from outside. It was legible and inert. Five changes turned it into the
stage it is now, and each solves a specific failure of the version before it.

**Grading, in the texture rather than the material.** A real stack is thin,
tightly pitched and barely coppery at M1 and thick, sparse and warm at M15, so
appearance alone should tell you how high up you are. The first attempt tinted
the material, which cannot work: a tint multiplies, so an already orange map
cannot be desaturated toward tungsten by any color you choose. The wire color
is therefore mixed **inside** `routingTexture` — `mix('#8e8a85','#d98a44', t**0.75)`
— and `tierLook(i)` is left to carry lightness and roughness only.

**A bottom-up cascade, not one accordion.** Each *gap* opens on its own ramp
(`gapOpen`, 3.2 ms apart), and a tier's height is a running sum of the gaps below
it, kept in `tierY` once per frame. Tiers, vias and bumps all read that array, so
the three can never disagree about where a tier is.

**A pulse that says what the wiring is for.** Without it, fifteen beautiful
sheets of metal are fifteen sheets of metal. A gaussian of `emissiveIntensity`
climbs the tiers on a span that overshoots the stack at both ends, so light keeps
arriving from below instead of strobing in place, and the vias light slightly
*ahead* of the sheet they feed. Amplitude matters more than it sounds: this
started at 2.3, which clipped to white and lost the copper the stage is about.
1.05 reads as heat moving through metal.

**Near-fade, which is what makes the interior camera possible at all.** Flying up
through a textured plane is a full-screen flash of copper as it crosses the near
plane. Every tier fades by `smoothstep(|camY - tierY[i]|, …)`, so a crossing
reads as passing through a veil.

**An exit that takes two keys.** One was not enough. A single jump from inside
the stack to above it left the camera at 0.926 still among the tiers, below the
top and meters from a plane — chaos, not emergence. 0.918 clears the footprint
and 0.934 clears the height, and only from up there do the bond bumps read as
the thing the whole stack was climbing toward.

The stage also gained room: it now starts at 0.824 rather than 0.848, about 46%
more scroll, taken from the core stage's tail where nothing new was arriving.

## The sweep's velocity: retime, don't reposition

The run-up to the floorplan sweep felt sluggish just before the regions bloomed.
The cause: the eye-level shot beside the dies sits about **3.8 units** from where
the sweep's first key is, so the two are nearly the same place, and that tiny hop
was being given 0.055 of scroll. 70 units per unit t, against 370 on the descent
before it and 138-151 across the sweep after. Since `sampleCamera` eases to rest
at every key, it read as a dive, then a crawl, then a sweep.

The first attempt at a fix moved that key out to x 17 so it had real ground to
cover. The velocity came out perfect and the shot was ruined: that key **is** the
"Bare silicon" eye-level view of the dies, and from x 17 it becomes a side view.

The actual fix changes only *when* the camera arrives, not where. Landing at
0.398 instead of 0.360 gives the descent 0.098 of scroll for its 31 units and the
hop 0.017 for its 3.8, so the whole run decelerates monotonically — 370, 319,
225, 151, 143, 138, 134 — with no dip to recover from.

**Rule for this key: its position is not a free parameter.** If the segment needs
work again, change the timing.

## Played, not scrolled

The descent used to be driven by `window.scrollY`, with `current` chasing
`target` on an exponential damp. That felt good and had two structural problems.
The viewer was almost never at a composed shot — every frame between two
keyframes is a frame nobody framed — and an exponential chase never actually
*arrives*, so there was no such thing as being at a defined point in the journey.

It is now **seven stops and six legs**. An arrow plays one leg with an explicit
duration and a smoothstep and lands exactly on the next stop. Two things fall
out of that, and they are the reason for the change: every resting frame is a
shot somebody composed, and there is a well-defined moment — parked — at which
the scene can be made interactive. Clicking and hovering are gated on exactly
that (`atStop()`), so the rule a viewer learns is *it is live when the chip has
come to rest*, rather than a per-region opacity threshold they cannot see.

Each stop is pinned to a fact about the animation rather than to a round number:

| # | t | why exactly there |
|---|---|---|
| 1 | 0.000 | the packaged chip, as the page opens |
| 2 | 0.398 | a camera key: the composed eye-level bare-silicon shot |
| 3 | 0.512 | `groupIn.strip` completes at 0.512 and `toOutline` starts at 0.512 — the single instant every macro region is up and none has begun settling to an outline |
| 4 | 0.800 | `blockIn` reaches 1 at exactly 0.640 + 0.160 |
| 5 | 0.888 | a camera key, level and side-on among the tiers. **Not** the 0.902 key further in: there the camera sits 0.12 under a tier and it fills the frame |
| 6 | 0.966 | `cellIn` completes at 0.964 and nothing has begun to fade. It is also the first `t` at which the whole picture is up: the fold finishes at 0.951 and the room finishes opening at 0.952 |
| 7 | 0.990 | a camera key, after `invIn` completes at 0.984. Not 0.994, where the rail tick sits flush against the end of the rail and reads as broken rather than as arrived |

There **was** a stop at 0.130, the package turned over to read its 1718 contact
pads, and it is long gone along with the flip that reached it.

Leg durations (`LEG_MS`) are hand-set rather than derived from distance in `t`,
because the legs are not equally full: the fourth is the entire 22-beat core
reveal and needs about three times the fifth, which is one camera move.

Consequences worth knowing about:

- **The page is one viewport tall and does not scroll.** The old 2000vh
  `#scroll-track` was removed rather than hidden — a page that can still be
  scrolled by a trackpad while the animation is under someone else's control is
  a page that fights the user.
- **Freezing for the sheet got much simpler.** It used to need a pinned scroll
  offset plus non-passive `wheel`/`touchmove` handlers. Now `t` only changes
  inside `advance()`, so `frozen` has one job: make the arrows inert.
- **Captions collapsed from nine to seven**, one per stop, so the counter, the
  rail ticks and the arrows all agree. Nine captions meant one press of the
  forward arrow moved the counter by two. Each caption's `t` is its stop's `t`
  exactly, so the card swaps on *arrival* and always describes where you are.
- **`window.__die.seek(t)` replaced `window.scrollTo`** for all the verify
  scripts and the video renderer, since nothing scrolls any more. It cancels any
  flight in progress and snaps, so a headless capture gets the frame it asked
  for rather than one on the way to it.
- `verify/stage-nav.py` drives the real buttons with a real mouse and asserts
  every leg lands *exactly* on its stop, that both arrows are dead in flight,
  that a canvas click in flight opens nothing, and that hover and click come back
  at a stop.

One capture gotcha this introduced: `seek` is instant, where the old damped
chase took about a second to converge — long enough that the caption's 0.55s
swap animation had always finished by screenshot time. It hadn't, and captions
came out invisible. `verify/shot.py` now waits 700 ms.

## 3D structure inside a tier

A tier used to be one textured plane. Read from *inside* the stack that is a
picture of wiring rather than wiring: no thickness, no side to catch light,
nothing to occlude the tier below.

Every tier now also carries real geometry — parallel bars spanning the die in a
single routing direction, **alternating per tier**. That alternation is not
styling: real stacks route one layer horizontally and the next vertically
precisely so a signal can turn a corner, and it is also what makes the stack
read as a lattice from inside instead of as a stack of combs. Bar count, width
and *thickness* all grade with height — many thin closely pitched bars at M1, a
handful of fat ones at the top that are power and clock rather than signal — and
thickness is the part a plane could never show. Short perpendicular jogs, a third
as many as the bars, stop a single tier reading as a comb edge-on.

Three things this forced:

- **Bars draw solid.** `depthWrite` comes on at full opacity, unlike the blended
  plane. A blended box shows its own back faces through its front ones and stops
  reading as metal, and the see-through quality this stage wants comes from the
  gaps *between* bars — structural, not material.
- **Bar color is graded on the material**, tungsten-gray at M1 to copper at the
  top. This is the tint that could not work on the plane: a material color
  multiplies, so it can never desaturate an already orange texture toward gray.
  With no map to fight, the same grading finally works as a color.
- **Two near-fade bands, because the plane and the bars fail differently.** The
  plane is a full sheet: at a grazing angle from just below, it washed the entire
  upper frame flat orange and buried the structure the bars had just added, so
  its band is wide (a tier within 0.70 of the camera's height is on its way out).
  The bars are slats with gaps and can be far closer before they become a wall,
  so 0.34 is enough. Outside the stack every tier is further away than either
  threshold, so both stay solid and the stack still reads as sheets from above.

## The affordance layer: lift, tag, line

Three things now say "these slabs are yours to touch", and the reason there are
three is that each says a different part of it:

| | says |
|---|---|
| the **lift** | this reacts — the attract pass, and hover |
| the **tag** | this has a name, and it opens |
| the **hint line** | it, in words, for anyone who has not moved the mouse |

### Making it more obvious, without making it louder

Three changes, and the constraint on all of them was that nothing may be *added*
to a slab — the pulsing ring and the corner plus were both tried and rejected as
a rash on a photograph that is already dense.

**The attract pass bounces twice.** A single rise and settle is the same shape as
every other motion in the scene, so it reads as the die being alive rather than
as something addressed to the viewer. A second, smaller bounce is a rhythm
nothing else here has, and rhythm is what separates a signal from ambient
movement. **The cycle length is deliberately unchanged at 2600ms**: `JUMP_MS`
grew by 250 and `JUMP_GAP` gave back the same 250. Frequency was the wrong knob,
because a repeating pattern in the corner of the eye becomes noise as a function
of how often it happens, not of what it does.

**The breathing is quicker**, `PULSE_HZ` 1.15 to 1.45. A cycle was 870ms, slow
enough to read as the block glowing steadily rather than pulsing; 690ms is a beat
and still nowhere near a flicker. It is deliberately not in step with the bounce,
so a lifted block is running two rhythms that do not divide into each other and
reads as something responding rather than as a loop playing.

**The click line is bigger and brighter than the keyboard line.** They used to
share `#hint`'s size. They are not the same job: the keyboard line names a
control sitting three centimeters below it, while the click line is the only
sentence on the page that says what a block *does*, carrying that alone for
anyone who has not moved the mouse. It is `.86rem` against `.66rem` and `--text`
against `--muted`. Measured at 1440 it runs 567 to 873 with the caption ending at
442, so the clearance the split bought is intact, and at 320px it is 270px wide
inside a 320px viewport.

> **A contact shadow under the lift was built here and taken out again**, and the
> reasoning is kept at the top of `scene.js` because it is the obvious next idea.
> It worked and it verified, and it genuinely helped at the core stop where 29
> blocks are packed edge to edge. But **the slabs are glass**: a contact shadow
> hides under its caster, and here it read straight through the block and pulled
> its color down. The only settings where the shadow was clearly legible were
> the ones where it spoiled the block. Rebuilding it needs the shadow masked by
> the footprint rather than visible through it, which is a stencil pass, not an
> opacity.

The middle one did not exist. A viewer who hovered a block watched it rise and
learned that the page was alive; nothing anywhere connected that movement to the
sheet a click would open. The one sentence that did say so had to carry the
whole job alone — and it was wired to `t > 0.03`, so it was on screen at stage
01, where nothing is clickable, and gone by stage 03, where everything is. **The
instruction was displayed exactly when it was false.**

**The hint lines were split.** They share a block but not a lifecycle. The
keyboard line belongs to stop 1. The click line asks `tiles.some(selectable)`
rather than testing a stop number, so it stays honest if the timeline is retimed
again; it waits `HINT_DELAY` after parking so the words and the demonstration
arrive together; and it stands down while the tag is up, because the tag is
saying the same thing better and about a specific block.

**The tag is a chip with two lines**, the block's name and "Click to read about
it", and its left rule takes the block's own color so it reads as belonging to
that slab rather than as page chrome that happened to appear. It rides the
cursor on hover — and the attract pass raises the *same chip* over the block it
is demonstrating, which is the point: the demo now teaches the click and not
merely the hover, and it still adds nothing to the scene itself.

Three consequences worth knowing about:

- **`attractLevel` now gates on `selectable`.** It never did, so the demo ran its
  three slots at *every* stop, lifting slabs whose opacity was zero. Invisible
  and harmless — right up until the tag started naming whatever the demo had
  claimed and cheerfully labeled an L1D Cache in the middle of the metal stack.
- **Stages 03 and 04 lost "Click any region to read about it."** Four tellings of
  one fact, and the caption's was the one that could be given up.
- **`tagW`/`tagH` are measured when the text changes, not per frame.** Reading
  `offsetWidth` forces a layout, and doing that inside a WebGL loop is a cost
  paid for nothing 59 frames in 60.

`verify/affordance.py` asserts the whole table, plus the credit panel. It waits
on **rendered frames**, never on the wall clock: at the floorplan stop a
swiftshader frame can take over a second, so "wait 2.2 s then look" is a coin
toss on whether a single frame has run since the seek, and an earlier version of
that file passed and failed on the same build depending on the weather.

## The credit, split by obligation

Two paragraphs used to sit permanently in the bottom-right at 0.56rem. That is
the worst of both readings: large enough to take a corner of the frame away from
the scene for the whole descent, and small enough that nobody has ever read the
disclaimer in it. On a phone the disclaimer was dropped outright for want of
room.

The split is by **obligation**, not by length. Crediting the photograph is the
condition this page carries, so that is one permanent line and never depends on
anybody opening anything. The disclaimer about the annotations is a note rather
than a condition, so it goes behind a labeled toggle — and the moment it is
behind a toggle it can be set at 0.74rem, a size somebody might actually read.

What that buys: the corner shrinks from four lines to one; the long text becomes
legible instead of merely present; and the phone gets all of it for the first
time, in a panel centered on the viewport.

The toggle is a **word, not a bare glyph**. A lone information glyph in a corner
is a mystery box, and the one thing a viewer needs before deciding to open it is
that this is about the *annotations* rather than about the site.

Two things this forced:

- **The outside-click close is scoped to the whole footer**, not to the panel, so
  the click that opened it cannot also be the outside-click that closes it.
  `stopPropagation` works until something else listens in the capture phase.
- **The narrow-screen bottom stack moved to the foot of the stylesheet.** The
  responsive block up at line 323 sits *before* `#nav`, `#hint` and `#caption`
  are defined, so at equal specificity the later base rule wins and any override
  written up there against a property the base also sets is dead. `#nav { gap:
  .5rem }` up there has never applied. One line carrying a toggle is wider than
  the nav pill and could no longer share a row with it, so the credit takes the
  bottom edge and nav, hint and caption each step up by that row's height — each
  offset derived from the one below it rather than chosen.

## Stages 06 and 07: the fold, the cell rows, and one gate

These two replaced *one wire, end to end* and *down to the transistors*. The wire
stage was a good picture answering a question the stack had already mostly
answered; the transistor stage was a free-floating patch of fins at no stated
scale, connected to nothing the viewer had been shown. What sat between copper
and transistors and was never said is the **standard cell**: that every gate on
the die is one of a few hundred prebuilt tiles, all drawn to the same row height,
abutted with nothing in between, and that the copper above is reaching for
*their* pins. That is the bridge from this page to the logic-gate lessons on the
rest of the site, and it is what these two stages are for.

The FinFET geometry was not thrown away. `fets`, `fins`, `gates` and `wafer` are
the same objects re-parameterised at cell scale, so they finally have a home.

### The fold

The stack goes back together, and it is deliberately **not** the opening cascade
played backwards. Three differences carry it, all argued at `gapClose`:

- **It closes from the top.** The open peels upward from M1 because M1 is what
  the stack is anchored to; the fold has to come back down onto M1 for the same
  reason, so the last thing to move is the thing the camera is about to stand on.
- **It is quicker and tighter** — 0.026 of `t` against the open's 0.077, with the
  gaps overlapping three times as hard. A shape the eye already knows does not
  need the reading time the first reveal needed.
- **It does not close to zero.** Fifteen coplanar transparent planes is a z-fight
  with fifteen times the overdraw in one band, and "M1 is the floor" means
  nothing if M15 is also the floor. `CLOSED_FRAC` leaves a real pitch, which is
  also the more honest reading: the exploded view was the exaggeration.

  **`CLOSED_FRAC` is set by the vias, not by how the copper looks.** A via is
  exactly as tall as the gap it crosses, so at the original 0.10 the folded gaps
  were 0.03 and every via in them disappeared into the slab halfway through the
  move — the fold read as the *connections being deleted* rather than as the
  layers closing up. At 0.28 the gap is 0.084, the upper vias are wider than they
  are tall and read as studs between the sheets, and nothing ever vanishes. It is
  still a 3.5x compression, which is plenty to read as a fold.

**Gap 0 is the exception and it is the point.** The fold closes the fourteen gaps
above it and opens this one into a *room*: M1 underfoot, the other fourteen tiers
compacted into a ceiling overhead, the cell rows showing through the floor. There
is no other way to be under the copper and above the cells at once — the camera's
near plane is 0.05 and a folded gap is 0.03, so a camera between two folded tiers
is inside both of them.

`stackOut` is gone. The stack used to fade away to make room for what came next;
now what comes next happens *underneath* it, so it has to survive to the end. Only
the **bumps** retire, and they are out of frame from the moment the room opens.

The **vias stay**, and getting that wrong first is worth recording. The first pass
retired them alongside the bumps, on the reasoning that a folded gap is 0.03 tall
and a via in it is a sliver worth nothing. That is true of thirteen of the
fourteen gaps and false of the one that matters: gap 0 is the room, so its vias do
not shrink, they *stretch*, and they become the columns you stand among. They are
the only thing in the shot that says the floor and the ceiling are connected —
which is what a via is — and the room was flat without them, being a floor, a roof
and some air. Nothing special-cases it: a via's length is already its own gap's
height, so the folded ones collapse and the ones in the room grow, from one line.

Gap 0 carries **a fifth** of the vias the other gaps do, and it is thinned at
build time rather than during the fold. At the density that is right for the
stack — thousands of short local connections, which is the point being made
there — a camera standing *inside* the gap is standing in a forest, with the
nearest columns 70px wide and the floor completely walled off.

An earlier pass kept the full count and shrank the surplus away as the room
opened. That was worse, and visibly so: the fold is watched from outside, and
five sixths of the columns quietly evaporating mid-flight reads as the scene
breaking rather than as a density choice. **Nothing disappears now** — there are
simply fewer of them, from the first frame to the last.

They are seeded with an LCG for the same reason the cells are: they went from
being background stippling nobody composes against to being the most prominent
geometry in a composed shot.

`perf.py` measures both new stops at 29.9k triangles against the stack's 23.4k,
and every stage is still vsync-limited.

### The cell rows

Nothing in this stage moves. The field is built once and the whole thing is a
fade, which is the right shape: the rows are not arriving, they were always
there, and the only reason they were not visible is that fifteen layers of copper
were in the way. The stage is the copper getting out of the way.

- **One height, many widths.** The rows are identical and the cells inside them
  are not, and that contrast *is* the teaching point.
- **Rails on every boundary**, shared between the row above and the row below.
  Supply is warm and ground is cool, decided once in `VDD_COL` / `GND_COL`, and
  the inverter's own straps read those same two constants — the rail along the
  hero cell's PMOS edge is the same color as the rail along every other cell's,
  so crossing from the floor into the cell is not learning a second scheme. Which
  boundary is supply is fixed *relative to the hero row*, not by the raw index:
  keyed off `b % 2` it depended on `ROW_N`'s parity, and the cell's VDD strap
  ended up sitting underneath the field's ground rail.
- **Abutment, not spacing.** A 0.006 seam, not a gap. Tiles with air between them
  are a picture of a floorplan, not of a cell row.
- **M1's plane goes translucent; its bars do not.** A floor that dissolves under
  you is a hole, and the rows read better through the gaps between real bars than
  through one uniformly faded sheet.
- **Seeded with an LCG, not `Math.random`**, unlike the vias and the bar jogs,
  which are right to use it. Nothing composes a shot against an individual via. A
  camera key *does* aim at one named cell here, so the hero cell is authored as a
  constant and its footprint left empty in the instanced field.

### One cell, one gate

**The switching loop is currently off** (`CELL_SWITCHING` in `scene.js`). The cell
has a lot to say structurally — six pieces of metal, six posts, two devices and a
shared gate — and a light running around it while a reader is still working out
which post goes where competes with the thing it is there to reward. The loop is
untouched and every term in it is multiplied by `swA`, so flipping the flag back
brings it all back with no other edit; `cell-switch.py` reports the flag rather
than failing.

**Contacts are tinted by the net they carry**, not by the metal they are made of,
and that is what makes the wiring readable. Drawn all one tungsten gray, six
identical posts stood between the metal and the silicon and gave no clue which
belonged to which — you could see that the supply rail came down somewhere and
that the output strap went down somewhere, but not that they reached different
terminals of different devices.

An inverter, because an inverter is the smallest thing that is still honestly
CMOS.

**The cell owns no rails.** It did briefly, and that was a wrong picture rather
than just clutter: a standard cell has no power straps of its own, it has the
*row's* rails running along its top and bottom edges, shared with the row above
and below, and that sharing is half the reason a row exists. The inverter reaches
up and out to the field's rails instead. Four pieces of metal, none of them a
rail: **A** over the gate, **Y** joining the two drains, and two **ties** running
in z from each source out to the rail line.

`lift` is what separates them. The signal metal rises at stop 07 so it stops
covering the devices it is wired to; the ties do not, because they end on a rail
that is not going anywhere. **Power stays down at the row, signal lifts out for
inspection**, and the difference in height is itself the explanation. The contacts
follow: the two source posts are short and stop at rail height, the two drain
posts and the gate post stretch with the lift. That difference is the clearest
statement in the cell of which terminal is which — short posts go to power, tall
ones go to the circuit.

**Devices are blocks, not fins.** Four ridges per device read as texture rather
than structure at the size this renders. Source and drain are drawn *identically*
and deliberately: in a MOSFET they are the same object and only the wiring tells
them apart, so coloring them differently would invent a distinction the silicon
does not have.

Color carries the rest, following the reference: **green P-type**, **teal
N-type** (pushed off flat blue so it cannot be read as the cool GND rail),
**salmon gate**, a sliver of **yellow gate oxide**, and every connection — posts,
straps, output via and output wire — in **one neutral gray**. Two colored bars at
the edges are power; everything gray between them is the circuit.

Two color details that are not obvious from the code:

- **`SIGNAL_COL` is darker than `CONTACT_COL` on purpose.** The posts are a
  physical material and are lit; the straps above them are a *basic* material and
  are not, because the switching loop has to drive them past 1.0 and only an
  unlit material can be. Given the same hex the straps rendered visibly paler and
  the circuit looked like two different grays.
- **The power ties are built from `railMat` itself**, not from a matching color:
  same material, same instanceColor, same height, same thickness, overlapping the
  rail's near half so there is no seam. A hand-matched color reads as a near
  miss, which is worse than an obvious difference — a strap that is *almost* the
  rail's color looks like a mistake, one that is exactly it looks like the rail.

The last two camera keys sit about **15 degrees to the left** of what they aim at.
Square-on was the right correction from the 45-degree diagonal these used to have,
and it overshot: a layout with no azimuth has no near corner, so nothing tells you
the metal is *above* the silicon rather than printed on it. Fifteen degrees sees
under the lifted straps without rotating the axes back into a diamond.

Moving left put a stack column straight through the cell, so the vias now fade to
3% at stop 07 rather than the 20% the sheets fade to. A tier is a thin plane seen
edge-on and survives being a ghost; a column is a meter of copper standing between
the camera and a cell half a unit wide.

**Keeping the cell in front of the copper — and the wrong fix first.** A via
crossing the inverter used to hide it, so `viaMat.depthWrite` was turned off. That
cured the symptom and broke the vias everywhere else: depth writes are exactly what
make a via read as a solid rod rather than a colored film, and every column in the
room and every via in stage 05 went see-through at once.

The right fix is on the object that has to win, not on every object it might lose
to. `viaMat` writes depth again; instead the whole `fets` group turns **depth
testing off**, so the cell simply stops asking. With no depth test the painter's
algorithm is all that remains, so the group carries an explicit `renderOrder` per
layer ascending in build order — substrate, well, devices, oxide, gate, contacts,
metal, labels — or the parts would swap places as the camera moved and the cell
would turn itself inside out. The etched labels sit above all of it at 230; at 224
the metal at 227 painted straight over IN and OUT.

`tieMat` is a **clone** of `railMat` for the same reason: the ties have to stop
depth-testing with the rest of the cell, and `railMat` is shared with the floor's
rails, which must keep theirs. `updateScene` copies color and opacity across each
frame so the clone cannot drift.

**The cell publishes a pin, not a route.** The output via and the long wire that
led away from it are gone. That run of metal was describing the *next* cell's
problem, and at this magnification it read as part of this one.

### Pin names are etched on the metal

`in`, `out`, `vdd` and `gnd`, drawn on the thing they name with `faceLabel()`, the
same silkscreen helper the die names use. They replaced four projected DOM tags
that had to be re-positioned every frame, clamped back inside the viewport when
they fell off the edge, and hidden entirely on a phone. A plane lying on the strap
has none of those problems and reads as part of the object, which is what a pin
name on a layout is.

Each label sits on a piece of metal that **runs the way the text reads** — which
is why `out` is on the output wire rather than the Y strap it continues: the strap
runs in z and the word would be sideways. The two on the rails need far more
vertical clearance than the two on the signal straps, because a rail is 0.026
thick against a strap's 0.007; given the strap's offset they sat *inside* the rail
and were invisible.

**The bumps arrive with the stack** (`bumpIn` 0.826-0.864), not after the cascade.
They used to land at 0.898-0.922, which is exactly the window the camera rises
past the top tier in, so the one moment they were first visible was the moment
they were fading in and dropping into place. They read as appearing from nowhere.
The climb they are the reward for is the camera's, and the reward has to be there
before the climb ends.

Lit color is derived **from each piece's own base**, not from one shared bright
value, so a conducting ground rail goes bright blue and a conducting supply rail
goes bright copper. Shared, both washed to the same warm white the instant they
switched, throwing away the color the floor had just spent a whole stage
establishing — at exactly the moment you most want to know which rail it is. The switching loop is a pure function of its phase — no edge detection, no
comparison against the last frame — so seeking to a `t` gives the same frame every
time and the video renderer's clock override still works. Exactly one device is
lit at a time, which is the lesson; the pulse leaves on the rising edge of Y and
climbs the output via in five pieces, for the same reason the old net's long runs
were cut into short boxes.

It lands in `outWire`, not in the tier. The tier is authored at die scale, where
one bar spans the chip, and by stop 07 it has been faded to a ghost so that it
stops crossing the subject — a flash in a ghost is not an arrival. `outWire` is
the same metal at the scale the camera is actually at.

**The metal lifts off**, and this is the change that made the stage readable at
all. Drawn flat, the cell is honest and illegible at the same time: the supply
and ground straps run the full width of the tile and the output strap runs its
full height, so between them the metal covers most of the devices it is connected
to — and the relationship between those two things is the whole point. There is
no camera angle that shows both while they are touching. So everything above the
devices rises clear of them and the contacts stretch to stay joined to it, which
is the language the page has spoken since the floorplan tiles rose as glass slabs
and the fifteen tiers peeled apart.

The elevation climbs 8, 21 and 37 degrees across the last three keys. Stop 06 is
nearly level because it is a room being stood in; a cell is a *layout*, and a
layout is read from above. It stops at 37 and not 90 because the argument of a
cell is that it is built in layers, and a plan view is the one angle that cannot
show a stack — the lift only reads from somewhere that can see under it.

**Azimuth mattered as much as elevation** and took longer to get right. These keys
used to look in along the die's diagonal, which put the cell on screen at 45
degrees, and a layout read cornerwise is a diamond of overlapping slabs: the fins,
the poly crossing them and the straps above ran in three different screen
directions and none of them looked like an axis. The view is now nearly down `-z`,
so the cell's width lies across the frame, the fins run with it and the poly runs
against it, and everything in the picture is either horizontal or vertical.

The cell is pushed right of the caption by moving the **camera and the aim
together**, not by panning the aim across it. Panning is what the traced net did
and it is wrong here: panning is what introduces the azimuth that turns the layout
back into a diamond.

### The top bar tucks away

Pinned on arrival and only on arrival — that first screen is where a visitor works
out whose site this is and how to leave it. From the first press of the forward
arrow the scene owns the whole frame; reaching the top edge brings the bar back,
leaving sends it away. It tucks on the first *forward* move only, so retreating to
stop 1 does not re-pin it.

Driven by a **coordinate test**, not `pointerenter`/`pointerleave`. The first
version armed an invisible strip and listened for enter on it and leave on the
bar, and it desynced immediately: a bar sliding down under a *stationary* pointer
fires no enter, so moving away fired a leave nothing was listening for and the bar
stuck open. "Is the cursor within 64px of the top" has no such corners, and 8px of
hysteresis stops a pointer resting on the boundary from flickering it.

`:focus-within` overrides the tuck for anyone who tabs to it, and `@media (hover:
none)` disables the scheme entirely — on a touch device there is no gesture that
would bring it back that would not also fight the scene.

### Figures in the sheet

A subject can carry a `figure` of `{ src, alt }`, and `openSheet()` puts it under
the prose and above the lesson cards, inside `.sheet-copy`. It illustrates what
was just read rather than pointing anywhere else, which is why it sits on that
side of the panel and not beside the video.

The drawings are ink on white and keep that white, on the same argument as the
lesson-card thumbnails: tinting artwork to the panel misrepresents it. The image
is sized by `max-width: 100%` and `max-height: 30vh` with `width: auto`, so the
height cap shrinks the box rather than leaving white margin out to the right of a
wide diagram. On a phone the cap comes off, because the sheet scrolls there.

It is centered in the column with `margin-inline: auto`. That shows only on the
figures the height cap makes narrower than the column, which is every figure that
is not much wider than it is tall: a square diagram pinned left under a 700px
column reads as a hole in the layout. The wide ones fill the column and centering
does nothing to them.

**The 30vh cap is what every sheet's height budget is built on.** L2 is the
binding case: at 1280×720 its copy plus figure clears the sheet's padding with
about 14px to spare, so raising the cap overflows that sheet before it improves
any other. A portrait or square figure is therefore small on a wide screen and
that is the trade, not an oversight.

Wired so far:

| slug | figure | note |
|---|---|---|
| `l2-cache` | `Meet-The-Processor/direct-mapped-cache.jpg` | Under the tag-array paragraph. Fills the column. |
| `ifop-phy` | `Meet-The-Processor/delid-grayscaled_dies-on-substrate-web.jpg` | Both dies bare on the substrate, traces visible between them. Square, so it renders at the cap. |
| `test-debug` | `single-cycle-cpu/waveform.jpg` | A waveform viewer, which is literally what the copy describes. Widest of the set, fills the column. |
| `integer-execution` | `ALU/alu-block.jpg` | The ALU symbol. Square, renders at the cap. |
| `branch-predictor` | `pipelined-cpu/predictor-fsm.jpg` | The two-bit predictor state machine. Reads at the cap. |
| `scheduling` | `pipelined-cpu/dependences.jpg` | **The one that does not survive the size.** Five instructions and their dependences, and at 363px the instruction labels are not legible. It reads as texture rather than as a diagram. A cropped version, or a different figure, would fix it.

### The copy column has no measure cap

`.sheet-copy` carried `max-width: 36rem` and no longer does. The grid already
gives the column a width, the room between the sheet's left padding and the gap
before the player, and the cap left a third of that room empty on a wide screen
while the player filled its own column to the pixel. The copy now runs to the
player's edge and stops at the grid gap.

This is a long measure by the usual rule, 716px at 1707 wide and 816px at 1920,
and it is deliberate: the edge of the player is the line the eye already reads
as the edge of the text, and a narrower column beside a full-width player reads
as a mistake rather than as typography. It also buys back the height, which is
what keeps every sheet inside the window: this panel is centered and does not
scroll on desktop, so a subject's copy plus its figure has a real budget.
Measured at 1280×720, 1707×950 and 1920×1080, all eleven wired sheets sit inside
the sheet's own padding at every one.

### The player sits in the middle of the screen

`.sheet-media` is `align-self: center`. The grid row is as tall as the taller of
the two columns and the sheet centers its rows, so this puts the player in the
vertical middle of the window. It only moves on the sheets whose copy outruns it,
which today is L2 and, by a few pixels, the Infinity Fabric band. On every other
sheet the copy is the shorter column, so the player still defines the row and the
title still lines up with its top edge, which is what the nudge on `#sheet-title`
is for.

### Lesson cards in the sheet

A subject can carry a `links` array, and `openSheet()` builds a card per entry
under the copy: thumbnail, kicker, title, arrow. Shaped after the home page's
`.mtp-card` and reproduced in this page's own tokens, for the same reason the top
bar is — this page loads none of the site's CSS.

The thumbnail is a real lesson figure rather than an icon, because a reader who
has seen the R-type diagram knows where they are being sent before they read the
title. Subjects with no `links` hide the row outright, unlike the video player,
which is deliberately shown blank: a missing video is a promise, a missing lesson
is not.

Wired so far: `instruction-fetch` → *The Basics of Instructions* and
*Fetch, Decode, Execute*, in course order.

### The sheet videos

One file per slug at `assets/video/<slug>.mp4`. `HAVE_VIDEO` in `scene.js` is the
switch — a slug not in that set gets a blank player and the "video coming soon"
note, which `.has-video` hides once there is something to play. Wired so far:

| slug | block | length | size |
|---|---|---|---|
| `zen5-core` | Zen 5 Core | 1:53 | 22 MB |
| `instruction-fetch` | Instruction Fetch and Decode | 2:00 | 25 MB |
| `scheduling` | Scheduler | 1:47 | 14 MB |
| `load-store` | Load / Store | 2:10 | 16 MB |
| `integer-execution` | Integer Execution | 2:17 | 19 MB |
| `ifop-phy` | IFOP PHY | 2:51 | 21 MB |
| `test-debug` | Test / Debug | 3:58 | 30 MB |
| `branch-predictor` | Branch Predictor | 4:08 | 40 MB |
| `l3-cache` | L3 Cache | 6:17 | 52 MB |
| `l2-cache` | L2 Cache, its two halves and its tag array | 6:43 | 59 MB |

The last five are the joined ones, and each is reproduced by its own script in
`tools/` rather than by `cut-fillers.py`, because the edit is hand-chosen and a
detector would not land on the same frames twice. **`l2-cache` is the longest**
at 6:43, and **`branch-predictor` is the most joined**: nine takes shot,
`bp-explainer1` through `9`, and the first shoot whose numbering turned out to be
the edit order.

**Eight of the nine ship.** Take 6 is cut, and for what it says rather than for
anything about the edit: it attributes the combining of local and global history
to *correlating* predictors, which is the definition of the *tournament*
predictor take 7 then describes. Correlating predictors therefore do not appear
in the video at all, and putting them back needs a re-shot take.

That script is also where the **AAC padding trap** is written down — the masters
decode a few milliseconds longer than their containers say, which walks the audio
late against the video across a splice unless every branch is `atrim`'d to its
video length.

`l3-cache` is seven takes, `l3-explainer1` through `7`, and **all seven ship**:
the memory problem, the hierarchy and the library analogy, temporal locality,
spatial locality, the L3 itself, the way down to L1, and the closing line. The
numbering is the edit order again, checked the same way. Every join dissolves,
and this shoot is the roomiest so far — four of the six joins are at or within
0.09s of the 0.40s cap, where the IFOP set had three joins worth two to five
frames. The shooting note is being followed.

**Its three trims are all defects rather than content**, and two of them are
worth knowing as shapes that recur:

- **Take 6 opens on a false start that is also a repeat.** Take 5 trails off on
  "…try to design processors in a way that…", and take 6 then says "Try to",
  pauses, says "try to design processors in a way that" again, and only then
  reaches "shuttles". The clause is delivered three times across one seam. Take 6
  comes in at 3.58 on "shuttles", which removes the stumble and the repeat at
  once and lets take 5's sentence finish through the join. Cutting the other way
  round was refused because take 6 says "tries" where take 5 says "try".
- **Take 1 ends on an orphaned "and"** with 0.85s of silence in front of it,
  running to the final frame, so whole it has a tail of 0.00 and the first join
  cannot dissolve at all. The out-point goes inside that gap, which is the
  `branch-predictor` take 8 edit performed from the other side, and the tail goes
  from 0.00s to 0.85s. Take 2 opens "And in general…", so the conjunction is
  spoken once instead of twice.
- Take 4 opened on **1.84s of dead air** against 0.10 to 1.03 everywhere else. It
  comes in at 1.44 and 0.31s of what remains is spent as the 3 → 4 dissolve.

`l2-cache` is five takes, `l2-explainer1` through `5`, and **all five ship**:
blocks and lines with hit and miss and what a miss costs, direct mapped caches,
why the block alone is not enough, the tag and the two organizations either side
of it, and the closing line pointing at L1i and L1d. The numbering is the edit
order again. Every join dissolves, which is what was asked for, and **two of the
five did not have to**: 1 → 2 scores 3.79 and 4a → 4b scores 1.88, both under
the 4.0 a hard cut can hide.

**It is the first edit with cuts inside a take, and it has two of them.** The
first is an "um" in take 1, in "requests information, um, from the cache", with
0.92s of dead air in front of it. Take 1 goes out at 23.95 and back at 24.99,
which keeps the word whole, takes the filler and the air around it, and leaves
0.30s of pause. **That seam is the one hard cut in the piece**: it scores 1.46
against `JUMP_OK`'s 4.0, because it is one take against itself 1.04s later with
the pose unmoved, so there is nothing for a dissolve to hide. The two pieces are
rejoined with `concat`, not `xfade`.

**That cut was made wrong the first time, and the way it was wrong is the thing
to keep.** It went out at 23.52 and in at 24.38, on a reading that had the 0.18s
run at 23.53 as the filler and the 0.33s run at 24.63 as the word "from". It is
the other way round: 23.53 is the tail of "information" and 24.63 is the "um".
The shipped clip therefore lost the end of a word and kept the filler, and Elliot
heard it at once.

The check that catches it is the one `cut-fillers.py` already prescribes:
**name every run of sound on its own, on the OUTPUT as well as the master.**
Transcribed by itself the run at 24.63 comes back as "um" in as many words. What
was done instead was a plain transcript of the finished encode, which read
"requests information from the cache" and looked like proof. It proves nothing —
whisper *deletes* fillers, so a clean transcript is exactly what a surviving one
also produces. Nor does the opposite: transcribing with a disfluent
`initial_prompt` writes an "um" back in at any pause. Only the run naming
separates the two cases.

The second is a false start. Take 4 begins one sentence three times, "So", a 1.23s pause, "since we have", and only then "since that
piece of information can be in so many different spots". It goes out at 91.10 and
comes back at 93.75, which takes the whole false start out in one span and lands
the join in silence on both sides, so take 4 ships as two segments and five takes
make five dissolves. The video and audio of a reused input need `split` and `asplit`;
feeding one input pad to two filters is a filtergraph error rather than a silent
duplication.

**Its other trim is the l3 take-6 shape, from the other side.** Take 2's last
complete sentence closes at 75.88, and what follows it is "And so, well, wait a
minute, that's still," a 1.14s pause, the rest of the thought, and a trailing
"but." Take 3 then opens "Okay, so wait a minute" and delivers the same beat
properly and finishes it. Take 2 goes out at 76.60, on the complete sentence, and
take 3 carries the turn. There the incoming take had said the clause worse; here
the outgoing one had. The orphaned "but." goes out with it, so it needs no trim
of its own.

Nothing else is trimmed: every head and tail on this shoot is inside the range
the series ships. The one tight join is 4b → 5, where take 5 has 0.07s of head
against take 4's full second of tail; the fade is 0.12, all of it inside take 4's
silence, and take 5 pays 0.05s of soft attack on the /s/ of "So" — the same trade
the l3 splice made on the /sh/ of "shuttles".

`ifop-phy` is the most instructive of them: five takes, `ifop-explainer1`
through `5`, in order. They are one script — what the PHY is, ending on "but
when would we need to use this piece of hardware?", then the example that
answers it, then how it does it, then why it has to, then the closing line.

**Every join dissolves, and the lengths are uneven because the takes are:**
0.20s, 0.16s, 0.15s, 0.40s. The binding constraint is not how badly a seam
scores, it is AIR — these five were shot tight, one stopping 0.08s after the last
word and another starting 0.04s in, so the silence on both sides of three of the
four joins is worth two to five frames. What buys the rest is that at every join
one side is dead air, and a crossfade against silence is a trail-off or a soft
attack rather than two voices at once. Only 4 → 5 has real room on both sides,
which is why it is the only one that gets a proper 0.40s.

**If longer dissolves are wanted throughout, they have to be bought in the
shooting** — a held beat of silence at the top and tail of each take — because no
edit can manufacture it afterwards. The per-join measurements and the reasoning
for each length are written out in `tools/cut-ifop-explainer.sh`, which is what
reproduces the clip that shipped.

> The take now numbered 1 is a re-shoot. The original ran 1:50 and contained the
> whole explanation, which takes 3 and 4 then re-did word for word — splicing
> that version would have played the piece twice. **When takes arrive numbered,
> transcribe them all and read them side by side before assuming the numbers are
> an order.**

`integer-execution` is the other one assembled from more than one take:
`ieu-explainer1/2/3.mov`, joined with a 0.5 s crossfade at each seam. The three
are one continuous explanation recorded in three sittings, so the speech runs
straight across both joins and take 2 restarts the sentence take 1 ended on,
which leaves an `and` / `And` on either side of the first seam. The dissolve
blends them into one word rather than hiding a repeat, which is the reason a
crossfade is right here and a hard cut is not.

It also carries two lifts inside take 1. The first, at 50.90 to 51.60, takes the
"um" and the dead air after the laugh at "generation ... generation". **The laugh
itself stays** — it was asked for, and a 0.37 s beat is left after it so he lands
the joke rather than snapping to the next word. That splice is a 0.16 s dissolve
rather than a hard cut because `cut-fillers.py`'s own frame-difference rule
scores it 6.66 against a `JUMP_OK` of 4.0.

The second, at 53.58 to 56.10, takes the repeated clause out of "the previous
generation of AMD processors, the Zen 4, which had three address generation
units". The sentence has already given the number, so it now lands on "the Zen 4"
and comes back on "And, you know, we kind of saw a similar change". The in-point
is forced: there is no silence between "four" and "which", so the splice sits on
the decaying tail of "four" and takes a 0.08 s crossfade to keep that tail from
stopping dead. Here the dissolve is not hiding a jump — the frame either side
scores 1.94, well under `JUMP_OK` — it exists because `acrossfade` shortens the
audio by its own length and the video has to lose the same length to stay in
sync.

**It has not otherwise been filler-cut** — `tools/cut-fillers.py` has not been run
over it. `tools/cut-ieu-explainer.sh` is what reproduces the clip that shipped,
the same arrangement as `cut-ls-explainer.sh`.

The other four are cut for fillers, half the hesitations out of each — except
`scheduling`, which had none. `tools/cut-fillers.py` does it: it finds them,
picks the longest half, decides hard cut against dissolve by measurement, and
re-encodes. Run it with `--plan` first and read what it intends to remove.

`load-store` also lost two "essentially"s, which are words and not hesitations,
so no detector will find them. Its exact edit is kept as
`tools/cut-ls-explainer.sh` — that file, not the tool, is what reproduces the
clip that shipped.

**Where the files live.** Masters in `video-masters/` at the repo root, never
committed, ~200 MB each. Web encodes under `assets/video/`, tracked, because they
*are* the site. `.gitignore` spells the split out.

**The encode, and the part that is easy to get wrong.** The masters are **HLG HDR
in BT.2020**, which is what a phone shoots by default and never mentions. Encoded
straight to 8-bit H.264 the result does not error, does not warn, and is visibly
gray and desaturated on every normal display. It has to be tone-mapped first:

```sh
ffmpeg -i video-masters/<name>.mov   -vf "zscale=w=1280:h=720:f=lanczos:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"   -r 30 -c:v libx264 -profile:v high -level 4.0 -crf 22 -preset medium   -c:a aac -b:a 128k -ac 2 -movflags +faststart   meet-the-processor/assets/video/<slug>.mp4
```

Run `ffprobe` first and check `color_transfer`: `arib-std-b67` or `smpte2084`
means tone-map, `bt709` means it is already SDR and the chain can be dropped.
The `format=gbrpf32le` step is not optional — tone-mapping in integer space bands
the gradients.

**Cutting words out of a take.** None of these is the whole master any more.
Trim and splice in the same pass as the encode, `trim` → splice → tone-map, so
the expensive HLG chain runs once over the joined timeline rather than once per
piece. Two things fail if you skip them: every audio branch needs an explicit
`aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo` or
`acrossfade` dies with "Error reinitializing filters", and both `xfade` inputs
need `settb=1/30`, because `concat` hands on a 1/1000000 timebase and `fps=30`
hands on 1/30.

A hesitation glued onto the next word is **left alone**. `cut-fillers.py` only
removes a run that transcribes as nothing but the filler, because a run reading
"um and we" cannot be cut without taking the words with it. Expect a few
survivors for that reason, and do not read them as the detector having missed.

Aim the cut at the audio, not at a transcript. Whisper's word boundaries drift by
up to half a second on these takes, **and it deletes "um" and "uh" from its
output entirely**, even when asked for a verbatim read with a disfluent
`initial_prompt`. Hesitations therefore have to be found in the waveform: collapse
it into speech and silence runs, and the ones no transcribed word overlaps are
the candidates. Name each candidate by transcribing that run **on its own** —
whisper's text is reliable where its timings are not — and put the splice inside
a silence so no consonant is clipped. Re-transcribe the finished file afterwards
and check both the count and the words either side.

**Hard cut or dissolve is a measurement, not a judgment.** Extract the frame
that would play last before the cut and the one that would play first after it,
and take the mean absolute difference. On this take a still pose scored 0.9 to
2.7 and cut cleanly; 6.7 was a shift in the chair and 11.4 was a hand coming up
to his face, and both of those needed a 0.16–0.20s dissolve. A dissolve also has
to *fit*: it eats that long from the silence on each side, so a splice with 0.10s
of silence before it can only ever be a hard cut.

**720p is not a compromise here, it is the measurement.** The player renders
1268 × 714 device pixels on a 1440 laptop at DPR 2 and 1053 × 591 on a phone at
DPR 3, so a 1280 × 720 file is within twelve pixels of exact and 1080p would be
resampled away. It only loses in fullscreen. For reference, the same source at
1080p30 CRF23 is 45 MB and near-lossless 1080p60 is 356 MB, over GitHub's hard
100 MB limit.

`-movflags +faststart` puts the index at the front so playback starts before the
download finishes, and `preload="metadata"` on the element means none of the file
is fetched until somebody presses play.

The full reasoning, including the mistakes, is in the Obsidian build log for
2026-08-01.

`verify/cell-switch.py` drives the loop through a full period and checks all of
it: one device at a time, the gate following the NMOS, A and Y complementary, and
the pulse peaking low to high before the wire lights.

**Retiming the tail.** Stop 6 is 0.966 and stop 7 is 0.990, on legs of 11000 and
6500 ms. The fifth leg now carries four beats where the wire carried one: the rise
out of the stack, the bumps landing, the whole fold, and the reveal.

The keys from 0.902 to 0.966 are shaped as **one arc over the top** rather than a
rise followed by a fall. The first attempt reversed in all three axes at its apex,
and a monotone-cubic spline answers a simultaneous reversal with a zero tangent,
so the camera stopped dead in the middle of the fold — `camera-continuity.py`
measured 0.24 of the leg's median speed. `x` now climbs straight through the apex
while `y` and `z` turn over, and it reads 0.34. Check any change here with the
harness rather than by eye: a stall that brief reads as a stutter and is very easy
to talk yourself out of seeing.

`camera-pace.py` still reports this leg as a lunge at 2.97, peaking on the exit
from the stack at 0.918. That is **pre-existing** — the same key measured 3.12
before any of this — and it is the one thing in the tail still worth fixing.