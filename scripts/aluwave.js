/* =========================================================================
   aluwave.js — the static-ish "1-bit ALU waveform" widget in the Hands On
   grid. Draws a timing diagram of the 1-bit ALU over 80 ns:
     - a signal-name panel on the left (each name has a colour swatch you can
       click to HIDE that signal; hidden signals collapse to a short strip whose
       swatch you click to bring them back),
     - a "Time (ns)" scale on top,
     - the traces on the right, colour-coded by role,
     - a travelling bead per visible signal (like the datapath), all starting at
       0 ns and sweeping forward together at the same speed.

   Self-contained. Reuses only the design tokens; no other script. Auto-inits
   every `.aluwave` on the page. Styles: .aluwave / .awv-* in main.css.
   ========================================================================= */
(function () {
  "use strict";
  var SVGNS = "http://www.w3.org/2000/svg";

  // Geometry (SVG user units; the plate scales the whole thing to fit).
  var NAMEW = 104, HEADH = 38, W = 502, STEPW = 48, N = 8;
  var PLOTL = NAMEW, PLOTR = PLOTL + STEPW * N;
  var LANEH = 34, STRIP = 16;            // full lane vs collapsed strip height
  var NAMECX = (32 + NAMEW) / 2;         // name centred in the panel, right of the eye
  var COLOR = { in: "#b794f6", ctrl: "#60a5fa", out: "#d4bbff" };   /* dark-card readable */
  // Bead motion — the datapath's own recipe: a fat dash sliding along the path at
  // a constant pixel speed, then parked off the end for the rest of a long cycle
  // (so a ripple passes only ~every 10 s).
  var DASH = 12, PAD = DASH + 8, MARGIN = 2 * PAD, SPEED = 0.18, CYCLE = 10000;

  function el(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    return e;
  }
  function txt(s, x, y, cls, anchor) {
    var t = el("text", { x: x, y: y, "class": cls });
    if (anchor) t.setAttribute("text-anchor", anchor);
    t.textContent = s;
    return t;
  }
  function railHi(top) { return top + 8; }
  function railLo(top) { return top + 26; }
  function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }

  function initAluwave(root) {
    var scope = root.querySelector(".aluwave__scope");
    if (!scope) return;

    var b  = [], a = [], op = [], res = [], t;
    for (t = 0; t < N; t++) {
      b[t]  = t % 2;
      a[t]  = (t >> 1) & 1;        // input a: alternates every 2 cycles
      op[t] = (t >> 2) & 1;        // control: every 4 cycles
      res[t] = op[t] ? (a[t] | b[t]) : (a[t] & b[t]);
    }
    var signals = [
      { name: "a", role: "in", bits: a, visible: true },
      { name: "b", role: "in", bits: b, visible: true },
      { name: "operation", role: "ctrl", bits: op, visible: true },
      { name: "result", role: "out", bits: res, visible: true }
    ];

    var beads = [];   // { s, el } for the currently-visible signals

    function pathD(bits, top) {
      var yv = function (v) { return v ? railHi(top) : railLo(top); };
      var d = "M " + PLOTL + " " + yv(bits[0]);
      for (var i = 0; i < N; i++) {
        d += " H " + (PLOTL + (i + 1) * STEPW);
        if (i + 1 < N && bits[i + 1] !== bits[i]) d += " V " + yv(bits[i + 1]);
      }
      return d;
    }

    function build() {
      // lay out lanes by visibility
      var top = HEADH, i;
      for (i = 0; i < signals.length; i++) {
        signals[i].top = top;
        signals[i].h = signals[i].visible ? LANEH : STRIP;
        top += signals[i].h;
      }
      var H = top;

      var svg = el("svg", {
        "class": "awv-svg", viewBox: "0 0 " + W + " " + H, role: "img",
        "aria-label": "Timing diagram of the 1-bit ALU over 80 nanoseconds. " +
          "Inputs a and b, control operation, and output result. Click a signal's " +
          "swatch to hide or show it."
      });

      // header labels
      svg.appendChild(txt("Signal", NAMEW / 2, 15, "awv-hdr", "middle"));
      svg.appendChild(txt("Time (ns)", (PLOTL + PLOTR) / 2, 15, "awv-hdr", "middle"));
      // time ticks (0 nudged right so it clears the vertical bar)
      for (i = 0; i <= N; i++) {
        var tx = PLOTL + i * STEPW;
        svg.appendChild(txt(String(i * 10), i === 0 ? PLOTL + 10 : tx, 31, "awv-time", "middle"));
      }
      // vertical step gridlines (t=0 line is the panel divider)
      var g = "";
      for (i = 0; i <= N; i++) g += "M " + (PLOTL + i * STEPW) + " " + HEADH + " V " + H + " ";
      svg.appendChild(el("path", { "class": "awv-grid", d: g.replace(/\s+$/, "") }));
      // horizontal separators between rows
      for (i = 1; i < signals.length; i++)
        svg.appendChild(el("line", { "class": "awv-rowsep", x1: 0, y1: signals[i].top, x2: W, y2: signals[i].top }));
      // header underline + panel bar (on top of the grid)
      svg.appendChild(el("line", { "class": "awv-div", x1: 0, y1: HEADH, x2: W, y2: HEADH }));
      svg.appendChild(el("line", { "class": "awv-div", x1: NAMEW, y1: 0, x2: NAMEW, y2: H }));

      // per-signal: swatch toggle + name (+ trace + bead when visible)
      beads = [];
      for (i = 0; i < signals.length; i++) addLane(svg, signals[i]);

      // hover scrubber guide — from the time axis to the bottom of the traces;
      // positioned/shown by the pointermove handler.
      svg.appendChild(el("line", { "class": "awv-cursor", x1: 0, y1: HEADH, x2: 0, y2: H }));

      // swap in, THEN start the bead animations (WAA needs attached elements)
      var old = scope.querySelector(".awv-svg");
      if (old) scope.removeChild(old);
      scope.appendChild(svg);
      if (!reduce) {
        for (var k = 0; k < beads.length; k++) {
          try { animateBead(beads[k].el); } catch (e) { /* no-anim fallback */ }
        }
      }
    }

    function addLane(svg, s) {
      var cy = s.top + s.h / 2;

      // colourless eye toggle: open eye = shown, slashed eye = hidden
      var grp = el("g", {
        "class": "awv-toggle" + (s.visible ? "" : " awv-toggle--off"),
        tabindex: "0", role: "button", "aria-pressed": s.visible ? "true" : "false",
        "aria-label": (s.visible ? "Hide signal " : "Show signal ") + s.name
      });
      // a small eye icon (16-unit artwork scaled down), centred at x=19, y=cy
      var ES = 0.68;
      var eye = el("g", { transform: "translate(" + (19 - 8 * ES).toFixed(2) + "," + (cy - 8 * ES).toFixed(2) + ") scale(" + ES + ")" });
      eye.appendChild(el("path", { "class": "awv-eye__lid",
        d: "M1 8 C3 4.5 5.4 3 8 3 C10.6 3 13 4.5 15 8 C13 11.5 10.6 13 8 13 C5.4 13 3 11.5 1 8 Z" }));
      eye.appendChild(el("circle", { "class": "awv-eye__pupil", cx: 8, cy: 8, r: 2.1 }));
      if (!s.visible) eye.appendChild(el("line", { "class": "awv-eye__slash", x1: 2, y1: 2.5, x2: 14, y2: 13.5 }));
      grp.appendChild(eye);
      grp.appendChild(el("rect", { x: 6, y: cy - 11, width: 26, height: 22, fill: "transparent" }));  // hit area
      grp.appendChild(el("title", {})).textContent = (s.visible ? "Hide " : "Show ") + s.name;
      function toggle() { s.visible = !s.visible; build(); }
      grp.addEventListener("click", toggle);
      grp.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Enter" || e.key === "Spacebar") { e.preventDefault(); toggle(); }
      });
      svg.appendChild(grp);

      // name
      var nameCls = "awv-name awv-name--" + s.role + (s.visible ? "" : " awv-name--muted");
      svg.appendChild(txt(s.name, NAMECX, cy + (s.visible ? 4 : 3), nameCls, "middle"));

      if (!s.visible) return;

      // trace (starts on the vertical bar)
      var dStr = pathD(s.bits, s.top);
      svg.appendChild(el("path", { "class": "awv-trace awv-trace--" + s.role, d: dStr }));
      // bead overlay: a copy of the trace styled as the datapath's dash-bulge;
      // its colour (and glow) comes from the signal via `color`/currentColor.
      var bead = el("path", { "class": "awv-bead", d: dStr });
      bead.style.color = COLOR[s.role];
      svg.appendChild(bead);
      beads.push({ s: s, el: bead });
    }

    /* One bead per trace, animated EXACTLY like the datapath: a fat round-capped
       dash slid along the path (strokeDashoffset) at a constant pixel speed, then
       parked off the end for the rest of a long cycle so ripples are infrequent. */
    function animateBead(bead) {
      var len = 200;
      try { len = bead.getTotalLength() || 200; } catch (e) {}
      var f = Math.max(((len + MARGIN) / SPEED) / CYCLE, 0.002);
      bead.animate([
        { strokeDashoffset: PAD + "px", opacity: 1, offset: 0 },
        { strokeDashoffset: (-(len + PAD)) + "px", opacity: 1, offset: f },
        { strokeDashoffset: (-(len + PAD)) + "px", opacity: 1, offset: 1 }
      ], { duration: CYCLE, iterations: Infinity, easing: "linear" });
    }

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    build();

    /* ---- hover scrubber: vertical guide through the cursor + a value tooltip
       (each value coloured to match its signal). Attached once; it reads the
       current SVG/lanes on every move, so it survives rebuilds. ---- */
    var tip = document.createElement("div");
    tip.className = "awv-tip";
    root.appendChild(tip);

    function onMove(e) {
      var svgEl = scope.querySelector(".awv-svg");
      var line = scope.querySelector(".awv-cursor");
      if (!svgEl || !line) return;
      var r = svgEl.getBoundingClientRect();
      var vbX = (e.clientX - r.left) / r.width * W;
      if (vbX < PLOTL || vbX > PLOTR) { onLeave(); return; }
      var step = clamp(Math.floor((vbX - PLOTL) / STEPW), 0, N - 1);
      var tns = clamp(Math.round((vbX - PLOTL) / (PLOTR - PLOTL) * (N * 10)), 0, N * 10);

      line.setAttribute("x1", vbX);
      line.setAttribute("x2", vbX);
      line.classList.add("is-on");

      var html = '<div class="awv-tip__t">' + tns + " ns</div>";
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (!s.visible) continue;
        html += '<div class="awv-tip__row" style="color:' + COLOR[s.role] + '">' +
                "<span>" + s.name + "</span><span>" + (s.bits[step] | 0) + "</span></div>";
      }
      tip.innerHTML = html;
      tip.classList.add("is-on");

      // place next to the cursor (flip left near the right edge)
      var ar = root.getBoundingClientRect();
      var x = e.clientX - ar.left, y = e.clientY - ar.top, off = 16, tw = tip.offsetWidth;
      x = (x + off + tw > ar.width) ? (x - off - tw) : (x + off);
      tip.style.left = x + "px";
      tip.style.top = (y + 14) + "px";
    }
    function onLeave() {
      var line = scope.querySelector(".awv-cursor");
      if (line) line.classList.remove("is-on");
      tip.classList.remove("is-on");
    }
    scope.addEventListener("pointermove", onMove);
    scope.addEventListener("pointerleave", onLeave);
  }

  var roots = document.querySelectorAll(".aluwave");
  for (var i = 0; i < roots.length; i++) initAluwave(roots[i]);
})();
