# Silicon From Scratch — Style Guide

A "golden set" of reusable UI patterns for this site. When building one of these
things, copy the pattern here **exactly** — same classes, markup shape, and
behavior — so every instance looks and works the same across pages.

Base design tokens (`--accent`, `--soft-ink`, `--paper`, `--ink`, `--hairline`,
`--radius`, `--ease`, `--font-mono`, `--font-display`, `--font-body`,
`--space-*`) live in `styles/main.css` and are assumed available.

---

## Mobile parity (applies to every widget here)

**Every interactive widget must fit and read the same on phones as on desktop** —
the same layout intent, fonts, colours, and spacing, just adapted to the narrower
screen. **Adapt, don't degrade or hide.** Concretely:

- **Reflow, don't drop.** Stack multi-column layouts into a single column in a
  sensible reading order; keep every element that's present on desktop.
- **Contain overflow.** A wide diagram/table/editor scrolls **horizontally inside
  its own panel** (`overflow-x: auto` + a sensible `min-width`) — the *page* must
  never scroll sideways.
- **Scale, don't shrink to nothing.** Size type, padding, and gaps with `clamp()`
  so things get smaller gracefully and stay legible/tappable (mind ~44px touch
  targets).
- **Keep it usable.** Every control reachable on desktop stays reachable on
  mobile. (Editable code textareas may go read-only on touch — that's a
  usability choice, not a removal; the widget is still fully viewable.)

Nothing visible or usable on desktop should be missing or broken on mobile. After
touching any widget, verify it at real phone/tablet widths — the `mobile-guardian`
agent renders each page at those widths, spots narrow-screen breakage, and repairs
the CSS.

---

## Section headings

The house section-header look — used by **YOUR PATH** and **HANDS ON**. Mono,
uppercase, wide tracking, a short purple tick before the text, sized up from a
normal kicker and rendered in soft-ink (not the accent purple; only the tick is
purple).

**Always build a section heading this way.** Apply `.section-title` alongside
`.kicker` — `.kicker` supplies the mono/uppercase/tracking + purple tick, and
`.section-title` bumps the size and recolors the text to soft-ink.

### Markup

```html
<div class="section__head">
  <p class="kicker section-title" id="SECTION-title">Your heading</p>
</div>
```

- Write the text in normal title case (e.g. `Hands on`); `text-transform:
  uppercase` renders it as `HANDS ON`.
- Give the `<p>` an `id` and point the section's `aria-labelledby` at it.
- Do **not** add a separate `<h2>` beneath it — this single styled line *is* the
  section header.

### CSS (already in `styles/main.css`)

```css
/* Standard section header: the "Your Path" treatment, made reusable. Apply
   alongside .kicker (so it keeps the mono uppercase + purple tick), bumping the
   size up and the text to soft-ink. This is THE section-header font style. */
.section-title {
  font-size: clamp(1.15rem, 1.6vw, 1.35rem);
  color: var(--soft-ink);
}
```

> Note: `.buildpath__title` (the "Your Path" label) is the same look but carries
> extra width/padding tuned to the path column. For general section headers use
> `.section-title`, not `.buildpath__title`.

---

## Lesson headers

The top of a lesson page — everything from the lesson title down to (but not
including) the first content section (e.g. "1's and 0's"). **Every lesson must
open with this exact header.** Reference implementation: `alu/logic-gates/index.html`
(the "Logic Gates & the 1-bit ALU" hero).

It's the `.doc-hero.doc-hero--balanced` block and has four parts:
1. **Lesson title** — eyebrow style (mono, uppercase, tracked, soft-ink, purple
   tick), *the same face as* `YOUR PATH` / `HANDS ON`, via `h1.title-eyebrow`.
2. **Intro paragraph** — `.doc-hero__lead`.
3. **Picture on the right** (user-provided) — `.doc-hero__art`, a paper card.
4. **"Think you got this already?" + Skip to Check Yourself** — `.doc-hero__actions`.

Desktop: title + lead + actions in a left column, picture on the right, centered
as a unit. Mobile: stacks in reading order — title, picture, lead, actions.

**The lesson page must load `styles/main.css` *and* `styles/alu.css`** (the
`.doc-hero*` / `.title-eyebrow*` rules live in `alu.css`).

### Markup

```html
<section class="doc-hero doc-hero--balanced container" aria-labelledby="LESSON-title">
  <div class="doc-hero__text">
    <h1 id="LESSON-title" class="title-eyebrow"><span class="title-eyebrow__text"><span class="title-eyebrow__group">First half &amp;</span> <span class="title-eyebrow__group">second half</span></span></h1>
    <p class="doc-hero__lead">
      One-paragraph intro to the lesson. Use <strong>bold</strong> for key terms.
    </p>
    <div class="doc-hero__actions">
      <span class="doc-hero__prompt">Think you got this already?</span>
      <a class="btn btn--primary" href="#check">Skip to Check Yourself</a>
    </div>
  </div>

  <figure class="doc-hero__art">
    <img src="PATH/TO/title-image.jpg" alt="Describe the lesson's title image." decoding="async" />
  </figure>
</section>
```

Rules:
- Title text goes inside `.title-eyebrow__text`, split into `.title-eyebrow__group`
  spans that each never break internally — so the title either sits on one line or
  breaks cleanly *between* the groups (e.g. `Logic Gates &` / `the 1-bit ALU`),
  never mid-phrase. Split at a natural seam (usually around the `&`/"and").
- Give the `<h1>` an `id` and point the section's `aria-labelledby` at it.
- The picture is provided by the user; keep it in the `figure.doc-hero__art` card
  and always write meaningful `alt` text.
- The skip button links to `#check` (the Check Yourself section's `id`). Prompt
  text stays exactly `Think you got this already?`.
- The section carries the `container` class alongside `doc-hero doc-hero--balanced`.

### CSS — Desktop (in `styles/alu.css`)

```css
.doc-hero {
  padding-block: clamp(var(--space-6), 10vw, var(--space-7))
                 clamp(var(--space-5), 7vw, var(--space-6));
  max-width: 80rem;
  display: grid;
  grid-template-columns: minmax(0, 36rem) minmax(0, 1fr);
  gap: clamp(var(--space-3), 4vw, var(--space-5));
  align-items: center;
}
.doc-hero__text { max-width: 36rem; }

/* Wide screens: nudge the whole hero a little left of centre. */
@media (min-width: 1344px) {
  .doc-hero { transform: translateX(-2rem); }
}

/* Balanced variant (the lesson header): text + picture as a tight unit, centred. */
.doc-hero--balanced { margin-inline: auto; max-width: 88rem; }
@media (min-width: 769px) {
  .doc-hero--balanced {
    grid-template-columns: minmax(0, 46rem) minmax(0, 44rem);
    justify-content: center;
  }
  .doc-hero--balanced .doc-hero__text { max-width: none; }
}
@media (min-width: 1344px) {
  .doc-hero--balanced { transform: none; }   /* no leftward nudge on the balanced hero */
}

/* Picture: on a paper card to read as a deliberate panel. */
.doc-hero__art {
  margin: 0;
  background: var(--paper);
  border: 1px solid var(--hairline);
  border-radius: var(--radius);
  padding: clamp(var(--space-3), 4vw, var(--space-4));
  box-shadow: var(--shadow-soft);
}
.doc-hero__art img { width: 100%; height: auto; border-radius: var(--radius-sm); }

.doc-hero h1 { margin-bottom: var(--space-3); }
/* Eyebrow-style lesson title — the same face as YOUR PATH / HANDS ON. */
.doc-hero h1.title-eyebrow {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: clamp(1.15rem, 1.6vw, 1.35rem);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: var(--soft-ink);
  line-height: 1.35;
}
.doc-hero h1.title-eyebrow::before {
  content: "";
  flex: none;
  width: 1.5rem;
  height: 1px;
  background: var(--accent);
}
.title-eyebrow__group { white-space: nowrap; }
.title-eyebrow__text { min-width: 0; text-align: center; }

.doc-hero__lead {
  font-size: 1.25rem;
  color: var(--soft-ink);
  margin-bottom: var(--space-4);
}
.doc-hero__lead strong { color: var(--soft-ink); }   /* muted bold, matches prose */
.doc-hero__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}
.doc-hero__prompt { color: var(--soft-ink); }

/* Balanced hero: centre the title, lead, and actions. */
.doc-hero--balanced h1.title-eyebrow { justify-content: center; }
.doc-hero--balanced .doc-hero__lead { text-align: center; }
.doc-hero--balanced .doc-hero__actions { justify-content: center; }
```

### CSS — Mobile (`@media (max-width: 768px)`, in `styles/alu.css`)

```css
@media (max-width: 768px) {
  /* Stack the hero; pin the top padding so it clears the fixed 42px topbar. */
  .doc-hero {
    grid-template-columns: 1fr;
    gap: var(--space-4);
    padding-block-start: 4.5rem;
  }
  .doc-hero--balanced { padding-block-start: 5.5rem; }   /* a touch more clearance */
  .doc-hero__text { max-width: none; }
  .doc-hero__art { max-width: 340px; margin-inline: auto; }

  /* Stack in reading order: title, image, paragraph, buttons. Promoting the text
     block to display:contents lets the image (a sibling of .doc-hero__text) slot
     between the title and the lead via `order`; the grid gap drives the spacing. */
  .doc-hero--balanced .doc-hero__text { display: contents; }
  .doc-hero--balanced .title-eyebrow { order: 1; margin-bottom: 0; }
  .doc-hero--balanced h1.title-eyebrow::before { display: none; }   /* drop tick so title centres */
  .doc-hero--balanced .doc-hero__art { order: 2; }
  .doc-hero--balanced .doc-hero__lead { order: 3; margin-bottom: 0; }
  .doc-hero--balanced .doc-hero__actions { order: 4; }
  .doc-hero__lead { font-size: 1.1rem; }
  .doc-hero__actions .btn { flex: 1 1 auto; justify-content: center; }
}
```

---

## Editable Verilog flip card

A flip card whose front shows a hand-drawn sketch and, on click, flips to an
**editable Verilog editor** with a live simulation bar (input toggle chips + the
computed output). Reference implementations: `alu/logic-gates/index.html` (the
gate cards + the 1-bit ALU) and the home Hands On section (`index.html`, the
gated D-latch, whose front cross-fades two images).

**Powered by two shared scripts — never re-implement the logic inline:**
- `scripts/verilog-mini.js` — a small Verilog parser + 1-bit evaluator + syntax
  highlighter (`VerilogMini.compile(src)` / `VerilogMini.highlight(src, err)`).
- `scripts/gate-card.js` — wires up **every** `.gate-card` on the page (flip,
  editor, chips, output value, output-name label, red squiggle on errors) and
  runs the `.latch-swap` image cross-fade. It auto-inits all cards; you just add
  the markup.

A page with a flip card must load, in this order (after the page's other JS):
```html
<script src="scripts/verilog-mini.js" defer></script>
<script src="scripts/gate-card.js" defer></script>
```
(and the `.gate-card*`, `.code-editor*`, `.gate-sim*`, `.tok-*` CSS — in
`styles/alu.css` for ALU pages, duplicated in `styles/main.css` for the homepage.)

### To add a card

Copy a `.gate-card` block from a reference page. The moving parts:
- `data-control="clk"` (optional) on `.gate-card` — names the control/enable
  signal(s); those chips are tinted blue, data inputs stay purple.
- Front: a `figure.gate-card__face--front` (keep the `figure` class so it reveals
  on scroll) with the sketch + a `figcaption` + the flip arrow. For a cross-fade
  front, use two `.latch-swap__img` (first one `is-active`).
- Back: the `.code-editor` (highlighted `<pre class="code-editor__hl">` underlay
  + editable `<textarea class="code-editor__ta">` with the same code) and a
  `.gate-card__backrow` holding `.gate-sim` (`.gate-sim__inputs` +
  `.gate-sim__out` with `.gate-sim__lhs` / `.gate-sim__val`) and the return button.
- The `<pre>` underlay is just a no-JS fallback; `gate-card.js` re-highlights it
  live, so it doesn't need hand-maintained token spans (but keep it consistent).

### Supported Verilog subset (what `verilog-mini.js` accepts)

Everything is **1-bit** (numbers are evaluated as their least-significant bit).
Anything outside this subset is reported as an error with a precise source span,
which the editor draws as a red wavy underline (`.tok-err`); the output shows `—`.

- optional `module name ( ansi_ports ); … endmodule`, **or** bare declarations +
  statements with no module wrapper (the simple gate cards).
- declarations: `input`/`output`/`inout` and `wire`/`reg`/`logic`, with optional
  `[msb:lsb]` range (parsed, treated as 1-bit) and comma lists.
- `assign lhs = expr;` (continuous), including on internal `wire`s — values settle
  to a fixpoint, so chained assigns work.
- `always @(*)` / `@*` / `@(list)` with `begin…end`, `if/else`, and blocking `=`
  or non-blocking `<=`. An `always` that doesn't assign its target (e.g.
  `if (clk) q = d;` with `clk` low) **holds** its previous value — that's the latch.
- expressions: `?:` `||` `&&` `|` `^` `&` `==` `!=` `===` `!==` `< <= > >=`
  `<< >>` `+ -`, unary `~ ! -` and reduction `& | ^`, parens, identifiers, and
  numbers (`0`, `1`, `1'b0`, `4'hF`, …).

Not supported (reported as errors): multi-bit arithmetic/buses beyond 1 bit,
`case`, `for`/`generate`, module instantiation, tasks/functions, `initial`, real
sequential clocking semantics. Keep card examples inside the subset.

### Flipping back
Clicking the **front** flips to the editor. To flip **back**, the reader clicks
anywhere on the back card's **frame** — the padding/border around the editor,
including the empty space by the return arrow (and the arrow itself). Only the
interactive `.code-editor` and `.gate-sim` boxes are exempt (a click there edits
code or toggles a chip; it never flips). This is wired in `gate-card.js` as one
delegated listener on `.gate-card__face--back`:

```js
back.addEventListener("click", function (e) {
  if (e.target.closest(".code-editor, .gate-sim")) return;
  flipTo(false);
});
```
Because the whole frame is the target, the return `<button>` no longer needs its
own handler (its mouse/keyboard clicks bubble up and flip back).

Hover feedback mirrors the front: hovering the frame **grows the whole card a
touch** (`.gate-card__face--back:hover { transform: rotateY(180deg) scale(1.045) }`
— the same `1.045` the front uses before its flip), *not* a highlight on the
return arrow. A `:has(.code-editor:hover, .gate-sim:hover)` guard cancels the grow
while the pointer is over the interactive boxes, which also keep `cursor: auto`.
The arrow is a static affordance only — it has **no** hover style.

### Behaviour notes
- The output **label** (`.gate-sim__lhs`) follows the declared `output` port, so
  renaming the output in the code updates it.
- The output **value** is driven by the parsed logic, so changing the functions
  (e.g. `&` → `|`) is reflected live; input chips toggle the values.
- `reg` state persists across chip toggles (so a latch actually remembers a bit).

### Testing
`verilog-mini.js` and `gate-card.js` are plain ES3-style modules that also run
under Windows `cscript` (JScript). They can be unit-tested headless by
concatenating the module with a test script and running `cscript //nologo`.

---

## ALU datapath explorer

An interactive 1-bit ALU schematic: the reader picks a named operation (or flips
individual `control[3:0]` bits) and the **active datapath lights up** on an inline
SVG. Reference implementation: the ALU page's `#explore` section
(`alu/index.html`). It also appears, restyled as a single card, in the home Hands
On grid (`index.html`).

**Powered by one shared script — never re-implement the schematic or wiring:**
- `scripts/alu-widget.js` — builds the entire SVG schematic (two ALU slices + the
  carry/`less` wiring) and wires the control panel. Highlighting is driven by
  three things in the script, the **only** places to edit behaviour: `NAMED_OPS`
  (friendly names → 4-bit codes), `deriveActiveIds()` (code → the SVG element ids
  to light — the single source of truth), and the generated `OPS` table.
- `styles/alu-widget.css` — all the base `.alu-*` styles.

The script keys off the single id `alu-widget`, so **one widget per page**. Load
the stylesheet in `<head>` and the script deferred before `</body>`:
```html
<link rel="stylesheet" href="styles/alu-widget.css" />
<script src="scripts/alu-widget.js" defer></script>
```

### Required hooks

`alu-widget.js` looks these up by id/class — keep them exactly:
- `#alu-widget` — the container.
- `#alu-diagram` — an **empty** `<svg viewBox="0 0 685 970">`; the script draws
  into it (give it `role="img"` + an `aria-label`, and a `<noscript>` fallback).
- `#alu-op-name` / `#alu-op-bits` — the readout's operation name + bit string.
- `.alu-widget__live` — an `aria-live="polite"` `<p>` for the screen-reader path
  description.
- `.alu-preset[data-code="N"]` — preset buttons; `data-code` is the **decimal**
  value of `control[3:0]`.
- `.alu-bit[data-bit="k"]` each wrapping a `.alu-bit__val` — the four control-bit
  toggles; `data-bit` is the bit position (`3`=Ainvert, `2`=Bnegate, `1:0`=Operation).

### Markup — the control panel (the stable part)

The SVG stage is just the empty `#alu-diagram`; the panel is what you copy:

```html
<div class="alu-widget" id="alu-widget">
  <!-- …layout wrapper(s): see the two layouts below… -->
  <aside class="alu-panel">
    <div class="alu-readout" aria-hidden="true">
      <span class="alu-readout__label">Operation</span>
      <span class="alu-readout__name" id="alu-op-name">add</span>
      <span class="alu-readout__bits" id="alu-op-bits">0010</span>
    </div>
    <div class="alu-controls__group" role="group" aria-label="Named operations">
      <span class="alu-controls__label">Presets</span>
      <div class="alu-presets">
        <button class="alu-preset" type="button" data-code="0"  aria-pressed="false">AND</button>
        <!-- OR=1, add=2, subtract=6, slt=7, NOR=12, NAND=13 -->
      </div>
    </div>
    <div class="alu-controls__group" role="group" aria-label="Control bits">
      <span class="alu-controls__label">control[3:0]</span>
      <div class="alu-bits">
        <button class="alu-bit" type="button" data-bit="3" aria-pressed="false" aria-label="control bit 3, Ainvert">
          <span class="alu-bit__name">Ainv</span><span class="alu-bit__val">0</span>
        </button>
        <!-- data-bit 2=Bneg, 1=Op1, 0=Op0 -->
      </div>
    </div>
    <p class="alu-widget__live" aria-live="polite"></p>
  </aside>

  <div class="alu-widget__stage">
    <svg id="alu-diagram" viewBox="0 0 685 970" role="img"
         aria-label="ALU datapath schematic. Choose an operation to highlight the active path."></svg>
    <noscript><p class="alu-noscript">This interactive diagram needs JavaScript.</p></noscript>
  </div>
</div>
```

### The two layouts

- **ALU page (`#explore`) — the default.** `.alu-widget` is a two-column grid: a
  `.alu-side` column (a `.section__head` + a `.prose` intro + the `.alu-panel`)
  beside the `.alu-widget__stage`. Pure `styles/alu-widget.css`; no extra rules.
- **Home Hands On grid — one card.** In `.handson-grid` the datapath and panel
  share **one paper card styled exactly like the Check Yourself card** (see that
  entry). Because the schematic is drawn with dark ink/idle colours, the stage
  keeps its own **white plate** (a light-token override) so it stays legible on
  the dark theme, while the panel sits transparently on the card and a hairline
  divides them. All of this lives in `styles/main.css` under
  `.handson-grid .alu-widget*` — copy that block if you place the widget in
  another dark-themed card. Note there's no `.alu-side` here (no heading/intro);
  the stage is the first child, the panel the second.

### Self-contained

To remove the widget, delete its `<section>`/card, the `alu-widget.css` `<link>`,
and the `alu-widget.js` `<script>` — nothing else depends on it.

---

## Interactive waveforms (timing diagrams)

The house style for **any digital timing-diagram / waveform** widget: a
signal-name panel on the left, a time scale across the top, and colour-coded step
traces on the right, all on the standard card. Reference implementation: the
"Interactive Waveforms" widget in the home Hands On grid (`scripts/aluwave.js` +
the `.aluwave` / `.awv-*` rules in `styles/main.css`). What follows is the
reusable *style* — the specific signals/logic of any one diagram are not part of
the pattern.

### Layout

- **Card.** The whole widget rides the standard paper card (same as Check
  Yourself / the datapath): `var(--paper)` background, `1px solid var(--hairline)`,
  `var(--radius)`, `var(--shadow-soft)`, `clamp(var(--space-3), 4vw, var(--space-4))`
  padding, as a vertical flex stack.
- **Optional sketch on top.** A hand-drawn schematic or photo sits on its own
  **white plate** (`background:#fff; border:1px solid rgba(35,35,42,0.12);
  border-radius:var(--radius-sm)`) — white so dark ink-art stays legible on the
  card, exactly like the datapath's schematic plate.
- **Scope panel.** The diagram itself is **transparent on the card with a top
  hairline divider** (`border-top:1px solid var(--hairline)`), mirroring the
  datapath's control panel — *not* a white plate. It is one inline `<svg>`
  (`viewBox`, `width:100%`, uniform scale) holding everything below.
- Inside the SVG: a **signal-name panel on the left** (a "Signal" header + one row
  per signal) separated from the traces by a **vertical hairline bar**, a
  **horizontal hairline under the header**, and **faint horizontal separators
  between rows** — it reads like a compact scope/GTKWave table.

### Fonts

- **Labels + signal names** (the "Signal" header, the row names): `var(--font-mono)`,
  ~10–11px; header labels `font-weight:600`, `letter-spacing:~0.06em`.
- **Time-scale numbers**: `var(--font-display)` (the friendly grotesque, *not*
  mono) — deliberately less "techy" than the surrounding labels.

### Colours (role-coded, tuned for the dark card)

Every signal is coloured by **role**, in tones that read on the dark panel — the
signal's name, its trace, and its bead all share the one colour:

- **Data inputs** → light purple `#b794f6` (the dark-theme accent).
- **Control signals** → light blue `#60a5fa`.
- **Outputs** → `#d4bbff` (the same lavender as the flip card's output-value
  number, i.e. `--accent-deep` on dark).

Neutral chrome comes from tokens: dividers `var(--hairline)`; gridlines + row
separators a faint `rgba(253,253,251,0.06)`; header/label/muted text
`var(--soft-ink)`.

### Traces + travelling beads

- Traces are SVG **step waveforms** (`<path>`, `stroke-width` ~2.5–3, round
  joins/caps) that start **on the vertical divider bar** (t=0) and step between a
  high and a low rail.
- Motion reuses the **datapath bead treatment exactly**: an overlay `<path>` copy
  of each trace styled as a fat round-capped dash (`stroke-dasharray: 12 100000`)
  with a colour **glow** (`filter: drop-shadow(0 0 3px currentColor)`), animated
  by sliding `strokeDashoffset` along the wire (Web Animations API, constant pixel
  speed). Use a **long cycle** (~10 s) so a ripple passes only occasionally, not
  constantly. Bead colour comes from the signal via `currentColor`. No beads
  under `prefers-reduced-motion`.

### Show / hide control

Each row carries a **colourless eye icon** — open eye = shown, slashed eye =
hidden — in `var(--soft-ink)` (never a coloured swatch). Hiding a signal collapses
its lane to a **short strip** whose slashed-eye + muted label is the un-hide
control; the remaining lanes shift up to fill *some* (not all) of the freed space.

### Hover scrubber

Hovering the traces draws a **vertical guide through the cursor** — a warm yellow
line (`#f5c542`, `vector-effect: non-scaling-stroke`) from the time axis down to
the bottom of the traces — plus a **value tooltip that follows the cursor**: a
small dark box (`background: rgba(18,18,24,0.96)`, hairline border, mono type)
listing the time and each visible signal's value, with **each value in its own
signal's colour**.

### Responsiveness

The scope scrolls horizontally (`overflow-x: auto` on the panel) with a
`min-width` (~32 rem) on the SVG, so on narrow screens the diagram **pans** rather
than squishing into illegibility.

---

## Check Yourself (multiple-choice quiz)

A self-contained multiple-choice widget: an italic question, a diagram image,
answer buttons that turn **green** (correct) or **red** (wrong) on click, and a
status line. Optionally a "Continue" button revealed once the correct answer is
picked. Reference implementations: `alu/logic-gates/index.html` (with a Continue
button) and the homepage Hands On section in `index.html` (without one).

The whole widget sits on a **paper card** — `var(--paper)` background, a hairline
border, `var(--radius)` corners, and `var(--shadow-soft)` — the same raised-panel
treatment as `.doc-hero__art`, so it reads as one deliberate block against the
page. This is part of the base `.quiz` rule, so every Check Yourself gets it.

### Markup

```html
<div class="quiz" id="quiz">
  <p class="quiz__q">The question, phrased as a prompt.</p>

  <figure class="figure figure--photo quiz__figure">
    <img src="PATH/TO/check-yourself.jpg"
         alt="Describe the diagram the question refers to."
         decoding="async" />
  </figure>

  <div class="quiz__options" role="group" aria-label="Answer choices">
    <button class="quiz__opt" type="button" data-correct="true">Correct choice</button>
    <button class="quiz__opt" type="button">Wrong choice</button>
    <button class="quiz__opt" type="button">Wrong choice</button>
    <button class="quiz__opt" type="button">Wrong choice</button>
  </div>

  <p class="quiz__feedback" role="status" aria-live="polite"></p>

  <!-- OPTIONAL: only include if there's a real page to continue to. -->
  <div class="quiz__next">
    <a class="btn btn--primary" href="DESTINATION">
      Continue <span aria-hidden="true">&rarr;</span>
    </a>
  </div>
</div>
```

Rules:
- Exactly one button carries `data-correct="true"`; that is the correct answer.
- The `1) 2) 3) …` number before each choice is added by CSS (`.quiz__opt::before`
  counter) — do **not** type numbers into the button text.
- To put sub-parts on their own lines inside a choice, use `<br>` (e.g.
  `A: …<br>B: …<br>C: …`).
- Order/number of choices is free; 2-column grid on desktop, 1-column ≤560px.
- Include `.quiz__next` **only** when there's a genuine next page. The script
  guards for its absence, so leaving it out is fine.
- The image is a normal `figure figure--photo` inside `quiz__figure`; always
  write meaningful `alt` text for the diagram.

The CSS lives in `styles/alu.css` for the ALU-section pages and is duplicated in
`styles/main.css` for the homepage (which doesn't load `alu.css`). If you add a
Check Yourself to a page, make sure whichever stylesheet it loads contains the
`.quiz*` rules below.

### CSS — Desktop (in `styles/alu.css` and `styles/main.css`)

Options sit in a two-column grid.

```css
/* The widget rides on a paper card — the same raised panel as .doc-hero__art. */
.quiz {
  max-width: 52rem;
  margin-inline: auto;
  background: var(--paper);
  border: 1px solid var(--hairline);
  border-radius: var(--radius);
  padding: clamp(var(--space-4), 5vw, var(--space-5));
  box-shadow: var(--shadow-soft);
}
.quiz__q {
  font-family: var(--font-body);
  font-size: clamp(1.2rem, 2.2vw, 1.5rem);
  font-weight: 400;
  font-style: italic;
  text-align: center;
  margin: 0 0 var(--space-3);
}
.quiz__figure { max-width: 48rem; margin: 0 auto var(--space-4); }
.quiz__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  counter-reset: quizopt;
}
.quiz__opt {
  counter-increment: quizopt;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-align: left;
  font-family: var(--font-display);
  font-size: 1.05rem;
  padding: 0.9rem 1.1rem;
  background: var(--paper);
  color: var(--ink);
  border: 1px solid var(--hairline);
  border-radius: var(--radius);
  cursor: pointer;
  transition: background-color 0.15s var(--ease),
              border-color 0.15s var(--ease), color 0.15s var(--ease);
}
/* Numbered prefix before each choice: 1) 2) 3) 4) */
.quiz__opt::before {
  content: counter(quizopt) ")";
  flex: none;
  color: var(--accent);
  font-family: var(--font-mono);
  font-weight: 600;
}
.quiz__opt:hover { border-color: var(--accent); }
.quiz__opt:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.quiz__opt.is-correct { background: #86efac; border-color: #86efac; color: #052e16; }
.quiz__opt.is-wrong   { background: #e57373; border-color: #e57373; color: #3d0a0a; }
.quiz.is-solved .quiz__opt { pointer-events: none; }

.quiz__feedback {
  min-height: 1.5em;
  margin: var(--space-3) 0 0;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.95rem;
  font-weight: 500;
}
.quiz__feedback.is-correct { color: #4ade80; }
.quiz__feedback.is-wrong   { color: #f87171; }

.quiz__next { display: none; margin-top: var(--space-4); justify-content: center; }
.quiz__next.is-shown { display: flex; }
```

### CSS — Mobile (`@media (max-width: 560px)`, in `styles/alu.css` and `styles/main.css`)

The only mobile change: the answer options collapse from two columns to one.

```css
@media (max-width: 560px) {
  .quiz__options { grid-template-columns: 1fr; }
}
```

### Script

Drop this once per page that has a quiz (guards for a missing `.quiz__next`):

```html
<script>
(function () {
  var quiz = document.getElementById("quiz");
  if (!quiz) return;
  var feedback = quiz.querySelector(".quiz__feedback");
  var next = quiz.querySelector(".quiz__next");
  quiz.querySelectorAll(".quiz__opt").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (quiz.classList.contains("is-solved")) return;
      if (btn.dataset.correct === "true") {
        btn.classList.add("is-correct");
        feedback.textContent = "Correct!";
        feedback.classList.remove("is-wrong");
        feedback.classList.add("is-correct");
        if (next) next.classList.add("is-shown");
        quiz.classList.add("is-solved");
      } else {
        btn.classList.add("is-wrong");
        feedback.textContent = "Incorrect, try again.";
        feedback.classList.remove("is-correct");
        feedback.classList.add("is-wrong");
      }
    });
  });
})();
</script>
```

> Multiple quizzes on one page: the markup/script above key off the single id
> `quiz`. For more than one on a page, switch to a class-based selector
> (`document.querySelectorAll(".quiz")`) and loop, giving each its own container.
