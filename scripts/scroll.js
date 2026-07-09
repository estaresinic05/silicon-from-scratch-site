/* =========================================================================
   Silicon From Scratch — scroll.js
   Phase 2: scroll-driven reveals with GSAP + ScrollTrigger.

   Safety model:
   - The <head> adds class "js" to <html> before paint; CSS hides reveal
     targets ONLY under html.js. So without JS the page is fully visible.
   - If GSAP failed to load OR the user prefers reduced motion, we remove
     the "js" class (un-hiding everything) and do nothing else.
   - We animate only opacity/transform, and clearProps "transform" after
     each reveal so existing CSS hover lifts keep working.
   ========================================================================= */

/* Build-path "trace": measure the node icons and the explainer lines, then draw
   ONE snaking line through the nodes plus a branch out to each explainer line,
   into the .bp-trace overlay SVG. Desktop-only; runs whenever JS is present (so
   a static, fully-drawn trace shows even under reduced-motion / no-GSAP), while
   the scroll "draw" is layered on top by the main module below. Idempotent. */
function buildBpTrace(managed) {
  var layout = document.querySelector(".buildpath-layout");
  var svg = layout && layout.querySelector(".bp-trace");
  if (!svg) return null;
  var NS = "http://www.w3.org/2000/svg";
  var snake = svg.querySelector(".bp-trace__snake");
  /* The explainer paragraphs feed the branch lines — but they're hidden below
     the two-column breakpoint (phones/tablets), where the serpentine stands on
     its own. When they're hidden, use no lines so no branches get drawn. */
  var introEl = layout.querySelector(".buildpath-intro");
  var introShown = introEl && getComputedStyle(introEl).display !== "none";
  var lines = introShown ? Array.prototype.slice.call(layout.querySelectorAll(
    ".buildpath-intro__lead, .buildpath-intro__sub, .buildpath-intro__note," +
    " .buildpath-intro__code, .buildpath-intro__end")) : [];

  /* One reusable branch <path> per explainer line — kept stable across rebuilds
     so the scroll timeline can keep referencing the same elements. */
  var branchPaths = Array.prototype.slice.call(svg.querySelectorAll(".bp-trace__branch"));
  while (branchPaths.length < lines.length) {
    var np = document.createElementNS(NS, "path");
    np.setAttribute("class", "bp-trace__branch");
    np.setAttribute("fill", "none");
    svg.insertBefore(np, snake);          // branches sit under the snake line
    branchPaths.push(np);
  }
  while (branchPaths.length > lines.length) { branchPaths.pop().remove(); }

  /* The serpentine now draws at EVERY width (phones included). Bail only if the
     layout hasn't been laid out yet — nothing to measure. */
  var lr = layout.getBoundingClientRect();
  if (lr.width < 1) {
    snake.removeAttribute("d");
    branchPaths.forEach(function (p) { p.removeAttribute("d"); });
    Array.prototype.slice.call(svg.querySelectorAll(".bp-trace__seg"))
      .forEach(function (p) { p.removeAttribute("d"); });
    return null;
  }
  svg.setAttribute("viewBox", "0 0 " + lr.width + " " + lr.height);
  var f = function (n) { return n.toFixed(1); };
  var frames = Array.prototype.slice.call(layout.querySelectorAll(".bp-frame"));
  if (!frames.length) return null;

  /* Each node: its centre (for branch targets + reveal timing) plus its left /
     right side mid-points. The snake now flows IN one side of each graphic and
     OUT the other, alternating side to side down the column. */
  var nodes = frames.map(function (el) {
    var r = el.getBoundingClientRect();
    var cy = r.top - lr.top + r.height / 2;
    return {
      cx: r.left - lr.left + r.width / 2,
      cy: cy,
      left:  { x: r.left  - lr.left, y: cy },
      right: { x: r.right - lr.left, y: cy }
    };
  });
  var pts = nodes.map(function (n) { return { x: n.cx, y: n.cy }; });

  /* Entry/exit sides for node i: even nodes flow in-left / out-right, odd nodes
     in-right / out-left (LEFT->right, RIGHT->left, ...). */
  function side(n, i) {
    return (i % 2 === 0)
      ? { inn: n.left,  out: n.right, inDir: -1, outDir:  1 }
      : { inn: n.right, out: n.left,  inDir:  1, outDir: -1 };
  }

  /* Serpentine line. Through each graphic we run a level segment (hidden behind
     the opaque frame). Between graphics a deep cubic bows sideways — its control
     points push out well past the node lane (alternating right, then left) so
     each turn eats up the page width, then curls back to meet the next node's
     entry side dead level. */
  /* How far each connector bows sideways. On phones/tablets the path is full
     width, so a big bow would spill off-screen — scale it down there; on wide
     desktops keep the generous swing. */
  var H = lr.width < 900 ? lr.width * 0.12 : Math.max(74, lr.width * 0.17);
  /* One <path> PER connector (the gap between two graphics). The segment THROUGH
     each graphic stays snipped out. We use a separate element per connector
     rather than one path with pen-lifts, because a browser restarts the dash
     pattern at every subpath — which would reveal every segment at once instead
     of drawing them in sequence. */
  var nConn = nodes.length - 1;
  var segPaths = Array.prototype.slice.call(svg.querySelectorAll(".bp-trace__seg"));
  while (segPaths.length < nConn) {
    var sg = document.createElementNS(NS, "path");
    sg.setAttribute("class", "bp-trace__seg");
    sg.setAttribute("fill", "none");
    svg.insertBefore(sg, snake);            // sits above the branches, like the old snake
    segPaths.push(sg);
  }
  while (segPaths.length > nConn) { segPaths.pop().remove(); }
  snake.removeAttribute("d");               // the single snake path is unused now

  var segLens = [], total = 0;
  for (var i = 1; i < nodes.length; i++) {
    var prev = side(nodes[i - 1], i - 1);
    var cur  = side(nodes[i], i);
    var ex = prev.out.x, ey = prev.out.y;               // left the previous node here
    var nx = cur.inn.x,  ny = cur.inn.y;                // enter this node here
    var c1x = ex + prev.outDir * H;                     // exit tangent, level & bowing out
    var c2x = nx + cur.inDir  * H;                      // entry tangent, level & bowing out
    var seg = segPaths[i - 1];
    seg.setAttribute("d", "M " + f(ex) + " " + f(ey) +
      " C " + f(c1x) + " " + f(ey) + ", " + f(c2x) + " " + f(ny) +
      ", " + f(nx) + " " + f(ny));                       // connector: exit(prev) -> entry(cur)
    var sl = seg.getTotalLength ? seg.getTotalLength() : 0;
    segLens.push(sl);
    total += sl;
  }
  /* Each segment's start/end fraction along the whole line, so the timeline can
     draw them back-to-back and they read as one continuous line. */
  var acc = 0;
  var segs = segPaths.map(function (seg, k) {
    var startFrac = total ? acc / total : 0;
    acc += segLens[k];
    var endFrac = total ? acc / total : 0;
    if (segLens[k]) {
      /* One dash the length of the segment + an oversized gap so the pattern
         never repeats — lets us offset PAST the length (to hide the round cap)
         without a second dash creeping onto the tail. */
      seg.style.strokeDasharray = segLens[k] + " " + (segLens[k] + 1000);
      if (!managed) seg.style.strokeDashoffset = "0";   // static default; GSAP owns it when managed
    }
    return { path: seg, len: segLens[k], startFrac: startFrac, endFrac: endFrac };
  });

  /* Fraction of the whole line at which it reaches each node (node 0 at the very
     start), used to time each node's reveal + its branch. */
  var nodeReach = nodes.map(function (n, i) { return i === 0 ? 0 : segs[i - 1].endFrac; });

  /* Branches connect each explainer line to a node on the main path. By default
     the path is defined starting AT the node, so the scroll "draw" (dashoffset
     len -> 0) grows from the main path outward toward the text. Two exceptions:
       - Branch 0 (the opening line) is defined starting at the text, so it draws
         the other way: paragraph -> main path.
       - Branch 1 ("Whether you're...") would otherwise reach across to a
         right-lane node and slice through the serpentine. Route it to the
         left-lane node just below and bow it out to the left, so it meets that
         node (behind its frame) without ever crossing the main path. */
  var branches = lines.map(function (p, idx) {
    var r = p.getBoundingClientRect();
    var ax = r.right - lr.left, ay = r.top - lr.top + r.height / 2;
    var ni = 0;
    for (var j = 1; j < pts.length; j++) {
      if (Math.abs(pts[j].y - ay) < Math.abs(pts[ni].y - ay)) ni = j;
    }
    /* Branches attach at a node's LEFT edge (the side facing the text), so they
       start on the card's edge rather than under it. */
    var bp = branchPaths[idx], d;
    if (idx === 1) {
      /* Attach to the nearest LEFT-lane (even) node — the ALU — rather than a
         right-lane node it would otherwise slice across to reach. Use the SAME
         smooth curve as the other branches (control points between the node and
         the text, no leftward overshoot), so the tip lands cleanly with no hook. */
      var best = 0;
      for (var k = 2; k < pts.length; k += 2) {
        if (Math.abs(pts[k].y - ay) < Math.abs(pts[best].y - ay)) best = k;
      }
      ni = best;
      var e1 = nodes[ni].left, mx1 = (ax + e1.x) / 2;
      d = "M " + f(e1.x) + " " + f(e1.y) +
          " C " + f(mx1) + " " + f(e1.y) + ", " + f(mx1) + " " + f(ay) +
          ", " + f(ax) + " " + f(ay);
    } else if (idx === 0) {
      /* draw paragraph -> main path (reverse of the others), landing on the edge */
      var e0 = nodes[ni].left, mx0 = (ax + e0.x) / 2;
      d = "M " + f(ax) + " " + f(ay) +
          " C " + f(mx0) + " " + f(ay) + ", " + f(mx0) + " " + f(e0.y) +
          ", " + f(e0.x) + " " + f(e0.y);
    } else {
      var e = nodes[ni].left, mx = (ax + e.x) / 2;
      d = "M " + f(e.x) + " " + f(e.y) +
          " C " + f(mx) + " " + f(e.y) + ", " + f(mx) + " " + f(ay) +
          ", " + f(ax) + " " + f(ay);
    }
    bp.setAttribute("d", d);
    var blen = bp.getTotalLength ? bp.getTotalLength() : 0;
    if (blen) {
      bp.style.strokeDasharray = blen + " " + (blen + 1000);   // non-repeating (see segs)
      if (!managed) bp.style.strokeDashoffset = "0";
    }
    return { path: bp, text: p, frac: nodeReach[ni], len: blen };
  });

  return { segs: segs, snakeLen: total, nodeReach: nodeReach, branches: branches };
}

(function () {
  "use strict";

  var root = document.documentElement;
  var prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ready = window.gsap && window.ScrollTrigger;

  /* Accessibility / progressive-enhancement fallback. */
  if (!ready || prefersReduced) {
    root.classList.remove("js"); // reveal everything, no animation
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  var EASE = "power2.out";

  /* Reveal helper: gentle fade + small upward move when `trigger` enters. */
  function reveal(targets, trigger, opts) {
    opts = opts || {};
    gsap.fromTo(
      targets,
      { opacity: 0, y: opts.y != null ? opts.y : 24 },
      {
        opacity: 1,
        y: 0,
        duration: opts.duration || 0.7,
        ease: EASE,
        stagger: opts.stagger || 0,
        clearProps: "transform", // leave hover transforms free afterwards
        scrollTrigger: {
          trigger: trigger || targets,
          start: opts.start || "top 82%"
        }
      }
    );
  }

  /* ---- Home hero: a gentle settling-in on load ---- */
  if (document.querySelector(".hero")) {
    gsap
      .timeline({ defaults: { ease: EASE } })
      .fromTo(".hero__logo", { opacity: 0, scale: 0.94 },
              { opacity: 1, scale: 1, duration: 0.9 })
      .fromTo(".hero h1", { opacity: 0, y: 20 },
              { opacity: 1, y: 0, duration: 0.7, clearProps: "transform" }, "-=0.5")
      .fromTo(".hero__intro", { opacity: 0, y: 20 },
              { opacity: 1, y: 0, duration: 0.7, clearProps: "transform" }, "-=0.5")
      .fromTo(".hero__actions", { opacity: 0, y: 20 },
              { opacity: 1, y: 0, duration: 0.7, clearProps: "transform" }, "-=0.5");

    /* subtle logo parallax as the hero scrolls away */
    var smallScreen = window.matchMedia("(max-width: 768px)").matches;
    gsap.to(".hero__logo", {
      yPercent: smallScreen ? -5 : -10, // lighter drift on phones
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
  }

  /* ---- Build path: the "Start Here" kicker, each step (large icon + copy), and
         the arrow between them fade in as they scroll into view. ---- */
  if (document.querySelector(".buildpath__title")) {
    reveal(".buildpath__title", ".buildpath__title", { y: 16, start: "top 88%", duration: 0.6 });
  }
  if (document.querySelector(".buildpath__kicker")) {
    reveal(".buildpath__kicker", ".buildpath__kicker", { y: 16, start: "top 88%", duration: 0.6 });
  }
  var bpDesktop = window.matchMedia("(min-width: 1080px)").matches;
  /* The serpentine (nodes fade in on their own scroll triggers; arrows are
     invisible spacers the trace line bridges) now runs at EVERY width — see the
     block below — so there's no separate per-step reveal here anymore. */
  gsap.utils.toArray(".bp-tag").forEach(function (tag) {
    reveal(tag, tag, { y: 12, start: "top 86%", duration: 0.6 });
  });

  /* ---- The single snaking trace (desktop): the line grows down as the section
         scrolls, and everything is timed TO it — each node fades in and each
         branch draws out (with its explainer line) exactly as the line reaches
         that point. One scrubbed timeline drives it all. Runs at every width now
         (on phones the branches/paragraphs are absent, so it's just the line +
         node fades). ---- */
  if (document.querySelector(".buildpath-section")) {
    var bpSectionEl = document.querySelector(".buildpath-section");
    var bpSteps = gsap.utils.toArray(".bp-step");
    var bpTL = null;

    /* Each graphic fades in on its OWN scroll position — consistently, as it
       enters the lower part of the viewport — rather than being timed to the
       drawing line (which made them appear at differing screen heights). These
       triggers are created once and are independent of the scrubbed line
       timeline (which is rebuilt on resize). */
    bpSteps.forEach(function (step, i) {
      /* The Single Cycle CPU graphic onward (index 3+) were reading as too early,
         so they fade in a touch later than the first three. */
      var start = i >= 3 ? "top 55%" : "top 80%";
      gsap.fromTo(step, { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: 0.6, ease: EASE,
          scrollTrigger: { trigger: step, start: start } });
    });

    var setupBpTL = function () {
      var info = buildBpTrace(true);          // managed: leave the dash offsets to GSAP
      if (!info || !info.snakeLen || !bpSectionEl) return;
      if (bpTL) {                             // rebuild cleanly (fonts settled / resized)
        if (bpTL.scrollTrigger) bpTL.scrollTrigger.kill();
        bpTL.kill();
      }
      /* Widened scrub range so the whole sequence is spread over much more scroll
         — the main line is visibly drawing as you move, rather than finishing
         before you reach it. */
      bpTL = gsap.timeline({
        scrollTrigger: { trigger: bpSectionEl, start: "top 82%", end: "bottom 48%", scrub: 0.6 }
      });

      /* The opening branch draws FIRST — paragraph out to the first graphic — and
         the main line is HELD until it lands there. */
      var SNAKE_START = info.branches.length ? 0.10 : 0;   // no branches (phones): start the line at 0
      var SNAKE_DUR   = 1 - SNAKE_START;
      var reach = function (frac) { return SNAKE_START + (frac || 0) * SNAKE_DUR; };
      /* Hide each line by offsetting a hair PAST its length, so its round end-cap
         sits off the path start and no stray dot shows before it animates. */
      var CAP_PAD = 5;
      var b0 = info.branches[0];
      if (b0) {
        bpTL.fromTo(b0.path, { strokeDashoffset: b0.len + CAP_PAD },
          { strokeDashoffset: 0, ease: "none", duration: SNAKE_START }, 0);
        if (b0.text) {
          bpTL.fromTo(b0.text, { opacity: 0, x: 12 },
            { opacity: 1, x: 0, ease: "power2.out", duration: SNAKE_START }, 0);
        }
      }

      /* The main line, held until SNAKE_START: each connector segment is drawn
         back-to-back across [SNAKE_START, 1] so, though the segments are
         physically discontinuous (snipped at every graphic), they animate as one
         continuous line that finishes only when you reach the bottom. */
      info.segs.forEach(function (s) {
        var t0 = reach(s.startFrac), t1 = reach(s.endFrac);
        bpTL.fromTo(s.path, { strokeDashoffset: s.len + CAP_PAD },
          { strokeDashoffset: 0, ease: "none", duration: Math.max(0.0001, t1 - t0) }, t0);
      });

      /* (Node graphics fade in on their own scroll triggers — see above — for a
         consistent reveal height, independent of the line's progress.) */

      /* Each remaining branch draws + its paragraph fades as the line reaches its
         node (branch 0 was handled above). */
      info.branches.forEach(function (b, i) {
        if (i === 0) return;
        var at = reach(b.frac);
        bpTL.fromTo(b.path, { strokeDashoffset: b.len + CAP_PAD },
          { strokeDashoffset: 0, ease: "none", duration: 0.12 }, Math.max(0, at - 0.12));
        if (b.text) {
          bpTL.fromTo(b.text, { opacity: 0, x: 12 },
            { opacity: 1, x: 0, ease: "power2.out", duration: 0.16 }, Math.max(0, at - 0.16));
        }
      });
      ScrollTrigger.refresh();
    };

    setupBpTL();                              // build now...
    window.addEventListener("load", setupBpTL); // ...and rebuild once fonts settle
    var bpResizeT;
    window.addEventListener("resize", function () {
      clearTimeout(bpResizeT);
      bpResizeT = setTimeout(setupBpTL, 150);
    });
  }

  /* ---- Build-path explainer lines (narrow screens only): fade each in on
         scroll. On desktop they're revealed by the trace timeline above, timed
         to the branch that reaches out to them. ---- */
  var bpIntro = document.querySelector(".buildpath-intro");
  if (bpIntro && !bpDesktop && getComputedStyle(bpIntro).display !== "none") {
    gsap.utils.toArray(bpIntro.querySelectorAll(
      ".buildpath-intro__lead, .buildpath-intro__sub, .buildpath-intro__note, .buildpath-intro__code, .buildpath-intro__end"
    )).forEach(function (line) {
      reveal(line, line, { y: 18, start: "top 88%", duration: 0.7 });
    });
  }

  /* ---- Doc hero (e.g. the ALU lesson pages): on load, settle the text up in sequence,
         then fade + gently scale the diagram in — mirrors the home hero feel. */
  if (document.querySelector(".doc-hero")) {
    gsap
      .timeline({ defaults: { ease: EASE } })
      .fromTo(".doc-hero__text > *", { opacity: 0, y: 20 },
              { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, clearProps: "transform" })
      .fromTo(".doc-hero__art", { opacity: 0, scale: 0.96 },
              { opacity: 1, scale: 1, duration: 0.9, clearProps: "transform" }, "-=0.6");
  }

  /* ---- Overview band: zoom the die shot in toward the column-1 / row-3 core.
         The animation plays on its own (not scrubbed) but only starts once the
         reader is halfway into the section. It zooms in once and stays there.
         The focal point lives in CSS (transform-origin on the img). Durations
         are in seconds — tweak freely. ---- */
  var overviewBand = document.querySelector(".overview-band");
  if (overviewBand) {
    var zoomLayer = overviewBand.querySelector(".overview-band__zoom");
    var hl = overviewBand.querySelector(".overview-band__hl");
    if (zoomLayer) {
      // Paused until the section's midpoint reaches the viewport centre, then
      // it plays through once and holds.
      var zoomTl = gsap.timeline({
        paused: true,
        scrollTrigger: {
          trigger: overviewBand,
          start: "center center",
          toggleActions: "play none none none"
        }
      });

      // Zoom runs across the whole timeline; the rightward pan eases in later.
      zoomTl
        .fromTo(zoomLayer, { scale: 1 },
                { scale: 2.6, ease: "power1.inOut", duration: 4 }, 0)
        .fromTo(zoomLayer, { xPercent: 0 },
                { xPercent: 5, ease: "power1.inOut", duration: 1.8 }, 2.2);

      // Once the zoom + pan have landed, fade the integer-execution
      // highlight in. (Plain opacity — cheaper than an extra transform.)
      if (hl) {
        zoomTl.fromTo(
          hl,
          { opacity: 0 },
          { opacity: 1, ease: "none", duration: 1 },
          3.2
        );
      }
    }
  }

  /* The first content section ("1's and 0's") usually sits within the initial
     viewport, so its scroll reveals would fire on load. We exclude it from the
     generic reveals below and instead reveal it on the user's first scroll. */
  var basics = document.getElementById("basics");
  function inBasics(el) { return basics && basics.contains(el); }

  /* ---- Diagram figures: fade + gently scale in as they scroll into view, the
         same reveal as the hero diagram above. ---- */
  function revealFigure(fig, start) {
    gsap.fromTo(
      fig,
      { opacity: 0, scale: 0.96 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.9,
        ease: EASE,
        clearProps: "transform",
        scrollTrigger: { trigger: fig, start: start || "top 85%" }
      }
    );
  }
  var handsonGrid = document.querySelector(".handson-grid");
  function inHandsOn(el) { return handsonGrid && handsonGrid.contains(el); }
  gsap.utils.toArray(".figure").forEach(function (fig) {
    if (inBasics(fig)) return;
    if (inHandsOn(fig)) return;   // revealed as part of its widget card below
    revealFigure(fig);
  });

  /* ---- Hands On widgets + the "How to get started" content fade + gently scale
         in as they scroll into view — the same reveal as the diagram figures. ---- */
  gsap.utils.toArray(".handson-col > *").forEach(function (w) { revealFigure(w, "top 88%"); });
  gsap.utils.toArray(".handson-intro, .getstarted__lead, .getstarted__cta").forEach(function (el) {
    reveal(el, el, { y: 20, start: "top 88%" });
  });

  /* ---- Section headings: kicker -> heading -> note, staggered ---- */
  gsap.utils.toArray(".section__head").forEach(function (head) {
    if (inBasics(head)) return;
    reveal(head.querySelectorAll(".kicker, h2, .section__note"), head, {
      y: 20,
      stagger: 0.12,
      start: "top 84%"
    });
  });

  /* ---- Body prose (The idea, Tools) ---- */
  gsap.utils.toArray(".idea .prose, .tools .prose").forEach(function (p) {
    reveal(p.children, p, { stagger: 0.12, start: "top 85%" });
  });

  /* ---- Logic Gates lesson: body copy, lists, and the truth-table fade in as
         each block scrolls into view (figures + headings are handled above). ---- */
  if (document.querySelector(".page-logic")) {
    gsap.utils.toArray(".page-logic .prose, .page-logic .checklist").forEach(function (block) {
      if (inBasics(block)) return;
      reveal(block.children, block, { stagger: 0.1, start: "top 85%" });
    });
    gsap.utils.toArray(".page-logic .table-wrap").forEach(function (t) {
      reveal(t, t, { start: "top 85%" });
    });
  }

  /* ---- "1's and 0's" ----
     On desktop the top of this section sits in the initial viewport, so we fade
     it in shortly after the hero settles — it gives the landing page substance
     instead of a blank band below the hero. On phones it sits well below the
     fold, so we keep it hidden until the first scroll (it never animates in on
     load there). ---- */
  if (basics) {
    var basicsHead = basics.querySelector(".section__head");
    var basicsOnDesktop = window.matchMedia("(min-width: 769px)").matches;

    if (basicsOnDesktop) {
      var landIn = gsap.timeline({ delay: 0.5, defaults: { ease: EASE } });
      if (basicsHead) {
        landIn.fromTo(basicsHead.querySelectorAll(".kicker, h2, .section__note"),
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, clearProps: "transform" });
      }
      landIn.fromTo(basics.querySelectorAll(".prose > *"),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, clearProps: "transform" }, "-=0.35");
      landIn.fromTo(basics.querySelectorAll(".figure"),
        { opacity: 0, scale: 0.96 },
        { opacity: 1, scale: 1, duration: 0.9, clearProps: "transform" }, "-=0.6");
    } else {
      window.addEventListener("scroll", function revealBasics() {
        if (basicsHead) {
          reveal(basicsHead.querySelectorAll(".kicker, h2, .section__note"), basicsHead,
                 { y: 20, stagger: 0.12, start: "top 92%" });
        }
        gsap.utils.toArray(basics.querySelectorAll(".prose")).forEach(function (p) {
          reveal(p.children, p, { stagger: 0.1, start: "top 92%" });
        });
        gsap.utils.toArray(basics.querySelectorAll(".figure")).forEach(function (fig) {
          revealFigure(fig, "top 92%");
        });
        ScrollTrigger.refresh();
      }, { passive: true, once: true });
    }
  }

  /* ---- The journey: the pinned image cross-fades through three states (face
         -> dies -> internals) while the copy reveals line by line as it
         scrolls past. ---- */
  var journey = document.querySelector(".journey");
  if (journey) {
    var steps = gsap.utils.toArray(".journey__step");

    // Warm up the die-map decode now so the cross-fade doesn't trigger a
    // synchronous decode (the source of the load-in hitch).
    var detailImg = journey.querySelector(".journey__img--detail");
    if (detailImg && detailImg.decode) { detailImg.decode().catch(function () {}); }

    /* Wrap each word in a span (preserving inline markup like <strong> and
       non-breaking spaces), so we can group them into visual lines. */
    function wrapWords(node, out) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          // Collapse ASCII whitespace (newlines + indentation) to single
          // spaces — but leave non-breaking spaces intact — so source line
          // breaks don't turn into stray words or leading gaps.
          var txt = child.textContent.replace(/[ \t\r\n\f]+/g, " ");
          if (txt === "") return;
          var frag = document.createDocumentFragment();
          txt.split(/( )/).forEach(function (part) {
            if (part === "") return;
            if (part === " ") {
              frag.appendChild(document.createTextNode(" "));
            } else {
              var span = document.createElement("span");
              span.className = "jw";
              span.textContent = part;
              frag.appendChild(span);
              out.push(span);
            }
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          wrapWords(child, out); // recurse into <strong>, etc.
        }
      });
    }

    /* Group word spans into visual lines by their vertical position. */
    function toLines(words) {
      var lines = [], cur = null, lastTop = null;
      words.forEach(function (w) {
        var top = w.getBoundingClientRect().top;
        if (lastTop === null || Math.abs(top - lastTop) > 4) {
          cur = [];
          lines.push(cur);
          lastTop = top;
        }
        cur.push(w);
      });
      return lines;
    }

    // This page opens straight on the journey (no hero), so the first chunk is
    // the landing view: play its reveal once on load instead of scrubbing it.
    var landingFirst = !document.querySelector(".hero") && (window.pageYOffset || 0) < 4;

    steps.forEach(function (step, idx) {
      var els = step.querySelectorAll(".kicker, h2, p, .journey__more");
      var words = [];
      Array.prototype.forEach.call(els, function (el) { wrapWords(el, words); });
      gsap.set(els, { opacity: 1 }); // containers visible; the words carry the fade

      var lines = toLines(words);

      // Fade in, line by line. The landing chunk plays once on load (a gentle
      // line-by-line settle-in like the home hero); the rest scrub to scroll.
      if (idx === 0 && landingFirst) {
        var introCopy = gsap.timeline({ delay: 0.15 });
        lines.forEach(function (line, i) {
          introCopy.fromTo(
            line,
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, ease: EASE, duration: 0.6 },
            i * 0.12 // staggered in reading order
          );
        });
      } else {
        var tl = gsap.timeline({
          scrollTrigger: { trigger: step, start: "top 85%", end: "top 38%", scrub: true }
        });
        lines.forEach(function (line, i) {
          tl.fromTo(
            line,
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, ease: "none", duration: 1 },
            i // one step per line → they reveal in reading order
          );
        });
      }

      // Fade out, line by line — the same staggered animation reversed — as the
      // chunk approaches and scrolls off the top. (immediateRender:false so it
      // doesn't fight the fade-in at load.)
      var tlOut = gsap.timeline({
        scrollTrigger: { trigger: step, start: "top 6%", end: "top -54%", scrub: true }
      });
      lines.forEach(function (line, i) {
        tlOut.fromTo(
          line,
          { opacity: 1, y: 0 },
          { opacity: 0, y: -14, ease: "none", duration: 1, immediateRender: false },
          i // first line first → they leave in reading order
        );
      });
    });

    /* Landing fade-in for the pinned image (the opening copy fades in line by
       line via its played timeline above). It's pre-hidden under html.js to
       avoid a flash; on a deep-link landing partway down, just show it. */
    var introMedia = journey.querySelector(".journey__media");
    if (introMedia) {
      if (landingFirst) {
        // Fade + a gentle scale-up so the image visibly settles in (mirrors the
        // home hero logo). clearProps so no leftover transform fights the zoom.
        gsap.fromTo(introMedia,
          { opacity: 0, scale: 0.94 },
          { opacity: 1, scale: 1, duration: 1.2, ease: EASE, clearProps: "transform" });
      } else {
        gsap.set(introMedia, { opacity: 1 });
      }
    }

    /* Cross-fade the stacked images in step with the copy. Each later state
       reveals over the previous one as its matching copy arrives:
         face -> dies (chunk 2) -> internals (the roles line) -> die map (chunk 3). */
    function crossfade(img, trigger, start, end) {
      if (!img || !trigger) return;
      gsap.fromTo(
        img,
        { opacity: 0 },
        {
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: trigger, start: start || "top 80%", end: end || "top 40%", scrub: true }
        }
      );
    }
    // Cycle the two delid shots (colour then greyscale) as one scrubbed
    // timeline, split evenly. It doesn't start until "Under the covers"
    // (steps[1]) is well into view, so the IHS top face stays in full while
    // "Where our journey begins" (steps[0]) sits centred. It ends before the
    // "Where the beauty lies" heading (steps[2]) reveals at "top 85%", so both
    // shots have cycled before those words appear. Two equal-length tweens on
    // one scrub keep the halves even regardless of copy height.
    var diesImg = journey.querySelector(".journey__img--dies");
    var grayImg = journey.querySelector(".journey__img--gray");
    if (diesImg && grayImg && steps[1] && steps[2]) {
      gsap.set([diesImg, grayImg], { opacity: 0 });
      gsap
        .timeline({
          scrollTrigger: {
            trigger: steps[1],
            start: "top 65%",      // hold the IHS while steps[0] is centred
            endTrigger: steps[2],
            end: "top 92%",        // both done before steps[2]'s words reveal
            scrub: true
          }
        })
        // Colour delid fades in, then HOLDS fully on screen before the
        // greyscale takes over, so it gets the lion's share of the cycle; the
        // greyscale gets a shorter fade right at the end.
        .fromTo(diesImg, { opacity: 0 }, { opacity: 1, ease: "none", duration: 1.6 }, 0)
        .fromTo(grayImg, { opacity: 0 }, { opacity: 1, ease: "none", duration: 0.9 }, 2.5);
    }
    // Bring the die-map detail in a little sooner and faster: it starts as
    // "Where the beauty lies" is a quarter up the screen ("top 75%") and is
    // fully present by "top 45%".
    crossfade(journey.querySelector(".journey__detail"), steps[2], "top 75%", "top 45%");

    // The centre-spine highlight fades in together with the L3-cache copy: same
    // trigger and range as that step's line-by-line reveal.
    crossfade(journey.querySelector(".journey__hl--spine"),
              journey.querySelector(".journey__step--cache"), "top 85%", "top 45%");

    // The eight Zen 5 core highlights fade in together with the cores copy.
    var coreHls = journey.querySelectorAll(".journey__hl--core");
    var coresStep = journey.querySelector(".journey__step--cores");
    if (coreHls.length && coresStep) {
      gsap.fromTo(coreHls, { opacity: 0 }, {
        opacity: 1, ease: "none",
        scrollTrigger: { trigger: coresStep, start: "top 72%", end: "top 40%", scrub: true }
      });
    }

    // The two IFOP PHY highlights fade in together with the IFOP PHY copy.
    var ifopHls = journey.querySelectorAll(".journey__hl--north");
    var ifopStep = journey.querySelector(".journey__step--ifop");
    if (ifopHls.length && ifopStep) {
      gsap.fromTo(ifopHls, { opacity: 0 }, {
        opacity: 1, ease: "none",
        scrollTrigger: { trigger: ifopStep, start: "top 72%", end: "top 40%", scrub: true }
      });
    }

    // The Test/Debug highlight fades in together with the Test/Debug copy.
    var testHl = journey.querySelector(".journey__hl--testdebug");
    var testStep = journey.querySelector(".journey__step--testdebug");
    if (testHl && testStep) {
      gsap.fromTo(testHl, { opacity: 0 }, {
        opacity: 1, ease: "none",
        scrollTrigger: { trigger: testStep, start: "top 72%", end: "top 40%", scrub: true }
      });
    }

    // The SMU / I/O interconnect band fades in together with its copy.
    var smuHl = journey.querySelector(".journey__hl--smu");
    var smuStep = journey.querySelector(".journey__step--smu");
    if (smuHl && smuStep) {
      gsap.fromTo(smuHl, { opacity: 0 }, {
        opacity: 1, ease: "none",
        scrollTrigger: { trigger: smuStep, start: "top 72%", end: "top 40%", scrub: true }
      });
    }

    // The "Going Deeper" sub-block rectangles cross-fade in as the reader
    // scrolls PAST "Inside a single core": the teal core highlight over the
    // cropped core fades out at the same time the two purple sub-block
    // rectangles fade in. Anchored to the step's bottom so it kicks in once the
    // copy has been read and scrolled up past centre. immediateRender:false on
    // the core fade-out so it doesn't clobber the cores-step fade-in at load.
    // The two L1 cache rectangles (Instruction + Data, plus the Data cache's
    // little extension tab) are held back from this first reveal — they fade in
    // later, once "A cache of one's own" has been read (see below).
    var l1Hls = gsap.utils.toArray(
      ".journey__hl--deeper-ne, .journey__hl--deeper-west, .journey__hl--deeper-l1tab"
    );
    // Instruction Fetch + Decode (and its extension) are also held back — they
    // fade in just after the L1 caches, once "Small but speedy" is read.
    var fetchHls = gsap.utils.toArray(
      ".journey__hl--deeper-fetch, .journey__hl--deeper-fetch-ext, " +
      ".journey__hl--deeper-fetch-up, .journey__hl--deeper-fetch-top, " +
      ".journey__hl--deeper-fetch-sub"
    );
    var deeperHls = gsap.utils.toArray(".journey__hl--deeper").filter(function (el) {
      return l1Hls.indexOf(el) === -1 && fetchHls.indexOf(el) === -1;
    });
    var deeperStep = journey.querySelector(".journey__step--deeper");
    if (deeperHls.length && deeperStep) {
      gsap.timeline({
        scrollTrigger: { trigger: deeperStep, start: "bottom 48%", end: "bottom 8%", scrub: true }
      })
        .fromTo(coreHls, { opacity: 1 }, { opacity: 0, ease: "none", immediateRender: false }, 0)
        .fromTo(deeperHls, { opacity: 0 }, { opacity: 1, ease: "none" }, 0);
    }

    // The L1 Instruction + Data cache rectangles fade in once the reader has
    // scrolled past "A cache of one's own" and reached "Small but speedy" (the L1
    // step). Anchored to that step's top so they arrive as its copy comes in.
    var l1Step = journey.querySelector(".journey__step--l1");
    if (l1Hls.length && l1Step) {
      gsap.fromTo(l1Hls, { opacity: 0 }, {
        opacity: 1, ease: "none",
        scrollTrigger: { trigger: l1Step, start: "top 78%", end: "top 42%", scrub: true }
      });
    }

    // Instruction Fetch + Decode fades in only once the reader has scrolled PAST
    // "Small but speedy" — after the pinned table has faded back out. Anchored to
    // the step's bottom so it lands well after the table clears.
    if (fetchHls.length && l1Step) {
      gsap.fromTo(fetchHls, { opacity: 0 }, {
        opacity: 1, ease: "none",
        scrollTrigger: { trigger: l1Step, start: "bottom 40%", end: "bottom 15%", scrub: true }
      });
    }

    // Cache-comparison table choreography (desktop only). As the reader arrives
    // at "Small but speedy", the pinned die image slides up to open room and the
    // table fades in pinned beneath it; it holds while the section is read, then
    // — as the section scrolls past — the table fades out and the image glides
    // back to centre. The table lives in the copy in markup (so it's in-context
    // and collapses to cards on mobile); here we relocate it into the sticky
    // media so it pins below the image. Only animate `top` (not transforms) so
    // we never fight the image's centring transform or the table's own.
    var l1Table = journey.querySelector(".cache-table");
    var mediaEl = journey.querySelector(".journey__media");
    var detailEl = journey.querySelector(".journey__detail");
    var deskMedia = window.matchMedia("(min-width: 769px)").matches;
    // Flipped true once the focus-zoom has finished cropping to the single core
    // (set from the zoom timeline below). BOTH the image raise and the table are
    // gated on it: until the crop is done the image stays centred (covering the
    // crop frame) so the grayscale delid never peeks out beneath the raised
    // image, and a fast scroll can't reveal the table over the full die map.
    var coreCropped = false;
    var applyGate = function () {};        // reassigned when the pinned table is set up
    if (l1Table && mediaEl && detailEl && l1Step && deskMedia) {
      mediaEl.appendChild(l1Table);          // pin it with the image
      gsap.set(l1Table, { opacity: 0 });
      var RAISE_TOP = 40;                     // image centre rides up to here, % (tune to taste)
      var tableFade = { o: 0 };               // scrubbed proxy; real opacity is gated
      var raise = { t: 50 };                  // scrubbed proxy; real `top` is gated
      // Drive internal values with the scroll, but clamp the actual image lift
      // and table opacity to their resting state until the crop is done.
      applyGate = function () {
        detailEl.style.top = (coreCropped ? raise.t : 50) + "%";
        l1Table.style.opacity = coreCropped ? tableFade.o : 0;
      };
      gsap.timeline({
        scrollTrigger: {
          trigger: l1Step, start: "top 88%", end: "bottom 12%", scrub: true,
          onUpdate: applyGate, onRefresh: applyGate
        }
      })
        // The image lifts (0-1), holds (1-3), then lowers (3-4) across the section.
        .fromTo(raise, { t: 50 }, { t: RAISE_TOP, ease: "none", duration: 1 }, 0)
        .to(raise, { t: RAISE_TOP, duration: 2 }, ">")
        .to(raise, { t: 50, ease: "none", duration: 1 }, ">")
        // The table fades in a beat AFTER the lift (0.9-1.7) and out a beat
        // BEFORE the image settles (2.4-3.2); it holds at full in between.
        .fromTo(tableFade, { o: 0 }, { o: 1, ease: "none", duration: 0.8 }, 0.9)
        .to(tableFade, { o: 0, ease: "none", duration: 0.8 }, 2.4);
    } else if (l1Table) {
      // In-flow (mobile / no pin): the step-child hide rule keeps it at opacity 0,
      // so just give it the standard scroll reveal where it sits in the copy.
      reveal(l1Table, l1Table, { y: 20, start: "top 88%", duration: 0.7 });
    }

    /* After the reader finishes "A balancing act" (the SMU step) and keeps
       scrolling, zoom + pan the pinned die map to focus on a single Zen 5 core
       — the same scrubbed scale/transform-origin move as the ALU overview band.
       The .journey__zoom layer (absolute, inset:0, transform-origin in CSS)
       holds the image AND its highlight rectangles, so they scale/pan together
       WITHOUT touching .journey__detail's centring transform — the frame stays
       pinned exactly where it is. The extra bottom runway on .journey__copy
       (see CSS) keeps the map pinned through the zoom. */
    var dieZoom = journey.querySelector(".journey__zoom");
    if (dieZoom && smuStep) {
      // Exact match of the ALU overview-band move: a paused timeline that plays
      // through once when triggered — scale 1 -> 2.6 over the whole timeline with
      // the rightward pan (xPercent 0 -> 5) easing in later. Triggered once the
      // SMU copy is read and the reader scrolls a little further.
      var zoomTl = gsap.timeline({
        paused: true,
        // Gate the image raise + cache table on the crop: they may only engage
        // once this zoom has fully cropped to the core, and must reset if we
        // reverse out of it (which also fades the crop/grayscale back in).
        onComplete: function () { coreCropped = true; applyGate(); },
        onReverseComplete: function () { coreCropped = false; applyGate(); },
        scrollTrigger: {
          trigger: smuStep,
          start: "bottom 45%",         // begins a touch earlier so the play-through
                                       // completes before the reader scrolls into
                                       // the "Going Deeper" copy below
          // play forward on the way down, and reverse it exactly on the way up
          toggleActions: "play none none reverse"
        }
      });
      // A spotlight mask that crops the image to the upper-left core: it has a
      // hole over that core and a huge box-shadow of the page bg covering the
      // rest, so fading it in hides ("fades out") the image under the other,
      // now-faded rectangles. It rides inside .journey__zoom, so the hole tracks
      // the core through the zoom/pan.
      var spotlight = journey.querySelector(".journey__spotlight");
      var dieDetail = journey.querySelector(".journey__detail");
      var dieCrop = journey.querySelector(".journey__crop");

      zoomTl
        // zoom in + pan to the upper-left core. The pan starts sooner and runs
        // longer so it flows continuously with the zoom (more fluid motion).
        .fromTo(dieZoom, { scale: 1 }, { scale: 2.9, ease: "power1.inOut", duration: 4 }, 0)
        .fromTo(dieZoom, { xPercent: 0, yPercent: 0 },
                { xPercent: 31, yPercent: 16, ease: "power1.inOut", duration: 3 }, 1)
        // fade the background die image (.journey__crop) out early — once the
        // frame crops down it would otherwise show through behind the core. By
        // position 3 (when the crop happens) it's gone; reverses back in on up.
        .to(dieCrop, { opacity: 0, ease: "power1.inOut", duration: 1.5 }, 1)
        // towards the very end, fade the spotlight mask in to crop the image
        // down to the focal core. The mask (opaque, on top of every rectangle)
        // hides the other highlights on its own, so we DON'T also animate their
        // opacity here — that previously fought each rectangle's own scrubbed
        // reveal trigger and glitched on fast scroll-up.
        .to(spotlight, { opacity: 1, ease: "power1.inOut", duration: 1 }, 3)
        // crop the square frame down so it bounds just the leftover core
        // rectangle (insets match where the zoomed/panned core lands); reverses
        // back to the full square on scroll-up as the rest fades back in
        .fromTo(dieDetail,
          { clipPath: "inset(0% 0% 0% 0% round 14px)" },
          { clipPath: "inset(16% 0% 28% 0% round 14px)", ease: "power1.inOut", duration: 1 }, 3);
      // Let the whole play-through run a hair slower so the zoom lands a fraction
      // later (the motion is unchanged, just stretched slightly in time).
      zoomTl.timeScale(0.92);
    }

    /* The die shots beneath the final chunk fade in (staggered) as it arrives.
       Their wrapper is hidden by the reveal CSS, so make it visible and fade
       the images themselves. */
    var gallery = journey.querySelector(".journey__gallery");
    var accents = journey.querySelectorAll(".journey__accent");
    if (accents.length && steps[2]) {
      if (gallery) gsap.set(gallery, { opacity: 1 });
      gsap.to(accents, {
        opacity: 1,
        ease: "none",
        stagger: 0.2,
        scrollTrigger: { trigger: steps[2], start: "top 80%", end: "top 45%", scrub: true }
      });
    }
  }

  /* ---- Epigraph pull-quote ---- */
  if (document.querySelector(".epigraph blockquote")) {
    reveal(".epigraph blockquote", ".epigraph", { duration: 0.9, start: "top 80%" });
  }

  /* ---- About: portrait + intro text are revealed by a CSS animation on the
         About page (about/index.html) so they appear immediately on load,
         without waiting for the deferred GSAP CDN. ---- */

  /* ---- Learn path: the connector line "draws" downward as you scroll,
         and each step's node dot + card reveal in sequence ---- */
  var ladder = document.querySelector(".ladder");
  if (ladder) {
    // The line draws in step with scroll across the ladder (scrubbed).
    gsap.to(ladder, {
      "--line-progress": 1,
      ease: "none",
      scrollTrigger: { trigger: ladder, start: "top 75%", end: "bottom 65%", scrub: 0.5 }
    });

    // Each step: card rises in, then its node pops on the line.
    gsap.utils.toArray(ladder.querySelectorAll(".step")).forEach(function (step) {
      gsap
        .timeline({ scrollTrigger: { trigger: step, start: "top 84%" } })
        .fromTo(step, { opacity: 0, y: 24 },
                { opacity: 1, y: 0, duration: 0.6, ease: EASE, clearProps: "transform" })
        .fromTo(step, { "--node-scale": 0 },
                { "--node-scale": 1, duration: 0.45, ease: "back.out(2)" }, "-=0.4");
    });
  }

  /* ---- "What you'll find" cards: revealed in sequence ---- */
  var findings = document.querySelector(".findings");
  if (findings) {
    reveal(findings.querySelectorAll(".finding"), findings, {
      y: 28,
      stagger: 0.12,
      start: "top 82%"
    });
  }

  /* Recalculate trigger positions once fonts/images have loaded. */
  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
  });
})();

/* Static build-path trace fallback: when the main module above bails out (GSAP
   failed to load OR reduced-motion), it does no scroll animation — so draw the
   snaking line + branches once, fully, so the path still reads. When GSAP is
   active this block is a no-op (the main module owns the trace). */
(function () {
  var reduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ready = window.gsap && window.ScrollTrigger;
  if (ready && !reduced) return;
  function draw() { buildBpTrace(); }
  if (document.readyState !== "loading") draw();
  else document.addEventListener("DOMContentLoaded", draw);
  window.addEventListener("load", draw);
  window.addEventListener("resize", draw);
})();
