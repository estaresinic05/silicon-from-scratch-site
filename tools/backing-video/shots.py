"""The eighteen shots, in cut order.

Each shot is a Shot(...) with two callables:

  prep(s)    Runs OFF CAMERA, before the recorder starts. Navigate, scroll the
             subject into frame, put the pointer somewhere sensible, let GSAP
             settle. Nothing here is filmed, so it can be as blunt as it likes
             -- JS scrolling, JS clicking, whatever gets the page into position.
  action(s)  Runs ON CAMERA. This is the performance, and everything in it
             should be done with `s.hand`, the real Windows pointer.

`s` is the Stage from capture.py: a thin wrapper holding the Playwright page,
the Hand, and the page->screen coordinate map.

Order. The cut opens on the home page and ENDS THAT SHOT BY PRESSING "Meet the
Processor", so the six die-scene shots that follow are somewhere the viewer was
taken rather than somewhere they were dropped. The lesson material follows.

Timing. Shots are SHOT_SECONDS long by default, and a shot may override
`seconds` when its beat genuinely does not fit. Only the DISSOLVE has to be
identical between every pair -- that is the requirement -- and a constant clip
length was only ever a convenience. `record` is how long the recorder actually
rolls, which is longer for the die-scene shots (see below).

Actions should aim slightly UNDER their budget and end on `s.wander(...)`; a
cursor still moving when the dissolve begins reads as a continuous session, and
a cursor frozen for the last half second reads as a script that ran out.

The die-scene problem. Its legs run LEG_MS = [10000, 14000, 19000, 5200, 11000,
6500] and `__die.seek()` SNAPS -- it does not animate, so it cannot be used to
film a camera move. And the interesting part of a leg is usually its arrival,
not its departure: the floorplan blooms in at the end of leg 1, the core's
blocks rise at the end of leg 2. So those shots roll for the whole leg and are
marked tail=True, which makes assemble.py keep only the final `seconds` with
`-sseof`. Assembly re-encodes regardless, so the trim is free.

Consequence worth knowing: the arrow click that starts a long leg happens more
than `seconds` before the arrival, so it lands outside the kept tail. The cursor
is deliberately left loitering on the purple arrow for the whole flight, so the
part that survives still reads as someone driving the scene by hand.
"""
from config import SHOT_SECONDS

# From scene.js:3417. Mirrored rather than imported because it lives in
# JavaScript; capture.py asserts the stop count against window.__die at runtime,
# so a change there fails loudly here instead of quietly mistiming five shots.
LEG_MS = [10000, 14000, 19000, 5200, 11000, 6500]


class Shot:
    def __init__(self, sid, page_url, prep, action, note='', seconds=None,
                 record=None, tail=False):
        self.id = sid
        self.url = page_url
        self.prep = prep
        self.action = action
        self.note = note            # printed as the shot rolls, so a bad take
                                    # can be identified from the log alone
        self.seconds = seconds or SHOT_SECONDS
        # A little pad so the action is never racing the recorder's stop.
        self.record = record or (self.seconds + 0.9)
        self.tail = tail


# --- helpers used by several shots ----------------------------------------

def _leg_shot(sid, from_stop, note, after=None, seconds=None, extra_record=0.0):
    """A die-scene shot: park at `from_stop`, fly the next leg, keep the tail.

    The leg is started by CLICKING THE PURPLE ARROW with the real pointer, not
    by calling .click() in JavaScript. It is the one control the whole scene is
    driven by, and a camera move that begins with no visible cause reads as the
    page playing itself rather than as someone using it.

    `after` runs once the camera has parked, for shots that want to do something
    at the stop rather than just arrive at it. Give those a longer `seconds` as
    well, or the kept tail is all epilogue and none of the flight.
    """
    leg_ms = LEG_MS[from_stop]

    def prep(s):
        s.mtp_ready()
        s.eval(f'window.__die.seek(window.__die.stops[{from_stop}])')
        s.wait(900)                      # let the caption swap finish
        s.park(0.42, 0.80)               # near the arrow, so the reach is short

    def action(s):
        s.click('#nav-next')             # the purple arrow
        # Loiter by the arrow through the flight. The arrows go inert while
        # flying, so there is nothing to press -- but this is what keeps a hand
        # in frame for the part of the clip that actually survives the trim.
        s.wander(1.2)
        # Poll for arrival rather than sleeping the leg: on a cold texture the
        # scene can take longer than LEG_MS to settle, and a fixed sleep would
        # cut the clip mid-flight.
        s.wait_for('!window.__die.flying', timeout=leg_ms + 8000)
        if after:
            after(s)
        else:
            s.wander(0.8)

    return Shot(sid, '/meet-the-processor/', prep, action, note=note,
                seconds=seconds,
                record=leg_ms / 1000.0 + 5.0 + extra_record, tail=True)


def _tour_blocks(s):
    """Walk the pointer over the core's blocks so they lift under it.

    Aimed at fractional canvas positions rather than named regions: these are
    geometry, not DOM elements, so there are no boxes to target. A spread of
    points across the middle of the frame catches a different slab each time,
    and hovering one lights its whole logical part -- the four vector register
    files, the FADD/FMAC lanes, both L2 halves -- so a single hover moves more
    than one block.
    """
    for fx, fy in ((0.42, 0.46), (0.55, 0.56), (0.64, 0.44),
                   (0.47, 0.64), (0.58, 0.70)):
        s.hover_at(fx, fy)
        s.wait(320)


def _quiz_shot(sid, url, note, wrong=0):
    """Answer a Check Yourself wrong, then right.

    The wrong answer earns its two seconds: it shows the quiz actually judges
    you, and red-then-green is a better piece of film than one correct click.
    """
    return Shot(
        sid, url,
        prep=lambda s: (s.goto(url), s.center('#quiz'), s.park(0.5, 0.35)),
        action=lambda s: (s.click('.quiz__opt:not([data-correct])', nth=wrong),
                          s.wait(1300),
                          s.click('.quiz__opt[data-correct]'),
                          s.wait(1400),
                          s.wander(0.5)),
        note=note)


# --- the cut ---------------------------------------------------------------

SHOTS = [

    # 1. The site arriving, and the click that sets up everything after it.
    #
    # This is the one shot that navigates ON camera: the hero's GSAP settle
    # fires once, on load, so a prepped page has already spent it. Prep parks on
    # a blank page painted the site's own background, so the cut opens on dark
    # and the load reads as a load, not as a flash.
    #
    # It ends by pressing Meet the Processor, and the next six shots are that
    # scene -- so the cut has a reason to be there rather than arriving by
    # magic. The press is real; the navigation is not (see LINK_REWRITE), so
    # each die shot loads the local page itself. On screen they are the same.
    Shot('home-hero', '/',
         prep=lambda s: (s.goto('/'),
                         s.blank_on_site_bg(),
                         s.park(0.35, 0.62)),
         action=lambda s: (s.goto('/'),
                           s.wait_visible('.hero__text'),
                           s.wait(1400),          # the settle plays itself
                           # The card's FOOTER, not the card. Resting the
                           # pointer on one of the three <video> panels makes
                           # Edge float its video-translate/picture-in-picture
                           # toolbar over the artwork, and that is browser UI --
                           # no page CSS removes it. The footer lights the same
                           # card hover state and touches no media element.
                           s.hover('.mtp-card__foot'),
                           s.wait(700),
                           s.click('.mtp-card__foot'),
                           s.wait(900)),
         note='ends on the click into Meet the Processor',
         seconds=7.0),

    # 2-3. Into the die. Lid off, then down to the floorplan.
    _leg_shot('mtp-lid', 0, 'the IHS lifting off the bare dies'),
    _leg_shot('mtp-floorplan', 1, 'cores, then L3, then the SMU strip blooming in'),

    # 4. The floorplan, explored by hand: hover several regions and watch them
    # lift, then press a Zen 5 core and let the explainer play.
    #
    # The hovers aim at fractional canvas positions rather than named regions,
    # because there are no DOM boxes here -- the blocks are geometry. Spreading
    # a few points across the die lights whichever ones are under them, which is
    # what someone poking at it would do anyway.
    #
    # The CLICK, though, is aimed by raycast: prep sweeps the canvas asking
    # __die.state.hover what is underneath until it finds a core. A hardcoded
    # coordinate would rot silently the next time the camera keys are retuned
    # and press empty silicon.
    #
    # Head-trimmed, not tail-trimmed: the sequence is the point, so the clip
    # keeps hover -> hover -> hover -> click -> video rather than just the end.
    Shot('mtp-zen5', '/meet-the-processor/',
         prep=lambda s: (s.mtp_ready(),
                         s.eval('window.__die.seek(window.__die.stops[2])'),
                         s.wait(1200),
                         s.find_region('core'),
                         s.park(0.62, 0.38)),
         action=lambda s: (s.hover_at(0.55, 0.45),
                           s.wait(500),
                           s.hover_at(0.63, 0.60),
                           s.wait(500),
                           s.hover_at(0.44, 0.66),
                           s.wait(500),
                           s.click_found(),
                           s.wait_visible('#sheet-video'),
                           s.wait(700),
                           s.play_sheet_video(),
                           # wander, not wait: Chromium hides the cursor over a
                           # playing video once it stops moving, and this shot
                           # is meant to look like someone watching it.
                           s.wander(1.6)),
         note='hovering the blocks, then the Zen 5 core and its video',
         seconds=10.0, record=11.5),

    # 5-7. The rest of the descent.
    # Nine seconds, not 5.6: the blocks rise through the end of the leg AND the
    # pointer then tours them. At 5.6 the kept tail would be almost all touring
    # and the reveal it is touring would have been trimmed off the front.
    _leg_shot('mtp-core', 2,
              'the 29 blocks rise, then the pointer lifts them one by one',
              after=_tour_blocks, seconds=9.0, extra_record=5.5),
    _leg_shot('mtp-metal', 3, 'the copper tiers cascading apart'),
    # Stop 06 -> 07: down through the standard-cell rows into a single CMOS
    # inverter, which then switches on a loop.
    _leg_shot('mtp-cell', 5, 'into one cell, one gate -- the inverter switching'),

    # 8. How you actually find a lesson: the Project Directory, its three
    # difficulty tiers, and a click through to one of them.
    #
    # Twelve seconds rather than 5.6. Opening the drawer, reading three tiers
    # and picking a lesson cannot be done in 5.6s without it looking frantic,
    # and nothing requires every clip to be the same length -- only every
    # DISSOLVE.
    Shot('project-directory', '/',
         prep=lambda s: (s.goto('/'),
                         s.park(0.5, 0.25)),
         action=lambda s: (s.click('.js-open-proj-dir'),
                           s.wait(900),
                           s.click('.menu__cat .menu__toggle', nth=0),   # Beginner
                           s.wait(900),
                           s.click('.menu__cat .menu__toggle', nth=1),   # Intermediate
                           s.wait(900),
                           s.click('.menu__cat .menu__toggle', nth=2),   # Advanced
                           s.wait(900),
                           s.click('.navsheet a:has-text("The Pipelined Datapath")'),
                           s.goto('/pipelined-cpu/pipelined-datapath/'),
                           s.wait_visible('.doc-hero__text'),
                           # Hold on the lesson you landed on. The arrival is
                           # the payoff of the whole walk and it was going by
                           # too fast to read the title.
                           s.wander(1.7)),
         note='Project Directory, three tiers, into the Pipelined Datapath',
         seconds=12.7, record=14.3),

    # 9. A Verilog flip card: front face -> flip -> live simulation. Toggling
    # clk on the gated D-latch is the clearest one-click cause-and-effect on the
    # site, because the output visibly follows.
    Shot('home-latch', '/',
         prep=lambda s: (s.goto('/'),
                         s.center('#latch-card'),
                         s.park(0.4, 0.75)),
         action=lambda s: (s.click('#latch-card .gate-card__face--front'),
                           s.wait(1200),                    # the flip
                           s.click('#latch-card .gate-sim__chip', nth=0),
                           s.wait(800),
                           s.click('#latch-card .gate-sim__chip', nth=1),
                           s.wander(0.9))),

    # 10. The Verilog, shown on real hardware rather than on a textbook gate.
    # Fetch/Decode/Execute's instruction-memory card is a module someone might
    # actually be proud of; the AND gate in "Meet the Gates" is not the flex.
    # The flip happens ON camera here, unlike the latch shot. It has to: the
    # sim chips live on the BACK face, so their boxes resolve even while the
    # card is front-side-up, and clicking one then lands on the front face and
    # flips the card instead of toggling anything. Filming the flip is the
    # honest version of what was happening by accident anyway, and the wait is
    # on the class rather than on a timer.
    Shot('fde-verilog', '/single-cycle-cpu/fetch-decode-execute/',
         prep=lambda s: (s.goto('/single-cycle-cpu/fetch-decode-execute/'),
                         s.center('.gate-card'),
                         s.park(0.35, 0.75)),
         action=lambda s: (s.click('.gate-card .gate-card__face--front'),
                           s.wait_for('document.querySelector(".gate-card")'
                                      '.classList.contains("is-flipped")'),
                           s.wait(1100),
                           s.click('.gate-card .gate-sim__chip', nth=0),
                           s.wait(900),
                           s.click('.gate-card .gate-sim__chip', nth=1),
                           s.wander(0.8)),
         note='the data memory module: flip, then drive its live sim',
         # 6.5s: a flip plus two toggles does not fit in 5.6, and cutting the
         # second toggle would leave the sim looking like it only responds once.
         seconds=6.5),

    # 11. The enlarge lightbox, on one of the hand-drawn RISC-V instruction
    # formats. Hover pops the card, click blurs the page out behind it and the
    # drawing owns the frame.
    Shot('instr-enlarge', '/single-cycle-cpu/basics-of-instructions/',
         prep=lambda s: (s.goto('/single-cycle-cpu/basics-of-instructions/'),
                         s.center('.figure--diagram'),
                         s.park(0.3, 0.3)),
         action=lambda s: (s.hover('.figure--diagram img'),
                           s.wait(700),
                           s.click('.figure--diagram img'),
                           s.wait(2200),
                           s.wander(1.2))),

    # 12. The ALU datapath explorer relighting itself. Three presets, ~1s apart
    # -- fast enough to show the wires follow the operation, slow enough that
    # the eye can follow which ones changed.
    Shot('alu-presets', '/alu/complete-alu/',
         prep=lambda s: (s.goto('/alu/complete-alu/'),
                         s.center('#alu-widget'),
                         s.park(0.3, 0.8)),
         action=lambda s: (s.click('.alu-preset[data-code="2"]'),   # add
                           s.wait(900),
                           s.click('.alu-preset[data-code="6"]'),   # subtract
                           s.wait(900),
                           s.click('.alu-preset[data-code="7"]'),   # slt
                           s.wander(0.4))),

    # 13. The slice's timing diagram answering the pointer. Sweeping across it
    # drags a scrubber guide along the traces; the eye toggles in the name panel
    # drop a signal out of the plot and bring it back.
    #
    # sweep(), not drag_track(): the guide follows a bare pointer, so pressing
    # would be both wrong and invisible.
    Shot('slice-wave', '/alu/alu-slice/',
         prep=lambda s: (s.goto('/alu/alu-slice/'),
                         s.center('.aluwave.slicewave'),
                         s.park(0.2, 0.75)),
         action=lambda s: (s.sweep('.aluwave.slicewave', 0.30, 0.92, 1.8, y=0.55),
                           s.wait(300),
                           s.click('.aluwave.slicewave .awv-toggle', nth=1),
                           s.wait(700),
                           s.click('.aluwave.slicewave .awv-toggle', nth=1),
                           s.wander(0.4)),
         note='scrubber guide follows the pointer, then a signal is hidden'),

    # 14. The drag. The track captures the pointer on pointerdown, so this has
    # to be a genuine press-traverse-release; a click at the far end would jump
    # the slider and lose the cross-fade, which is the entire point.
    Shot('layout-fade', '/introduction-to-physical-design/transistor-basics/',
         prep=lambda s: (s.goto('/introduction-to-physical-design/transistor-basics/'),
                         s.center('.layout-fade'),
                         s.park(0.3, 0.8)),
         action=lambda s: (s.drag_track('.layout-fade__track', 0.02, 0.98, 3.4),
                           s.wait(600),
                           s.drag_track('.layout-fade__track', 0.98, 0.45, 1.0))),

    # 15. The three MOS operating modes, tab by tab.
    Shot('mode-switch', '/introduction-to-physical-design/transistor-basics/',
         prep=lambda s: (s.goto('/introduction-to-physical-design/transistor-basics/'),
                         s.center('.mode-switch'),
                         s.park(0.4, 0.75)),
         action=lambda s: (s.click('.mode-switch__tab', nth=1),
                           s.wait(1400),
                           s.click('.mode-switch__tab', nth=2),
                           s.wait(1400),
                           s.wander(0.8))),

    # 16. A collapsed figure expanding to the full drawing. The .reveal-hint
    # arrow is already pointing at the button, so the cursor arriving there is
    # the page's own choreography being obeyed.
    Shot('datapath-reveal', '/single-cycle-cpu/constructing-a-datapath/',
         prep=lambda s: (s.goto('/single-cycle-cpu/constructing-a-datapath/'),
                         s.center('.pc-reveal'),
                         s.park(0.6, 0.3)),
         action=lambda s: (s.hover('.pc-reveal__toggle'),
                           s.wait(800),
                           s.click('.pc-reveal__toggle'),
                           s.wait(2200),
                           s.wander(1.0))),

    # 17-18. Two Check Yourselfs. The datapath one asks about the register
    # file's split-cycle write; the pipelining one about stalls and forwarding.
    _quiz_shot('datapath-quiz', '/pipelined-cpu/pipelined-datapath/',
               'the register-file timing quiz', wrong=1),
    _quiz_shot('quiz', '/pipelined-cpu/pipelining/',
               'the stall / forward quiz', wrong=1),
]
