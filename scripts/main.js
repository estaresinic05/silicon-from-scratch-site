/* =========================================================================
   Silicon From Scratch — main.js
   Small, dependency-free page behavior:
     1. Keep the address bar clean when using in-page #section anchors.
     2. Mobile navigation toggle.
   ========================================================================= */
(function () {
  "use strict";

  /* ---- 1. Clean URLs for in-page anchors --------------------------------
     Sections are linked with #fragments (e.g. "Back to the path" -> /#learn,
     the nav, "See the architecture"). We still scroll to the section, but
     strip the #fragment so the URL stays clean (just / or /alu/).
     Two cases: arriving from another page (on load) and clicking an anchor on
     the current page (on click). */
  // Drop the #fragment from the URL without moving the page. We deliberately do
  // NOT scroll here: the browser's native fragment jump and the GSAP reveal
  // animations already place and reveal the section correctly. Doing our own
  // scroll would fight that system (the section lands but never reveals). So we
  // let the native behavior run and only tidy the address bar afterward.
  function stripHash() {
    if (location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  // Arrived at e.g. /#learn from another page ("Back to the path"): the browser
  // scrolls to the section on load; once that has settled, clean the URL.
  window.addEventListener("load", function () {
    if (!location.hash || location.hash === "#") return;
    if (!document.getElementById(location.hash.slice(1))) return;
    setTimeout(stripHash, 600);
  });

  // Same-page anchor clicks (nav, "See the architecture", wordmark): let the
  // native smooth scroll + reveals happen, then clean the URL. The skip link is
  // left alone so it still moves keyboard focus to the main content.
  document.addEventListener("click", function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link || link.classList.contains("skip-link")) return;
    var id = link.getAttribute("href").slice(1);
    if (!id || !document.getElementById(id)) return; // bare "#" or missing target
    setTimeout(stripHash, 600);
  });

  /* ---- 1.5 Auto-hiding top bar ------------------------------------------
     The bar is a fixed overlay that's always visible at the top of the page;
     it only hides once the reader scrolls down. On hover-capable devices it
     also reveals when the pointer nears the top of the viewport; on touch
     devices it reveals while scrolling up. It never hides while the mobile
     menu is open. */
  var topbar = document.querySelector(".topbar");
  if (topbar) {
    var TOP_ZONE = 4; /* px from the top still counts as "at the top of the page" */
    function atTop() { return (window.pageYOffset || 0) <= TOP_ZONE; }

    function showBar() { topbar.classList.remove("is-hidden"); }
    function hideBar() {
      if (document.body.classList.contains("nav-open")) return;
      /* keep the bar up while the pointer is over it */
      if (topbar.matches(":hover")) return;
      /* keep the bar up while the side (☰) drawer is open — the pointer may be
         anywhere inside that panel, well below the bar's own bounding box */
      if (document.querySelector(".toc__menu.is-open")) return;
      /* always visible at the top of the page */
      if (atTop()) return;
      topbar.classList.add("is-hidden");
    }
    showBar(); /* visible at launch — we start at the top */

    var hoverCapable = window.matchMedia &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (hoverCapable) {
      var REVEAL = 80; /* px from the top of the viewport that summons the bar */
      window.addEventListener("mousemove", function (e) {
        if (e.clientY <= REVEAL) showBar();
        else if (e.clientY > topbar.offsetHeight + 28) hideBar();
      });
      /* Hide once the reader scrolls down; reveal again at the very top. */
      window.addEventListener("scroll", function () {
        if (atTop()) showBar();
        else hideBar();
      }, { passive: true });
    } else {
      /* Classic: reveal when scrolling up (or at the very top), hide when
         scrolling down. A small threshold avoids jitter on tiny moves. */
      var lastY = window.pageYOffset || 0;
      window.addEventListener("scroll", function () {
        var y = window.pageYOffset || 0;
        if (y <= 4 || y < lastY - 4) showBar();
        else if (y > lastY + 4) hideBar();
        lastY = y;
      }, { passive: true });
    }
  }

  /* ---- 1.6 Page section index (desktop ☰) ------------------------------
     Build a jump list of this page's sections. Sections carrying a data-menu
     attribute set their own label (and, if present, take priority); otherwise
     we fall back to each section's heading. Clicking the ☰ slides a panel in
     from the right edge of the screen; clicking an entry, the backdrop, or
     pressing Escape closes it. Desktop only (the .toc button is hidden on
     mobile via CSS). */
  var toc = document.getElementById("page-toc");
  if (toc) {
    var tocBtn = toc.querySelector(".toc__btn");
    var tocMenu = toc.querySelector(".toc__menu");
    var scope = document.getElementById("main") || document.body;
    var seen = {};

    // Move the panel to <body>: the top bar uses transform/will-change, which
    // would otherwise trap a position:fixed child and stop it filling the
    // viewport height.
    document.body.appendChild(tocMenu);
    var backdrop = document.createElement("div");
    backdrop.className = "toc-backdrop";
    document.body.appendChild(backdrop);

    // Prefer elements that opt in with data-menu (sections, or in-page chunks
    // like the journey's "Going Deeper" step); otherwise list every section.
    var labeled = scope.querySelectorAll("[data-menu]");
    var sections = labeled.length ? labeled : scope.querySelectorAll("section");

    Array.prototype.forEach.call(sections, function (sec) {
      var label = (sec.getAttribute("data-menu") || "").trim();
      if (!label) {
        var h = sec.querySelector("h1, h2");
        label = h ? (h.textContent || "").replace(/\s+/g, " ").trim() : "";
      }
      if (!label) return;
      var target = sec.id;
      if (!target) {
        target = "sec-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        sec.id = target;
      }
      if (seen[target]) return;
      seen[target] = 1;
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + target;
      a.textContent = label;
      li.appendChild(a);
      tocMenu.appendChild(li);
    });

    if (!tocMenu.children.length) {
      var empty = document.createElement("li");
      empty.className = "toc__empty";
      empty.textContent = "No sections on this page";
      tocMenu.appendChild(empty);
    }

    function openToc() {
      tocMenu.classList.add("is-open");
      backdrop.classList.add("is-open");
      tocBtn.setAttribute("aria-expanded", "true");
    }
    function closeToc() {
      tocMenu.classList.remove("is-open");
      backdrop.classList.remove("is-open");
      tocBtn.setAttribute("aria-expanded", "false");
    }
    // Hover to open: opens when the pointer is over the ☰ or the drawer, and
    // closes shortly after it leaves both (a small delay bridges the gap as the
    // pointer travels from the button onto the panel).
    var hideTimer;
    function scheduleClose() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        // Bind to the button (not the .toc container): the button is shoved
        // right with a transform, so the container's hit-box sits to its left
        // and would otherwise open the menu before the cursor reaches the ☰.
        if (!tocBtn.matches(":hover") && !tocMenu.matches(":hover")) closeToc();
      }, 140);
    }
    function cancelClose() { clearTimeout(hideTimer); }
    tocBtn.addEventListener("mouseenter", function () { cancelClose(); openToc(); });
    tocBtn.addEventListener("mouseleave", scheduleClose);
    tocMenu.addEventListener("mouseenter", cancelClose);
    tocMenu.addEventListener("mouseleave", scheduleClose);
    // Also open on keyboard focus of the button, for keyboard users.
    tocBtn.addEventListener("focus", openToc);

    backdrop.addEventListener("click", closeToc);
    tocMenu.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      closeToc();
      // The journey's "Meet the Processor" (the section, whose first chunk we
      // centre) and "Going Deeper" (a journey chunk) should land centred in the
      // viewport, not jumped to the top like a normal anchor. Other entries keep
      // the default top-anchor behaviour.
      var id = (a.getAttribute("href") || "").replace(/^#/, "");
      var el = id && document.getElementById(id);
      if (!el) return;
      var centerEl = el.classList.contains("journey")
        ? el.querySelector(".journey__step")
        : (el.classList.contains("journey__step") ? el : null);
      if (!centerEl) return;
      e.preventDefault();
      var mid = centerEl.getBoundingClientRect().top + window.pageYOffset +
                centerEl.offsetHeight / 2;
      window.scrollTo({
        top: Math.max(0, mid - window.innerHeight / 2),
        behavior: "smooth"
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeToc();
    });
  }

  /* ---- 2. Mobile navigation toggle -------------------------------------- */
  var toggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("primary-nav");
  if (!toggle || !nav) return;

  function closeNav() {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  }

  toggle.addEventListener("click", function () {
    var isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    document.body.classList.toggle("nav-open", isOpen);
  });

  /* Close the menu after tapping a link, and on Escape. */
  nav.addEventListener("click", function (e) {
    if (e.target.closest("a")) closeNav();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
  });
})();
