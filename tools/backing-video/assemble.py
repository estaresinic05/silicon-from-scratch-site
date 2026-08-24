"""Cut the clips together with one identical dissolve between every pair.

    python tools/backing-video/assemble.py
    python tools/backing-video/assemble.py --master 240   # also a native-rate cut

Equal dissolves are the requirement, so XFADE is one constant used everywhere
and there is no per-cut override to reach for. Clip LENGTHS may vary -- that was
never the requirement, and one shot genuinely needs longer than the rest -- so
the offsets are accumulated rather than multiplied out. Total is
sum(seconds) - (n-1) * XFADE.

Two things worth knowing before editing this.

NOTHING IS RESCALED. The clips are captured at exactly 1920x1080 -- the
browser's content area is sized to the delivered frame -- so this only trims,
dissolves and re-encodes. No crop, no scale, no resampling. If you change
FINAL_W/H in config.py without changing what the capture grabs, add the scale
back here.

TAIL CLIPS ARE TRIMMED FROM THE END. The die-scene shots record a whole camera
leg -- up to 19 seconds -- because the part worth filming is the arrival, not
the departure. They carry tail=True and get `-sseof`, which is free here
because everything is being re-encoded anyway.
"""
import argparse
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config as C
from shots import SHOTS

X = C.XFADE


def collect():
    """The clips that exist, in cut order, paired with their shot."""
    found = []
    for i, shot in enumerate(SHOTS):
        path = os.path.join(C.CLIPS, f'{i+1:02d}-{shot.id}.mp4')
        if os.path.exists(path) and os.path.getsize(path) > 10000:
            found.append((path, shot))
        else:
            print(f'  !! missing {os.path.basename(path)} -- not in the cut')
    return found


def build(clips, out, fps):
    cmd = ['ffmpeg', '-y', '-loglevel', 'error']
    for path, shot in clips:
        # BOTH -sseof and -t must precede their -i. An option written after
        # "-i file" belongs to the NEXT input -- or, on the last one, to the
        # OUTPUT, where a stray -t truncates the entire assembled cut to a
        # single shot's length. That is exactly the bug this comment exists to
        # stop someone reintroducing.
        if shot.tail:
            cmd += ['-sseof', f'-{shot.seconds}']    # keep the last N seconds
        cmd += ['-t', str(shot.seconds), '-i', path]

    parts = []
    for i, _ in enumerate(clips):
        # Normalize before blending: xfade will not touch inputs whose timebase,
        # rate or pixel format disagree, and a fallback-encoded clip can easily
        # disagree with an NVENC one.
        parts.append(
            f'[{i}:v]fps={C.CAPTURE_FPS},'
            f'setpts=PTS-STARTPTS,format=yuv420p[v{i}]')

    if len(clips) == 1:
        last = '[v0]'
    else:
        prev = '[v0]'
        for k in range(1, len(clips)):
            # The accumulated chain is sum(d[:k]) - (k-1)*X long, and the next
            # clip has to start X before it ends, so:
            #     offset(k) = sum(d[:k]) - k*X
            # Written for VARYING clip lengths on purpose. Shots may differ in
            # duration -- only the dissolve is required to be identical -- and
            # the constant-length form (k*(D-X)) silently desynchronizes the
            # moment one shot is longer than the rest.
            off = sum(c[1].seconds for c in clips[:k]) - k * X
            tag = f'[x{k}]'
            parts.append(f'{prev}[v{k}]xfade=transition=fade:'
                         f'duration={X}:offset={off:.3f}{tag}')
            prev = tag
        last = prev

    cmd += ['-filter_complex', ';'.join(parts), '-map', last,
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
            '-pix_fmt', 'yuv420p', '-r', str(fps), '-an',
            '-movflags', '+faststart', out]
    return cmd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--master', type=int, action='append', default=None,
                    help='extra output framerate, e.g. --master 240')
    args = ap.parse_args()

    clips = collect()
    if not clips:
        raise SystemExit(f'no clips in {C.CLIPS}; run capture.py first')

    rates = [C.OUTPUT_FPS] + [r for r in (args.master or []) if r != C.OUTPUT_FPS]
    expected = sum(s.seconds for _, s in clips) - (len(clips) - 1) * X
    print(f'{len(clips)} clips, {X}s dissolves -> {expected:.1f}s')

    for fps in rates:
        out = os.path.join(C.OUT, 'backing.mp4' if fps == C.OUTPUT_FPS
                           else f'backing-{fps}.mp4')
        subprocess.run(build(clips, out, fps), check=True)
        dur = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=nw=1:nk=1', out],
            capture_output=True, text=True).stdout.strip()
        print(f'  {out}  {float(dur):.2f}s @ {fps}fps  '
              f'{os.path.getsize(out)/1e6:.1f} MB')


if __name__ == '__main__':
    main()
