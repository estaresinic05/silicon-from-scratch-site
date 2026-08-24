"""Numbers shared by capture and assembly. Change the cut here, not in two files."""
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                    '..', '..'))

# OUTPUT LIVES OUTSIDE THE REPO, AND THAT IS NOT TIDINESS -- IT IS THE FIX FOR
# A REAL DEFECT.
#
# The repo sits under OneDrive. Writing half a gigabyte of clips into it makes
# OneDrive start uploading them WHILE THE NEXT SHOT IS BEING FILMED, and that
# disk and CPU contention lands in the footage as hitches and outright freezes.
# A .gitignore entry does nothing about this; OneDrive does not read it.
#
# Hundreds of megabytes of screen capture also have no business in a git
# working tree in the first place.
OUT = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')),
                   'SiliconBackingVideo')
CLIPS = os.path.join(OUT, 'clips')

BASE = 'http://127.0.0.1:8777'
PORT = 8777
CDP_PORT = 9222

# The cut. SHOT_SECONDS is the DEFAULT clip length; a shot may override it via
# `seconds` when its beat genuinely does not fit (the Project Directory walk
# runs 12s). Currently 18 shots -> 97.0s.
#
# Every dissolve is XFADE, with no exceptions -- that evenness is the
# requirement. Equal clip LENGTHS never were, and conflating the two costs you
# any shot that needs room to breathe.
SHOT_SECONDS = 5.6
XFADE = 0.6

# 60 in, 60 out, 1:1.
#
# This started as a 240fps capture cropped and downscaled from the full
# 2560x1600 desktop, and it had to change: ddagrab -- the GPU capture path, and
# the only one fast enough for 240 -- cannot duplicate this desktop at all, and
# NVENC is unavailable because the installed driver predates the nvenc API this
# ffmpeg build requires. That leaves gdigrab, which is a CPU blit and measures
# ~52 fps grabbing 1920x1080 and ~34 fps grabbing 2560x1600. See README.
#
# So the browser renders into a window whose CONTENT AREA is exactly the
# delivered frame, and that region is what gets grabbed. Nothing is cropped,
# scaled or resampled anywhere in the pipeline, which buys back most of the
# sharpness the downscale was there to provide in the first place.
#
# The honest caveat: the grabber reaches ~52-58 fps, so a small fraction of the
# frames in a 60fps master are duplicates. Behind a talking head this is not
# visible. capture.py reports the real per-clip rate either way.
# Measured, in this order, so nobody repeats the experiments:
#   * writing clips into the OneDrive-backed repo caused the worst artifact by
#     far -- sync uploads during the next take, landing as freezes. Moving OUT
#     (see above) took the heavy WebGL shots from 41 to 47 fps and removed them.
#   * dropping the panel to 60Hz to match: WORSE, 41 -> 31. A grab that misses
#     one 16.7ms frame waits for the next; at 240Hz it is not quantized as hard.
#   * shrinking the captured area: no help. 1280x720 measured SLOWER than
#     1920x1080 on an idle desktop, so gdigrab's cost here is per-frame
#     overhead and contention, not pixels.
#   * asking for 30 instead of 60: still not even (27-28 of 30). The scene
#     itself stalls composition, so no target rate is perfectly filled.
# 60 it is: ~46-54 achieved, which is more fluid than a solid 30 would be.
CAPTURE_FPS = 60
OUTPUT_FPS = 60

FINAL_W, FINAL_H = 1920, 1080
