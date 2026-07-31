# Inside the Die — scroll-driven CCD descent (prototype)

A scroll-driven 3D descent through the compute die of an **AMD Ryzen 5 9600X**.

Open `prototypes/cpu-layers/index.html` **through a local web server**, not by
double-clicking it. ES modules and the import map will not load from `file://`.

```
python prototypes/cpu-layers/serve.py
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

**Symptom to remember: new behaviour, old appearance.** It is almost always this.

## Isolation

This folder is completely self-contained and **cannot affect the live site**:

- imports nothing from `/styles` or `/scripts`
- no page on the site links to it
- `<meta name="robots" content="noindex, nofollow">`
- deleting `prototypes/` removes it entirely

## The nine stages

| # | Stage | What happens |
|---|-------|--------------|
| 01 | The packaged chip | The AM5 package under its nickel lid, slowly settling square |
| 02 | Underneath | Flips over to the 1718 gold LGA contact pads |
| 03 | Bare silicon | The IHS rises and drifts away, both dies are revealed, and the camera comes to eye level beside them |
| 04 | The floorplan beneath | Delayers, then regions bloom in as flat colour; parks with every region up and fully filled |
| 05 | Inside one core | Descends into the bottom-left core; its 29 blocks rise as glass slabs a beat at a time, in the order an instruction meets them, while the camera orbits low |
| 06 | The metal stack | 15 graded copper tiers cascade apart from the bottom up, a pulse of light climbs them, and the camera flies in among them |
| 07 | Down to the transistors | FinFET fins with gates crossing over them |

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
- **Region highlights** — colour fill that blooms in, then settles to a glowing
  outline — for anything that is an *area of a die*: the floorplan's cores, L3
  and bottom strip, and now the blocks within a single core too.

### The region highlight

During stage 06 the regions reveal in sequence — the eight cores, then L3,
then the SMU/IFOP strip — as flat colour fills that mimic the annotated
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

### The blocks inside one core

Stage 07's regions are **traced by hand**, in `trace.html`, and used verbatim.

Three rounds of deriving them automatically each landed close but wrong: from
the annotation's colour washes, from rectangles snapped to the die's white
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

**Snap flush to neighbours.** Traced edges are axis-aligned, so an edge is
(orientation, coordinate, span). It snaps onto an existing edge only when that
edge is parallel, within **0.008 uv**, *and their spans overlap* — without the
overlap test a distant edge sharing a coordinate would drag it sideways.
Load/store arrived 0.0015-0.0044 off L1d on three edges; integer execution 0.0007-0.0045 off on four.

> Not every near-miss is a neighbour. The L2 halves sit 0.0063 from Load/store,
> inside tolerance, but the 13 px between them is array texture — the L2$
> control and interconnect column, which the reference names as its own region.
> Snapping there would erase a real block, so check what is in the gap before
> closing it.

**Verify with erosion, not raw intersection.** Flush regions share boundary
pixels, so the raw masks overlap by a few hundred pixels even when correct.
Erode each by 1 px first: across all five regions that gives **0 px** of real
overlap.

**Fit the label to the shape.** The anchor stored per region maximises an
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
holds the real contour plus the platform square, both in millimetres about the
lid centre, produced by boundary-tracing the cleaned lid mask at 1024 px,
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

So: threshold → 28 px erode → flood-fill from the centre → 28 px dilate.

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
out into every fin**, stopping only where the grey changes: each outer edge
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

The two greys are separated by finish, the same way the platform was found in
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
2–23 where the substrate a few millimetres away reads 83.

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
worst case 0.010 mm, which is 2 px of quantisation.

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

| tab | width | reach beyond the square | centre |
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
replaced by its nearest metal colour, which decouples silhouette from texture:
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
in the piece that was a diagram being coloured in — one stage after the
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
a set instead of jumping around the core.

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
point. 21 entries become 22 beats over 29 blocks.

**A name has to fit on one piece.** Vector execution was one region carrying
both of its columns, with `fit: false` so the fitter would not reject a centre
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

**No settle to outline, unlike the floorplan.** A block takes its colour when it
rises and keeps it until the whole core clears with the die surfaces. The
floorplan hands the silicon back because its regions are read once and then get
out of the way for the descent into a core; this stage is building a picture of
a datapath, and a block that has faded to a rim is no longer part of it.

That also means the core builds no outline canvas at all — the `fill` canvas is
self-contained (colour flood, white boundary stroke, name plate), and stacking
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
which of its arms is nearest, so a small neighbour's edge drew over it from some
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
| fill / outline caps | 45, 46, 50 | colour and name, last |

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

Boundaries here are measured flush on purpose — neighbouring regions share an
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
> coloured edges and **no cap at all**, silently losing its fill and its name.
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

| source | chord | depth | centre, from mid-edge |
|---|---|---|---|
| retail photo, top edge | 2.23 mm | 1.04 mm | −2.77 mm |
| retail photo, bottom edge | 2.26 mm | 0.98 mm | −2.79 mm |
| `substrate.jpg` | 2.25 mm | — | −2.81 mm |

Modelled as a true half circle, r = 1.125 mm at x = −2.78 mm. The package is
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

Below 1 LSB the two surfaces quantise to the *same* value. The crossover falls
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
  wiring is a few micrometres tall on a die millimetres wide; at true scale it
  would be invisible. Horizontal proportions are to scale.

## Assets

Textures in `assets/` are downscaled crops of the reference photography in
`../../../cpu-model-hunt/reference-images` (outside this repo):

| File | Source | Used for |
|------|--------|----------|
| `ihs-photo.jpg` | lid photo, cropped to the measured lid bbox | source for `ihs.jpg` |
| `ihs.jpg` | the above, edge-extended past the metal | stages 01–03 |
| `pads.jpg` | package underside | stage 02 |
| `substrate.jpg` | delid, cropped to the 40 mm package | stages 03–05 |
| `die-backside.jpg` | delid, true colour | stages 03–05 |
| `iod-backside.jpg` | delid, cropped to the I/O die | stages 03–06 |
| `die-floorplan.jpg` | straightened delayered CCD | stages 06, 08 |
| `core-detail.jpg` | crop of the bottom-left core | stage 07 |

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

> **Check before this ever ships publicly:** confirm the licence/attribution
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
cannot be desaturated toward tungsten by any colour you choose. The wire colour
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
top and metres from a plane — chaos, not emergence. 0.918 clears the footprint
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
| 2 | 0.130 | `flipTo` completes at 0.118 and `flipBack` starts at 0.142, so this is the only window where the package is fully and steadily inverted |
| 3 | 0.398 | a camera key: the composed eye-level bare-silicon shot |
| 4 | 0.512 | `groupIn.strip` completes at 0.512 and `toOutline` starts at 0.512 — the single instant every macro region is up and none has begun settling to an outline |
| 5 | 0.800 | `blockIn` reaches 1 at exactly 0.560 + 0.240 |
| 6 | 0.888 | a camera key, level and side-on among the tiers. **Not** the 0.902 key further in: there the camera sits 0.12 under a tier and it fills the frame |
| 7 | 0.976 | a camera key, after `fetIn` completes at 0.962 |

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
- **Bar colour is graded on the material**, tungsten-grey at M1 to copper at the
  top. This is the tint that could not work on the plane: a material colour
  multiplies, so it can never desaturate an already orange texture toward grey.
  With no map to fight, the same grading finally works as a colour.
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
it", and its left rule takes the block's own colour so it reads as belonging to
that slab rather than as page chrome that happened to appear. It rides the
cursor on hover — and the attract pass raises the *same chip* over the block it
is demonstrating, which is the point: the demo now teaches the click and not
merely the hover, and it still adds nothing to the scene itself.

Three consequences worth knowing about:

- **`attractLevel` now gates on `selectable`.** It never did, so the demo ran its
  three slots at *every* stop, lifting slabs whose opacity was zero. Invisible
  and harmless — right up until the tag started naming whatever the demo had
  claimed and cheerfully labelled an L1D Cache in the middle of the metal stack.
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
than a condition, so it goes behind a labelled toggle — and the moment it is
behind a toggle it can be set at 0.74rem, a size somebody might actually read.

What that buys: the corner shrinks from four lines to one; the long text becomes
legible instead of merely present; and the phone gets all of it for the first
time, in a panel centred on the viewport.

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

## Stage 06: one net, end to end

The metal stack stage shows fifteen layers of copper and says what each is for.
The question it leaves is the one this stage answers: given all that, how does a
signal actually get from one transistor to another?

So a single net is traced through the stack, and every property of it is a
consequence of something the stack stage already established:

- A run on tier *i* travels along **that tier's own routing axis** — the same
  even-x/odd-z alternation the bars use. That is why the path is a staircase in
  plan as well as in height: it cannot turn a corner without changing layer,
  which is precisely why real stacks alternate.
- The wire **thickens as it climbs**, on the same curve the bars grade on.
- It spends its length at the bottom on short hops, climbs a **via stack to
  M11** for one long haul across the die, and comes straight back down. That is
  what a router actually does, and it is the reason the upper layers are fat.

Two independent things happen to it, and keeping them separate is what makes the
stage read. The net **draws itself**, once, along its own length, as the camera
arrives; then a bead **runs it**, on a loop. The gradient alone reads as
decoration — the bead is what makes it a signal that arrives somewhere.

Five things that had to be got right:

- **The draw is a scale ramp, not a fade.** A piece not yet laid must be
  *absent*, not dark: a black wire blending over the stack behind it is a ghost
  of the path, and it gives the ending away.
- **The dimming LEADS the wire.** A first pass tied it to `routeA`, so the stack
  was at full brightness through the first half of the draw — and unlit copper
  against lit copper sheets is invisible. The route quietly laid half its length
  where nobody could see it and then appeared to blink into existence. `dimA`
  now completes at 0.932, before the draw is half done. It is also the better
  beat: the stage goes quiet, and *then* one thing lights.
- **The stack dims to 26%, not to nothing.** The shot is a wire seen passing
  *through* fifteen layers. A wire alone in an empty volume is a diagram of
  nothing. The travelling pulse does go almost all the way out, because two
  lights climbing the same stack at different speeds is just confusing.
- **The look-at is 1.5 units left of the route's own centre.** The caption owns
  the bottom-left of the frame at every stop and this route begins in the far
  corner of the die: aimed at its centre, the first three hops projected
  straight through the title. The low pin moved to the *descending* zig-zag for
  the same reason, and it is where the bead arrives, so it is where the eye is.
- **Long runs are cut into 0.26-unit boxes.** The glow has to be a gradient along
  the wire; a whole five-unit segment flashing at once is a lamp, not a signal.

The net's colours run past 1.0 on purpose — ACES rolls them off into a hot
highlight rather than clipping, the same lesson the copper pulse learned at 2.3.

**Retiming the tail.** The stop is a camera key at 0.944, chosen where `routeIn`
has finished and `routeOut` has not begun: the whole path up, none of it fading,
the same rule stop 4 is pinned by. Everything downstream moved out from under it:
`stackOut` 0.930 to 0.948, `fetIn` 0.932 to 0.950, and the two transistor keys by
0.006 and 0.002, with `fetIn` still complete before stop 7. Its leg is 8000 ms
rather than the 6500 the old stack-to-transistors leg had, because it is a leg
that has to teach something: a route drawn faster than it can be followed is a
squiggle. `camera-speed.py` reads 375, 337, 352, 313, 292, 202, 167 across the
tail, so it still decelerates the whole way into the transistors.
