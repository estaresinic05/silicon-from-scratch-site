/* ------------------------------------------------------------------ *
   CODE EXPLORER — Control Hazards, "Putting It All Together".

   Two Verilog modules share one box so the section fits a screen. Tabs
   swap between them, and each note beside a listing lights the lines it
   is describing and scrolls them into view inside the panel.

   Two details are load-bearing:

   - Lines are wrapped at run time, and the newline BETWEEN two lines is
     kept in its own `display: none` span rather than dropped. `.code-line`
     is a block, so an ordinary "\n" text node between two of them would be
     preserved by `white-space: pre` and double-space the whole listing;
     deleting the newlines instead would break Copy, which main.js builds
     out of the block's textContent. A hidden span renders as nothing and
     still counts as text, so the listing looks right and copies right.

   - The line number is drawn by CSS from `data-line`, not written into the
     DOM, for the same reason: generated content never reaches textContent,
     so nobody copies a listing with numbers down the left.

   Binds to nothing when `.code-explorer` is absent, so it is safe to load
   on any page.
 * ------------------------------------------------------------------ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Wrap every line of a listing in its own span. Returns the line spans. */
  function wrapLines(figure) {
    var code = figure.querySelector(".code-editor__hl code");
    if (!code || code.querySelector(".code-line")) return [];
    var lines = code.innerHTML.split("\n");
    code.innerHTML = lines.map(function (line, i) {
      return '<span class="code-line" data-line="' + (i + 1) + '">' + line + "</span>";
    }).join('<span class="code-nl">\n</span>');
    return Array.prototype.slice.call(code.querySelectorAll(".code-line"));
  }

  /* "18-23" or "18" -> [first, last], 1-based and inclusive. */
  function range(spec) {
    var parts = String(spec).split("-");
    var a = parseInt(parts[0], 10);
    var b = parts.length > 1 ? parseInt(parts[1], 10) : a;
    if (isNaN(a)) return null;
    return [a, isNaN(b) ? a : b];
  }

  function initPanel(panel) {
    var figure = panel.querySelector(".code-explorer__code");
    var body = panel.querySelector(".code-editor__body");
    var notes = Array.prototype.slice.call(panel.querySelectorAll(".code-note"));
    if (!figure || !body || !notes.length) return;

    var lineEls = wrapLines(figure);
    if (!lineEls.length) return;

    function clear() {
      for (var i = 0; i < lineEls.length; i++) lineEls[i].classList.remove("is-lit");
      notes.forEach(function (n) {
        n.classList.remove("is-active");
        n.setAttribute("aria-pressed", "false");
      });
    }

    function light(note, scroll) {
      clear();
      note.classList.add("is-active");
      note.setAttribute("aria-pressed", "true");

      var r = range(note.getAttribute("data-lines") || "");
      if (!r) return;                 /* a note with nothing to point at */

      var first = null, last = null;
      for (var n = r[0]; n <= r[1]; n++) {
        var el = lineEls[n - 1];
        if (!el) continue;
        el.classList.add("is-lit");
        if (!first) first = el;
        last = el;
      }
      if (!first || !scroll) return;

      /* Put the middle of the lit run in the middle of the panel, then clamp:
         a run near the top of the module scrolls to the top instead, and one
         near the bottom stops at the bottom, because there is no more listing
         to put on the other side of it.

         Measured from rects rather than offsetTop. The body is `position:
         static` in the static-editor variant, so offsetTop is reported against
         whatever positioned ancestor happens to be above it, which is not the
         box doing the scrolling. */
      var bodyTop = body.getBoundingClientRect().top;
      var mid = (first.getBoundingClientRect().top +
                 last.getBoundingClientRect().bottom) / 2 - bodyTop + body.scrollTop;

      var target = mid - body.clientHeight / 2;
      var max = body.scrollHeight - body.clientHeight;
      if (target > max) target = max;
      if (target < 0) target = 0;
      if (Math.abs(target - body.scrollTop) < 2) return;
      if (body.scrollTo) {
        body.scrollTo({ top: target, behavior: reduceMotion ? "auto" : "smooth" });
      } else {
        body.scrollTop = target;
      }
    }

    notes.forEach(function (note) {
      note.addEventListener("click", function () {
        /* Clicking the active note turns the highlight off again. */
        if (note.classList.contains("is-active")) { clear(); return; }
        light(note, true);
      });
    });

    /* Open on the first note so the link between the two columns is visible
       before anything is clicked. No scroll: the panel starts at the top. */
    light(notes[0], false);
  }

  function initExplorer(root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll(".code-explorer__tab"));
    var panels = Array.prototype.slice.call(root.querySelectorAll(".code-explorer__panel"));
    panels.forEach(initPanel);

    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab, false); });
      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === "Home") next = tabs[0];
        else if (e.key === "End") next = tabs[tabs.length - 1];
        if (!next) return;
        e.preventDefault();
        select(next, true);
      });
    });
  }

  function init() {
    var roots = document.querySelectorAll(".code-explorer");
    for (var i = 0; i < roots.length; i++) initExplorer(roots[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
