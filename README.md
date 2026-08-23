# Silicon From Scratch — Website

Source code for the **Silicon From Scratch** website — a learning hub for anyone
curious about how the processors inside modern devices are designed and built.

This repository contains only the website (static HTML/CSS, with a tiny bit of
vanilla JavaScript for the mobile menu). The hardware designs themselves live in a
separate repository: **[Silicon-From-Scratch](https://github.com/estaresinic05/Silicon-From-Scratch)**.

## Live site

https://estaresinic05.github.io/silicon-from-scratch-site

## Structure

```
index.html               Home page markup
alu/index.html           The ALU deep-dive page (hosts the interactive explorer)
styles/main.css          Design tokens, layout, components, responsive + motion rules
styles/alu.css           ALU-page components (figures, tables, code blocks, hero)
styles/alu-widget.css    Scoped styles for the interactive ALU datapath explorer
scripts/main.js          Mobile navigation toggle
scripts/scroll.js        GSAP scroll-reveal animations
scripts/alu-widget.js    Builds + drives the interactive ALU datapath explorer
assets/                  Logo and images
```

## Running locally

No build step. Just open `index.html` (or `alu/index.html`) in a browser. The
interactive ALU explorer needs JavaScript enabled; everything else degrades
gracefully without it.

## Interactive ALU datapath explorer

An interactive widget on the ALU page (`alu/index.html`) that teaches how a 1-bit
ALU slice works and how 32 of them compose into a full ALU. Pick an operation (or
flip the four `control[3:0]` bits) and the exact wires/gates carrying the result
light up while everything inactive dims.

**Where it lives**

| File | Role |
|------|------|
| `scripts/alu-widget.js` | Builds the inline SVG schematic and runs the highlight engine. |
| `styles/alu-widget.css` | All styling, built on the `main.css` design tokens. |
| `alu/index.html` (the `#explore` `<section>`) | The control panel markup + an empty `<svg id="alu-diagram">` the script fills in. |

It is fully self-contained: to remove it, delete the `#explore` `<section>`, the
`alu-widget.css` `<link>` in `<head>`, and the `alu-widget.js` `<script>` near
`</body>`.

**Embedding it on another page**

1. Link the stylesheet in `<head>`: `<link rel="stylesheet" href="PATH/styles/alu-widget.css" />`
2. Copy the `<section id="explore"> … </section>` block from `alu/index.html`
   (it contains the control buttons and the empty `<svg id="alu-diagram">`).
3. Load the script before `</body>`: `<script src="PATH/scripts/alu-widget.js" defer></script>`

The script keys off the ids `alu-widget`, `alu-diagram`, `alu-op-name`,
`alu-op-bits`, and the `.alu-preset` / `.alu-bit` buttons — keep those intact.

**Tweaking the highlight colours**

Edit the local custom properties at the top of `.alu-widget` in
`styles/alu-widget.css`:

```css
.alu-widget {
  --alu-active: var(--accent);   /* lit wires/blocks (defaults to the brand purple) */
  --alu-invert: var(--accent);   /* the inverted (NOT) legs used by NOR/NAND/subtract */
  --alu-idle:   rgba(35,35,42,0.22); /* dimmed / inactive wires */
}
```

**Tweaking the per-operation path map**

Everything is driven by one place in `scripts/alu-widget.js`:

- `NAMED_OPS` — the friendly operation names and their 4-bit encodings. Add or
  rename an operation here (and nowhere else).
- `deriveActiveIds(code)` — mechanically turns any of the 16 `control[3:0]` codes
  into the list of SVG element ids to light. This is the single source of truth
  for "what is the active path"; it never touches the SVG markup or the engine.

Those two feed a generated 16-entry `OPS` table that the highlight engine consumes.
Every wire/gate in the SVG has a stable, descriptive id (e.g. `wire-b0-ainv-not`,
`gate-msb-and`, `mux-b0-result-in2`), so the deriver only ever references ids —
adding or editing an operation means touching the table, never the drawing code.

This datapath cannot produce XOR/XNOR or constant outputs; the unnamed `control`
codes are shown literally per their bits (labelled e.g. `control=1011`).

## Notes

- All internal links are relative, so the site is ready for a custom domain later
  with no file changes.
- Motion is restrained and fully disabled under `prefers-reduced-motion`.

## License

All rights reserved, see [`LICENSE`](LICENSE). The repository is public so the
site can be served from it and its construction read, not so it can be reused.
The hardware designs, which are open, live in
[Silicon-From-Scratch](https://github.com/estaresinic05/Silicon-From-Scratch).
