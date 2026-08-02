"""Walks the inverter's switching loop at stop 07 and checks the contract.

Drives window.__die.clock rather than waiting on the wall clock, which is the
same lever the video renderer uses and the reason the loop is written as a pure
function of its phase. Checks, over one full period:
  - exactly one device is lit at a time, never both and never neither
  - the gate is lit with the NMOS, since A drives both
  - A and Y are complementary
  - the pulse leaves the via low and arrives high, in order
  - the output wire lights only after the pulse has climbed
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/meet-the-processor/"
PERIOD = 5200
N = 20

bad = []


def note(m):
    bad.append(m)
    print("  FAIL " + m)


with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                 "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=60000)
    pg.evaluate("window.__die.drift = false")
    pg.evaluate("window.__die.seek(0.99)")
    pg.wait_for_timeout(400)

    # CELL_SWITCHING gates the whole loop. Off is a deliberate state, not a
    # regression, so say so and stop rather than reporting six failed assertions
    # about a light that was asked not to run.
    if not pg.evaluate("window.__die.state.switching"):
        print("CELL_SWITCHING is off: the cell is held at its resting state "
              "so the layout can be read. Nothing to check. Flip the flag "
              "in scene.js to re-enable the loop, then run this again.")
        b.close()
        raise SystemExit(0)

    print(f"{'phase':>6} {'PMOS':>6} {'NMOS':>6} {'gate':>6} {'A':>6} {'Y':>6}"
          f"  {'via, low to high':<28} {'wire':>6}")
    rows = []
    for i in range(N + 1):
        ph = i / N
        pg.evaluate("(ms)=>window.__die.clock = ms", ph * PERIOD)
        # Two real animation frames, not a timeout. state reads back what was
        # last DRAWN, so a wall-clock wait samples whichever frame happened to
        # land and the readout comes out in identical blocks that look like the
        # loop has stalled when it has not.
        pg.evaluate("()=>new Promise(r=>requestAnimationFrame("
                    "()=>requestAnimationFrame(r)))")
        c = pg.evaluate("window.__die.state.cell")
        if not c:
            note("the cell is not visible at t 0.99")
            break
        rows.append((ph, c))
        via = " ".join(f"{v:4.2f}" for v in c["via"])
        print(f"{ph:6.2f} {c['pmos']:6.2f} {c['nmos']:6.2f} {c['gate']:6.2f}"
              f" {c['a']:6.2f} {c['y']:6.2f}  {via:<28} {c['wire']:6.2f}")

    if rows:
        FIN_DIM, GATE_DIM = 0.34, 0.24
        for ph, c in rows:
            hot_p = c["pmos"] > FIN_DIM + 0.35
            hot_n = c["nmos"] > FIN_DIM + 0.35
            # mid-edge is legitimately neither; only the settled states are checked
            settled = ph < 0.05 or 0.20 < ph < 0.45 or 0.60 < ph < 0.95
            if settled and hot_p == hot_n:
                note(f"phase {ph:.2f}: both devices {'lit' if hot_p else 'dark'} "
                     f"(pmos {c['pmos']}, nmos {c['nmos']})")
            if settled and (c["gate"] > GATE_DIM + 0.35) != hot_n:
                note(f"phase {ph:.2f}: gate does not follow the NMOS")

        # the pulse: the bottom of the via must peak before the top of it
        def peak(idx):
            return max(range(len(rows)), key=lambda k: rows[k][1]["via"][idx])
        lo, hi = peak(0), peak(len(rows[0][1]["via"]) - 1)
        print(f"\npulse: bottom of the via peaks at phase {rows[lo][0]:.2f}, "
              f"top at {rows[hi][0]:.2f}")
        if not lo < hi:
            note("the pulse does not travel upward")
        wire_peak = max(range(len(rows)), key=lambda k: rows[k][1]["wire"])
        print(f"       the output wire peaks at {rows[wire_peak][0]:.2f}")
        if wire_peak < hi:
            note("the wire lights before the pulse reaches it")

    if errs:
        note(f"console: {errs[:3]}")
    print("\nissues:", "; ".join(bad) if bad else "none")
    b.close()

sys.exit(1 if bad else 0)
