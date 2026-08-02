# DESIGN.md — Inside the Die

Design specification for the scroll-driven Ryzen 5 9600X descent.
Written to be handed to a design tool (Stitch, Figma) **and** used as the
contract when merging generated UI back into `index.html` / `style.css`.

Scope note: this document covers the **2D interface only** — the chrome that
sits over the WebGL canvas. The 3D scene, its camera path and its materials
are defined in `scene.js` and are not a design deliverable.

---

## 1. What the product is

A single page. A fixed 3D viewport fills the viewport; scrolling drives a
camera descent through a real processor in seven stages, from the packaged
chip down to individual transistors. All interface elements float over that
viewport. There is no page scroll in the conventional sense — scroll position
is a timeline scrubber.

**Tone:** a technical instrument, not a marketing page. Restrained, precise,
confident. The photography is the hero; the interface should be almost
invisible until it is needed.

**Audience:** curious readers learning how a CPU is physically built. Assume
intelligence, not prior knowledge.

---

## 2. Design tokens

### Colour

| Token | Value | Use |
|---|---|---|
| `--void` | `#07080b` | Page and scene background |
| `--panel` | `#101319` | Detail panel surface |
| `--line` | `rgba(255,255,255,0.14)` | Hairlines, panel borders |
| `--text` | `#eef1f6` | Primary text |
| `--muted` | `#8d95a6` | Secondary text, specs, captions body |
| `--accent` | `#6B2FC9` | Brand purple (carried from the main site) |
| `--accent-lit` | `#a97bff` | Lit purple — active states, stage number, rail |

Die-region highlight colours (used in the 3D overlay; the UI may reference
them in a legend, but must not use them as interface colours):

| Region | Value |
|---|---|
| Zen 5 cores | `#ff5f42` |
| L3 cache | `#5b8cf0` |
| SMU / power management | `#f0a93a` |
| Test / Debug | `#9b6cf0` |
| IFOP PHY | `#38c9a0` |

**Rule:** the interface is monochrome plus purple. Region colours belong to
the die, never to buttons, borders or text.

### Type

| Token | Family | Use |
|---|---|---|
| `--font-ui` | Bricolage Grotesque → system sans | Headings, chrome |
| `--font-mono` | JetBrains Mono → ui-monospace | Labels, specs, stage index, facts |

Scale (desktop):

| Role | Size | Weight | Notes |
|---|---|---|---|
| Stage title | `clamp(1.55rem, 3.6vw, 2.4rem)` | 600 | Tight leading (1.1), `-0.015em` |
| Stage body | `0.97rem` | 400 | Leading 1.55, max 24rem measure |
| Stage index | `0.72rem` | 400 | Mono, `0.14em` tracking |
| Chip identity | `0.92rem` | 600 | |
| Spec strip | `0.72rem` | 400/500 | Mono, muted with `<b>` in `--text` |
| Leader label | `0.70rem` | 400 | Mono, `0.03em` |
| Panel title | `1.2rem` | 600 | |
| Panel body | `0.90rem` | 400 | Leading 1.6, `#c3cad8` |
| Panel kicker | `0.64rem` | 400 | Mono, uppercase, `0.16em`, accent-lit |
| Panel facts | `0.72rem` | 400 | Mono, two columns |

### Spacing & shape

- Edge padding: `clamp(1rem, 4vw, 2.6rem)`
- Panel radius `12px`; label radius `5px`
- Hairline borders only — no heavy strokes, no drop shadows except the panel
  (`0 24px 60px rgba(0,0,0,.6)`)
- Glass surfaces: `rgba(...)` fill + `backdrop-filter: blur(7–18px)`

---

## 3. Layout

Everything is absolutely positioned over a fixed full-bleed canvas.

```
┌────────────────────────────────────────────────────────┐
│ ● AMD Ryzen 5 9600X / Zen 5 CCD      70.6mm²  8.315B  ⋯ │  top bar
│                                                        │
│                                                     ▍  │  progress rail
│                  [ 3D VIEWPORT ]                    ▍  │  (right, vertical)
│                                                     ▍  │
│                                                        │
│  01 / 09                                               │
│  Stage title                                           │  caption block
│  Two or three lines of body copy.                      │  (bottom-left)
│                                                        │
│              ↓ SCROLL TO DESCEND · CLICK ANY LAYER     │  hint
└────────────────────────────────────────────────────────┘
```

- **Top bar** — left: status dot + chip name + subtitle. Right: three
  monospace spec pairs. Non-interactive. Sits over a top-down gradient scrim.
- **Caption block** — bottom-left, max 27rem. Sits over a soft radial scrim so
  it stays legible over bright silicon. Content swaps per stage.
- **Progress rail** — right edge, vertical, 2px, 34vh tall, fills with an
  accent gradient as scroll advances.
- **Hint** — bottom-centre, fades out after 3% scroll.
- **Detail panel** — right side, vertically centred, ~23rem wide. Appears on
  click. Never auto-opens.

### Scrims

The interface sits over photography that ranges from near-black to bright
silicon. Every text cluster needs its own scrim:

- Top bar: linear gradient, `rgba(7,8,11,.85)` → transparent, 190% of bar height
- Caption: radial gradient centred on the text, `.94` → transparent by 100%

These are essential, not decorative. Do not remove them.

---

## 4. Components

### 4.1 Leader-line label

A small monospace chip connected by a 1px line to a dot on the 3D object it
names. Positioned by projecting a 3D point to screen each frame.

- Idle: `rgba(10,12,17,.62)` fill, `--line` border, blurred backdrop
- Hover: border becomes `--accent-lit`
- Flips to the left of its anchor when past 62% of viewport width
- Optional muted suffix for a value (e.g. `L3 cache` + `32 MB`)
- Fades in/out over 0.35s; only labels relevant to the current stage exist

### 4.2 Detail panel

Opens on clicking a label, a die region, a metal layer, the lid, the pads or
either die.

```
kicker (mono, uppercase, accent)
Title
Body paragraph — 2–4 sentences, plain language, no marketing.
─────────────────────────
fact label            value
fact label            value
```

- Facts are a two-column definition list: label muted left, value right
- Dismiss: close button, clicking empty space, or Escape
- Desktop: right side, slides in from the right
- Mobile: bottom sheet, slides up, full width

### 4.3 Caption block

- Stage index in mono (`01` in accent-lit, `/ 09` muted)
- Title, then body
- On stage change: fade + 11px rise, 0.55s, body delayed 0.06s
- Must never animate while the user is mid-scroll in the same stage

---

## 5. Motion

| Element | Behaviour |
|---|---|
| Camera | Damped follow of scroll (lerp 0.075/frame) — never 1:1 |
| Caption | Fade + rise on stage change only |
| Labels | Opacity only, 0.35s |
| Panel | 0.35s slide + fade from the right (up, on mobile) |
| Rail | Height tracks scroll directly, no easing |

**`prefers-reduced-motion`:** camera snaps instead of easing; caption swap,
panel animation and looping decorations (pulse, bob) are disabled. The
experience must remain fully usable.

---

## 6. Responsive

| Breakpoint | Changes |
|---|---|
| ≥ 861px | Full layout as above |
| ≤ 860px | Spec strip hidden; caption full width above the hint, smaller type; rail shortened to 24vh; panel becomes a bottom sheet; labels 0.62rem |

The 3D viewport always fills the screen. Never letterbox it.

---

## 7. Accessibility

- Body text ≥ 4.5:1 against its scrim, not against the raw photograph
- Labels and the panel close button are real `<button>`s, keyboard reachable
- Panel is dismissible with Escape
- The 3D canvas is decorative-with-content: every fact stated visually is also
  reachable as text in a panel
- Do not rely on the region colours alone to convey meaning — each coloured
  region also carries its name

---

## 8. Content inventory

Seven stages, in order:

1. **The packaged chip** — the AM5 package under its nickel lid
2. **Bare silicon** — the lid rises away, both dies, raking light across the
   polished die backside
3. **The floorplan beneath** — regions reveal, then settle to outlines
4. **Inside one core** — L1d, L2, vector, load/store, fetch/decode
5. **The metal stack** — 15 copper tiers separate upward
6. **The cell rows** — the stack folds back down into a ceiling, M1 turns to
   glass, and a field of standard cells shows through the floor
7. **One cell, one gate** — one tile resolves into a CMOS inverter and switches

Clickable subjects with panels: heat spreader, I/O die, compute die, Zen 5 core,
L3 cache, SMU / power management, Test / Debug, IFOP PHY.

The metal tiers and the transistors are **not** clickable, though `SUBJECTS`
carries copy for both, parked in `SUBJECTS_UNWIRED`. `pick()` raycasts only the
two tile groups and gates on a tile record with a `.side` material; the stack and
the cell field have no such record, so wiring them up means a second path in
`pick()` and teaching `updateHints()` about a third population. It is the obvious
next move now that the last two stops are each about one nameable object, and it
is its own piece of work.

---

## 9. Constraints

- **Self-contained.** No CDN, no webfont fetch, no external requests of any
  kind. Fonts fall back to system stacks by design.
- **No new dependencies.** Vanilla HTML/CSS/JS only; three.js is vendored.
- **Isolated.** This folder imports nothing from `/styles` or `/scripts` and
  nothing on the live site links to it.
- Generated markup must be mergeable into the existing `index.html` element
  IDs: `#stage #gl #leaders #labels #chrome #caption #cap-num #cap-title
  #cap-body #rail #rail-fill #hint #panel #panel-kicker #panel-title
  #panel-body #panel-facts #panel-close`.
