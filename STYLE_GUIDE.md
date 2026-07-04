# Silicon From Scratch — Style Guide

A "golden set" of reusable UI patterns for this site. When building one of these
things, copy the pattern here **exactly** — same classes, markup shape, and
behavior — so every instance looks and works the same across pages.

Base design tokens (`--accent`, `--soft-ink`, `--paper`, `--ink`, `--hairline`,
`--radius`, `--ease`, `--font-mono`, `--font-display`, `--font-body`,
`--space-*`) live in `styles/main.css` and are assumed available.

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

## Check Yourself (multiple-choice quiz)

A self-contained multiple-choice widget: an italic question, a diagram image,
answer buttons that turn **green** (correct) or **red** (wrong) on click, and a
status line. Optionally a "Continue" button revealed once the correct answer is
picked. Reference implementations: `alu/logic-gates/index.html` (with a Continue
button) and the homepage Hands On section in `index.html` (without one).

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
.quiz { max-width: 52rem; margin-inline: auto; }
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
