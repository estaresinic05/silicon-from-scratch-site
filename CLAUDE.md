# CLAUDE.md — working rules for this repository

Instructions for Claude Code (and any other agent) working on the Silicon From
Scratch website. Read this first, then the doc map below for whatever you are
touching.

---

## The project in one paragraph

A static educational site teaching how modern processors are designed and built,
from a single transistor up to a pipelined CPU. **18 pages, no build step, no
framework, no package manager** — hand-written HTML, three shared stylesheets,
and vanilla JavaScript. GSAP loads from a CDN with an SRI hash; Three.js loads
from a CDN via an import map on the two WebGL pages. Deployed on GitHub Pages at
**siliconfromscratch.com** (see `CNAME`). The hardware designs themselves live in
a *separate* repository, `estaresinic05/Silicon-From-Scratch` — do not confuse
the two.

---

## Doc map — where the answer already is

Do not invent a pattern that is already written down. In priority order:

| Document | What it governs | When to read it |
|---|---|---|
| **`STYLE_GUIDE.md`** (root) | The golden set. Responsive strategy, colour/type tokens, section headings, figure cards, lesson headers, Verilog flip cards, waveforms, Check Yourself quizzes, GitHub / go-back cards. | **Before writing any markup or CSS on a lesson page.** |
| **`.claude/skills/mobile-scheme/SKILL.md`** | The phone scheme: why `styles/mobile.css` is one media query, rem-vs-px for touch targets, the 44px floor, containment, and how to measure without being fooled by in-flight reveals. | **Before any CSS that could affect a narrow screen.** |
| `README.md` (root) | Repo structure, how to run locally, the ALU datapath explorer's internals. | Onboarding, or touching `alu-widget.js`. |
| `meet-the-processor/DESIGN.md` | The 2D interface over the die-descent canvas: its own tokens, layout, components, motion, a11y. | Any change to the Meet the Processor chrome. |
| `meet-the-processor/README.md` | The 3D scene: the seven stops, the stop model, region data, the `verify/` scripts, and how to serve it. | Any change to `scene.js`. |
| `prototypes/cpu-layers/*.md` | The original prototype the die descent grew out of. Kept for history. | Archaeology only — the live page is `meet-the-processor/`. |
| `saved-snippets/` | Code salvaged from deleted pages, kept so it can be reused. | Before rebuilding something that used to exist. |

`STYLE_GUIDE.md` is the authority for shared-site pages. `meet-the-processor/`
runs its own token set on purpose and is the exception, not a precedent — see
"Two design systems" below.

---

## House rules

These are not preferences to weigh. They are how the site is written.

### Prose

1. **No em dashes and no parentheses in lesson prose.** Rewrite the sentence
   instead. (This applies to the teaching text on the pages, not to code
   comments or to these docs.)
2. **Lesson voice is educational, flowing and professorial.** Full sentences that
   carry the reader forward. Not bulleted notes, not marketing copy.
3. **Multiplexers are written `2x1`, never `2-to-1`.** Same for `4x1`, `8x1`.
4. **Bold the key term** on first use, per the rule in `STYLE_GUIDE.md`.

### Markup and CSS

5. **Copy the golden-set pattern exactly** — same classes, same markup shape.
   Every instance of a component must look and behave identically across pages.
6. **Every page's top bar uses the logo *symbol* image**, never a plain purple
   dot. Copy the bar from an existing page.
7. **Size in `rem`/`clamp()`/`%`, never `px`,** except hairlines and radii. One
   layout that scales; nothing hidden by width. The full reasoning is the first
   section of `STYLE_GUIDE.md`.

   Two deliberate exceptions, both in `styles/mobile.css` and both explained in
   the `mobile-scheme` skill: **the phone scheme is a media query**, because
   "must not affect desktop" is only guaranteed by a rule that cannot match at
   desktop widths; and **touch targets inside it are sized in `px`**, because
   the fluid root clamps to 13px on a phone and would otherwise shrink every
   control by 19% exactly where a thumb needs more room, not less.
8. **`--fill` is a background behind white text; `--accent` is text on the page.**
   They are two different purples and are not interchangeable. Derive tints with
   `color-mix(...)` — never hand-type an `rgba()` purple, which freezes an old
   accent and silently stops tracking the token.
9. **Actions are pills (`999px`); surfaces keep `--radius`.**
10. **Shared components live in the shared stylesheets.** Don't redefine a figure
    card or a quiz per page.

### Working style

11. **Reload the page in the browser after finishing a change** and actually look
    at it. Playwright is available; so is `tools/mobile-shots.py`.
12. **Check the mobile layout** after any desktop-focused change — read the
    `mobile-scheme` skill and render at real phone widths with
    `tools/mobile-shots.py`. **Phone fixes go in `styles/mobile.css` and
    nowhere else**, so the desktop layout stays provably untouched.
13. **Commit messages carry no `Co-Authored-By` trailer.** Author is
    `estaresinic05 <yellowsockem@gmail.com>`.
14. **Don't leave half-wired work in the tree.** A script with no `<script>` tag
    pointing at it is dead weight; either finish it or leave it uncommitted.

---

## Two design systems, deliberately

Most of the site shares `styles/main.css` + `styles/alu.css` + `styles/alu-widget.css`
and the tokens in `STYLE_GUIDE.md`.

**`meet-the-processor/` does not load `styles/main.css`**, because the WebGL scene
owns the entire viewport and the page never scrolls in the normal sense — the
site's layout and scroll-reveal rules have nothing to act on there and would only
fight the canvas. Its top bar is *reproduced* in `meet-the-processor/style.css`
at the site's exact metrics (1400px rail, 40px inset, 4rem tall, Geist wordmark,
filled Project Directory pill trailing the links) so the seam is invisible.

**It does load `scripts/main.js`, for exactly one component: the project
directory drawer.** That exception was made 2026-08-03. The alternative was a
second copy of the whole lesson list living on that page, and a duplicated `MENU`
drifts the first time a lesson is added. Everything else in `main.js` finds no
elements to bind to there and is inert — verified, not assumed.

Three things that made it work, all of which will bite again if disturbed:

- **The drawer's CSS lives in `styles/project-directory.css`**, split out of
  `main.css` so this page can take the drawer without the rest. `main.css`
  `@import`s it, so the other pages needed no edit. It declares no tokens: every
  `var()` still resolves against the host page's `:root`, which is what keeps the
  drawer tracking the light and dark themes on the main site. **Add a `var()` to
  that file and you must also add it to the republished block at the bottom of
  `meet-the-processor/style.css`**, which is where this page supplies the ones it
  does not already define.
- **`PREFIX` in `main.js` keys off either stylesheet.** It used to read the
  `main.css` link alone, which this page does not have, so every menu link
  resolved against `/meet-the-processor/` instead of the site root.
- **`#sitebar` is a direct child of `<body>`, not of `#stage`.** `#stage` is
  `position: fixed; z-index: 1` and therefore a stacking context, so a bar nested
  inside it can never paint above anything outside it however high its own
  `z-index` goes, and the drawer came down over the wordmark.

Both controls on that page — the top bar's pill and the Start Building button at
stop 7 — carry `js-open-proj-dir`, which is `main.js`'s own public hook. Neither
holds any logic of its own.

Consequence: **a change to the shared top bar must be made twice** — once in
`styles/main.css` and once in `meet-the-processor/style.css`. There is no
inheritance to rely on.

---

## Running locally

Most pages are plain files — open them directly, or serve the root.

**The two WebGL pages must be served over HTTP**, not opened from `file://`:
ES modules and the import map will not load otherwise.

```
python tools/serve.py
# then http://127.0.0.1:8777/meet-the-processor/
```

Use `tools/serve.py` rather than `python -m http.server`. It serves the same root
on the same port and differs in two ways that both matter:

- **`Cache-Control: no-store`.** `http.server` sends no cache header at all, and a
  browser may then apply heuristic freshness and serve a stale stylesheet without
  revalidating. **Symptom to remember: new behaviour, old appearance.** It is
  almost always the cache.
- **Byte ranges.** `http.server` ignores `Range` and answers 200 with the whole
  file. A `<video>` then reports an empty `seekable` range, so its scrub bar goes
  inert: the bead will not drag and clicking the timeline does nothing. GitHub
  Pages answers 206, so the deployed videos have always scrubbed. **A player that
  will not seek locally is this, not the page.**

It lived at `prototypes/cpu-layers/serve.py` until 2026-08-03, which was inside
the gitignored `prototypes/` tree — the documented way to run the site was a file
no clone had.

---

## Agents and tooling in this repo

| Name | Job |
|---|---|
| `mobile-scheme` (`.claude/skills/`) | The rules for the phone layout. Read before writing CSS that could affect a narrow screen. Replaced the `mobile-guardian` agent, which patched breakage inside media queries instead of designing. |
| `cleanup-guardian` (`.claude/agents/`) | Finds genuinely unused files, quarantines them, proves the site still works. Never deletes without approval. |
| `tools/mobile-shots.py` | Batch phone/tablet screenshots, portrait and landscape, with real device emulation. |
| `tools/mobile-audit.py` | Walks the DOM at four device profiles and reports every element wider than the viewport, by name. Finds what screenshots cannot. |
| `tools/desktop-unchanged.py` | **The gate for any phone work.** Measures every element with `mobile.css` enabled, disables it in the same page load, measures again. Any difference at 1280/1600 is a regression. |
| `tools/tap-targets.py` | Lists every tappable control under 44px, skipping the ones that are inert by design. |
| `tools/cut-fillers.py` | Finds the "um"s in a sheet-video master, cuts the longest half, re-encodes to the site's spec. `--plan` first, always. Whisper deletes fillers from its output, so they are found in the waveform and named run by run. |
| `meet-the-processor/verify/` | Python checks for the 3D scene: affordance behaviour, stop composition, region coverage. Run these after editing `scene.js`. |
