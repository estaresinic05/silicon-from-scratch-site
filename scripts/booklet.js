/* ============================================================================
   Booklet — diagram pages the reader turns by the corner.

   Wires up every `.booklet` on the page, so a lesson only has to write the
   markup. The moving parts:

     .booklet__leaf    one page. Turned leaves carry `is-turned`, the page on
                       top carries `is-current`. The 3D turn and the dog-eared
                       corner are both CSS (styles/alu.css); this file only
                       moves the classes and keeps the caption honest.
     .booklet__peel    the folded corner, and the ONLY visible control.

   Each leaf's `data-label` is written into the caption, so the page order and
   its wording live in the markup rather than in here.

   Three ways through, all doing the same thing: take the corner, swipe, or
   arrow keys. The last page's corner folds back to the first, because with no
   button row a reader who reached the end would otherwise be stuck there.
   ========================================================================== */
(function () {
  "use strict";

  /* A drag counts as a page turn once it has travelled this far horizontally
     AND is clearly more horizontal than vertical, so a diagonal thumb on the
     way down the page scrolls instead of turning. */
  var SWIPE_MIN  = 40;
  var SWIPE_SLOP = 1.2;

  function initBooklet(root) {
    var stack  = root.querySelector(".booklet__stack");
    var leaves = Array.prototype.slice.call(root.querySelectorAll(".booklet__leaf"));
    if (!stack || leaves.length < 2) return;

    var peel    = root.querySelector(".booklet__peel");
    var caption = root.querySelector(".booklet__cap");

    var last    = leaves.length - 1;
    var current = 0;
    /* Replaced by the observer's disconnect below, once there is one. */
    var stopHinting = function () {};

    /* ---- state -------------------------------------------------------- */

    function render() {
      leaves.forEach(function (leaf, i) {
        leaf.classList.toggle("is-turned", i < current);
        leaf.classList.toggle("is-current", i === current);
        /* Only the page on top is readable. Without this a screen reader is
           handed six alt texts for one figure. The leaves are not focusable
           and are not controls — the corner is the only thing to press. */
        leaf.setAttribute("aria-hidden", i === current ? "false" : "true");
      });

      if (caption) caption.textContent = leaves[current].dataset.label || "";
    }

    function goTo(i) {
      var next = Math.max(0, Math.min(last, i));   /* guard; turn() wraps first */
      if (next === current) return;
      current = next;
      /* The nudge has done its job the moment a page turns, by any route —
         corner, key or swipe. `is-used` is never taken off again, and the
         observer that would have re-armed it is dropped. */
      root.classList.remove("is-hinting");
      root.classList.add("is-used");
      stopHinting();
      render();
    }

    /* The corner never retires, and the ends wrap. It is the only control on
       screen, so a page where it did nothing would strand a reader who is not
       reaching for the keyboard — and hiding it at the end had a second bug
       besides: hiding the element that HAS focus drops focus to <body>, and
       the arrow-key handler is bound to the booklet, so the keyboard went
       dead too. Nothing here hides or disables, so neither can happen. */
    function turn(step) {
      goTo((current + step + leaves.length) % leaves.length);
    }

    /* ---- the corner --------------------------------------------------- */

    if (peel) {
      peel.addEventListener("click", function () { turn(1); });
    }

    /* Arrow keys work wherever focus sits inside the booklet. Home and End
       jump to the covers. */
    root.addEventListener("keydown", function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var handled = true;
      if      (e.key === "ArrowRight") turn(1);
      else if (e.key === "ArrowLeft")  turn(-1);
      else if (e.key === "Home")       goTo(0);
      else if (e.key === "End")        goTo(last);
      else handled = false;
      if (handled) e.preventDefault();
    });

    /* ---- swipe -------------------------------------------------------- */
    /* `touch-action: pan-y pinch-zoom` in the stylesheet leaves vertical
       scrolling and pinch zoom to the browser and keeps the horizontal axis
       for this. Pinch matters: these are dense circuit diagrams. */
    var dragId = null, dragX = 0, dragY = 0;

    stack.addEventListener("pointerdown", function (e) {
      if (!e.isPrimary || e.pointerType === "mouse") return;
      dragId = e.pointerId; dragX = e.clientX; dragY = e.clientY;
    });

    stack.addEventListener("pointerup", function (e) {
      if (e.pointerId !== dragId) return;
      dragId = null;
      var dx = e.clientX - dragX;
      var dy = e.clientY - dragY;
      if (Math.abs(dx) < SWIPE_MIN) return;
      if (Math.abs(dx) < Math.abs(dy) * SWIPE_SLOP) return;
      turn(dx < 0 ? 1 : -1);
    });

    stack.addEventListener("pointercancel", function () { dragId = null; });

    /* ---- the nudge ---------------------------------------------------- */
    /* The corner keeps lifting until a page is turned. Two conditions on it,
       and both matter:

         · Only while the booklet is ON SCREEN. Left running it would repaint
           a masked full-page image forever, including while the reader is
           three sections away, and a cue nobody can see is pure cost. The
           observer stays connected and toggles rather than firing once.
         · Only until `is-used`, which goTo sets on the first turn by any
           route. After that the observer is disconnected for good. */
    if (typeof IntersectionObserver === "function") {
      var watch = new IntersectionObserver(function (entries) {
        if (root.classList.contains("is-used")) { watch.disconnect(); return; }
        entries.forEach(function (entry) {
          root.classList.toggle("is-hinting", entry.isIntersecting);
        });
      }, { threshold: 0.4 });
      watch.observe(root);
      stopHinting = function () { watch.disconnect(); };
    } else {
      root.classList.add("is-hinting");
    }

    render();
  }

  function init() {
    document.querySelectorAll(".booklet").forEach(initBooklet);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
