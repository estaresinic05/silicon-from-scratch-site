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
    // One readout per output. Most cards declare a single output; a card can
    // list several (e.g. the full adder's sum + cout), and the k-th readout
    // tracks the k-th declared output port.
    var lhsEls = card.querySelectorAll(".gate-sim__lhs");
    var valEls = card.querySelectorAll(".gate-sim__val");
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
    /* Flip back via the return arrow only. Hovering it bulges the whole card
       (see .gate-card__return:hover in alu.css) instead of recolouring the
       arrow, so the cue reads "grow, then flip" — the mirror of the front. */
    if (ret) ret.addEventListener("click", function () { flipTo(false); });
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
      if (!valEls.length) return;
      var vals = res.eval(env, state);
      for (var i = 0; i < valEls.length; i++) {
        var out = res.outputs[i];
        if (out != null && (out in vals)) { valEls[i].textContent = String(vals[out] & 1); valEls[i].removeAttribute("data-bad"); }
        else { valEls[i].textContent = "—"; valEls[i].setAttribute("data-bad", "1"); }
      }
    }

    // Input toggled (code unchanged): recompute the value only.
    function evalOnly() { var res = V.compile(ta.value); if (res.ok) showVal(res); }

    // Code edited: recompile, rebuild chips, evaluate, and squiggle any error.
    function refresh() {
      var res = V.compile(ta.value);
      if (res.ok) {
        rebuildChips(res.inputs);
        for (var i = 0; i < lhsEls.length; i++) { if (res.outputs[i]) lhsEls[i].textContent = res.outputs[i]; }
        showVal(res);
        errRange = null;
      } else {
        for (var j = 0; j < valEls.length; j++) { valEls[j].textContent = "—"; valEls[j].setAttribute("data-bad", "1"); }
        errRange = res.error;          // keep the last-good chips + label
      }
      render();
    }

    /* Static / display-only card: for Verilog that instantiates sub-modules
       (e.g. the 32-bit ALU slices), which is outside verilog-mini's 1-bit
       subset and can't be simulated. Such a card still flips and gets live
       syntax highlighting, but skips compile — so no input chips, no output
       value, and no error squiggle. Opt in with `data-static` on the
       .gate-card, and omit the .gate-sim from its back row. */
    if (card.hasAttribute("data-static")) {
      ta.readOnly = true;
      errRange = null;
      render();
      return;
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
