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

  /* ---- 1.55 Menu data ---------------------------------------------------
     The same dark right-side drawer (formerly the page-section index) now
     holds the project menu: difficulty -> project -> the project's contents.
     Built from data so it is identical on every page. */
  // The stylesheet link encodes how far this page sits from the site root
  // ("styles/main.css", "../styles/main.css", ...). Reuse that prefix so menu
  // links resolve from any depth, locally or deployed.
  var cssLink = document.querySelector('link[rel="stylesheet"][href*="main.css"]');
  var PREFIX = cssLink ? cssLink.getAttribute("href").replace(/styles\/main\.css.*$/, "") : "";
  var SOON = PREFIX + "coming-soon/";

  // Top-bar quick links (desktop inline nav, and the top of the mobile drawer).
  // An absolute http(s) href opens in a new tab; a null href renders as an inert
  // "Coming soon" placeholder.
  var QUICK = [
    ["Home", "#top"],
    ["Meet the Processor", "meet-the-processor/"],
    ["GitHub", "https://github.com/estaresinic05/Silicon-From-Scratch"],
    ["About", "about/"],
    ["Tools", "#tools"]
  ];

  var MENU = [
    ["Beginner", [
      ["ALU", [
        ["Logic Gates and Simple 1-bit ALU", "alu/logic-gates/"],
        "Full Adder",
        "Ripple Carry Adder",
        "32-bit ALU Slice",
        "Complete 32-bit ALU",
        "Testing",
        "Bonus: Carry Lookahead"
      ]],
      ["Multiplier", ["Coming Soon"]],
      ["Divider", ["Coming Soon"]]
    ]],
    ["Intermediate", [
      ["Single Cycle CPU", [
        "Basics of Instructions",
        "Fetch, Decode, Execute",
        "Constructing a Datapath",
        "Immediate Generation Unit and ALU Control",
        "Main Control Unit and Branch Logic",
        "Testing"
      ]],
      ["Floating Point Adder", ["Coming Soon"]]
    ]],
    ["Advanced", [
      ["Pipelined CPU", [
        "What is Pipelining",
        "Constructing a Datapath",
        "Control Unit",
        "Data Hazards",
        "Control Hazards",
        "Testing"
      ]],
      ["ALU Physical Design", ["Coming Soon"]]
    ]],
    ["Very Advanced", [
      ["Pipelined CPU Physical Design", ["Coming Soon"]]
    ]]
  ];

  // The chevron is two strokes converging to a point (a down-chevron); CSS
  // flips it to point up when its branch is open.
  var CHEVRON =
    '<svg class="menu__chev" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M5 9l7 7 7-7" /></svg>';

  // One quick link: an <a>, or the inert "Help" placeholder when href is null.
  function quickNode(label, path) {
    if (path === null) {
      var span = document.createElement("span");
      span.className = "nav__pending";
      span.setAttribute("aria-disabled", "true");
      span.title = "Coming soon";
      span.textContent = label;
      return span;
    }
    var a = document.createElement("a");
    if (/^https?:\/\//.test(path)) {
      a.href = path;                 // external link: leave as-is, open in a new tab
      a.target = "_blank";
      a.rel = "noopener";
    } else {
      a.href = PREFIX + path;        // internal: resolve from the site root
    }
    a.textContent = label;
    return a;
  }

  // One expandable branch: a toggle button (label + chevron) and a panel that
  // `fill` populates with the next level. `level` drives the grey shading.
  function makeBranch(label, level, fill) {
    var li = document.createElement("li");
    li.className = "menu__item menu__item--l" + level;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "menu__toggle";
    btn.setAttribute("aria-expanded", "false");
    var name = document.createElement("span");
    name.className = "menu__label";
    name.textContent = label;
    btn.appendChild(name);
    btn.insertAdjacentHTML("beforeend", CHEVRON);

    var panel = document.createElement("div");
    panel.className = "menu__panel";
    var ul = document.createElement("ul");
    ul.className = "menu__sub";
    fill(ul);
    panel.appendChild(ul);

    btn.addEventListener("click", function () {
      var open = li.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    li.appendChild(btn);
    li.appendChild(panel);
    return li;
  }

  // Build the difficulty -> project -> contents tree into `parent` (a <ul> or
  // the drawer itself), with the difficulty branches starting at `baseLevel`.
  // The desktop drawer lists them at level 1; the mobile drawer nests the whole
  // tree one level deeper (baseLevel 2) under a collapsible "Project Directory"
  // parent. An optional `topClass` tags each top-level branch (used to hide the
  // desktop arrangement on mobile).
  function buildProjectTree(parent, baseLevel, topClass) {
    MENU.forEach(function (cat) {
      var branch = makeBranch(cat[0], baseLevel, function (catUl) {
        cat[1].forEach(function (proj) {
          catUl.appendChild(makeBranch(proj[0], baseLevel + 1, function (projUl) {
            proj[1].forEach(function (sub) {
              var leaf = document.createElement("li");
              leaf.className = "menu__leaf";
              var a = document.createElement("a");
              if (Array.isArray(sub)) {
                // A [label, path] leaf is a published lesson: link straight to
                // it (path is relative to the site root, like the menu links).
                a.href = PREFIX + sub[1];
                a.textContent = sub[0];
              } else {
                // A literal "Coming Soon" leaf names its parent project on the
                // placeholder page; named topics pass through as themselves.
                var topic = sub === "Coming Soon" ? proj[0] : sub;
                a.href = SOON + "?topic=" + encodeURIComponent(topic);
                a.textContent = sub;
              }
              leaf.appendChild(a);
              projUl.appendChild(leaf);
            });
          }));
        });
      });
      if (topClass) branch.classList.add(topClass);
      parent.appendChild(branch);
    });
  }

  // Build the drawer. One panel is shared by the desktop ☰ and the mobile
  // hamburger, so it holds both arrangements and CSS reveals the right one per
  // width:
  //   - Desktop (>=769px): a flat "Project Directory" heading with the tree at
  //     level 1 (unchanged). Home/About/Tools stay in the top-bar inline nav.
  //   - Mobile (<=768px): the top-bar quick links (which the inline nav hides at
  //     this width) ride at the top, then a collapsible "Project Directory"
  //     dropdown nests the same tree one level deeper.
  function buildDrawer(tocMenu) {
    tocMenu.innerHTML = "";
    tocMenu.classList.add("toc__menu--proj");

    // Mobile-only: a collapsible "Project Directory" parent nesting the same
    // tree one level deeper (difficulty -> project -> contents). It rides
    // between "Home" and "Meet the Processor" in the mobile quick-link list.
    var projDir = makeBranch("Project Directory", 1, function (ul) {
      buildProjectTree(ul, 2);
    });
    projDir.classList.add("is-mobile-only");

    // Mobile-only: the top-bar quick links (Home / Meet the Processor / GitHub /
    // About / Tools), styled to match the drawer's flat rows, with the
    // "Project Directory" dropdown inserted right after "Home".
    QUICK.forEach(function (q, i) {
      var li = document.createElement("li");
      li.className = "menu__quick is-mobile-only";
      li.appendChild(quickNode(q[0], q[1]));
      tocMenu.appendChild(li);
      if (i === 0) tocMenu.appendChild(projDir);
    });

    // Desktop-only: flat heading + the directory tree at level 1.
    var heading = document.createElement("li");
    heading.className = "toc__heading is-desktop-only";
    heading.textContent = "Project Directory";
    tocMenu.appendChild(heading);
    buildProjectTree(tocMenu, 1, "is-desktop-only");
  }

  /* ---- 1.6 Project menu drawer (☰ on desktop, hamburger on mobile) ------
     Reuses the dark slide-in panel. The ☰ opens it on hover (desktop); the
     hamburger opens it on click (mobile). Clicking a link, the backdrop, or
     pressing Escape closes it. */
  var toc = document.getElementById("page-toc");
  var navToggle = document.getElementById("nav-toggle");
  if (toc) {
    var tocBtn = toc.querySelector(".toc__btn");
    var tocMenu = toc.querySelector(".toc__menu");

    // Move the panel to <body>: the top bar uses transform/will-change, which
    // would otherwise trap a position:fixed child and stop it filling the
    // viewport height.
    document.body.appendChild(tocMenu);
    var backdrop = document.createElement("div");
    backdrop.className = "toc-backdrop";
    document.body.appendChild(backdrop);

    buildDrawer(tocMenu);

    function openToc() {
      tocMenu.classList.add("is-open");
      backdrop.classList.add("is-open");
      tocBtn.setAttribute("aria-expanded", "true");
      if (navToggle) navToggle.setAttribute("aria-expanded", "true");
      document.body.classList.add("nav-open");
    }
    function closeToc() {
      tocMenu.classList.remove("is-open");
      backdrop.classList.remove("is-open");
      tocBtn.setAttribute("aria-expanded", "false");
      if (navToggle) navToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    }
    // Click the ☰ to toggle the drawer (it flips to an X while open) — same
    // click behaviour as the mobile hamburger.
    tocBtn.addEventListener("click", function () {
      if (tocMenu.classList.contains("is-open")) closeToc();
      else openToc();
    });

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

    // Mobile: the hamburger opens/closes this same drawer (the ☰ is hidden on
    // mobile; on desktop the hamburger is hidden and the ☰ hover-opens).
    if (navToggle) {
      navToggle.addEventListener("click", function () {
        if (tocMenu.classList.contains("is-open")) closeToc();
        else openToc();
      });
    }
  }

  /* ---- 2. Top-bar quick links (desktop inline nav) ----------------------
     Home / About / Meet the Processor / Tools / Help. Inline on desktop;
     hidden on mobile, where they ride at the top of the drawer instead. */
  var nav = document.getElementById("primary-nav");
  if (nav) {
    nav.innerHTML = "";
    QUICK.forEach(function (q) { nav.appendChild(quickNode(q[0], q[1])); });
  }
})();
