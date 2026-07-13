# Silicon From Scratch — Style Guide

A "golden set" of reusable UI patterns for this site. When building one of these
things, copy the pattern here **exactly** — same classes, markup shape, and
behavior — so every instance looks and works the same across pages.

Base design tokens (`--accent`, `--soft-ink`, `--paper`, `--ink`, `--hairline`,
`--radius`, `--ease`, `--font-mono`, `--font-display`, `--font-body`,
`--space-*`) live in `styles/main.css` and are assumed available.

---

## Responsive strategy — ONE layout, just resized (read this first)

**The site is a single layout that scales fluidly with the viewport — the same
structure at *every* screen size, just larger or smaller.** It does **not** reflow
into a different mobile layout, and it does **not** hide anything on small screens.
Small screens show a shrunken version of the desktop design. This is deliberate —
inconsistent per-breakpoint reflowing was causing rendering bugs, so we removed it.

**Large-screen enlarging is deferred.** The root font is currently capped at the
normal 16px baseline, so big monitors render at their standard size (no growing) —
we only scale *down* for now. Turning enlarging back on later is a one-line change
(raise the `clamp()` ceiling below).

### How the scaling works

- **One knob: a fluid root font-size.** `html { font-size: clamp(12px, 6.5px +
  0.66vw, 16px); }` — 16px at ~1440px and above, shrinking toward a 12px floor on
  phones. (The `16px` ceiling is the temporary "don't enlarge yet" cap; it was
  `20px` when large-screen enlarging is enabled.) **Because the whole design is
  sized in `rem`** (the `--space-*` scale, `--maxw`/`--maxw-prose`, and type),
  scaling this one value **scales the entire layout together.** That's what "same
  layout, just resized" means here.
- So: **size everything in `rem`** (or `em`), and widths in `%` / `fr` / `rem`.
  This is what lets a component grow on a 4K monitor and shrink on a phone without
  any new media query. Fixed `px` is only for things that should NOT scale —
  hairlines (`1px` borders), and the small `--radius` values.
- **Multi-column layouts stay multi-column at every width.** e.g. Hands On is a
  two-column masonry (`.handson-grid { grid-template-columns: 1fr 1fr }`) with **no**
  single-column collapse — it just gets narrower. Don't add a `1fr` / stacked
  breakpoint to content grids.
- **Nothing is `display:none` by breakpoint.** Everything on desktop is on mobile.

### Rules for new work

1. **Size in `rem`/`clamp()`/`%`, not `px`.** Reach for `px` only for hairlines and
   radii. A value in `rem` scales with the root font; a value in `px` won't.
2. **No content-reflow media queries.** Don't collapse a multi-column grid to one
   column, and don't hide content, on narrow screens. If a grid feels tight, it
   should just be *smaller*, not restructured.
3. **Contain internal overflow, never the page.** A component wider than its column
   (a wide timing diagram, a code editor) scrolls **inside its own panel**
   (`overflow-x: auto` + a `rem` `min-width`) — the page itself must never scroll
   sideways (verify `scrollWidth === clientWidth` at your test widths).
4. **Verify at the extremes.** Check ~360–500px (phone), ~768px (tablet), ~1280px
   (laptop), and ~1920px (large). It should be the *same layout* at all four, and
   the page must not overflow horizontally at any of them.

### The only sanctioned exceptions

- **Top nav** collapses to the hamburger/`☰` drawer on narrow screens (a full
  horizontal nav can't fit) — this is chrome, not content.
- **Editable code textareas** go read-only on touch (poor phone UX) — the widget
  stays fully *viewable*, nothing is removed.
- **The "Your Path" serpentine's left explainer paragraphs** are hidden below the
  two-column breakpoint (`max-width: 1079px`). The serpentine trace + its nodes
  themselves show at **every** width (full-width on phones); only the side prose
  column drops, because two columns of prose + path can't both fit narrow. The
  JS trace (`buildBpTrace` in `scroll.js`) now draws at all widths and simply
  omits the branch lines when the paragraphs are hidden.

Add a new exception here **only** with a clear reason — the default is always
"same layout, just resized."

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

## Bolding key terms in body text

Emphasize a **key term** the first time it matters in a paragraph by wrapping it
in `<strong>` — e.g. `a <strong>multiplexer</strong>`, `the <strong>power
supply</strong>`, `<strong>set-less-than</strong>`. This is the standard (and only)
way to bold within `.prose` body copy; don't reach for `<b>`, inline
`font-weight`, or ALL-CAPS to emphasize a word.

- **Look:** `<strong>` in `.prose` inherits the paragraph's colour and the
  browser's bold weight — a plain, muted bold that reads as emphasis without
  shouting. It's the same bold used in `.doc-hero__lead` leads and the flip-card
  `figcaption` descriptions, so don't add a per-instance colour or weight.
- **Scope:** bold the **term being introduced or defined**, not whole phrases or
  sentences — one or two words is the norm.
- **Sparingly:** if everything in a paragraph is bold, nothing is emphasized.
- **Not for code or stress:** use `<code>` for a signal / identifier / instruction
  field (`<code>sel</code>`, `<code>rs1</code>`) and `<em>` for light stress;
  reserve `<strong>` for the defined term. **Numbers are never in `<code>`, and
  instruction/register names go in `<em>`, not `<code>`** — see *Code, italics, and
  numbers* below.

---

## Code, italics, and numbers (assembly & RTL prose)

How to typeset signals, instructions, registers, fields, and numbers in body copy.
Reference implementation: `single-cycle-cpu/basics-of-instructions/index.html`.

- **`<code>` is reserved for two things:** *variable / signal names* (`<code>sel</code>`,
  `<code>clk</code>`, `<code>a</code>`) and *instruction fields*
  (`<code>rs1</code>`, `<code>rs2</code>`, `<code>rd</code>`, `<code>opcode</code>`,
  `<code>funct3</code>`, `<code>funct7</code>`, `<code>imm[11:5]</code>`). Nothing else.
- **Instruction names, whole instructions, and register names go in `<em>`
  (italic), never `<code>`.** That covers bare mnemonics (`<em>lw</em>`,
  `<em>add</em>`), full instructions (`<em>add x5, x6, x7</em>`,
  `<em>sw x5, 12(x8)</em>`), and standalone register names (`<em>x7</em>`,
  `<em>x10</em>`). They read as italic body text, the same face as light `<em>` stress.
- **Numbers are never in `<code>`** — bit patterns (`0110011`), field values
  (`000`), and decimal literals (offsets like 8 or 12) are all plain body text.

### Instruction-field colours

Every instruction-field `<code>` is tinted to match its cell in the
instruction-format diagrams (`assets/single-cycle-cpu/r-type.jpg`, `i-type.jpg`,
`s-type.jpg`), so a field named in prose reads as the same field shown in the
image. Add the matching `fld-*` class to the `<code>`; the colours live in
`styles/alu.css` as `.theme-dark code.fld-*` (scoped under `.theme-dark` + the
`code` element so they outrank the base code-chip colour).

| Field(s) | Class | Colour | Text | Chip background |
|---|---|---|---|---|
| `funct7`, `funct3`, `opcode` | `fld-funct7` / `fld-funct3` / `fld-opcode` | purple | `#d9c6ff` | `rgba(183, 148, 246, 0.18)` |
| `rs2` | `fld-rs2` | green | `#8fe0a0` | `rgba(134, 214, 162, 0.18)` |
| `rs1` | `fld-rs1` | amber | `#f0c886` | `rgba(240, 200, 134, 0.18)` |
| `rd` | `fld-rd` | periwinkle | `#b3baf2` | `rgba(160, 168, 232, 0.22)` |
| `imm[…]` | `fld-imm` | rose | `#eaa9ba` | `rgba(216, 150, 170, 0.20)` |

The purple trio (`funct7`/`funct3`/`opcode`) is the same as the default `<code>`
chip (`.theme-dark code`, `#d9c6ff`), so they already match — but still carry an
explicit `fld-*` class so the field-colour scheme is complete and self-documenting.

```html
<em>lw x7, 8(x10)</em> loads from address <em>x10</em> + 8 into the
<code class="fld-rd">rd</code> field; the opcode bits are 0000011.
```

---

## Figures / image cards

Every image that isn't part of another widget — hand-drawn diagrams, worked
examples, block diagrams, the datapath sketch — rides the **standard `.figure`
card**, so images read as deliberate framed panels and look identical across
every lesson. Reference implementations: the diagrams in
`single-cycle-cpu/basics-of-instructions/index.html`, and the fetch-decode-execute
diagram in `single-cycle-cpu/fetch-decode-execute/index.html` (`#all-together`).

### Markup

```html
<figure class="figure">
  <img src="PATH/TO/diagram.jpg" alt="Describe what the diagram shows." decoding="async" />
</figure>
```

- The `figure` class both **draws the card** and is the hook `scroll.js` reveals
  on scroll — keep it even when you add a sizing modifier.
- Always give a real, descriptive `alt`, and add `decoding="async"`.

### The card (already in `styles/alu.css` — don't redefine it per page)

```css
.figure {
  margin: var(--space-5) 0 0;
  background: var(--paper);              /* dark on the dark theme, light on the light theme */
  border: 1px solid var(--hairline);
  border-radius: var(--radius);
  padding: clamp(var(--space-2), 3vw, var(--space-4));
  box-shadow: var(--shadow-soft);
}
.figure img { width: 100%; height: auto; border-radius: var(--radius-sm); margin-inline: auto; }
```

- **Never hard-code a `#fff` background on the card.** The diagram JPGs already
  carry their own light background, so a white plate blends into the image and the
  card disappears. Use the token `var(--paper)` (i.e. just the base `.figure`) so
  the card *frames* the image — dark card on the dark theme, light card on light.
- **Per-figure CSS is sizing only:** at most `max-width` + `margin-inline: auto`
  to cap and centre; let the base `.figure` own the background/border/radius/shadow.
  Existing width caps: `.figure--diagram` (26rem), `.figure--diagram-lg` (34rem),
  `.figure--diagram-tall` (20rem, portrait), `.figure--diagram-xl` (48rem).

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

**Syntax colours (`.tok-*`).** `VerilogMini.highlight` classifies each token and
`gate-card.js` re-highlights live, so every code block shares one VS-Code-Dark+
palette. **These exact values live in *both* `styles/alu.css` and
`styles/main.css` — keep the two copies in sync** (the editor background is
`#1e1e1e`):

| class | what it colours | hex |
|---|---|---|
| `.tok-kw` | keywords — `input` `output` `wire` `reg` `assign` `module` `always` `if`… | `#569cd6` blue |
| `.tok-cm` | comments (`//…`, `/*…*/`) | `#6a9955` green |
| `.tok-num` | numeric literals — `42`, `1'b0`, `4'hF` | `#b5cea8` light green |
| `.tok-type` | module names — **declared** (`module <name>`) *or* **instantiated** (the type in `<type> [#(…)] <inst> (…)`) | `#4ec9b0` teal |
| `.tok-inst` | the **instance name** in an instantiation | `#dcdcaa` pale yellow |
| `.tok-paren` | parentheses `(` `)` | `#ffd700` gold |
| `.tok-op` | operators — `= & \| ^ ~ ? + - == && …` | `#b794f6` purple |
| `.tok-err` | error span — red wavy underline (not a fill) | `#f14c4c` |

Plain signal identifiers (and non-paren punctuation like `[] {} ; , : @`) get **no
class**, so they stay the default editor foreground `#d4d4d4`. The `.tok-type` /
`.tok-inst` / `.tok-paren` cases are inferred by a small lookahead in `highlight`
(a bare identifier's type alone can't tell a signal from a module/instance name),
so if you change the lexer or add a token type, update `highlight` **and** add the
matching `.tok-*` rule to both stylesheets.

### To add a card

Copy a `.gate-card` block from a reference page. The moving parts:
- `data-control="clk"` (optional) on `.gate-card` — names the control/enable
  signal(s); those chips are tinted blue, data inputs stay purple.
- Front: a `figure.gate-card__face--front` (keep the `figure` class so it reveals
  on scroll) with the sketch + a `figcaption` + the flip arrow. For a cross-fade
  front, use two `.latch-swap__img` (first one `is-active`).
- **Titlebar (`.code-editor__bar`) — always carry a Reset button.** In order: the
  `.code-editor__glyph` mark — **literal `</>` text** (`<span
  class="code-editor__glyph" aria-hidden="true">&lt;/&gt;</span>`, styled blue with
  a little letter-spacing so it reads as three typed characters, *not* an icon) —
  then the `code-editor__lang` `Verilog HDL` label, then the `.code-editor__reset`
  button. `**</> Verilog HDL** sits on the **left**` and
  `.code-editor__lang { margin-right: auto }` pushes **Reset to the right**. The
  Reset button reverts the editor to its original code (`gate-card.js` wires it; the
  reader will edit and needs a way back) and is **required** on every editable card —
  copy the whole titlebar verbatim from the full adder (`alu/full-adder/index.html`).
  Keep this `</> Verilog HDL`-on-the-left layout identical across every code card.
- Back: the `.code-editor` (highlighted `<pre class="code-editor__hl">` underlay
  + editable `<textarea class="code-editor__ta">` with the same code) and a
  `.gate-card__backrow`.
- **The `.gate-sim` input/output bar is required** on an editable card (it's the
  point of the card — a live playground). It holds `.gate-sim__inputs` (the toggle
  chips, one per declared `input`, generated by `gate-card.js`) **and**
  `.gate-sim__outs` with one `.gate-sim__out` per declared `output`
  (`.gate-sim__lhs` label = the output name, `.gate-sim__val` = its live value).
  List a readout for **every** output so the reader sees all of them; the return
  button sits at the end of the `.gate-card__backrow`. Only a `data-static`
  display-only card (see below) omits the sim bar.
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
sequential clocking semantics. Keep *editable* card examples inside the subset.

### Display-only cards (`data-static`) — code outside the 1-bit subset

To show structural/multi-module Verilog (e.g. a slice written with `mux_2x1` /
`full_adder` instantiations and a 2-bit `operation` bus) as a flip card, add
`data-static` to the `.gate-card` — `gate-card.js` then only flips + highlights
it and never calls `compile()`.

> When the structural code doesn't belong *on* the page at all, just link out to
> it: drop the real image on a plain `.figure` and put a **"See the code on
> GitHub" card** (see that entry) beneath it — the Final Upgrade section of
> `alu/alu-slice/index.html` does this with two cards side by side (`.slice-links`,
> a 2-column grid), one under each slice, pointing at `ALU/rtl/alu_slice.v` and
> `ALU/rtl/alu_msb.v`.

Use the **same markup** as an editable card — including the `.code-editor__hl`
`<pre><code>` underlay and the `.code-editor__ta` textarea (both hold the code;
`gate-card.js` still needs the textarea) — with three changes:
- add `data-static` to the `.gate-card`,
- add `readonly` to the `.code-editor__ta` (it's reference source, not editable),
- **omit** the `.gate-sim` from `.gate-card__backrow` (there's no 1-bit output to
  show); keep just the return button, right-aligned via
  `style="justify-content: flex-end;"`.

`gate-card.js` detects `data-static` and wires the flip + one-shot syntax
highlight (`VerilogMini.highlight`) but **skips `compile()`** — so no input
chips, no output value, and no red error squiggle. Size a standalone card with
`.gate-card--solo`. Everything else (flip animation, VS Code editor chrome,
return arrow) is identical to the editable card.

### Flipping back
Clicking the **front** flips to the editor. To flip **back**, the reader clicks
the **return arrow** (`.gate-card__return`) in the bottom row — the frame is
inert. This is wired in `gate-card.js` as one listener on that button:

```js
if (ret) ret.addEventListener("click", function () { flipTo(false); });
```

Hover feedback mirrors the front: hovering the **return arrow** **grows the whole
card a touch** (the same `1.045` the front uses before its flip) rather than
recolouring the arrow itself, so the cue reads "grow, then flip":

```css
.gate-card.is-flipped .gate-card__face--back:has(.gate-card__return:hover) {
  transform: rotateY(180deg) scale(1.045);
}
```
The arrow keeps its own colour on hover — it has **no** colour/highlight change.

### Behaviour notes
- The output **label** (`.gate-sim__lhs`) follows the declared `output` port, so
  renaming the output in the code updates it.
- **Multiple outputs.** A card can show more than one live output (e.g. the full
  adder's `sum` + `cout`): list several `.gate-sim__out` readouts inside a
  `.gate-sim__outs` group, and the *k*-th readout tracks the *k*-th declared
  `output` port (label + value both follow, positionally).
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
- **No `<code>` in the question or answers.** Signal, port, and register names
  (e.g. clk, data1, writeEnable) stay as plain text; use `<em>` only for whole
  instructions or register operands (e.g. `<em>add x3, x1, x2</em>`, `<em>x1</em>`),
  matching the rest of the prose. Keeps the quiz reading as prose, not code.
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

---

## "See the code on GitHub" card

A compact paper-card link out to the project's source: the **GitHub mark** on the
left, a two-line label ("See the code on GitHub" + a one-line subtitle), and a
purple **arrow** on the right that nudges right on hover while the whole card
lifts. The entire card is one `<a>`, so all of it is clickable. Reference
implementations: `alu/full-adder/index.html` (links straight to the lesson's
Verilog file) and the homepage Hands On section in `index.html` (links to the
repo root).

The card rides the standard **paper card** — `var(--paper)` background, hairline
border, `var(--radius)` corners, `var(--shadow-soft)` — matching every other
raised panel on the site. It opens in a new tab (`target="_blank"
rel="noopener"`).

### Markup

```html
<a class="code-card"
   href="https://github.com/estaresinic05/Silicon-From-Scratch/blob/main/PATH/TO/file.v"
   target="_blank" rel="noopener">
  <svg class="code-card__logo" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
  <span class="code-card__text">
    <span class="code-card__title">See the code on GitHub</span>
    <span class="code-card__sub">One line naming what the reader will find</span>
  </span>
  <span class="code-card__arrow" aria-hidden="true">&rarr;</span>
</a>
```

Rules:
- Point `href` at the **most specific** source that fits: a single `.v` file for a
  lesson about that circuit, or the repo root for a general "browse everything."
- The GitHub mark inherits `fill: var(--ink)`, so it stays legible in both themes
  — don't hard-code a colour.
- Keep the subtitle to one short line describing what's on the other end.

### CSS

The rules live in `styles/alu.css` for the ALU-section pages and are **duplicated
in `styles/main.css`** for the homepage (which doesn't load `alu.css`) — keep the
two copies in sync.

```css
.code-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: clamp(var(--space-3), 3vw, var(--space-4));
  background: var(--paper);
  border: 1px solid var(--hairline);
  border-radius: var(--radius);
  box-shadow: var(--shadow-soft);
  color: var(--ink);
  text-decoration: none;
  transition: transform 0.18s var(--ease), box-shadow 0.18s var(--ease),
              border-color 0.18s var(--ease);
}
.code-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lift);
  border-color: var(--accent);
}
.code-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.code-card__logo { flex: none; width: 2.25rem; height: 2.25rem; fill: var(--ink); }
.code-card__text { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.code-card__title {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 0.95rem;
  letter-spacing: 0.02em;
}
.code-card__sub { color: var(--soft-ink); font-size: 0.9rem; }
.code-card__arrow {
  margin-left: auto;
  flex: none;
  color: var(--accent);
  font-size: 1.2rem;
  transition: transform 0.18s var(--ease);
}
.code-card:hover .code-card__arrow { transform: translateX(3px); }
```

> Placed at the bottom of the Hands On section's right column, the card travels
> **with** the Interactive Waveforms widget: `index.html`'s waveform-relocation
> script moves the `.code-card` alongside `.aluwave` so it stays directly beneath
> the diagram in both the two-column and the narrow full-width layouts.
