"""Find the hesitations in a sheet-video master, cut half of them, re-encode.

  python tools/cut-fillers.py video-masters/core-explainer.mov zen5-core --plan
  python tools/cut-fillers.py video-masters/core-explainer.mov zen5-core

`--plan` stops after printing what it would remove, which is the only sane way to
review an edit before it is made. Without it the plan is applied and the web
encode is written to meet-the-processor/assets/video/<slug>.mp4.

Extra spans can be removed alongside the fillers with --also START,END (repeat
it); that is how the two "essentially"s came out of the load/store take.


WHY IT IS NOT JUST A TRANSCRIPT SEARCH
--------------------------------------
Whisper does not mistime "um" and "uh". It DELETES them: base.en found none of
the eight in the load/store take, and small.en with a deliberately disfluent
initial_prompt found one. The transcript is not a record of the fillers.

They are in the waveform though, so this works the other way round. Collapse the
audio into runs of speech and silence, then transcribe each run ON ITS OWN and
read the label back. Whisper's text is reliable at that scale even though its
word boundaries drift by up to half a second, which is the same reason the
boundaries here come from the RMS profile and never from the model.

An earlier version only transcribed runs that no word overlapped, on the theory
that a filler is what whisper heard and did not write down. That misses the ones
it merges into a neighbouring word's span -- two of eight, in the take it was
written against -- so every run above MIN_RUN is transcribed now.


WHICH HALF
----------
The longest half, and "long" is not a fixed threshold: the fillers are sorted and
the top half taken. On the load/store take that split 0.41-0.45s from
0.16-0.37s, which is audible against inaudible. Removing all of them reads as
over-edited.


HARD CUT OR DISSOLVE
--------------------
Measured, not judged. The frame that would play last before the cut against the
one that would play first after it, mean absolute difference over a greyscale
frame. Under JUMP_OK the pose has not moved and the cut is invisible; above it
the splice needs a dissolve to hide the jump.

A dissolve also has to FIT. It eats its own duration out of the silence on each
side, so a filler with less than FADE+0.04s of silence around it stays a hard cut
however badly it scores -- crossfading speech is worse than any jump.
"""
import argparse, json, os, subprocess, sys, tempfile, wave
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, 'meet-the-processor', 'assets', 'video')

MODEL = 'small.en'
SILENCE = 250        # RMS below this is silence, on 10 ms hops
BLIP = 0.05          # a "speech" run this short is a click, not a sound
MIN_RUN = 0.22       # runs shorter than this are consonants, not words
JUMP_OK = 4.0        # mean frame difference a hard cut can hide
FADE = 0.16          # dissolve length where the silence allows it
MIN_FADE = 0.07      # shorter than two frames at 30fps is not a dissolve
PAD = 0.10           # air taken either side of a cut word, gap permitting

FILLER = {'um', 'umm', 'uh', 'uhh', 'hmm', 'mm', 'er', 'erm', 'ah'}

# The site's encode, from meet-the-processor/README.md. The masters are HLG HDR
# in BT.2020 and go grey and desaturated without the tone-map chain.
TONEMAP = ('zscale=w=1280:h=720:f=lanczos:t=linear:npl=100,format=gbrpf32le,'
           'zscale=p=bt709,tonemap=hable:desat=0,'
           'zscale=t=bt709:m=bt709:r=tv,format=yuv420p')
AFMT = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo'


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def wav_of(src, tmp):
    p = os.path.join(tmp, 'a.wav')
    run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-vn', '-ac', '1',
         '-ar', '16000', p])
    return p


def speech_runs(wav):
    w = wave.open(wav)
    sr = w.getframerate()
    raw = np.frombuffer(w.readframes(w.getnframes()), np.int16)
    hop = int(0.010 * sr)
    n = len(raw) // hop
    a = raw.astype(np.float32)
    rms = np.array([np.sqrt((a[k*hop:(k+1)*hop] ** 2).mean()) for k in range(n)])
    voiced = rms > SILENCE
    runs, s = [], 0
    for k in range(1, n + 1):
        if k == n or voiced[k] != voiced[s]:
            runs.append([s * .01, k * .01, bool(voiced[s])])
            s = k

    # Drop the blips. A 10 ms spike over the threshold in the middle of a pause
    # is a mouth click or a chair creak, and leaving it in splits the silence in
    # two -- which is how a cut with 0.4s of room to breathe gets measured as
    # having 0.01s and refused a dissolve it should have had.
    merged = []
    for r in runs:
        if r[2] and r[1] - r[0] < BLIP:
            r[2] = False
        if merged and merged[-1][2] == r[2]:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return sr, raw, [tuple(r) for r in merged]


def name_runs(wav, sr, raw, runs):
    """Transcribe every speech run over MIN_RUN, one at a time."""
    from faster_whisper import WhisperModel
    m = WhisperModel(MODEL, device='cpu', compute_type='int8')
    pad = np.zeros(sr // 2, np.int16)      # whisper needs air around a fragment
    tmp = os.path.join(os.path.dirname(wav), '_run.wav')
    named = []
    todo = [r for r in runs if r[2] and r[1] - r[0] >= MIN_RUN]
    for i, (t0, t1, _) in enumerate(todo):
        seg = np.concatenate([pad, raw[int(t0*sr):int(t1*sr)], pad])
        o = wave.open(tmp, 'w')
        o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr)
        o.writeframes(seg.tobytes()); o.close()
        segs, _ = m.transcribe(tmp, beam_size=5)
        txt = ''.join(x.text for x in segs).strip()
        named.append((t0, t1, txt))
        if i % 20 == 0:
            print(f'  {i}/{len(todo)} runs named', flush=True)
    return named


def gaps_around(runs, t0, t1):
    """Silence between this run and the nearest real speech either side."""
    before = t0 - max([b for a, b, v in runs if v and b <= t0 + 0.001] or [0.0])
    nxt = [a for a, b, v in runs if v and a >= t1 - 0.001]
    after = (min(nxt) - t1) if nxt else 0.0
    return max(before, 0.0), max(after, 0.0)


def frame(src, t, tmp, tag):
    p = os.path.join(tmp, f'f_{tag}.png')
    run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{max(t, 0):.3f}', '-i', src,
         '-frames:v', '1', '-vf', 'scale=320:-1', p])
    return np.asarray(Image.open(p).convert('L'), dtype=np.float32)


def jump(src, a, b, tmp, tag):
    return float(np.abs(frame(src, a - 0.04, tmp, tag + 'a')
                        - frame(src, b + 0.04, tmp, tag + 'b')).mean())


def build_filter(src_dur, cuts):
    """One filter_complex for the whole edit: trim -> splice -> tone-map.

    Splices are hard by default; a cut carrying fade=d dissolves. Consecutive
    hard-joined segments are concatenated as a group and the groups are then
    xfaded together, so a dissolve never has to be simulated with concat.
    """
    segs, prev = [], 0.0
    for c in cuts:
        segs.append((prev, c['start']))
        prev = c['end']
    segs.append((prev, src_dur))

    # fade[i] is the join between segment i and i+1
    fades = [c.get('fade', 0.0) for c in cuts]

    v, a = [], []
    for i, (s, e) in enumerate(segs):
        end = '' if e >= src_dur else f':{e:.3f}'
        v.append(f'[0:v]trim={s:.3f}{end},setpts=PTS-STARTPTS,fps=30,settb=1/30[v{i}];')
        a.append(f'[0:a]atrim={s:.3f}{end},asetpts=PTS-STARTPTS,{AFMT}[a{i}];')

    # group runs of hard joins
    groups, cur = [], [0]
    for i, f in enumerate(fades):
        if f:
            groups.append(cur); cur = [i + 1]
        else:
            cur.append(i + 1)
    groups.append(cur)

    lines = v + a
    gv, ga, gd = [], [], []
    for gi, g in enumerate(groups):
        dur = sum(segs[i][1] - segs[i][0] for i in g)
        if len(g) == 1:
            gv.append(f'v{g[0]}'); ga.append(f'a{g[0]}')
        else:
            iv = ''.join(f'[v{i}]' for i in g)
            ia = ''.join(f'[a{i}]' for i in g)
            lines.append(f'{iv}concat=n={len(g)}:v=1:a=0,settb=1/30[gv{gi}];')
            lines.append(f'{ia}concat=n={len(g)}:v=0:a=1,{AFMT}[ga{gi}];')
            gv.append(f'gv{gi}'); ga.append(f'ga{gi}')
        gd.append(dur)

    # dissolve the groups together, left to right
    curv, cura, curd = gv[0], ga[0], gd[0]
    joins = [f for f in fades if f]
    for k in range(1, len(groups)):
        d = joins[k - 1]
        off = curd - d
        lines.append(f'[{curv}][{gv[k]}]xfade=transition=fade:'
                     f'duration={d}:offset={off:.3f},settb=1/30[xv{k}];')
        lines.append(f'[{cura}][{ga[k]}]acrossfade=d={d}:c1=tri:c2=tri,{AFMT}[xa{k}];')
        curv, cura = f'xv{k}', f'xa{k}'
        curd = curd + gd[k] - d
    lines.append(f'[{curv}]{TONEMAP}[vout];')
    lines.append(f'[{cura}]anull[aout]')
    return '\n'.join(lines), curd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('master')
    ap.add_argument('slug')
    ap.add_argument('--plan', action='store_true')
    ap.add_argument('--also', action='append', default=[],
                    help='extra span to cut, START,END in master seconds')
    ap.add_argument('--fraction', type=float, default=0.5)
    args = ap.parse_args()

    src = args.master if os.path.isabs(args.master) else os.path.join(ROOT, args.master)
    dur = float(subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.strip())

    tmp = tempfile.mkdtemp(prefix='cutfill-')
    print(f'{os.path.basename(src)}  {dur:.2f}s  ->  {tmp}', flush=True)

    wav = wav_of(src, tmp)
    sr, raw, runs = speech_runs(wav)
    print(f'{sum(1 for r in runs if r[2])} speech runs; naming the long ones',
          flush=True)
    named = name_runs(wav, sr, raw, runs)
    json.dump(named, open(os.path.join(tmp, 'runs.json'), 'w'), indent=1)

    fillers = [(t0, t1, txt) for t0, t1, txt in named
               if txt.strip().strip('.,!?').lower() in FILLER]
    fillers.sort(key=lambda r: r[1] - r[0], reverse=True)
    keep_n = len(fillers) - int(round(len(fillers) * args.fraction))
    take = sorted(fillers[:len(fillers) - keep_n], key=lambda r: r[0])

    print(f'\n{len(fillers)} hesitations found:')
    for t0, t1, txt in sorted(fillers, key=lambda r: r[0]):
        mark = 'CUT ' if (t0, t1, txt) in take else '    '
        print(f'  {mark}{t0:8.3f} -> {t1:8.3f}  {t1-t0:5.2f}s  {txt!r}')

    cuts = []
    for t0, t1, _ in take:
        before, after = gaps_around(runs, t0, t1)
        cuts.append({'start': round(t0 - min(PAD, before * 0.5), 3),
                     'end': round(t1 + min(PAD, after * 0.5), 3),
                     'why': 'filler', 'before': before, 'after': after})
    for s in args.also:
        a, b = (float(x) for x in s.split(','))
        before, after = gaps_around(runs, a, b)
        cuts.append({'start': a, 'end': b, 'why': 'manual',
                     'before': before, 'after': after})
    cuts.sort(key=lambda c: c['start'])

    print('\nsplices:')
    for i, c in enumerate(cuts):
        c['jump'] = jump(src, c['start'], c['end'], tmp, str(i))
        # The dissolve eats its own length out of the silence on BOTH sides, so
        # the room is whichever side has less. Where a full one will not fit,
        # take the longest that will rather than falling back to a hard cut: two
        # frames of blend still reads better than a jolt of 9, and the only hard
        # floor is that a dissolve shorter than a couple of frames is a flicker.
        room = min(c['before'], c['after'])
        if c['jump'] > JUMP_OK:
            fade = round(min(FADE, max(0.0, room - 0.02)), 2)
            if fade >= MIN_FADE:
                c['fade'] = fade
        note = f"dissolve {c['fade']}s" if c.get('fade') else 'hard'
        why = '' if c['jump'] <= JUMP_OK else (
            f"  (short: only {room:.2f}s of silence)" if c.get('fade') and c['fade'] < FADE
            else '' if c.get('fade') else
            f'  (wanted a dissolve, only {room:.2f}s of silence)')
        print(f"  {i+1}  {c['start']:8.3f} -> {c['end']:8.3f}  "
              f"jump {c['jump']:5.2f}  {note}{why}")

    removed = sum(c['end'] - c['start'] for c in cuts) + sum(c.get('fade', 0) for c in cuts)
    print(f'\n{len(cuts)} cuts, {removed:.2f}s out of {dur:.2f}s')
    if args.plan:
        print('--plan: stopping before the encode')
        return

    fc, out_dur = build_filter(dur, cuts)
    dst = os.path.join(OUTDIR, args.slug + '.mp4')
    run(['ffmpeg', '-y', '-v', 'error', '-stats', '-i', src,
         '-filter_complex', fc, '-map', '[vout]', '-map', '[aout]',
         '-r', '30', '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0',
         '-crf', '22', '-preset', 'medium', '-c:a', 'aac', '-b:a', '128k',
         '-ac', '2', '-movflags', '+faststart', dst])
    got = float(subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'csv=p=0', dst], capture_output=True, text=True).stdout.strip())
    print(f'\n{dst}\n  {got:.2f}s (predicted {out_dur:.2f}), '
          f'{os.path.getsize(dst)/1048576:.1f} MiB')


if __name__ == '__main__':
    main()
