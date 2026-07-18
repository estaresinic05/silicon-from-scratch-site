/* ============================================================================
   Enlarge — static figure images pop slightly on hover to signal they're
   clickable, then open centred on a blurred backdrop when clicked. The whole
   card (the <figure> background) pops and enlarges together with the image;
   the caption is dropped from the enlarged view.

   Interactive image widgets are excluded: flip cards, the reveal/swap figures,
   timing-wave widgets, code editors, the ALU widget, and anything that is
   itself a button or link. Styles live in styles/main.css (.enlargeable /
   .enlarge-overlay).
   ========================================================================== */
(function () {
  "use strict";

  function init() {
    // Images inside these containers are interactive widgets, not static art.
    // Note: [class*="-reveal"] matches op-/pc-/adder-reveal but NOT quiz__reveal
    // (double underscore), so quiz answer images stay enlargeable.
    var EXCLUDE = [
      ".gate-card", ".code-editor", ".datapath", ".reveal-hint",
      '[class*="-reveal"]', '[class*="reveal-fig"]', '[class*="wave"]',
      '[class*="alu-widget"]', ".alu-panel",
      '[role="button"]', "a", "button"
    ].join(", ");

    // The card (the enclosing <figure>) is the enlarge target, so its
    // background pops and enlarges along with the image.
    var cards = [];
    document.querySelectorAll("figure img").forEach(function (img) {
      if (img.closest(EXCLUDE)) return;
      var fig = img.closest("figure");
      if (!fig || cards.indexOf(fig) !== -1) return;
      fig.classList.add("enlargeable");
      fig.setAttribute("tabindex", "0");
      fig.setAttribute("role", "button");
      fig.setAttribute("aria-label", (img.alt ? img.alt + ". " : "") + "Enlarge image");
      cards.push(fig);
    });
    if (!cards.length) return;

    var overlay = null;

    function onKey(e) { if (e.key === "Escape") close(); }

    function open(fig) {
      close();
      overlay = document.createElement("div");
      overlay.className = "enlarge-overlay";

      // Clone the whole card so the enlarged view keeps its background, border
      // and radius. Strip interactive attributes and the caption from the copy.
      var clone = fig.cloneNode(true);
      clone.classList.remove("enlargeable");
      clone.removeAttribute("tabindex");
      clone.removeAttribute("role");
      clone.removeAttribute("aria-label");
      clone.removeAttribute("aria-hidden");
      // Some figures (e.g. hands-on cards) are only un-hidden by a scroll-reveal
      // rule that depends on their container; the clone sits in the overlay, so
      // force it visible or it would inherit the reveal's opacity:0.
      clone.style.opacity = "1";
      clone.querySelectorAll("figcaption").forEach(function (cap) { cap.remove(); });
      overlay.appendChild(clone);

      document.body.appendChild(overlay);
      document.body.style.overflow = "hidden";
      void overlay.offsetWidth;            // flush styles so the fade-in runs
      overlay.classList.add("is-open");
      overlay.addEventListener("click", close);
      document.addEventListener("keydown", onKey);
    }

    function close() {
      if (!overlay) return;
      var o = overlay;
      overlay = null;
      o.classList.remove("is-open");
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      setTimeout(function () { o.remove(); }, 240);
    }

    cards.forEach(function (fig) {
      fig.addEventListener("click", function () { open(fig); });
      fig.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(fig); }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
