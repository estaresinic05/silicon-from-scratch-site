# backing-video

Films the B-roll that sits behind the talking head in the site's intro video:
eighteen short shots of the site being used, a real mouse pointer moving like a
hand, and an identical cross-dissolve between every cut.

```
python tools/backing-video/capture.py --probe     # dry run: no recording
python tools/backing-video/capture.py             # ~4 min of filming
python tools/backing-video/assemble.py            # -> .backing/backing.mp4
```

Output lands in `.backing/` (gitignored): `clips/NN-id.mp4`, and `backing.mp4`
— the 90.6s 1080p60 cut.

**While `capture.py` runs the machine is not yours.** The browser owns the
top-left 1920×1080 of the screen and a script is flying the physical pointer.
Bumping the mouse ruins the take in progress and nothing else — re-shoot it
with `--only <shot-id>`.

---

## Why it is built this way

The brief needed a **visible cursor** moving the way a person moves one.
Playwright's mouse dispatches CDP events and never touches the OS pointer, so a
Playwright recording has no cursor in it at all. So the pointer goes through
Win32 (`human_mouse.py`), ffmpeg screen-grabs the desktop with `draw_mouse`, and
Playwright is left doing what it is actually good at: navigating, waiting on
real conditions, and reading state out of the page.

A side benefit worth knowing: because the input is genuine OS input, **`:hover`
is genuine too**. The gate-card lift, the die scene's block-group lighting and
the enlarge-card pop all happen by themselves.

### The browser is Edge, deliberately

Not Playwright's bundled Chromium, which is built **without proprietary
codecs**. The H.264 mp4s this video exists to show — the three hero loops and
the Zen 5 core explainer — would not decode, and the two best shots would be
poster frames. Edge is Chromium with the codecs. Chrome would do as well; it is
not installed on this machine. Override with `--browser`.

`--app` mode is load-bearing too: no tab strip and no omnibox means
`127.0.0.1:8777` never appears in the finished video. Unlike `--kiosk` it can
also be *sized*, which the section below explains is the whole ballgame.

---

## Why this captures at 60 and not 240

It was specified at the panel's native 240fps. That is not reachable on this
machine, and the reasons are worth recording so nobody re-litigates them:

- **`ddagrab` cannot duplicate this desktop.** Desktop Duplication is the only
  GPU-speed capture path ffmpeg has on Windows. Forced to the RTX 4080 it
  reports `Selected output not supported`; forced to the Intel Arc that
  actually drives the panel it reports `Failed to enumerate DXGI output 0`.
  Neither adapter, the documented `-filter_complex` form, nor any of the five
  `output_fmt` / `allow_fallback` variants changes it.
- **NVENC will not open.** This ffmpeg build requires nvenc API 13.1; the
  installed driver provides 13.0. Every `*_nvenc` encoder fails immediately.
- **`gdigrab` is a CPU blit, and it is the bottleneck.** Measured: ~34 fps
  grabbing 2560×1600, ~52 fps grabbing 1920×1080. Grabbing with *no encoder at
  all* measures the same ~52, so libx264 is not what is costing us.

Since the cost is per pixel, the browser is sized so its **content area is
exactly the 1920×1080 delivered frame**, and only that rectangle is grabbed.
The pipeline is then 1:1 end to end — no crop, no scale, no resampling — which
buys back most of the sharpness the original downscale existed to provide.

Residual caveat, stated plainly: the grabber reaches ~52–58 of the 60 fps it is
asked for, so a small fraction of frames in the master are duplicates. Behind a
talking head it is not visible, and `capture.py` prints the real rate for every
clip so you can see it rather than trust it.

If you want a genuine 240: install OBS Studio, which has working GPU display
capture, and replace `Recorder`. Everything else in the harness is unaffected.

---

## The traps

Each of these produces a capture that looks plausible and is worthless, so each
is asserted rather than hoped for.

**1. Reduced motion.** `scripts/scroll.js` strips `html.js` and cancels every
GSAP reveal under `prefers-reduced-motion`, and `scripts/main.js:619` refuses to
play the hero clips. The page still *renders* fine — it is simply dead. If
`assert_motion_on` throws, `emulate_media` did not take.

**2. The page rendering slower than the recorder.** `measure_fps` counts rAF
callbacks; below the capture target the run aborts, because a clip that juddered
at the source cannot be fixed downstream.

**3. A silent capture-path downgrade.** Falling back from `ddagrab` to
`gdigrab` is printed loudly, and every clip's real frame count is checked
afterwards. The threshold is 85% rather than 95% precisely because the ~52/60
shortfall is *known* — flagging every clip would train the eye to ignore the
flag, so it only fires on a real collapse.

---

## Geometry and the pointer map

The desktop is 2560×1600 at 150% scale; the browser takes the top-left
1920×1080 of it at `--force-device-scale-factor=1`, so one CSS pixel is one
captured pixel is one delivered pixel. `fit_window` measures the frame and
title-bar overhead over CDP and corrects for it rather than assuming a constant,
because that overhead varies with theme and DPI.

Page CSS pixels → physical screen pixels is **measured, not derived**.
`Stage.calibrate()` parks the real cursor on three known screen points and asks
the page what `clientX/clientY` it saw. Deriving it from the DPI scale is the
kind of arithmetic that is right on one machine and quietly wrong on the next.

## What makes the motion read as a hand

In the order the eye notices them missing, all in `human_mouse.py`:

1. **Speed curve.** Minimum-jerk (`10u³−15u⁴+6u⁵`), the measured signature of
   human reaching. Linear interpolation is a bigger tell than a straight path.
2. **Curvature.** Bézier control points thrown perpendicular to the line, sign
   alternating per move so gestures do not all bow the same way.
3. **Overshoot** past 400px, then a short corrective settle. Short moves do not
   overshoot, because a hand only overshoots when it was already moving fast.
4. **Never perfectly still** — a low-passed tremor, and idle wander between
   actions. At 240fps there are a lot of frames in which to notice a frozen
   cursor.

Emission is at **480Hz**, well above the capture rate, so no frame catches the
pointer parked between two `SetCursorPos` calls. `time.sleep` cannot pace 2ms on
Windows, so the step loop spins on `perf_counter`.

`--seed` fixes the pointer RNG: the same seed reproduces the same motion, which
is what makes a re-shoot comparable to the take it replaces.

---

## The die-scene timing problem

`meet-the-processor` legs run `LEG_MS = [10000, 14000, 19000, 5200, 11000,
6500]`, and **`__die.seek()` snaps** — it does not animate, so it cannot be used
to film a camera move. Worse, the part worth filming is usually the *arrival*:
the floorplan blooms in at the end of leg 1, the core's blocks rise at the end
of leg 2.

So those shots park at a stop with `seek`, click `#nav-next`, and roll for the
whole leg — up to 19 seconds — marked `tail=True`. `assemble.py` keeps only the
final 5.6s with `-sseof`. The trim is free because assembly re-encodes anyway.

The Zen 5 core is found by **raycast, not by hardcoded pixels**:
`Stage.find_region` sweeps the canvas with CDP pointer moves and asks
`__die.state.hover` what is under each one. A baked-in coordinate would rot
silently the next time the camera keys are retuned and click empty silicon.

`openSheet()` sets the video's `src` and calls `load()` but never plays it, so
the shot clicks the player's own play button; `video.play()` is the fallback,
because the native control bar's geometry is Chromium's business and must not
be what costs the shot.

---

## Changing the cut

- **Which shots, and what happens in them** → `shots.py`. Each shot has a
  `prep` (off camera: navigate, frame, settle) and an `action` (on camera: do it
  with `s.hand`). Aim actions slightly under budget and end on `s.wander(...)` —
  a cursor still moving into the dissolve reads as a continuous session.
- **Length, dissolve, framerate, frame size** → `config.py`. Note that
  `FINAL_W/H` is also what the browser window is sized to; change it and the
  capture follows, but `assemble.py` will then need its scale filter back.
- Re-shoot one shot with `--only`, then re-run `assemble.py` alone.
