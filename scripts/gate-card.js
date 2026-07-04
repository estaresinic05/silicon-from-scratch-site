/* =========================================================================
   gate-card.js — wires up every .gate-card flip card (Logic Gates / 1-bit ALU
   / gated D-latch). The front sketch flips to an editable Verilog editor; the
   editor is parsed + evaluated live by verilog-mini.js (load it first), so:
     - the input chips + live output value reflect whatever logic is typed,
     - the output label follows a rename of the output port,
     - a syntax/semantic error shows "—" and a red squiggle at the exact spot.
   Also runs the gated-D-latch front-image cross-fade if a .latch-swap is present.
   ========================================================================= */
(function () {
  "use strict";
  var V = window.VerilogMini;
  if (!V) return;

  function initCard(card) {
    var front = card.querySelector(".gate-card__face--front");
    var back  = card.querySelector(".gate-card__face--back");
    var ret   = card.querySelector(".gate-card__return");
    var ta    = card.querySelector(".code-editor__ta");
    var hlEl  = card.querySelector(".code-editor__hl");
    var hl    = hlEl ? hlEl.querySelector("code") : null;
    if (!front || !ta || !hl) return;                 // not an editor card

    var resetBtn = card.querySelector(".code-editor__reset");
    var inputsEl = card.querySelector(".gate-sim__inputs");
    var lhsEl = card.querySelector(".gate-sim__lhs");
    var valEl = card.querySelector(".gate-sim__val");
    var controls = (card.getAttribute("data-control") || "").split(/[,\s]+/);
    var original = ta.value;
    var env = {};            // input chip values
    var state = {};          // persistent reg values (latch hold)
    var errRange = null;     // current syntax-error span, or null

    function isControl(n) { for (var i = 0; i < controls.length; i++) if (controls[i] === n) return true; return false; }

    /* On phones/tablets the editor is view-only: you can flip the card and read
       the code + output bar, but not type (a code textarea is poor mobile UX and
       pops the on-screen keyboard). readOnly blocks edits and suppresses the
       keyboard while still allowing scroll/selection. */
    var noType = window.matchMedia ? window.matchMedia("(max-width: 768px)") : null;
    function applyNoType() { ta.readOnly = !!(noType && noType.matches); }
    applyNoType();
    if (noType && noType.addEventListener) noType.addEventListener("change", applyNoType);
    else if (noType && noType.addListener) noType.addListener(applyNoType);

    function flipTo(showBack) {
      card.classList.toggle("is-flipped", showBack);
      if (showBack) { if (!ta.readOnly) ta.focus(); } else front.focus();
    }
    front.addEventListener("click", function () { flipTo(true); });
    front.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); flipTo(true); }
    });
    /* Flip back by clicking the card frame — the border/padding around the
       editor, including the space by the return arrow. Clicks inside the
       interactive editor or the live-sim box are left alone. The return button
       lives outside both, so its clicks (mouse or keyboard) flip back too. */
    if (back) back.addEventListener("click", function (e) {
      if (e.target.closest(".code-editor, .gate-sim")) return;
      flipTo(false);
    });
    if (resetBtn) resetBtn.addEventListener("click", function () { ta.value = original; state = {}; refresh(); if (!ta.readOnly) ta.focus(); });

    // Keep the highlighted underlay scrolled in step with the textarea.
    ta.addEventListener("scroll", function () { hlEl.scrollTop = ta.scrollTop; hlEl.scrollLeft = ta.scrollLeft; });

    function render() { hl.innerHTML = V.highlight(ta.value, errRange); }

    function rebuildChips(inputs) {
      if (!inputsEl) return;
      var nextEnv = {}, i;
      for (i = 0; i < inputs.length; i++) { var n = inputs[i]; nextEnv[n] = (n in env) ? env[n] : 1; }
      env = nextEnv;
      inputsEl.innerHTML = "";
      for (i = 0; i < inputs.length; i++) makeChip(inputs[i]);
    }
    function makeChip(n) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "gate-sim__chip" + (isControl(n) ? " gate-sim__chip--control" : "");
      function paint() { chip.setAttribute("data-val", env[n]); chip.innerHTML = "<b>" + n + "</b> = " + env[n]; }
      paint();
      chip.addEventListener("click", function () { env[n] = env[n] ? 0 : 1; paint(); evalOnly(); });
      inputsEl.appendChild(chip);
    }

    function showVal(res) {
      if (!valEl) return;
      var vals = res.eval(env, state);
      var out = res.display;
      if (out != null && (out in vals)) { valEl.textContent = String(vals[out] & 1); valEl.removeAttribute("data-bad"); }
      else { valEl.textContent = "—"; valEl.setAttribute("data-bad", "1"); }
    }

    // Input toggled (code unchanged): recompute the value only.
    function evalOnly() { var res = V.compile(ta.value); if (res.ok) showVal(res); }

    // Code edited: recompile, rebuild chips, evaluate, and squiggle any error.
    function refresh() {
      var res = V.compile(ta.value);
      if (res.ok) {
        rebuildChips(res.inputs);
        if (lhsEl && res.display) lhsEl.textContent = res.display;
        showVal(res);
        errRange = null;
      } else {
        if (valEl) { valEl.textContent = "—"; valEl.setAttribute("data-bad", "1"); }
        errRange = res.error;          // keep the last-good chips + label
      }
      render();
    }

    ta.addEventListener("input", refresh);
    refresh();
  }

  // Gated D-latch front: cross-fade the two stacked images every 7 seconds.
  function initSwap(card) {
    var imgs = card.querySelectorAll(".latch-swap__img");
    if (imgs.length < 2) return;
    var idx = 0;
    setInterval(function () {
      imgs[idx].classList.remove("is-active");
      idx = (idx + 1) % imgs.length;
      imgs[idx].classList.add("is-active");
    }, 7000);
  }

  var cards = document.querySelectorAll(".gate-card");
  for (var i = 0; i < cards.length; i++) { initCard(cards[i]); initSwap(cards[i]); }
})();
