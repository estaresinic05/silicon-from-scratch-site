/* =========================================================================
   Silicon From Scratch — alu-widget.js
   Interactive 1-bit ALU datapath explorer (homepage Hands On section).

   WHAT THIS DOES
   - Builds an inline SVG schematic of TWO ALU slices, each drawn as a module
     with a clear BOUNDARY BOX: control signals (Ainvert, Binvert, Cin,
     Operation) enter from the top as arrows, operands (a, b, less) enter from
     the left, and outputs (Result, Cout / Set, Overflow) leave on the right or
     bottom. The gates/muxes/adder live INSIDE each box. Between the two boxes a
     "⋮" stands in for the 30 identical slices, with the carry chain and the
     MSB Set -> bit-0 Less feedback wired across.
   - Wires the control panel (named-operation buttons + four control bits).
   - "Illuminates" the active datapath for the current control[3:0] value.

   HOW THE HIGHLIGHTING IS DRIVEN  (the one place you edit to change behaviour)
   - NAMED_OPS .......... friendly names + their 4-bit encodings. Edit here only.
   - deriveActiveIds() .. given any of the 16 codes, returns the SVG element ids
                          to light. Single source of truth for the active path.
   - OPS ................ the generated 16-entry table the engine consumes.

   Every wire/gate has a stable, descriptive id (e.g. wire-b0-ainv-not,
   gate-msb-and, mux-b0-result-in2). The id scheme is documented in the README.
   ========================================================================= */
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  /* Tiny DOM helper: create an SVG element, set attributes, append it. */
  function add(parent, tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === "text") e.textContent = attrs[k];
        else e.setAttribute(k, attrs[k]);
      }
    }
    if (parent) parent.appendChild(e);
    return e;
  }

  /* Draw a wire as a poly-line path. `inv` marks an inverted (NOT) leg so the
     CSS can style it distinctly when lit. Returns the <path> so the caller can,
     e.g., add an arrowhead. */
  function wire(g, id, pts, inv) {
    var d = pts
      .map(function (p, i) { return (i ? "L" : "M") + p[0] + " " + p[1]; })
      .join(" ");
    return add(g, "path", {
      id: id,
      class: "alu-wire" + (inv ? " alu-wire--inv" : ""),
      d: d
    });
  }

  /* A labelled block (mux / gate / adder): a shape + a centred caption, grouped
     under one id so the whole block lights at once. */
  function block(g, id, shapeTag, shapeAttrs, label, lx, ly, extraClass) {
    var grp = add(g, "g", {
      id: id,
      class: "alu-node" + (extraClass ? " " + extraClass : "")
    });
    add(grp, "title", { text: label });
    var s = add(grp, shapeTag, shapeAttrs);
    s.setAttribute("class", "alu-shape");
    if (label) add(grp, "text", { x: lx, y: ly, class: "alu-label", text: label });
    return grp;
  }

  /* A NOT inverter (triangle + bubble) sitting on an inverted mux leg. */
  function notGate(g, id, x, y) {
    var grp = add(g, "g", { id: id, class: "alu-node alu-node--inv" });
    add(grp, "title", { text: "NOT (invert)" });
    add(grp, "path", {
      d: "M" + x + " " + (y - 8) + " L" + x + " " + (y + 8) + " L" + (x + 16) + " " + y + " Z",
      class: "alu-shape"
    });
    add(grp, "circle", { cx: x + 19, cy: y, r: 2.6, class: "alu-shape" });
    return grp;
  }

  /* A small input/output port: a dot, optionally a caption. */
  function port(g, id, x, y, label, anchor, dx) {
    var grp = add(g, "g", { id: id, class: "alu-port" });
    add(grp, "circle", { cx: x, cy: y, r: 4, class: "alu-dot" });
    if (label) {
      add(grp, "text", {
        x: x + (dx || 0), y: y + 4,
        class: "alu-portlabel", "text-anchor": anchor || "start", text: label
      });
    }
    return grp;
  }

  /* A junction bubble where datapath wires connect (a fan-out / tap). Styled like
     an input port: hollow grey at rest, purple when its path is live. */
  function jdot(g, id, x, y) {
    return add(g, "circle", { id: id, cx: x, cy: y, r: 3, class: "alu-jdot" });
  }

  /* Plain caption text. */
  function label(g, x, y, text, cls, anchor) {
    return add(g, "text", {
      x: x, y: y, class: cls || "alu-cap",
      "text-anchor": anchor || "start", text: text
    });
  }

  /* A small "0/1/2/3" pin number printed beside a mux input. */
  function pin(g, x, y, t) {
    return add(g, "text", { x: x, y: y, class: "alu-pin", "text-anchor": "middle", text: t });
  }

  /* Give a wire an arrowhead at its end (used for control inputs). */
  function arrow(w) { w.setAttribute("marker-end", "url(#alu-arrow)"); return w; }

  /* A control-input wire: blue line + blue arrowhead, matching the Ainvert /
     Binvert / Operation lines in the hand-drawn schematic. */
  function ctrlWire(g, id, pts) {
    var w = wire(g, id, pts);
    w.setAttribute("class", "alu-wire alu-ctrl-wire");
    w.setAttribute("marker-end", "url(#alu-arrow-ctrl)");
    return w;
  }

  /* ------------------------------------------------------------------ *
     BUILD ONE SLICE  (all coordinates are LOCAL; the caller translates it).
     The slice is a rectangle (the module boundary). Inputs cross the top
     (control) and left (operands); outputs cross the right and bottom.
   * ------------------------------------------------------------------ */
  function buildSlice(pfx, isMsb) {
    var g = add(null, "g", { class: "alu-slice" });
    var BBOT = isMsb ? 470 : 380;        /* box bottom (MSB is taller for ovf) */

    /* ---- the module boundary box. It is PORTRAIT (taller than wide): the
            datapath is packed horizontally so each slice reads as its own tall
            block, like the hand-drawn schematic. Signals cross the rectangle as
            inputs (arrows in) / outputs. ---- */
    add(g, "rect", {
      id: "block-" + pfx, class: "alu-block",
      x: 40, y: 60, width: 290, height: BBOT - 60, rx: 4
    });

    /* ====================== CONTROL INPUTS (top edge) =================== */
    label(g, 52, 30, "Ainvert", "alu-ctrl alu-ctrl--blue", "middle");
    label(g, 110, 30, "Binvert", "alu-ctrl alu-ctrl--blue", "middle");
    label(g, 302, 30, "Operation", "alu-ctrl alu-ctrl--blue", "middle");
    /* Ainvert drops straight down into the mux (x=91); just above the slice it
       bends left and back up to a small detour, so its label sits clear of the
       Binvert line at x=115. */
    ctrlWire(g, "wire-" + pfx + "-ainv-sel", [[52, 40], [52, 52], [91, 52], [91, 109]]);
    ctrlWire(g, "wire-" + pfx + "-binv-sel", [[110, 40], [110, 220], [91, 220], [91, 231]]);
    ctrlWire(g, "wire-" + pfx + "-op-sel", [[302, 50], [302, 128]]);

    /* ====================== OPERAND INPUTS (left edge) ==================
       The leads start OUTSIDE the box (x=8) and cross the boundary (x=40), so
       it's obvious a and b are inputs entering the slice. */
    port(g, "port-" + pfx + "-a", 8, 124, "a", "end", -10);
    wire(g, "wire-" + pfx + "-a-in", [[8, 124], [56, 124]]);
    arrow(wire(g, "wire-" + pfx + "-ainv-direct", [[56, 124], [82, 124]]));
    wire(g, "wire-" + pfx + "-ainv-not", [[56, 124], [56, 148], [60, 148]], true);

    port(g, "port-" + pfx + "-b", 8, 246, "b", "end", -10);
    wire(g, "wire-" + pfx + "-b-in", [[8, 246], [56, 246]]);
    arrow(wire(g, "wire-" + pfx + "-binv-direct", [[56, 246], [82, 246]]));
    wire(g, "wire-" + pfx + "-binv-not", [[56, 246], [56, 270], [60, 270]], true);

    notGate(g, "not-" + pfx + "-a", 60, 148);
    notGate(g, "not-" + pfx + "-b", 60, 270);

    /* ====================== 2:1 inverter muxes ========================= */
    block(g, "mux-" + pfx + "-ainv", "polygon", { points: "82,100 100,118 100,154 82,172" }, "", 0, 0);
    pin(g, 89, 128, "0"); pin(g, 89, 152, "1");
    block(g, "mux-" + pfx + "-binv", "polygon", { points: "82,222 100,240 100,276 82,294" }, "", 0, 0);
    pin(g, 89, 250, "0"); pin(g, 89, 274, "1");

    /* mux outputs fan out to AND / OR / adder (in parallel) */
    wire(g, "wire-" + pfx + "-amux-out", [[100, 136], [120, 136]]);
    wire(g, "wire-" + pfx + "-bmux-out", [[100, 258], [132, 258]]);
    arrow(wire(g, "wire-" + pfx + "-a-to-and", [[120, 136], [170, 136]]));
    arrow(wire(g, "wire-" + pfx + "-a-to-or", [[120, 136], [120, 190], [176, 190]]));
    arrow(wire(g, "wire-" + pfx + "-a-to-adder", [[120, 136], [120, 242], [185, 242]]));
    arrow(wire(g, "wire-" + pfx + "-b-to-and", [[132, 258], [132, 160], [170, 160]]));
    arrow(wire(g, "wire-" + pfx + "-b-to-or", [[132, 258], [132, 210], [176, 210]]));
    arrow(wire(g, "wire-" + pfx + "-b-to-adder", [[132, 258], [185, 258]]));

    /* a junction bubble at every wire connection on the operand fan-out: where a
       input splits to its direct/NOT legs, where each mux output fans to the
       gates, and where the OR leg leaves each operand bus. */
    jdot(g, "dot-" + pfx + "-a-split", 56, 124);
    jdot(g, "dot-" + pfx + "-b-split", 56, 246);
    jdot(g, "dot-" + pfx + "-amux-fan", 120, 136);
    jdot(g, "dot-" + pfx + "-a-or-branch", 120, 190);
    jdot(g, "dot-" + pfx + "-bmux-fan", 132, 258);
    jdot(g, "dot-" + pfx + "-b-or-branch", 132, 210);

    /* ====================== AND / OR / adder ===========================
       No text labels on the gates (the shapes speak for themselves). Each gate's
       output sits at the SAME y as its result-mux input, so the gate→mux wires
       are straight horizontals (AND→0 at y=150, OR→1 at y=200, adder→2 at y=250). */
    block(g, "gate-" + pfx + "-and", "path", { d: "M170 127 H210 A23 23 0 0 1 210 173 H170 Z" }, "", 0, 0);
    wire(g, "wire-" + pfx + "-and-out", [[233, 150], [285, 150]]);

    block(g, "gate-" + pfx + "-or", "path",
      { d: "M170 178 Q185 200 170 222 Q219 222 233 200 Q219 178 170 178 Z" }, "", 0, 0);
    wire(g, "wire-" + pfx + "-or-out", [[233, 200], [285, 200]]);

    block(g, "adder-" + pfx, "rect", { x: 185, y: 232, width: 36, height: 36 }, "+", 203, 253);
    wire(g, "wire-" + pfx + "-sum-out", [[221, 250], [285, 250]]);

    /* carry-in into the adder. The gates were widened toward the adder, so the
       carry-in enters to the RIGHT of them (x=240), drops down, then steps left
       into the adder's top face. MSB: the real ripple carry (neutral, lights with
       the adder). Bit 0: carry-in IS Bnegate, so the Binvert control wire branches
       over to it (shared start [110,50]); stays blue (control), so it isn't lit. */
    if (isMsb) {
      arrow(wire(g, "wire-" + pfx + "-cin", [[240, 60], [240, 224], [203, 224], [203, 232]]));
    } else {
      ctrlWire(g, "wire-" + pfx + "-cin", [[110, 50], [250, 50], [250, 224], [203, 224], [203, 232]]);
      /* solid blue control junction where the carry-in branch taps the Binvert line */
      add(g, "circle", { cx: 110, cy: 50, r: 3, class: "alu-ctrl-dot" });
    }

    /* carry-out: bit 0 leaves the bottom (→ ripple chain); the MSB feeds the
       overflow block, so it's a short stub. */
    if (isMsb) {
      wire(g, "wire-" + pfx + "-cout", [[203, 268], [203, 340]]);
    } else {
      wire(g, "wire-" + pfx + "-cout", [[203, 268], [203, 380]]);
      label(g, 218, 396, "Cout", "alu-ctrl", "start");
    }

    /* ====================== 4:1 result mux ============================= */
    block(g, "mux-" + pfx + "-result", "polygon", { points: "285,113 320,145 320,305 285,337" }, "", 0, 0);
    [["0", 150], ["1", 200], ["2", 250], ["3", 300]].forEach(function (p, i) {
      add(g, "line", { id: "mux-" + pfx + "-result-in" + i, class: "alu-instub", x1: 279, y1: p[1], x2: 285, y2: p[1], "marker-end": "url(#alu-arrow)" });
      pin(g, 296, p[1] + 4, p[0]);
    });
    /* the result bit runs a bit past the slice edge to an output bubble; the
       NOR (zero) connection taps off that same bubble (see wire-*-result-tap). */
    wire(g, "wire-" + pfx + "-result", [[320, 225], [345, 225]]);
    port(g, "port-" + pfx + "-result", 345, 225, null);
    label(g, 366, 212, "Result", "alu-ctrl", "middle");

    /* ====================== less input (left edge) ===================== */
    if (!isMsb) {
      port(g, "port-b0-less", 8, 300, null);
      label(g, 8, 290, "less", "alu-ctrl", "middle");
      wire(g, "wire-b0-less-in", [[8, 300], [285, 300]]);
    } else {
      port(g, "port-msb-less", 8, 300, null);
      /* the MSB's Less input is hardwired to 0 (only bit 0's Less is driven by
         the Set feedback), so label it with the constant value. */
      label(g, 8, 290, "0", "alu-ctrl", "middle");
      wire(g, "wire-msb-less-in", [[8, 300], [285, 300]]);
    }

    /* ====================== MSB extras: Set + overflow ================= */
    if (isMsb) {
      /* Set is the MSB sum bit. It is tapped (junction bubble, drawn with the
         sum→overflow line below) off that line and leaves the slice's RIGHT face;
         the feedback wire then loops around the slice bottom and back up the left
         bus to bit 0's Less input. */
      wire(g, "wire-msb-set", [[265, 360], [330, 360]]);
      label(g, 335, 353, "Set", "alu-ctrl", "start");

      /* Overflow-detection block. The carry-in is NOT fed here — it only enters
         the adder. Instead the A-mux and B-mux outputs (the operand sign bits)
         drop into the block, alongside the carry-out and the sum. */
      var ov = add(g, "g", { id: "block-msb-ovf", class: "alu-node" });
      add(ov, "title", { text: "Overflow detection" });
      add(ov, "rect", { x: 100, y: 400, width: 170, height: 40, rx: 3, class: "alu-shape" });
      add(ov, "text", { x: 185, y: 424, class: "alu-label alu-label--sm", text: "Overflow detection" });
      /* the A-mux output runs straight down into the overflow block; the B-mux
         output taps off (junction bubble) on its run to the adder and drops down
         too — both enter the block's top face. */
      arrow(wire(g, "wire-msb-amux-to-ovf", [[120, 242], [120, 400]]));
      arrow(wire(g, "wire-msb-bmux-to-ovf", [[155, 258], [155, 400]]));
      jdot(g, "dot-msb-a-adder-branch", 120, 242);   /* A bus: adder vs overflow */
      jdot(g, "dot-msb-bmux-ovf", 155, 258);          /* B bus: adder vs overflow */
      arrow(wire(g, "wire-msb-cout-to-ovf", [[203, 340], [203, 400]]));
      /* the adder's sum is tapped (bubble) and drops straight down into the
         overflow-detection block. */
      arrow(wire(g, "wire-msb-sum-to-ovf", [[265, 250], [265, 400]]));
      jdot(g, "dot-msb-sum-ovf", 265, 250);
      /* the Set branch taps this SAME sum→overflow line lower down (junction
         bubble), then exits the slice's right face. */
      jdot(g, "dot-msb-set-tap", 265, 360);
      /* Binvert also taps in: its x=110 line is extended straight down past the
         B-mux elbow to enter the overflow block from the TOP edge (blue control).
         The bubble marks where it splits — straight down to overflow vs. left into
         the B-mux. */
      var bw = wire(g, "wire-msb-binv-to-ovf", [[110, 220], [110, 400]]);
      bw.setAttribute("class", "alu-wire alu-ctrl-wire");
      bw.setAttribute("marker-end", "url(#alu-arrow-ctrl)");
      add(g, "circle", { cx: 110, cy: 220, r: 3, class: "alu-ctrl-dot" });
      wire(g, "wire-msb-ovf-out", [[270, 420], [378, 420]]);
      port(g, "port-msb-ovf", 378, 420, null);
      label(g, 383, 413, "Overflow", "alu-ctrl", "start");
    }

    return g;
  }

  /* ------------------------------------------------------------------ *
     ASSEMBLE THE DIAGRAM (two slices + ellipsis + inter-slice wiring)
   * ------------------------------------------------------------------ */
  var OX = 95, OY_B0 = 10, OY_MSB = 470;

  function buildDiagram(svg) {
    /* arrowhead marker shared by every control-input wire */
    var defs = add(svg, "defs", null);
    /* a small OPEN arrowhead: just two short strokes converging to a point (no
       fill, no back edge), used on every datapath/control input. */
    var mk = add(defs, "marker", {
      id: "alu-arrow", markerWidth: 8, markerHeight: 8,
      refX: 5, refY: 4, orient: "auto", markerUnits: "userSpaceOnUse"
    });
    add(mk, "path", { d: "M1 1 L5 4 L1 7", class: "alu-arrowhead" });
    /* the same shape for the control inputs (inherits the blue wire colour) */
    var mkc = add(defs, "marker", {
      id: "alu-arrow-ctrl", markerWidth: 8, markerHeight: 8,
      refX: 5, refY: 4, orient: "auto", markerUnits: "userSpaceOnUse"
    });
    add(mkc, "path", { d: "M1 1 L5 4 L1 7", class: "alu-arrowhead-ctrl" });

    /* --- bit-0 slice --- */
    var s0 = buildSlice("b0", false);
    s0.setAttribute("transform", "translate(" + OX + "," + OY_B0 + ")");
    svg.appendChild(s0);

    /* --- MSB slice --- */
    var sm = buildSlice("msb", true);
    sm.setAttribute("transform", "translate(" + OX + "," + OY_MSB + ")");
    svg.appendChild(sm);

    /* --- the "⋮" ellipsis standing in for bits 1..30 (no caption) --- */
    var ell = add(svg, "g", { class: "alu-ellipsis" });
    [0, 1, 2].forEach(function (i) {
      add(ell, "circle", { cx: OX + 185, cy: 450 + i * 13, r: 3, class: "alu-dot" });
    });

    /* --- inter-slice wiring on the top SVG (between the boxes) --- */
    var net = add(svg, "g", { class: "alu-net" });

    /* the carry chain: bit-0 CarryOut ripples down into the MSB CarryIn */
    wire(net, "wire-carry-chain",
      [[OX + 203, OY_B0 + 380], [OX + 203, OY_MSB + 45], [OX + 240, OY_MSB + 45], [OX + 240, OY_MSB + 60]]);

    /* the Set -> Less feedback: MSB Set exits the slice's RIGHT face, loops down
       around the slice bottom, then up the left bus to bit-0 Less. */
    wire(net, "wire-set-feedback",
      [[OX + 330, OY_MSB + 360], [OX + 350, OY_MSB + 360], [OX + 350, OY_MSB + 485],
       [OX - 42, OY_MSB + 485], [OX - 42, OY_B0 + 300], [OX + 8, OY_B0 + 300]]);

    /* the Zero output: a NOR of every Result bit (here, the two shown bits).
       Same shield shape as the OR gate inside a slice, with a NOT bubble on the
       tip. The Zero lead is run out a good distance so it reads as an output. */
    /* The NOR sits a little away from the result bus; each shown Result reaches
       it as a visible input lead, and a small "⋮" between them stands in for the
       30 other Result bits that also drive the NOR. */
    arrow(wire(net, "wire-b0-result-tap",
      [[OX + 345, OY_B0 + 225], [492, OY_B0 + 225], [492, 436], [519.5, 436]]));
    arrow(wire(net, "wire-msb-result-tap",
      [[OX + 345, OY_MSB + 225], [492, OY_MSB + 225], [492, 464], [519.5, 464]]));
    /* identical shield to the in-slice OR gate (back x=515, width 63, height 44),
       just with a NOT bubble on its point — that's what makes it a NOR. */
    block(net, "gate-zero-nor", "path",
      { d: "M515 428 Q530 450 515 472 Q564 472 578 450 Q564 428 515 428 Z" }, "", 0, 0);
    add(net.querySelector("#gate-zero-nor"), "circle", { cx: 581, cy: 450, r: 2.6, class: "alu-shape" });
    /* "⋮" — the other Result bits feeding the NOR (more than the two drawn) */
    var zellip = add(net, "g", { class: "alu-ellipsis" });
    [444, 450, 456].forEach(function (yy) {
      add(zellip, "circle", { cx: 503, cy: yy, r: 2, class: "alu-dot" });
    });
    wire(net, "wire-zero-out", [[584, 450], [625, 450]]);
    port(net, "port-zero", 625, 450, "Zero", "start", 10);

    /* Lift every junction / port bubble into a single overlay ABOVE all wires
       (across slices AND the inter-slice net) so each wire reads as TERMINATING
       at the bubble: the bubble paints on top of the wire, never the reverse.
       Each bubble inherits its slice's translate so it stays put. */
    var bubbles = add(svg, "g", { class: "alu-bubbles" });
    Array.prototype.forEach.call(
      svg.querySelectorAll(".alu-port, .alu-tapdot, .alu-ctrl-dot, .alu-jdot"),
      function (b) {
        var slice = b.closest ? b.closest("g.alu-slice") : null;
        if (slice && slice.getAttribute("transform")) {
          b.setAttribute("transform", slice.getAttribute("transform"));
        }
        bubbles.appendChild(b);
      }
    );

    /* top overlay layer for the travelling beads (populated per operation) */
    beadLayer = add(svg, "g", { class: "alu-beads" });
  }

  /* ------------------------------------------------------------------ *
     THE OPERATION TABLE — the only thing you edit to change behaviour
   * ------------------------------------------------------------------ */
  var NAMED_OPS = [
    { code: 0x0, name: "AND" },       /* 0000 */
    { code: 0x1, name: "OR" },        /* 0001 */
    { code: 0x2, name: "add" },       /* 0010 */
    { code: 0x6, name: "subtract" },  /* 0110 */
    { code: 0x7, name: "slt" },       /* 0111 */
    { code: 0xC, name: "NOR" },       /* 1100 */
    { code: 0xD, name: "NAND" }       /* 1101 */
  ];

  function fields(code) {
    return {
      Ainv: (code >> 3) & 1,   /* control[3] — invert operand A */
      Bneg: (code >> 2) & 1,   /* control[2] — invert operand B + carry-in */
      op: code & 3             /* control[1:0] — result-mux select */
    };
  }

  /* Junction bubbles + the wires that meet at each. A junction lights whenever
     ANY wire passing through it is lit, so the dot reads as "on" exactly when the
     datapath actually flows through that connection. */
  function junctionDefs(p) {
    var J = [
      ["dot-" + p + "-a-split", ["wire-" + p + "-a-in", "wire-" + p + "-ainv-direct", "wire-" + p + "-ainv-not"]],
      ["dot-" + p + "-b-split", ["wire-" + p + "-b-in", "wire-" + p + "-binv-direct", "wire-" + p + "-binv-not"]],
      ["dot-" + p + "-amux-fan", ["wire-" + p + "-amux-out", "wire-" + p + "-a-to-and", "wire-" + p + "-a-to-or", "wire-" + p + "-a-to-adder"]],
      ["dot-" + p + "-a-or-branch", ["wire-" + p + "-a-to-or", "wire-" + p + "-a-to-adder"]],
      ["dot-" + p + "-bmux-fan", ["wire-" + p + "-bmux-out", "wire-" + p + "-b-to-and", "wire-" + p + "-b-to-or", "wire-" + p + "-b-to-adder"]],
      ["dot-" + p + "-b-or-branch", ["wire-" + p + "-b-to-or", "wire-" + p + "-b-to-and"]]
    ];
    if (p === "msb") {
      J.push(["dot-msb-a-adder-branch", ["wire-msb-a-to-adder", "wire-msb-amux-to-ovf"]]);
      J.push(["dot-msb-bmux-ovf", ["wire-msb-b-to-adder", "wire-msb-bmux-to-ovf"]]);
    }
    return J;
  }

  /* Mechanically derive the lit element ids for ANY of the 16 codes. */
  function deriveActiveIds(code) {
    var f = fields(code);
    var ids = [];
    function push() { for (var i = 0; i < arguments.length; i++) ids.push(arguments[i]); }

    /* NOTE: the control SELECT lines (ainv-sel / binv-sel / op-sel) are drawn as
       neutral input arrows and are intentionally NOT lit — they are control, not
       datapath. Inversion is shown by the dashed NOT legs; the chosen operation
       by the lit result-mux input number. */
    function muxes(p) {
      push("port-" + p + "-a", "wire-" + p + "-a-in", "mux-" + p + "-ainv", "wire-" + p + "-amux-out");
      push("port-" + p + "-b", "wire-" + p + "-b-in", "mux-" + p + "-binv", "wire-" + p + "-bmux-out");
      if (f.Ainv) push("wire-" + p + "-ainv-not", "not-" + p + "-a");
      else push("wire-" + p + "-ainv-direct");
      if (f.Bneg) push("wire-" + p + "-binv-not", "not-" + p + "-b");
      else push("wire-" + p + "-binv-direct");
    }
    function toGate(p, gate) { push("wire-" + p + "-a-to-" + gate, "wire-" + p + "-b-to-" + gate); }
    function resultOut(p, sel) {
      push("mux-" + p + "-result", "mux-" + p + "-result-in" + sel,
        "wire-" + p + "-result", "port-" + p + "-result",
        "wire-" + p + "-result-tap", "gate-zero-nor", "wire-zero-out", "port-zero");
    }
    function arithCarry() {
      push("wire-b0-cout", "wire-carry-chain", "wire-msb-cout", "wire-msb-cin");
      push("block-msb-ovf", "wire-msb-amux-to-ovf", "wire-msb-bmux-to-ovf",
        "wire-msb-cout-to-ovf", "wire-msb-sum-to-ovf", "dot-msb-sum-ovf",
        "wire-msb-ovf-out", "port-msb-ovf");
    }

    if (f.op === 0 || f.op === 1) {
      var gate = f.op === 0 ? "and" : "or";
      ["b0", "msb"].forEach(function (p) {
        muxes(p); toGate(p, gate);
        push("gate-" + p + "-" + gate, "wire-" + p + "-" + gate + "-out");
        resultOut(p, f.op);
      });
    } else if (f.op === 2) {
      ["b0", "msb"].forEach(function (p) {
        muxes(p); toGate(p, "adder");
        push("adder-" + p, "wire-" + p + "-sum-out");
        resultOut(p, 2);
      });
      arithCarry();   /* lights wire-msb-cin; bit-0's carry-in is the blue Binvert control */
    } else {
      /* LESS / slt: every slice subtracts, and the MSB's Set output feeds bit
         0's Less. The top (bit-0) slice lights its muxes, NOT leg, and adder
         just like the MSB — even though bit 0's Result comes from Less (3). */
      muxes("msb"); toGate("msb", "adder");
      push("adder-msb", "wire-msb-cin");
      muxes("b0"); toGate("b0", "adder");
      push("adder-b0");
      arithCarry();
      push("wire-msb-set", "dot-msb-set-tap", "wire-set-feedback", "port-b0-less", "wire-b0-less-in");
      /* the MSB's Less input is the constant 0; it also selects result-mux
         input 3, so the MSB's Result bit (0) flows out to the Zero NOR too. */
      push("port-msb-less", "wire-msb-less-in");
      resultOut("msb", 3);
      resultOut("b0", 3);
    }

    /* light each junction bubble that sits on an active wire */
    var lit = {};
    for (var k = 0; k < ids.length; k++) lit[ids[k]] = 1;
    ["b0", "msb"].forEach(function (p) {
      junctionDefs(p).forEach(function (j) {
        for (var i = 0; i < j[1].length; i++) {
          if (lit[j[1][i]]) { ids.push(j[0]); break; }
        }
      });
    });
    return ids;
  }

  /* Build the single 16-entry table the engine consumes. */
  var OPS = [];
  for (var c = 0; c < 16; c++) {
    var named = NAMED_OPS.filter(function (o) { return o.code === c; })[0];
    var bits = ("0000" + c.toString(2)).slice(-4);
    OPS[c] = {
      code: c, bits: bits,
      name: named ? named.name : "control=" + bits,
      named: !!named, resultSel: c & 3,
      ids: deriveActiveIds(c)
    };
  }

  /* A plain-language description of the active path, for the live caption. */
  function describe(code) {
    var f = fields(code);
    var a = f.Ainv ? "¬a" : "a";
    var b = f.Bneg ? "¬b" : "b";
    var invNote = (f.Ainv || f.Bneg)
      ? " The dashed legs are the inverted (NOT) mux inputs." : "";
    if (f.op === 0)
      return a + " AND " + b + " → result-mux input 0 → Result, in every bit slice." + invNote;
    if (f.op === 1)
      return a + " OR " + b + " → result-mux input 1 → Result, in every bit slice." + invNote;
    if (f.op === 2)
      return a + " + " + b + (f.Bneg ? " + 1" : "") +
        " through the adders; the carry ripples top→bottom (bit 0's carry-in is the " +
        "Bnegate control, here " + f.Bneg + ") → result-mux input 2 (Sum) → Result." + invNote;
    return "The MSB subtracts (" + a + " − b path), and its Set output travels the " +
      "feedback wire down to bit 0's Less input → bit-0 result-mux input 3 → Result₀ " +
      "(signed set-on-less-than)." + invNote;
  }

  /* ------------------------------------------------------------------ *
     HIGHLIGHT ENGINE
   * ------------------------------------------------------------------ */
  var svg, liveEl, nameEl, bitsEl, presetEls, bitEls, beadLayer, beads = [];

  /* A wire's flow "stage" (0 = operands entering, rising toward the outputs).
     Beads are keyed off this — not push order — so a and b enter TOGETHER (both
     stage 0) and the whole wave traces the datapath in parallel, left→right,
     rather than one wire at a time. */
  function stageOf(id, code) {
    var raw = id.replace(/^wire-/, "");
    var pfx = /^msb-/.test(raw) ? "msb" : (/^b0-/.test(raw) ? "b0" : "");
    var s = raw.replace(/^(b0|msb)-/, "");
    var arith = (code & 3) === 2;   /* add / subtract */

    /* operands rise into the muxes the same way for every slice */
    if (/^[ab]-in$/.test(s)) return 0;
    if (/inv-(direct|not)$/.test(s)) return 1;
    if (/mux-out$/.test(s)) return 2;

    if (!arith) {
      /* ---- original (parallel) timing: AND/OR/NOR/NAND and slt ---- */
      if (/-to-(and|or|adder)$/.test(s)) return 3;
      if (/^(and|or|sum)-out$/.test(s)) return 4;
      /* the carry CASCADE is strictly sequential: slice-1 carry-out → ripple
         chain → slice-2 carry-in. */
      if (s === "cout") return 5;
      if (s === "carry-chain") return 6;
      if (s === "cin") return 7;
      if (/-to-ovf$/.test(s) || s === "set" || s === "result") return 5;
      if (/result-tap$/.test(s) || s === "set-feedback" || s === "ovf-out") return 6;
      if (/less-in$/.test(s) || s === "zero-out") return 7;
      return 4;
    }

    /* ---- add / subtract: cascade top→bottom along the carry chain ----
       Bit 0 adds first; its carry-out ripples to the MSB. The MSB's operands
       are sent in early but WAIT at the adder input until the carry arrives,
       then the MSB adds and drives overflow + its Result. */
    if (pfx === "b0") {
      if (/-to-adder$/.test(s)) return 3;
      if (s === "sum-out") return 4;
      if (s === "cout") return 5;
      if (s === "result") return 5;
      if (s === "result-tap") return 6;
    }
    if (s === "carry-chain") return 6;
    if (s === "cin") return 7;                 /* carry arrives at the MSB adder */
    if (pfx === "msb") {
      if (/-to-adder$/.test(s)) return 8;       /* operands waited; now enter the adder */
      if (s === "sum-out") return 9;
      if (s === "cout") return 9;               /* MSB carry-out drops to overflow */
      if (/-to-ovf$/.test(s)) return 10;
      if (s === "ovf-out") return 11;
      if (s === "result") return 10;
      if (s === "result-tap") return 11;
    }
    if (s === "zero-out") return 12;            /* fires once both Results arrive */
    return 4;
  }

  /* Rebuild the travelling beads. One overlay path per active wire, animated with
     a per-bead Web Animation so the bead moves at a CONSTANT pixel speed on every
     wire (duration ∝ the wire's real length — no speeding up on long wires). Each
     stage only starts once the longest wire of the previous stage has fully
     arrived, so the wave traces the datapath (and the carry cascade) smoothly and
     in order. Each bead inherits its slice's translate to sit on top of the wire. */
  function rebuildBeads(op) {
    if (!beadLayer) return;
    for (var j = 0; j < beads.length; j++) beadLayer.removeChild(beads[j]);
    beads = [];
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var SPEED = 0.2;                 /* user-units per ms — the same everywhere */
    var DASH = 14;                   /* bead (dash) length */
    var PAD = DASH + 8;              /* park the bead this far off each end so its
                                        round cap is fully clear — no fade needed */
    var MARGIN = 2 * PAD;            /* extra travel: slide fully in, then fully out */
    var recs = [], i;

    op.ids.forEach(function (id) {
      var el = svg.querySelector("#" + CSS.escape(id));
      if (!el || el.tagName.toLowerCase() !== "path") return;
      var cls = el.getAttribute("class") || "";
      if (cls.indexOf("alu-wire") === -1 || cls.indexOf("alu-ctrl-wire") !== -1) return;
      var d = el.getAttribute("d");
      if (!d) return;
      var bead = add(beadLayer, "path", { d: d, class: "alu-bead" });
      var slice = el.closest ? el.closest("g.alu-slice") : null;
      if (slice && slice.getAttribute("transform")) bead.setAttribute("transform", slice.getAttribute("transform"));
      var len = 60;
      try { len = bead.getTotalLength() || 60; } catch (e) {}
      recs.push({ bead: bead, stage: stageOf(id, op.code), len: len });
      beads.push(bead);
    });
    if (!recs.length) return;

    /* cumulative per-stage delay: a stage begins when the longest wire of the
       previous stage has arrived, keeping one constant speed across hand-offs. */
    var maxStage = 0;
    for (i = 0; i < recs.length; i++) if (recs[i].stage > maxStage) maxStage = recs[i].stage;
    var stageMax = [];
    for (i = 0; i <= maxStage; i++) stageMax[i] = 0;
    recs.forEach(function (r) { var t = r.len + MARGIN; if (t > stageMax[r.stage]) stageMax[r.stage] = t; });
    var stageDelay = [0];
    for (i = 1; i <= maxStage; i++) stageDelay[i] = stageDelay[i - 1] + stageMax[i - 1] / SPEED;

    var maxEnd = 0;
    recs.forEach(function (r) {
      var end = stageDelay[r.stage] + (r.len + MARGIN) / SPEED;
      if (end > maxEnd) maxEnd = end;
    });
    var CYCLE = maxEnd + 1800;       /* + a pause before the wave repeats */

    recs.forEach(function (r) {
      var travel = r.len + MARGIN;
      var f = Math.max((travel / SPEED) / CYCLE, 0.002);
      /* Opacity stays at 1 the whole time — the bead is simply parked off the
         wire (dash beyond either end) when it isn't travelling, so it slides in
         and out cleanly instead of fading. */
      r.bead.animate([
        { strokeDashoffset: PAD + "px",               opacity: 1, offset: 0 },
        { strokeDashoffset: (-(r.len + PAD)) + "px",  opacity: 1, offset: f },
        { strokeDashoffset: (-(r.len + PAD)) + "px",  opacity: 1, offset: 1 }
      ], { duration: CYCLE, delay: stageDelay[r.stage], iterations: Infinity, easing: "linear" });
    });
  }

  function applyHighlight(code) {
    var op = OPS[code & 15];

    var lit = svg.querySelectorAll(".is-active");
    for (var i = 0; i < lit.length; i++) lit[i].classList.remove("is-active");

    op.ids.forEach(function (id) {
      var el = svg.querySelector("#" + CSS.escape(id));
      if (el) el.classList.add("is-active");
    });
    rebuildBeads(op);

    nameEl.textContent = op.name;
    bitsEl.textContent = op.bits;
    svg.setAttribute("aria-label",
      "ALU datapath for " + op.name + ", control " + op.bits + ". " + describe(code));
    liveEl.textContent = op.name + " (" + op.bits + "): " + describe(code);

    syncControls(code);
  }

  function syncControls(code) {
    bitEls.forEach(function (btn) {
      var bit = +btn.getAttribute("data-bit");
      var on = (code >> bit) & 1;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      var v = btn.querySelector(".alu-bit__val");
      if (v) v.textContent = on;
    });
    presetEls.forEach(function (btn) {
      btn.setAttribute("aria-pressed", +btn.getAttribute("data-code") === code ? "true" : "false");
    });
  }

  /* ------------------------------------------------------------------ *
     INIT
   * ------------------------------------------------------------------ */
  var current = 0x2;   /* default: "add" — shows the carry chain immediately */

  function init() {
    var widget = document.getElementById("alu-widget");
    if (!widget) return;
    svg = document.getElementById("alu-diagram");
    if (!svg) return;

    buildDiagram(svg);

    liveEl = widget.querySelector(".alu-widget__live");
    nameEl = document.getElementById("alu-op-name");
    bitsEl = document.getElementById("alu-op-bits");
    presetEls = Array.prototype.slice.call(widget.querySelectorAll(".alu-preset"));
    bitEls = Array.prototype.slice.call(widget.querySelectorAll(".alu-bit"));

    presetEls.forEach(function (btn) {
      btn.addEventListener("click", function () {
        current = +btn.getAttribute("data-code");
        applyHighlight(current);
      });
    });
    bitEls.forEach(function (btn) {
      btn.addEventListener("click", function () {
        current ^= (1 << +btn.getAttribute("data-bit"));
        applyHighlight(current);
      });
    });

    applyHighlight(current);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
