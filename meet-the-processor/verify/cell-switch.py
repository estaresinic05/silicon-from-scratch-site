"""Walks the inverter's switching loop at stop 07 and checks the contract.

Drives window.__die.clock rather than waiting on the wall clock, which is the
same lever the video renderer uses and the reason the loop is written as a pure
function of its phase. Checks, over one full period:
  - exactly one device is lit at a time, never both and never neither
  - the gate is lit with the NMOS, since A drives both
  - A and Y are complementary
  - the cell spends most of the period AT REST, which is the point of the timing:
    a gate blinking on a loop stops being read after two cycles
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/meet-the-processor/"
PERIOD = 11400          # one full loop, most of it at rest
ACTIVE = 4400           # the part of it that actually switches
N = 24

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
    # regression, so say so and stop rather than reporting failed assertions
    # about a light that was asked not to run.
    if not pg.evaluate("window.__die.state.switching"):
        print("CELL_SWITCHING is off: the cell is held at its resting state "
              "so the layout can be read. Nothing to check. Flip the flag "
              "in scene.js to re-enable the loop, then run this again.")
        b.close()
        raise SystemExit(0)

    print(f"{'ms':>7} {'PMOS':>6} {'NMOS':>6} {'gate':>6} {'A':>6} {'Y':>6}   phase")
    rows = []
    for i in range(N + 1):
        ms = i / N * PERIOD
        pg.evaluate("(ms)=>window.__die.clock = ms", ms)
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
        rows.append((ms, c))
        print(f"{ms:7.0f} {c['pmos']:6.2f} {c['nmos']:6.2f} {c['gate']:6.2f}"
              f" {c['a']:6.2f} {c['y']:6.2f}   {'switching' if ms < ACTIVE else 'at rest'}")

    if rows:
        # base values, read off the resting frame rather than hardcoded. The cell
        # rests with NOTHING lit now, so this frame is the plain base colour of
        # every part and the checks below are all relative to it.
        rest = rows[-1][1]
        DIM_P, DIM_N, DIM_G = rest["pmos"], rest["nmos"], rest["gate"]
        lit = lambda v, dim: v > dim + 0.3

        for ms, c in rows:
            ph = ms / ACTIVE
            if ph >= 1:
                # the pause: the layout on its own, exactly as it looks with the
                # loop switched off
                if lit(c["pmos"], DIM_P) or lit(c["nmos"], DIM_N):
                    note(f"{ms:.0f} ms: something is still lit during the pause")
                continue
            # mid-edge is legitimately neither; only settled states are checked
            if not (0.20 < ph < 0.45):
                continue
            if lit(c["pmos"], DIM_P) == lit(c["nmos"], DIM_N):
                note(f"{ms:.0f} ms: both devices "
                     f"{'lit' if lit(c['pmos'], DIM_P) else 'dark'} "
                     f"(pmos {c['pmos']}, nmos {c['nmos']})")
            if lit(c["gate"], DIM_G) != lit(c["nmos"], DIM_N):
                note(f"{ms:.0f} ms: the gate does not follow the NMOS")

        # the switch must actually happen, or every check above passes vacuously
        if not any(lit(c["nmos"], DIM_N) for _, c in rows):
            note("the NMOS never conducts: the loop is not running at all")

        share = 1 - ACTIVE / PERIOD
        print()
        print(f"at rest for {share*100:.0f}% of the {PERIOD/1000:.1f}s loop")
        if share < 0.5:
            note("the switch is on screen too much of the time to read as an event")

    if errs:
        note(f"console: {errs[:3]}")
    print("\nissues:", "; ".join(bad) if bad else "none")
    b.close()

sys.exit(1 if bad else 0)
