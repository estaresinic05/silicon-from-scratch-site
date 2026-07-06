/* =========================================================================
   slice-wave.js — interactive timing diagram for the 1-bit ALU slice
   (the "Addition Incoming" section). Draws the slice's signals over 80 ns:
     - data inputs a, b, Cin        → light purple (#b794f6)
     - control Ainvert, Binvert     → light blue   (#60a5fa)
     - control Operation            → light blue, a 2-BIT BUS shown in binary radix
     - outputs Result, Cout         → lavender     (#d4bbff)
   Each row carries the style-guide eye toggle (open = shown, slashed = hidden);
   hidden rows collapse to a short strip whose eye brings them back.
   Reuses the .awv-* styles from main.css. Self-contained; inits every
   `.slicewave` on the page (never touches the home page's `.aluwave`).
   ========================================================================= */
(function () {
  "use strict";
  var SVGNS = "http://www.w3.org/2000/svg";

  // Geometry (SVG user units; the scope scales the whole thing to fit).
  var NAMEW = 148, HEADH = 38, STEPW = 46, N = 8;
  var PLOTL = NAMEW, PLOTR = PLOTL + STEPW * N, W = PLOTR + 14;
  var LANEH = 34, STRIP = 16, TXW = 6;            // full lane vs collapsed strip; bus transition half-width
  var NAMECX = 84;                                // name centred right of the eye
  var COLOR = { in: "#b794f6", ctrl: "#60a5fa", out: "#d4bbff" };
  // Bead motion — the datapath recipe (a fat dash sliding at a constant pixel
  // speed, parked off the end for the rest of a long cycle).
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
  function railMid(top) { return top + 17; }
  function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }

  function initWave(root) {
    var scope = root.querySelector(".aluwave__scope");
    if (!scope) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---- stimulus + the slice's actual logic, computed so it's always right ---- */
    var a   = [0, 1, 0, 1, 0, 1, 0, 1];      // toggles every cycle
    var b   = [0, 0, 1, 1, 0, 0, 1, 1];      // toggles every other cycle
    var cin = [0, 0, 0, 0, 1, 1, 1, 1];      // toggles every four cycles
    var ain = [0, 1, 0, 0, 0, 0, 1, 0];          // stays low all through op == 10 (add); only high when bin is
    var bin = [0, 1, 0, 0, 1, 0, 1, 0];          // high wherever ain is (plus t4 alone during the add)
    var op  = [0, 1, 2, 2, 2, 2, 1, 0];          // 0=AND, 1=OR, 2=add (3 unused / don't care)
    var result = [], cout = [], t;
    for (t = 0; t < N; t++) {
      var ae = ain[t] ? 1 - a[t] : a[t];
      var be = bin[t] ? 1 - b[t] : b[t];
      var AND = ae & be, OR = ae | be, sum = ae ^ be ^ cin[t];
      var carry = (ae & be) | (ae & cin[t]) | (be & cin[t]);
      result[t] = op[t] === 0 ? AND : op[t] === 1 ? OR : op[t] === 2 ? sum : 0;
      cout[t] = carry;
    }

    var hidden = {};                              // persists visibility across rebuilds
    function key(s) { return s.label + (s.sub || ""); }

    function buildSignals() {
      var s = [
        { label: "a", role: "in", kind: "bit", bits: a },
        { label: "b", role: "in", kind: "bit", bits: b },
        { label: "C", sub: "in", role: "in", kind: "bit", bits: cin },
        { label: "Ainvert", role: "ctrl", kind: "bit", bits: ain },
        { label: "Binvert", role: "ctrl", kind: "bit", bits: bin },
        { label: "Operation", role: "ctrl", kind: "bus", vals: op }
      ];
      s.push({ label: "Result", role: "out", kind: "bit", bits: result });
      s.push({ label: "C", sub: "out", role: "out", kind: "bit", bits: cout });
      for (var i = 0; i < s.length; i++) s[i].visible = !hidden[key(s[i])];
      return s;
    }

    var signals = [], beads = [];

    function bitPath(bits, top) {
      var yv = function (v) { return v ? railHi(top) : railLo(top); };
      var d = "M " + PLOTL + " " + yv(bits[0]);
      for (var i = 0; i < N; i++) {
        d += " H " + (PLOTL + (i + 1) * STEPW);
        if (i + 1 < N && bits[i + 1] !== bits[i]) d += " V " + yv(bits[i + 1]);
      }
      return d;
    }
    // Bus: a stroked ribbon (top + bottom rails) that crosses over (an X) wherever
    // the value changes, with the binary value written in each stable run.
    function busPath(vals, top) {
      var H = railHi(top), L = railLo(top), M = railMid(top), d = "", i = 0;
      while (i < N) {
        var j = i + 1; while (j < N && vals[j] === vals[i]) j++;
        var xa = PLOTL + i * STEPW, xb = PLOTL + j * STEPW;
        var lt = (i === 0) ? 0 : TXW, rt = (j === N) ? 0 : TXW;
        d += " M " + (xa + lt) + " " + H + " H " + (xb - rt);
        d += (rt > 0) ? (" L " + xb + " " + M + " L " + (xb - rt) + " " + L) : (" V " + L);
        d += " H " + (xa + lt);
        d += (lt > 0) ? (" L " + xa + " " + M + " L " + (xa + lt) + " " + H) : (" V " + H);
        i = j;
      }
      return d.replace(/^\s+/, "");
    }
    function busLabels(vals, top) {
      var g = el("g", {}), i = 0;
      while (i < N) {
        var j = i + 1; while (j < N && vals[j] === vals[i]) j++;
        var cx = (PLOTL + i * STEPW + PLOTL + j * STEPW) / 2;
        var str = String((vals[i] >> 1) & 1) + String(vals[i] & 1);
        g.appendChild(txt(str, cx, railMid(top) + 3, "awv-busval", "middle"));
        i = j;
      }
      return g;
    }

    function build() {
      signals = buildSignals();
      var top = HEADH, i;
      for (i = 0; i < signals.length; i++) {
        signals[i].top = top;
        signals[i].h = signals[i].visible ? LANEH : STRIP;
        top += signals[i].h;
      }
      var H = top;

      var svg = el("svg", {
        "class": "awv-svg", viewBox: "0 0 " + W + " " + H, role: "img",
        "aria-label": "Timing diagram of the 1-bit ALU slice over 80 nanoseconds: " +
          "data inputs a, b, and carry-in; control signals Ainvert, Binvert, and a " +
          "two-bit Operation bus you can expand into its bits; and outputs Result " +
          "and carry-out. Click a signal's eye to hide or show it."
      });

      svg.appendChild(txt("Signal", NAMEW / 2, 15, "awv-hdr", "middle"));
      svg.appendChild(txt("Time (ns)", (PLOTL + PLOTR) / 2, 15, "awv-hdr", "middle"));
      for (i = 0; i <= N; i++) {
        var tx = PLOTL + i * STEPW;
        svg.appendChild(txt(String(i * 10), i === 0 ? PLOTL + 10 : tx, 31, "awv-time", "middle"));
      }
      var g = "";
      for (i = 0; i <= N; i++) g += "M " + (PLOTL + i * STEPW) + " " + HEADH + " V " + H + " ";
      svg.appendChild(el("path", { "class": "awv-grid", d: g.replace(/\s+$/, "") }));
      for (i = 1; i < signals.length; i++)
        svg.appendChild(el("line", { "class": "awv-rowsep", x1: 0, y1: signals[i].top, x2: W, y2: signals[i].top }));
      svg.appendChild(el("line", { "class": "awv-div", x1: 0, y1: HEADH, x2: W, y2: HEADH }));
      svg.appendChild(el("line", { "class": "awv-div", x1: NAMEW, y1: 0, x2: NAMEW, y2: H }));

      beads = [];
      for (i = 0; i < signals.length; i++) addLane(svg, signals[i]);

      svg.appendChild(el("line", { "class": "awv-cursor", x1: 0, y1: HEADH, x2: 0, y2: H }));

      var old = scope.querySelector(".awv-svg");
      if (old) scope.removeChild(old);
      scope.appendChild(svg);
      if (!reduce) for (var k = 0; k < beads.length; k++) { try { animateBead(beads[k].el); } catch (e) {} }
    }

    function nameNode(s, cy) {
      var cx = NAMECX + (s.indent ? 14 : 0);
      var tt = el("text", {
        x: cx, y: cy + (s.visible ? 4 : 3),
        "class": "awv-name awv-name--" + s.role + (s.visible ? "" : " awv-name--muted"),
        "text-anchor": "middle"
      });
      tt.appendChild(document.createTextNode(s.label));
      if (s.sub) {
        var sub = el("tspan", { dy: "3", "font-size": s.visible ? "8" : "7" });
        sub.textContent = s.sub;
        tt.appendChild(sub);
      }
      return tt;
    }

    // Style-guide eye toggle: open eye = shown, slashed eye = hidden, in soft-ink.
    function addEye(svg, s, cy) {
      var grp = el("g", {
        "class": "awv-toggle" + (s.visible ? "" : " awv-toggle--off"),
        tabindex: "0", role: "button", "aria-pressed": s.visible ? "true" : "false",
        "aria-label": (s.visible ? "Hide signal " : "Show signal ") + key(s)
      });
      var ES = 0.68;
      var eye = el("g", { transform: "translate(" + (19 - 8 * ES).toFixed(2) + "," + (cy - 8 * ES).toFixed(2) + ") scale(" + ES + ")" });
      eye.appendChild(el("path", { "class": "awv-eye__lid",
        d: "M1 8 C3 4.5 5.4 3 8 3 C10.6 3 13 4.5 15 8 C13 11.5 10.6 13 8 13 C5.4 13 3 11.5 1 8 Z" }));
      eye.appendChild(el("circle", { "class": "awv-eye__pupil", cx: 8, cy: 8, r: 2.1 }));
      if (!s.visible) eye.appendChild(el("line", { "class": "awv-eye__slash", x1: 2, y1: 2.5, x2: 14, y2: 13.5 }));
      grp.appendChild(eye);
      grp.appendChild(el("rect", { x: 6, y: cy - 11, width: 26, height: 22, fill: "transparent" }));
      grp.appendChild(el("title", {})).textContent = (s.visible ? "Hide " : "Show ") + key(s);
      function toggle() { hidden[key(s)] = s.visible; build(); }
      grp.addEventListener("click", toggle);
      grp.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Enter" || e.key === "Spacebar") { e.preventDefault(); toggle(); }
      });
      svg.appendChild(grp);
    }

    function addLane(svg, s) {
      var cy = s.top + s.h / 2;

      addEye(svg, s, cy);
      svg.appendChild(nameNode(s, cy));

      if (!s.visible) return;

      if (s.kind === "bus") {
        svg.appendChild(el("path", { "class": "awv-trace awv-trace--" + s.role, d: busPath(s.vals, s.top) }));
        svg.appendChild(busLabels(s.vals, s.top));
        return;
      }

      var dStr = bitPath(s.bits, s.top);
      svg.appendChild(el("path", { "class": "awv-trace awv-trace--" + s.role, d: dStr }));
      var bead = el("path", { "class": "awv-bead", d: dStr });
      bead.style.color = COLOR[s.role];
      svg.appendChild(bead);
      beads.push({ s: s, el: bead });
    }

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

    build();

    /* ---- hover/drag scrubber: a vertical guide + a value tooltip (each value in
       its signal's colour). Buses read out in binary. Mirrors aluwave.js. ---- */
    var tip = document.createElement("div");
    tip.className = "awv-tip";
    root.appendChild(tip);

    var dragging = false, persist = false;
    function isTouch(e) { return e.pointerType === "touch" || e.pointerType === "pen"; }
    function valueAt(s, step) {
      if (s.kind === "bus") return String((s.vals[step] >> 1) & 1) + String(s.vals[step] & 1);
      return String(s.bits[step] | 0);
    }

    function onMove(e) {
      var svgEl = scope.querySelector(".awv-svg");
      var line = scope.querySelector(".awv-cursor");
      if (!svgEl || !line) return;
      var r = svgEl.getBoundingClientRect();
      var vbX = (e.clientX - r.left) / r.width * W;
      if (vbX < PLOTL || vbX > PLOTR) {
        if (dragging) vbX = clamp(vbX, PLOTL, PLOTR);
        else { onLeave(); return; }
      }
      var step = clamp(Math.floor((vbX - PLOTL) / STEPW), 0, N - 1);
      var tns = clamp(Math.round((vbX - PLOTL) / (PLOTR - PLOTL) * (N * 10)), 0, N * 10);

      line.setAttribute("x1", vbX); line.setAttribute("x2", vbX); line.classList.add("is-on");

      var html = '<div class="awv-tip__t">' + tns + " ns</div>";
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (!s.visible) continue;
        html += '<div class="awv-tip__row" style="color:' + COLOR[s.role] + '">' +
                "<span>" + key(s) + "</span><span>" + valueAt(s, step) + "</span></div>";
      }
      tip.innerHTML = html;
      tip.classList.add("is-on");

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
    function onDown(e) {
      var svgEl = scope.querySelector(".awv-svg");
      if (!svgEl) return;
      var r = svgEl.getBoundingClientRect();
      var vbX = (e.clientX - r.left) / r.width * W;
      if (vbX < PLOTL || vbX > PLOTR) return;   // taps on the eye / chevron still work
      dragging = true; persist = isTouch(e);
      if (scope.setPointerCapture) { try { scope.setPointerCapture(e.pointerId); } catch (_) {} }
      onMove(e);
      if (isTouch(e)) e.preventDefault();
    }
    function release(e) {
      dragging = false;
      if (scope.releasePointerCapture) { try { scope.releasePointerCapture(e.pointerId); } catch (_) {} }
    }
    function onUp(e) { if (!dragging) return; release(e); if (!persist) onLeave(); }
    function onCancel(e) { if (!dragging) return; release(e); persist = false; onLeave(); }

    scope.addEventListener("pointerdown", onDown);
    scope.addEventListener("pointermove", function (e) { if (dragging && isTouch(e)) e.preventDefault(); onMove(e); });
    scope.addEventListener("pointerup", onUp);
    scope.addEventListener("pointercancel", onCancel);
    scope.addEventListener("pointerleave", function () { if (!dragging && !persist) onLeave(); });
  }

  var roots = document.querySelectorAll(".slicewave");
  for (var i = 0; i < roots.length; i++) initWave(roots[i]);
})();
