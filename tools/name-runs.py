"""Name every run of sound in a span of a video, one run at a time.

  python tools/name-runs.py meet-the-processor/assets/video/l2-cache.mp4 21 27
  python tools/name-runs.py video-masters/l2-explainer1.mov 19 36

THIS IS HOW A FILLER CUT IS VERIFIED, and it exists because the obvious check is
worthless. Whisper DELETES "um" and "uh" from its output, so a plain transcript
of a finished encode reads "requests information from the cache" whether the
filler was removed or is still sitting there. That output is not evidence. The
mirror error is no better: transcribe with a disfluent `initial_prompt` and the
model writes an "um" back in at any pause, cut or not.

The l2-cache clip shipped with the filler still in it on exactly this mistake —
a plain transcript was read as proof. See the "TAKE 1" section of
tools/cut-l2-explainer.sh for the whole account.

WHAT WORKS is what cut-fillers.py's docstring already says: collapse the audio
into runs of speech and silence from the RMS profile, then transcribe each run
ON ITS OWN and read the label back. A 0.33s "um" transcribed alone comes back as
"um" in as many words. Two columns are printed per run because neither is
sufficient alone:

  in isolation      names the sound, but a very short run has too little for the
                    model and comes back as a random word
  with 1.2s run-up  places it in the sentence, which is what tells a filler from
                    the tail of the word in front of it

Run it on the OUTPUT as well as on the master. The master tells you where the
filler is; only the output tells you whether it left.

Boundaries come from the waveform and never from the model, whose word
timestamps drift by up to half a second — enough to swap a filler with its
neighbor, which is the error this file was written after.
"""
import subprocess, sys, os, wave
import numpy as np
from faster_whisper import WhisperModel

SIL = 250            # RMS below this is silence, on 10 ms hops, as cut-fillers.py
HOP = 0.01
RUN_UP = 1.2         # context carried into the second transcription
MODEL = 'small.en'

src = sys.argv[1]
lo = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
hi = float(sys.argv[3]) if len(sys.argv) > 3 else 1e9

tmp = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.name-runs')
os.makedirs(tmp, exist_ok=True)
whole = os.path.join(tmp, 'whole.wav')
piece = os.path.join(tmp, 'piece.wav')

subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src,
                '-ac', '1', '-ar', '48000', whole], check=True)
w = wave.open(whole)
sr = w.getframerate()
a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32)
h = int(sr * HOP)
m = len(a) // h
rms = np.sqrt((a[:m*h].reshape(m, h) ** 2).mean(1))

speaking = rms >= SIL
runs, cur, start = [], speaking[0], 0
for k in range(1, len(speaking)):
    if speaking[k] != cur:
        runs.append((cur, start * HOP, k * HOP))
        cur, start = speaking[k], k
runs.append((cur, start * HOP, len(speaking) * HOP))

model = WhisperModel(MODEL, device='cpu', compute_type='int8')

def say(a0, b0):
    """Whisper needs air around a fragment, so pad both ends."""
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(max(0, a0)), '-to', str(b0),
                    '-i', src, '-ac', '1', '-ar', '16000',
                    '-af', 'adelay=400|400,apad=pad_dur=0.4', piece], check=True)
    segs, _ = model.transcribe(piece)
    return ' '.join(s.text.strip() for s in segs)

print(f"{'run':>16}  {'len':>5}  in isolation | with {RUN_UP}s of run-up")
for kind, s, e in runs:
    if not kind or not (lo <= s <= hi):
        continue
    print(f"{s:7.2f}-{e:6.2f}  {e-s:5.2f}  "
          f"{say(s - 0.02, e + 0.02)!r:34s} | {say(s - RUN_UP, e + 0.05)!r}")
