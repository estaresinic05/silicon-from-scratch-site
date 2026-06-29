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

  /* ---- Doc hero (e.g. the ALU page): on load, settle the text up in sequence,
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

  /* ---- Diagram figures: fade + gently scale in as they scroll into view, the
         same reveal as the hero diagram above. ---- */
  gsap.utils.toArray(".figure").forEach(function (fig) {
    gsap.fromTo(
      fig,
      { opacity: 0, scale: 0.96 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.9,
        ease: EASE,
        clearProps: "transform",
        scrollTrigger: { trigger: fig, start: "top 85%" }
      }
    );
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

    steps.forEach(function (step) {
      var els = step.querySelectorAll(".kicker, h2, p, .journey__more");
      var words = [];
      Array.prototype.forEach.call(els, function (el) { wrapWords(el, words); });
      gsap.set(els, { opacity: 1 }); // containers visible; the words carry the fade

      var lines = toLines(words);

      // Fade in, line by line, as the chunk approaches.
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
