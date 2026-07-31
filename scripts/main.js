/* =========================================================================
   Silicon From Scratch — main.js
   Small, dependency-free page behavior:
     1. Keep the address bar clean when using in-page #section anchors.
     2. Mobile navigation toggle.
   ========================================================================= */
(function () {
  "use strict";

  /* ---- 0. Fresh landings on back/forward --------------------------------
     Returning to a page with the browser's back (or forward) button should
     feel like landing on it fresh — top of the page, scroll-reveals replaying
     — not dropped wherever the reader last was.
     Two mechanisms restore the old position: the back/forward cache serves
     the whole page frozen as it was left (reload it), and the browser's
     scroll restoration re-applies the old offset on ordinary history loads
     (switch it to manual and start at the top ourselves). Anchor arrivals
     (e.g. /#learn from another page) keep the native jump. */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  // Ordinary back/forward loads are reloaded before first paint by the inline
  // <head> script on every page. Back/forward-CACHED pages resume frozen
  // without re-running scripts, so they're caught here instead — hidden
  // synchronously (before the restored frame can present) and reloaded.
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
      document.documentElement.style.visibility = "hidden";
      location.reload();
    }
  });
  if (!location.hash) window.scrollTo(0, 0);

  /* ---- 1. Clean URLs for in-page anchors --------------------------------
     Sections are linked with #fragments (e.g. "Back to the path" -> /#learn,
     the nav, "See the architecture"). We still scroll to the section, but
     strip the #fragment so the URL stays clean (just / or a page path).
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
  // "Home" used to lead this list; the "Project Directory" tab now sits in its
  // place at the head of the bar (the wordmark still links home).
  var QUICK = [
    ["Meet the Processor", "meet-the-processor/"],
    ["About", "about/"]
  ];

  // GitHub left the link row and rides in the top-right corner as its mark.
  var GITHUB_URL = "https://github.com/estaresinic05/Silicon-From-Scratch";

  var MENU = [
    ["Beginner", [
      ["ALU", [
        ["Logic Gates and 1-bit ALU", "alu/logic-gates/"],
        ["Full Adder and Ripple Carry Adder", "alu/full-adder/"],
        ["32-bit ALU Slice", "alu/alu-slice/"],
        ["Complete 32-bit ALU", "alu/complete-alu/"],
        ["Testing Your ALU", "alu/testing/"]
      ]],
      ["Multiplier & Divider", ["Coming Soon"]]
    ]],
    ["Intermediate", [
      ["Single Cycle CPU", [
        ["The Basics of Instructions", "single-cycle-cpu/basics-of-instructions/"],
        ["Fetch, Decode, Execute", "single-cycle-cpu/fetch-decode-execute/"],
        ["Constructing a Datapath", "single-cycle-cpu/constructing-a-datapath/"],
        ["The Control Unit", "single-cycle-cpu/control-unit/"],
        ["Testing Your Single Cycle CPU", "single-cycle-cpu/testing/"]
      ]],
      ["Floating Point Adder", ["Coming Soon"]],
      ["Memory Hierarchy", ["Coming Soon"]]
    ]],
    ["Advanced", [
      ["Pipelined CPU", [
        ["Pipelining", "pipelined-cpu/pipelining/"],
        ["The Pipelined Datapath", "pipelined-cpu/pipelined-datapath/"],
        "Control Unit",
        "Data Hazards",
        "Control Hazards"
      ]],
      ["Introduction to Physical Design", [
        ["Transistor Basics", "introduction-to-physical-design/transistor-basics/"],
        ["Implementing Arbitrary Logic and Stick Diagrams", "coming-soon/"]
      ]]
    ]],
    ["Very Advanced", [
      ["Pipelined CPU Physical Design", ["Coming Soon"]],
      ["Timing Analysis", ["Coming Soon"]]
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
  // `fill` populates with the next level. `level` drives the gray shading.
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
              // A [label, path] leaf is a published lesson and links straight to
              // it; anything else points at the generic placeholder page.
              leaf.appendChild(leafLink(sub));
              projUl.appendChild(leaf);
            });
          }));
        });
      });
      if (topClass) branch.classList.add(topClass);
      parent.appendChild(branch);
    });
  }

  // One leaf link (a published lesson, or the "coming soon" placeholder).
  function leafLink(sub) {
    var a = document.createElement("a");
    if (Array.isArray(sub)) {
      a.href = PREFIX + sub[1];
      a.textContent = sub[0];
    } else {
      a.href = SOON;
      a.textContent = sub;
    }
    return a;
  }

  /* Desktop flyout sheets ---------------------------------------------------
     One white sheet per difficulty, held in a fixed container that sits just
     left of the drawer. Pressing a difficulty row slides its sheet out over the
     page; inside, each project is a bold heading with its lessons listed under
     it. Returns the container so the drawer can hand it to the open/close
     handlers. */
  function buildSheets() {
    var wrap = document.createElement("div");
    wrap.className = "navsheets";

    MENU.forEach(function (cat) {
      var sheet = document.createElement("div");
      sheet.className = "navsheet";
      sheet.setAttribute("aria-hidden", "true");

      // No heading: the highlighted row in the drawer already names the
      // difficulty, and dropping it keeps the band shallow.
      var cols = document.createElement("div");
      cols.className = "navsheet__cols";
      cat[1].forEach(function (proj) {
        var group = document.createElement("section");
        group.className = "navsheet__group";

        var h = document.createElement("h3");
        h.className = "navsheet__title";
        h.textContent = proj[0];
        group.appendChild(h);

        var ul = document.createElement("ul");
        ul.className = "navsheet__links";
        proj[1].forEach(function (sub) {
          var li = document.createElement("li");
          li.appendChild(leafLink(sub));
          ul.appendChild(li);
        });
        group.appendChild(ul);
        cols.appendChild(group);
      });
      sheet.appendChild(cols);
      wrap.appendChild(sheet);
    });

    document.body.appendChild(wrap);
    return wrap;
  }

  // Build the drawer. One panel is shared by the desktop ☰ and the mobile
  // hamburger, so it holds both arrangements and CSS reveals the right one per
  // width:
  //   - Desktop (>=769px): a flat "Project Directory" heading over the four
  //     difficulty rows. Pressing one slides a white sheet out to the left of
  //     the drawer (AMD-style) holding that difficulty's projects and lessons.
  //     Home/About/Tools stay in the top-bar inline nav.
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
    projDir.classList.add("menu__projdir");   // tagged so openToc can auto-expand it

    // Mobile-only: the "Project Directory" dropdown leads, then the top-bar
    // quick links (Meet the Processor / GitHub / About / Tools), styled to
    // match the drawer's flat rows.
    tocMenu.appendChild(projDir);
    QUICK.forEach(function (q) {
      var li = document.createElement("li");
      li.className = "menu__quick is-mobile-only";
      li.appendChild(quickNode(q[0], q[1]));
      tocMenu.appendChild(li);
    });

    // Desktop-only: one row per difficulty, straight at the top of the drawer.
    // Each opens its white flyout sheet rather than expanding in place. There's
    // no heading — the nav item that opened the drawer already names it.
    MENU.forEach(function (cat, i) {
      var li = document.createElement("li");
      li.className = "menu__item menu__item--l1 menu__cat is-desktop-only";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "menu__toggle";
      btn.setAttribute("aria-expanded", "false");
      btn.dataset.sheet = String(i);
      var name = document.createElement("span");
      name.className = "menu__label";
      name.textContent = cat[0];
      btn.appendChild(name);
      // Points left, toward the sheet it opens.
      btn.insertAdjacentHTML("beforeend", CHEVRON.replace(
        'class="menu__chev"', 'class="menu__chev menu__chev--flyout"'));
      li.appendChild(btn);
      tocMenu.appendChild(li);
    });
  }

  /* ---- 1.6 Project menu drawer -----------------------------------------
     One slide-in panel, opened by the top bar's "Project Directory" nav item
     on desktop and by the hamburger on mobile. Clicking a link, the backdrop,
     or pressing Escape closes it. */
  var toc = document.getElementById("page-toc");
  var navToggle = document.getElementById("nav-toggle");
  if (toc) {
    var tocMenu = toc.querySelector(".toc__menu");

    // Move the panel to <body>: the top bar uses transform/will-change, which
    // would otherwise trap a position:fixed child and stop it filling the
    // viewport height.
    document.body.appendChild(tocMenu);
    var backdrop = document.createElement("div");
    backdrop.className = "toc-backdrop";
    document.body.appendChild(backdrop);

    buildDrawer(tocMenu);
    var sheets = buildSheets();

    // On desktop the drawer stops flush with the bottom of the band rather than
    // running the full height of the screen. The band's height is content-driven
    // (the tallest difficulty), so publish it as a custom property the drawer's
    // stylesheet can size itself from, and keep it current as the window resizes.
    function syncDrawerHeight() {
      document.documentElement.style.setProperty(
        "--navsheet-h", sheets.getBoundingClientRect().height + "px");
    }
    syncDrawerHeight();
    window.addEventListener("resize", syncDrawerHeight);
    if (document.fonts && document.fonts.ready) {
      // Web fonts land after first paint and change the band's height.
      document.fonts.ready.then(syncDrawerHeight);
    }

    // Close whichever flyout sheet is out, and un-highlight its difficulty row.
    // `instant` skips the wipe: used when swapping difficulties, where the band
    // itself should hold still and only its contents change.
    function closeSheet(instant) {
      var open = sheets.querySelector(".navsheet.is-open");
      if (open) {
        open.classList.toggle("is-swap", !!instant);
        open.classList.remove("is-open");
        open.setAttribute("aria-hidden", "true");
      }
      // Any sheet still carrying the swap flag goes back to wiping next time.
      if (!instant) {
        var swapped = sheets.querySelectorAll(".navsheet.is-swap");
        for (var s = 0; s < swapped.length; s++) swapped[s].classList.remove("is-swap");
      }
      var rows = tocMenu.querySelectorAll(".menu__cat > .menu__toggle");
      for (var i = 0; i < rows.length; i++) {
        rows[i].setAttribute("aria-expanded", "false");
        rows[i].parentNode.classList.remove("is-active");
      }
      document.body.classList.remove("nav-sheet-open");
    }

    // Show one difficulty's sheet, replacing whichever was out before, so only
    // one is ever showing.
    function selectCat(btn) {
      if (!btn || btn.getAttribute("aria-expanded") === "true") return;
      // Swapping between difficulties with the band already out: hold the band
      // still and let only the text animate. A first open still wipes open.
      var swapping = !!sheets.querySelector(".navsheet.is-open");
      closeSheet(swapping);
      var sheet = sheets.children[Number(btn.dataset.sheet)];
      if (!sheet) return;
      sheet.classList.toggle("is-swap", swapping);
      sheet.classList.add("is-open");
      sheet.setAttribute("aria-hidden", "false");
      btn.setAttribute("aria-expanded", "true");
      btn.parentNode.classList.add("is-active");
      document.body.classList.add("nav-sheet-open");
    }

    // Pressing the row that is already showing does nothing — the sheet is
    // dismissed from the nav item alone.
    tocMenu.addEventListener("click", function (e) {
      selectCat(e.target.closest(".menu__cat > .menu__toggle"));
    });

    /* The "Project Directory" tab. It leads the top-bar nav, in the slot "Home"
       used to hold, and opens this same drawer mirrored: docked to the LEFT
       edge, its sheets unrolling left-to-right. Built here so every page gets
       it without touching each page's markup; section 2 places it in the nav
       (which it rebuilds, so it has to go in afterwards). */
    var tab = document.createElement("button");
    tab.type = "button";
    tab.className = "projtab";
    tab.setAttribute("aria-expanded", "false");
    tab.textContent = "Project Directory";
    tab.addEventListener("click", function () {
      if (tocMenu.classList.contains("is-open")) closeToc();
      else openToc();
    });

    /* Which edge the menu docks to is a property of the viewport, not of the
       opening: desktop drops down from behind the bar, mobile slides in from
       the right. It is set once here (and on resize) rather than at open time,
       so the closed state is always already rendered — a transform applied in
       the same tick as .is-open would have no "from" frame to animate out of. */
    function syncSide() {
      var wide = !(window.matchMedia &&
                   window.matchMedia("(max-width: 768px)").matches);
      tocMenu.classList.toggle("is-left", wide);
      sheets.classList.toggle("is-left", wide);
    }
    syncSide();
    window.addEventListener("resize", syncSide);

    function openToc(expandProjDir) {
      closeSheet();          // never inherit a sheet from the previous opening
      var isLeft = tocMenu.classList.contains("is-left");
      if (tab) tab.setAttribute("aria-expanded", isLeft ? "true" : "false");
      tocMenu.classList.add("is-open");
      backdrop.classList.add("is-open");
      // The mobile hamburger flips to an X only when it is the one holding the
      // drawer open.
      if (navToggle) navToggle.setAttribute("aria-expanded", isLeft ? "false" : "true");
      document.body.classList.add("nav-open");
      // On mobile the collapsible "Project Directory" dropdown rides inside this
      // drawer. Only auto-expand it when the reader explicitly asked for the
      // project directory (the "Open Project Directory" CTAs) — opening from the
      // hamburger should land on the collapsed top folder (Project Directory /
      // Meet the Processor / GitHub / About / Tools), not jump into the tree.
      // Desktop opens with the first difficulty already showing, so the menu is
      // never a bare column of rows waiting to be pressed.
      if (isLeft) selectCat(tocMenu.querySelector(".menu__cat > .menu__toggle"));
      if (expandProjDir &&
          window.matchMedia && window.matchMedia("(max-width: 768px)").matches) {
        var pd = tocMenu.querySelector(".menu__projdir");
        if (pd && !pd.classList.contains("is-open")) {
          pd.classList.add("is-open");
          var pdBtn = pd.querySelector(".menu__toggle");
          if (pdBtn) pdBtn.setAttribute("aria-expanded", "true");
        }
      }
    }
    function closeToc() {
      // The band rises back up in step with the drawer, so closing is just the
      // opening move in reverse — no separate fade to sequence.
      closeSheet();
      tocMenu.classList.remove("is-open");
      if (tab) tab.setAttribute("aria-expanded", "false");
      backdrop.classList.remove("is-open");
      if (navToggle) navToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    }

    backdrop.addEventListener("click", closeToc);
    // Following a lesson from a sheet dismisses the whole nav behind it.
    sheets.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeToc();
    });
    // Below the desktop breakpoint the sheets don't apply — the drawer's own
    // nested tree takes over, so drop any sheet left open by a resize.
    window.addEventListener("resize", function () {
      if (window.innerWidth <= 768) closeSheet();
    });
    tocMenu.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      closeToc();
      // The journey's "Meet the Processor" (the section, whose first chunk we
      // center) and "Going Deeper" (a journey chunk) should land centered in the
      // viewport, not jumped to the top like a normal anchor. Other entries keep
      // the default top-anchor behavior.
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

    // Mobile: the hamburger opens/closes this same drawer, docked right. It is
    // hidden on desktop, where the "Project Directory" nav item takes over.
    if (navToggle) {
      navToggle.addEventListener("click", function () {
        if (tocMenu.classList.contains("is-open")) closeToc();
        else openToc();
      });
    }

    // "Open Project Directory" buttons (home hero CTAs, the About page, etc.) open
    // this same drawer. Un-hide the (auto-hiding) top bar first so it doesn't
    // slide away. On desktop they open the left-docked drawer the nav item owns;
    // on mobile they open the right one with expandProjDir, so the Project
    // Directory dropdown is expanded and a tap lands straight on the tree.
    var openers = document.querySelectorAll(".js-open-proj-dir");
    for (var oi = 0; oi < openers.length; oi++) {
      openers[oi].addEventListener("click", function () {
        if (topbar) topbar.classList.remove("is-hidden");
        if (tocMenu.classList.contains("is-open")) return;
        openToc(true);
      });
    }
  }

  /* ---- 2. Top-bar quick links (desktop inline nav) ----------------------
     Home / About / Meet the Processor / Tools / Help. Inline on desktop;
     hidden on mobile, where they ride at the top of the drawer instead. */
  /* The GitHub mark, hard right in the bar (before the mobile hamburger). The
     official Octocat glyph, so it reads as GitHub at icon size. */
  var topRight = document.querySelector(".topbar__right");
  if (topRight) {
    var gh = document.createElement("a");
    gh.className = "ghlink";
    gh.href = GITHUB_URL;
    gh.target = "_blank";
    gh.rel = "noopener";
    gh.setAttribute("aria-label", "Silicon From Scratch on GitHub");
    gh.title = "GitHub";
    gh.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 ' +
      '0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 ' +
      '1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 ' +
      '0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 ' +
      '2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 ' +
      '2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 ' +
      '.21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" /></svg>';
    topRight.insertBefore(gh, topRight.firstChild);
  }

  var nav = document.getElementById("primary-nav");
  if (nav) {
    nav.innerHTML = "";
    /* Text links first, then the Project Directory pill LAST.
       It used to lead the bar, where "Home" once sat. A filled pill reads as
       the end of a nav, not the start of one: leading with it put the loudest
       element in the middle of the group and left the eye travelling down in
       weight from there. Trailing it, the run goes quiet-to-loud and finishes
       on the one control that opens something. */
    QUICK.forEach(function (q) { nav.appendChild(quickNode(q[0], q[1])); });
    if (typeof tab !== "undefined" && tab) nav.appendChild(tab);
  }

  /* ---- 3. Copy button on every code block -------------------------------
     Each .code-editor gets a Copy button in its titlebar, at the far right —
     to the LEFT of the Reset button when the block has one. It copies the code
     exactly as shown (all spacing and indentation preserved): the editable
     <textarea> source when present, otherwise the highlighted <pre>'s text.
     On success the copy glyph briefly becomes a checkmark. */
  var COPY_GLYPH =
    '<svg class="code-editor__copy-ico code-editor__copy-ico--copy" viewBox="0 0 24 24" aria-hidden="true">' +
    '<rect x="8" y="8" width="13" height="13" rx="2" />' +
    '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />' +
    '</svg>' +
    '<svg class="code-editor__copy-ico code-editor__copy-ico--done" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M5 13l4 4L19 7" />' +
    '</svg>' +
    '<span class="code-editor__copy-txt code-editor__copy-txt--copy">Copy</span>' +
    '<span class="code-editor__copy-txt code-editor__copy-txt--done">Copied</span>';

  // The exact text of a block: the textarea source if editable, else the
  // highlighted <pre>'s textContent (which keeps every newline and space).
  function codeText(editor) {
    var ta = editor.querySelector(".code-editor__ta");
    if (ta) return ta.value;
    var code = editor.querySelector(".code-editor__hl code") ||
               editor.querySelector(".code-editor__hl");
    return code ? code.textContent : "";
  }

  // Copy with the async Clipboard API when available, falling back to a hidden
  // textarea + execCommand (needed in non-secure contexts such as file://).
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var tmp = document.createElement("textarea");
        tmp.value = text;
        tmp.setAttribute("readonly", "");
        tmp.style.position = "fixed";
        tmp.style.top = "-1000px";
        tmp.style.opacity = "0";
        document.body.appendChild(tmp);
        tmp.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(tmp);
        if (ok) resolve(); else reject();
      } catch (err) { reject(err); }
    });
  }

  var editors = document.querySelectorAll(".code-editor");
  for (var ei = 0; ei < editors.length; ei++) {
    (function (editor) {
      var bar = editor.querySelector(".code-editor__bar");
      if (!bar || bar.querySelector(".code-editor__copy")) return;

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-editor__copy";
      btn.setAttribute("aria-label", "Copy the code to the clipboard");
      btn.title = "Copy";
      btn.innerHTML = COPY_GLYPH;

      // Sit to the left of Reset when the block has one; otherwise at the far
      // right of the bar (margin-right:auto on .code-editor__lang pushes it over).
      var reset = bar.querySelector(".code-editor__reset");
      if (reset) bar.insertBefore(btn, reset);
      else bar.appendChild(btn);

      var revert;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();            // never flip the card underneath
        copyText(codeText(editor)).then(function () {
          btn.classList.add("is-copied");
          btn.title = "Copied!";
          clearTimeout(revert);
          revert = setTimeout(function () {
            btn.classList.remove("is-copied");
            btn.title = "Copy";
          }, 1500);
        }).catch(function () { /* clipboard blocked — nothing to do */ });
      });
    })(editors[ei]);
  }
  /* ---- 4. Glossary term popups -------------------------------------------
     A word in the prose marked up as
       <button class="glossary-term" data-glossary="doping">doped</button>
     opens the matching <template id="glossary-doping" data-title="Doping">
     centered on a blurred backdrop, the same treatment an enlarged figure gets.
     Keeps a long aside off the page until the reader asks for it. */
  var terms = document.querySelectorAll("[data-glossary]");
  if (terms.length) {
    var gOverlay = null, gOpener = null;

    function gKey(e) {
      if (e.key === "Escape") gClose();
    }
    function gClose() {
      if (!gOverlay) return;
      var dying = gOverlay;
      gOverlay = null;
      dying.classList.remove("is-open");
      document.removeEventListener("keydown", gKey);
      setTimeout(function () { dying.remove(); }, 220);
      // Send focus back to the word that opened it.
      if (gOpener) { gOpener.focus(); gOpener = null; }
    }
    function gOpen(btn) {
      var tpl = document.getElementById("glossary-" + btn.dataset.glossary);
      if (!tpl) return;
      gClose();
      gOpener = btn;

      gOverlay = document.createElement("div");
      gOverlay.className = "glossary-overlay";

      var card = document.createElement("div");
      card.className = "glossary-card";
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-modal", "true");
      card.setAttribute("aria-label", tpl.dataset.title || "Definition");

      var head = document.createElement("div");
      head.className = "glossary-card__head";
      var title = document.createElement("p");
      title.className = "glossary-card__title";
      title.textContent = tpl.dataset.title || "";
      var close = document.createElement("button");
      close.type = "button";
      close.className = "glossary-card__close";
      close.setAttribute("aria-label", "Close");
      close.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M6 6l12 12M18 6L6 18" /></svg>';
      head.appendChild(title);
      head.appendChild(close);

      var body = document.createElement("div");
      body.className = "glossary-card__body";
      body.appendChild(tpl.content.cloneNode(true));

      card.appendChild(head);
      card.appendChild(body);
      gOverlay.appendChild(card);
      document.body.appendChild(gOverlay);

      // A frame before adding .is-open so the fade/scale has a state to run from.
      requestAnimationFrame(function () {
        if (gOverlay) gOverlay.classList.add("is-open");
      });
      close.focus();

      close.addEventListener("click", gClose);
      // Clicking the backdrop closes; clicking inside the card does not.
      gOverlay.addEventListener("click", function (e) {
        if (!e.target.closest(".glossary-card")) gClose();
      });
      document.addEventListener("keydown", gKey);
    }

    for (var ti = 0; ti < terms.length; ti++) {
      terms[ti].addEventListener("click", function () { gOpen(this); });
    }
  }

  /* ---- 5. Mode switcher ---------------------------------------------------
     A .mode-switch card shows one drawing at a time and cross-fades between
     them when a button underneath is pressed. Each button carries
     data-mode="<name>" and each image in the stage carries the same, so the
     pairing lives in the markup rather than in here. */
  var switches = document.querySelectorAll(".mode-switch");
  for (var si = 0; si < switches.length; si++) {
    (function (box) {
      var shots = box.querySelectorAll(".mode-switch__stage img");
      var tabs = box.querySelectorAll(".mode-switch__tab");

      function show(mode) {
        for (var i = 0; i < shots.length; i++) {
          var on = shots[i].getAttribute("data-mode") === mode;
          shots[i].classList.toggle("is-active", on);
          // The three drawings are the same picture in three states, so only
          // the visible one should reach a screen reader.
          shots[i].setAttribute("aria-hidden", on ? "false" : "true");
        }
        for (var t = 0; t < tabs.length; t++) {
          tabs[t].setAttribute("aria-pressed",
            tabs[t].getAttribute("data-mode") === mode ? "true" : "false");
        }
      }

      for (var t = 0; t < tabs.length; t++) {
        tabs[t].addEventListener("click", function () {
          show(this.getAttribute("data-mode"));
        });
      }
    })(switches[si]);
  }

  /* ---- 6. Layout fade slider ---------------------------------------------
     A .layout-fade figure stacks three pre-aligned drawings of the inverter
     layout and fades between them as the reader drags a bubble along the
     track. The base drawing stays fully opaque underneath; the stage-2 and
     stage-3 images fade in one after the other, so a solid opaque image is
     always behind whatever is fading and the picture never darkens. */
  var fades = document.querySelectorAll(".layout-fade");
  for (var fi = 0; fi < fades.length; fi++) {
    (function (box) {
      var track = box.querySelector(".layout-fade__track");
      var fill = box.querySelector(".layout-fade__fill");
      var handle = box.querySelector(".layout-fade__handle");
      var step2 = box.querySelector('.layout-fade__stage img[data-step="2"]');
      var step3 = box.querySelector('.layout-fade__stage img[data-step="3"]');
      if (!track) return;

      var LABELS = [
        "Stage 1 of 3: transistors placed",
        "Stage 2 of 3: supply and ground rails connected",
        "Stage 3 of 3: input and output wired"
      ];

      function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

      // t runs 0 (stage 1) to 1 (stage 3). Stage 2 fades in over the first
      // half, stage 3 over the second half.
      function render(t) {
        t = clamp(t);
        if (step2) step2.style.opacity = clamp(t / 0.5);
        if (step3) step3.style.opacity = clamp((t - 0.5) / 0.5);
        fill.style.width = (t * 100) + "%";
        handle.style.left = (t * 100) + "%";
        // The drag-me chevron hides while the bubble is away from its start
        // and pops back up whenever it returns home (with a little slack, so
        // "close enough to the start" still counts).
        box.classList.toggle("is-used", t > 0.02);
        var stage = t < 0.25 ? 0 : t < 0.75 ? 1 : 2;
        track.setAttribute("aria-valuenow", String(1 + Math.round(t * 2)));
        track.setAttribute("aria-valuetext", LABELS[stage]);
      }

      function tFromEvent(e) {
        var r = track.getBoundingClientRect();
        return clamp((e.clientX - r.left) / r.width);
      }

      var dragging = false;
      track.addEventListener("pointerdown", function (e) {
        dragging = true;
        track.setPointerCapture(e.pointerId);
        render(tFromEvent(e));
        e.preventDefault();
      });
      track.addEventListener("pointermove", function (e) {
        if (dragging) render(tFromEvent(e));
      });
      function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        try { track.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      track.addEventListener("pointerup", endDrag);
      track.addEventListener("pointercancel", endDrag);

      // Keyboard: arrows nudge, and snap to whole stages with page keys.
      var current = 0;
      var origRender = render;
      render = function (t) { current = clamp(t); origRender(current); };
      track.addEventListener("keydown", function (e) {
        var k = e.key, next = current;
        if (k === "ArrowRight" || k === "ArrowUp") next = current + 0.5;
        else if (k === "ArrowLeft" || k === "ArrowDown") next = current - 0.5;
        else if (k === "Home") next = 0;
        else if (k === "End") next = 1;
        else return;
        e.preventDefault();
        render(next);
      });

      render(0);
    })(fades[fi]);
  }
})();
