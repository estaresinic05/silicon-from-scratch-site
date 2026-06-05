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

  /* ---- Hero: a gentle settling-in on load ---- */
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

  /* ---- Hero: subtle logo parallax as the hero scrolls away ---- */
  var smallScreen = window.matchMedia("(max-width: 768px)").matches;
  gsap.to(".hero__logo", {
    yPercent: smallScreen ? -5 : -10, // lighter drift on phones
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });

  /* ---- Section headings: kicker -> heading -> note, staggered ---- */
  gsap.utils.toArray(".section__head").forEach(function (head) {
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

  /* ---- Epigraph pull-quote ---- */
  if (document.querySelector(".epigraph blockquote")) {
    reveal(".epigraph blockquote", ".epigraph", { duration: 0.9, start: "top 80%" });
  }

  /* ---- About: portrait, then the introduction text ---- */
  var aboutGrid = document.querySelector(".aboutme__grid");
  if (aboutGrid) {
    reveal(".aboutme__photo", aboutGrid, { start: "top 80%" });
    reveal(aboutGrid.querySelectorAll(".aboutme__body > *"), aboutGrid, {
      stagger: 0.1,
      start: "top 78%"
    });
  }

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
