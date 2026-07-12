/* =========================================================================
   dmem-wave.js — a live timing diagram for the data-memory playground on the
   Fetch/Decode/Execute page. Unlike the home page's static aluwave / slicewave,
   this one is a ROLLING CAPTURE: the inline data-memory script calls
   window.DMEMWave.push(sample) on every clk pulse, and each call appends one
   column to the scope. Signals:
     - clk, writeEnable, readEnable      → 1-bit rails,  control blue
     - dataAddress, writeData            → 32-bit hex buses, input purple
     - memory                            → 32-bit hex bus, internal grey
     - readData                          → 32-bit hex bus, output deep-purple
   Reuses the .awv-* structure/markup from the style-guide waveforms; the
   .dmemwave CSS scope re-colours everything for the light lesson page. Each row
   keeps the eye show/hide toggle and the hover scrubber; no travelling beads
   (the capture redraws on every pulse, so a constant ripple would only distract).
   ========================================================================= */
(function () {
  "use strict";
  var SVGNS = "http://www.w3.org/2000/svg";

  // Geometry (SVG user units; the scope scales the whole thing to fit). Steps are
  // wide enough to seat an 8-digit hex value in a bus cell.
  var NAMEW = 144, HEADH = 38, STEPW = 84, MAXCOLS = 10;
  var LANEH = 50, STRIP = 20, TXW = 9;            // full lane vs collapsed strip; bus transition half-width
  var NAMECX = (32 + NAMEW) / 2;
  var COLOR = { in: "#6B2FC9", ctrl: "#4A90D9", out: "#4F1F9E", internal: "#56565F" };

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
  function railHi(top) { return top + LANEH / 2 - 11; }
  function railLo(top) { return top + LANEH / 2 + 11; }
  function railMid(top) { return top + LANEH / 2; }
  function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }
  function hex8(n) { var s = (n >>> 0).toString(16).toUpperCase(); while (s.length < 8) s = "0" + s; return "0x" + s; }

  function initWave(root) {
    var scope = root.querySelector(".aluwave__scope");
    if (!scope) return null;

    var cols = [];            // rolling history; each entry { addr, wd, we, re, clk, mem, read }
    var hidden = {};          // signal visibility persists across redraws
    var N = 0;
    var PLOTL = NAMEW, PLOTR = PLOTL, W = PLOTL + 6 * STEPW + 14;   // W set per-render
    var signals = [];

    function buildSignals() {
      var col = function (key) { return cols.map(function (c) { return c[key]; }); };
      var s = [
        { label: "clk",         role: "ctrl",     kind: "bit", bits: col("clk") },
        { label: "writeEnable", role: "ctrl",     kind: "bit", bits: col("we") },
        { label: "readEnable",  role: "ctrl",     kind: "bit", bits: col("re") },
        { label: "dataAddress", role: "in",       kind: "bus", vals: col("addr") },
        { label: "writeData",   role: "in",       kind: "bus", vals: col("wd") },
        { label: "memory",      role: "internal", kind: "bus", vals: col("mem") },
        { label: "readData",    role: "out",      kind: "bus", vals: col("read") }
      ];
      for (var i = 0; i < s.length; i++) s[i].visible = !hidden[s[i].label];
      return s;
    }

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
    // the value changes, with the hex value written into each stable run.
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
    function busLabels(vals, top, role) {
      var g = el("g", {}), i = 0;
      while (i < N) {
        var j = i + 1; while (j < N && vals[j] === vals[i]) j++;
        var cx = (PLOTL + i * STEPW + PLOTL + j * STEPW) / 2;
        g.appendChild(txt(hex8(vals[i]), cx, railMid(top) + 3, "awv-busval awv-busval--" + role, "middle"));
        i = j;
      }
      return g;
    }

    function render() {
      N = cols.length;
      // Fixed scale: the plot always spans the full MAXCOLS-pulse budget, so a new
      // capture fills the next empty column instead of rescaling the whole diagram.
      PLOTR = PLOTL + STEPW * MAXCOLS;
      W = PLOTR + 14;

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
        "aria-label": "Live timing diagram of the data memory, captured one column per clk pulse."
      });

      svg.appendChild(txt("Signal", NAMEW / 2, 15, "awv-hdr", "middle"));
      svg.appendChild(txt("clk pulse", (PLOTL + PLOTR) / 2, 15, "awv-hdr", "middle"));

      // Time ticks + step gridlines for the full budget (fixed scale), so empty
      // columns still show as slots waiting to be captured.
      for (i = 0; i < MAXCOLS; i++)
        svg.appendChild(txt(String(i + 1), PLOTL + (i + 0.5) * STEPW, 31, "awv-time", "middle"));
      var g = "";
      for (i = 0; i <= MAXCOLS; i++) g += "M " + (PLOTL + i * STEPW) + " " + HEADH + " V " + H + " ";
      svg.appendChild(el("path", { "class": "awv-grid", d: g.replace(/\s+$/, "") }));

      for (i = 1; i < signals.length; i++)
        svg.appendChild(el("line", { "class": "awv-rowsep", x1: 0, y1: signals[i].top, x2: W, y2: signals[i].top }));
      svg.appendChild(el("line", { "class": "awv-div", x1: 0, y1: HEADH, x2: W, y2: HEADH }));
      svg.appendChild(el("line", { "class": "awv-div", x1: NAMEW, y1: 0, x2: NAMEW, y2: H }));

      for (i = 0; i < signals.length; i++) addLane(svg, signals[i]);

      // Empty-state hint, centred over the plot before the first capture.
      if (N === 0)
        svg.appendChild(txt("Toggle the signals on the card, then pulse clk to capture.",
          (PLOTL + PLOTR) / 2, HEADH + (H - HEADH) / 2 + 3, "awv-wave-hint", "middle"));

      svg.appendChild(el("line", { "class": "awv-cursor", x1: 0, y1: HEADH, x2: 0, y2: H }));

      var old = scope.querySelector(".awv-svg");
      if (old) scope.removeChild(old);
      scope.appendChild(svg);
    }

    function addEye(svg, s, cy) {
      var grp = el("g", {
        "class": "awv-toggle" + (s.visible ? "" : " awv-toggle--off"),
        tabindex: "0", role: "button", "aria-pressed": s.visible ? "true" : "false",
        "aria-label": (s.visible ? "Hide signal " : "Show signal ") + s.label
      });
      var ES = 0.68;
      var eye = el("g", { transform: "translate(" + (19 - 8 * ES).toFixed(2) + "," + (cy - 8 * ES).toFixed(2) + ") scale(" + ES + ")" });
      eye.appendChild(el("path", { "class": "awv-eye__lid",
        d: "M1 8 C3 4.5 5.4 3 8 3 C10.6 3 13 4.5 15 8 C13 11.5 10.6 13 8 13 C5.4 13 3 11.5 1 8 Z" }));
      eye.appendChild(el("circle", { "class": "awv-eye__pupil", cx: 8, cy: 8, r: 2.1 }));
      if (!s.visible) eye.appendChild(el("line", { "class": "awv-eye__slash", x1: 2, y1: 2.5, x2: 14, y2: 13.5 }));
      grp.appendChild(eye);
      grp.appendChild(el("rect", { x: 6, y: cy - 11, width: 26, height: 22, fill: "transparent" }));
      grp.appendChild(el("title", {})).textContent = (s.visible ? "Hide " : "Show ") + s.label;
      function toggle() { hidden[s.label] = s.visible; render(); }
      grp.addEventListener("click", toggle);
      grp.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Enter" || e.key === "Spacebar") { e.preventDefault(); toggle(); }
      });
      svg.appendChild(grp);
    }

    function addLane(svg, s) {
      var cy = s.top + s.h / 2;
      addEye(svg, s, cy);
      svg.appendChild(txt(s.label, NAMECX, cy + (s.visible ? 4 : 3),
        "awv-name awv-name--" + s.role + (s.visible ? "" : " awv-name--muted"), "middle"));

      if (!s.visible || N === 0) return;

      if (s.kind === "bus") {
        svg.appendChild(el("path", { "class": "awv-trace awv-trace--" + s.role, d: busPath(s.vals, s.top) }));
        svg.appendChild(busLabels(s.vals, s.top, s.role));
        return;
      }
      svg.appendChild(el("path", { "class": "awv-trace awv-trace--" + s.role, d: bitPath(s.bits, s.top) }));
    }

    render();

    /* ---- hover/drag scrubber: a vertical guide + a value tooltip (each value in
       its signal's colour). Buses read out in hex. Mirrors slice-wave.js. ---- */
    var tip = document.createElement("div");
    tip.className = "awv-tip";
    root.appendChild(tip);

    var dragging = false, persist = false;
    function isTouch(e) { return e.pointerType === "touch" || e.pointerType === "pen"; }
    function valueAt(s, step) {
      if (s.kind === "bus") return hex8(s.vals[step]);
      return String(s.bits[step] | 0);
    }
    function onMove(e) {
      if (N === 0) return;
      var svgEl = scope.querySelector(".awv-svg");
      var line = scope.querySelector(".awv-cursor");
      if (!svgEl || !line) return;
      var r = svgEl.getBoundingClientRect();
      var vbX = (e.clientX - r.left) / r.width * W;
      var capR = PLOTL + STEPW * N;             // only the captured columns are scrubbable
      if (vbX < PLOTL || vbX > capR) {
        if (dragging) vbX = clamp(vbX, PLOTL, capR);
        else { onLeave(); return; }
      }
      var step = clamp(Math.floor((vbX - PLOTL) / STEPW), 0, N - 1);
      line.setAttribute("x1", vbX); line.setAttribute("x2", vbX); line.classList.add("is-on");

      var html = '<div class="awv-tip__t">pulse ' + (step + 1) + "</div>";
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (!s.visible) continue;
        html += '<div class="awv-tip__row" style="color:' + COLOR[s.role] + '">' +
                "<span>" + s.label + "</span><span>" + valueAt(s, step) + "</span></div>";
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
      if (vbX < PLOTL || vbX > PLOTL + STEPW * N) return;   // taps on the eye toggles / empty slots still work
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

    return {
      push: function (sample) {
        cols.push(sample);
        if (cols.length > MAXCOLS) cols.shift();
        render();
      },
      reset: function () { cols = []; render(); }
    };
  }

  var api = null;
  var root = document.querySelector(".dmemwave");
  if (root) api = initWave(root);
  // The inline data-memory script pushes a column on every clk pulse.
  window.DMEMWave = api || { push: function () {}, reset: function () {} };
})();
