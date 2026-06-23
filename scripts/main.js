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
     The bar is a fixed overlay, hidden by default. On hover-capable devices it
     reveals when the pointer nears the top of the viewport; on touch devices it
     reveals while the user scrolls and tucks away again once scrolling stops.
     It never hides while the mobile menu is open. */
  var topbar = document.querySelector(".topbar");
  if (topbar) {
    function showBar() { topbar.classList.remove("is-hidden"); }
    function hideBar() {
      if (document.body.classList.contains("nav-open")) return;
      /* keep the bar up while the pointer is over it or the section menu is open */
      if (topbar.matches(":hover")) return;
      if (document.querySelector(".toc.is-open")) return;
      topbar.classList.add("is-hidden");
    }
    hideBar(); /* start tucked away */

    var hoverCapable = window.matchMedia &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (hoverCapable) {
      var REVEAL = 80; /* px from the top of the viewport that summons the bar */
      window.addEventListener("mousemove", function (e) {
        if (e.clientY <= REVEAL) showBar();
        else if (e.clientY > topbar.offsetHeight + 28) hideBar();
      });
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

  /* ---- 1.6 Page section index (the ☰ menu) -----------------------------
     Build a jump list from this page's section headings. Hover (desktop) or
     tap (touch) the ☰ to open it; clicking an entry scrolls to that section. */
  var toc = document.getElementById("page-toc");
  if (toc) {
    var tocMenu = toc.querySelector(".toc__menu");
    var tocBtn = toc.querySelector(".toc__btn");
    var scope = document.getElementById("main") || document.body;
    var seen = {};

    Array.prototype.forEach.call(scope.querySelectorAll("section"), function (sec) {
      var h = sec.querySelector("h1, h2");
      if (!h) return;
      var text = (h.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;
      var target = sec.id || h.id;
      if (!target) {
        target = "sec-" + text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        sec.id = target;
      }
      if (seen[target]) return;
      seen[target] = 1;
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + target;
      a.textContent = text;
      li.appendChild(a);
      tocMenu.appendChild(li);
    });

    if (!tocMenu.children.length) {
      var empty = document.createElement("li");
      empty.className = "toc__empty";
      empty.textContent = "No sections on this page";
      tocMenu.appendChild(empty);
    }

    if (tocBtn) {
      tocBtn.addEventListener("click", function () {
        var open = toc.classList.toggle("is-open");
        tocBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      tocMenu.addEventListener("click", function (e) {
        if (e.target.closest("a")) {
          toc.classList.remove("is-open");
          tocBtn.setAttribute("aria-expanded", "false");
        }
      });
      document.addEventListener("click", function (e) {
        if (!toc.contains(e.target)) {
          toc.classList.remove("is-open");
          tocBtn.setAttribute("aria-expanded", "false");
        }
      });
    }
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
