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

    function flipTo(showBack) {
      card.classList.toggle("is-flipped", showBack);
      if (showBack) ta.focus(); else front.focus();
    }
    front.addEventListener("click", function () { flipTo(true); });
    front.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); flipTo(true); }
    });
    if (ret) ret.addEventListener("click", function () { flipTo(false); });
    if (resetBtn) resetBtn.addEventListener("click", function () { ta.value = original; state = {}; refresh(); ta.focus(); });

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
