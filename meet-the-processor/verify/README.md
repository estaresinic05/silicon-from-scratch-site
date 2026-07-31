# Verification harnesses

Seven small scripts that check things about `scene.js` that are tedious or
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
| `camera-speed.py` | Distance ÷ time for every camera segment. Flags lurches. `sampleCamera` eases *inside* each segment, so the camera comes to rest at every key — a short segment between two distant keys is not a fast move, it is a jolt. This found a bug the user had not reported. |
| `first-frame.py` | Time to first frame on a throttled connection, and which assets blocked it versus streamed after. Use it before adding any texture. |
| `region-overlap.py` | Rasterises every core region, erodes 1 px, intersects. Flush regions share boundary pixels by design, so the erode is what separates "touching" from "overlapping". Also prints each region's area. |
| `perimeter-flush.py` | Checks that every region reaching one of the core's four sides sits exactly on that side's line, and lists coverage so gaps are visible. Measures per region, not per vertex — interior detail that happens to sit near an edge is not perimeter. |
| `camera-elevation.py` | Elevation and azimuth at every camera key, flagging jumps over 12 degrees and marking the ones that happen INSIDE a single stage. Exists because the floorplan sweep spent a long time doing the opposite of its own comment: elevations of 21, 46, 19, so the camera climbed to near birds-eye right as the first regions bloomed and dropped back a moment later. Very hard to see while scrubbing, very obvious in motion. Run it after touching `KEYS`. |
| `where-block.py` | `python where-block.py 0.800 "Vector Execution"` — projects a core block's top face through the real camera (via `window.__die.state.mvp`) and samples the render at that pixel. Answers "is this block actually drawn, and what colour is it" with numbers instead of squinting. It is what found the block that was rendering walls but no cap: the pixel at its label went from bare die-blue to white the moment the bug was fixed. |
| `label-contrast.py` | Blends each region's fill over the pixels it actually covers at the real 0.62 alpha and scores white text against it (WCAG). The authored hex is not what reaches the eye; this is how the unreadable yellows were found. |

## The one that keeps earning its keep

`scroll-check.py`. Everything else answers a question you knew you had.
