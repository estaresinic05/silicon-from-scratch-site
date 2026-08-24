# Verification harnesses

Small scripts that check things about `scene.js` that are tedious or
impossible to judge by eye. They were written one at a time while building the
descent, and each one exists because eyeballing had already got something
wrong at least once.

They lived in a session scratchpad until now, which is a temp directory that
gets wiped. They are here so they survive.

Everything needs the local server running from the **site root**:

```sh
python -m http.server 8777
```

`shot.py`, `scroll-check.py` and `first-frame.py` also need Playwright with
Chromium (`pip install playwright && playwright install chromium`). They launch
with SwiftShader, so they work on a machine with no GPU — slowly.

| script | what it answers |
|---|---|
| `scroll-check.py` | Walks the whole scroll and reports console errors and warnings. Run this after every change; it is the cheapest way to catch a typo that kills the module. |
| `shot.py` | Screenshots the scene at given scroll positions: `python shot.py 0.46 0.70`. Waits for `window.__die.t` to converge rather than on a fixed timeout, because the scroll is damped, and disables the camera drift so captures are reproducible. |
| `cell-switch.py` | Drives the inverter's switching loop at stop 07 through a full period via `__die.clock`, and checks the contract: exactly one device lit at a time, the gate following the NMOS, A and Y complementary, and the pulse peaking low-to-high up the output via before `outWire` lights. Waits on real animation frames rather than a timeout, because `__die.state` reads back what was last *drawn* and a wall-clock wait samples whichever frame happened to land. |
| `camera-speed.py` | Distance ÷ time for every camera segment. Flags lurches. `sampleCamera` eases *inside* each segment, so the camera comes to rest at every key — a short segment between two distant keys is not a fast move, it is a jolt. This found a bug the user had not reported. |
| `first-frame.py` | Time to first frame on a throttled connection, and which assets blocked it versus streamed after. Use it before adding any texture. |
| `region-overlap.py` | Rasterises every core region, erodes 1 px, intersects. Flush regions share boundary pixels by design, so the erode is what separates "touching" from "overlapping". Also prints each region's area. |
| `perimeter-flush.py` | Checks that every region reaching one of the core's four sides sits exactly on that side's line, and lists coverage so gaps are visible. Measures per region, not per vertex — interior detail that happens to sit near an edge is not perimeter. |
| `camera-elevation.py` | Elevation and azimuth at every camera key, flagging jumps over 12 degrees and marking the ones that happen INSIDE a single stage. Exists because the floorplan sweep spent a long time doing the opposite of its own comment: elevations of 21, 46, 19, so the camera climbed to near birds-eye right as the first regions bloomed and dropped back a moment later. Very hard to see while scrubbing, very obvious in motion. Run it after touching `KEYS`. |
| `where-block.py` | `python where-block.py 0.800 "Vector Execution"` — projects a core block's top face through the real camera (via `window.__die.state.mvp`) and samples the render at that pixel. Answers "is this block actually drawn, and what color is it" with numbers instead of squinting. It is what found the block that was rendering walls but no cap: the pixel at its label went from bare die-blue to white the moment the bug was fixed. |
| `label-contrast.py` | Blends each region's fill over the pixels it actually covers at the real 0.62 alpha and scores white text against it (WCAG). The authored hex is not what reaches the eye; this is how the unreadable yellows were found. |
| `fit-compare.py` | Shoots the same stops at 1440x900 and 390x844 so the narrow-viewport pull can be judged against the shot each stop was composed to be. `python verify/fit-compare.py mytag 0.888 0.966`. This is what showed that one pull factor across the whole descent backs the camera out of the metal stack. |
| `cell-in-frame.py` | Stop 07's four pin names in NDC at five phone widths, via `__die.cellFrame`. A screenshot cannot tell "OUT just clears the edge" from "it just does not", and one of those is a missing word. This is what `FIT_W`'s last entry is tuned against. |
| `bar-fit.py` | Every phone top-bar child's box and the row's leftover slack, at five widths. The bar's budget is mostly spent before any type is placed — two 44px targets are fixed and the wordmark will not shrink past its own 135px of text — so this is what says whether a change to the bar has spent width it did not have. |
| `desktop-unchanged.py` | **The gate for any phone work on this page.** `tools/desktop-unchanged.py` toggles `styles/mobile.css`, which this page does not load, so it says nothing here. Measure, `git stash` the changed files, measure again with a different tag, `--diff` the two. Expect the caption block, `spark`, the rail tick and the nav chevrons to differ by a few px whatever you do: they animate, and that is the 9-11px false positive to ignore. A camera difference at any desktop size is not. |

## The one that keeps earning its keep

`scroll-check.py`. Everything else answers a question you knew you had.
