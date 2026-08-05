#!/bin/sh
# Builds meet-the-processor/assets/video/integer-execution.mp4.
#
# This file, not tools/cut-fillers.py, is what reproduces the clip that shipped.
# Same reasoning as tools/cut-ls-explainer.sh: the edit is hand-chosen, and a
# tool that re-derives it from a detector would not necessarily land on the same
# frames next time.
#
# Several things are happening at once, and they have to be one pass. The three
# takes are joined with a 0.5 s crossfade each, and inside take 1 there are two
# lifts, 0.86 s and 2.60 s. Everything is spliced BEFORE the tone-map so the
# expensive HLG chain runs once over the joined timeline rather than three
# times.
#
#
# THE SPLICES
#
# Take 1 ends mid-sentence on "and" and take 2 opens on "And", because take 2
# restarts the sentence take 1 ended on. The 0.5 s dissolve overlaps the two
# into one word. Take 2 -> take 3 is a clean continuation and takes the same
# 0.5 s for consistency.
#
#
# THE FIRST LIFT INSIDE TAKE 1
#
# At 47.7 s he says "generation" for the second time in one sentence, notices,
# and laughs. The giggle stays -- it is the good part. What went was the
# recovery after it:
#
#     50.60  chuckle ends
#     50.60 - 51.05   silence
#     51.06 - 51.47   "um"
#     51.48 - 51.83   silence
#     51.84  "AMD processors" resumes
#
# Cut 50.90 -> 51.60, which takes the "um" and most of the dead air either side
# and leaves a 0.37 s beat, so he lands the laugh and comes back rather than
# snapping straight to the next word.
#
# It is a DISSOLVE, not a hard cut, and that was measured rather than judged:
# tools/cut-fillers.py's own rule scores the frame either side of the splice at
# 6.66 mean absolute difference against a JUMP_OK of 4.0 -- his head is still
# moving from the laugh at the in-point and settled at the out-point, so a hard
# cut jolts. The 0.16 s dissolve eats its length out of the silence on both
# sides and there is 0.23 s of room, so a full one fits.
#
#
# THE SECOND LIFT INSIDE TAKE 1
#
# The sentence names the same fact twice: "... up from three address generation
# units in the previous generation of AMD processors, the Zen 4, which had three
# address generation units." The trailing clause goes, so it lands on "the Zen
# 4" and comes back on "And, you know, we kind of saw a similar change".
#
#     53.58  "four" is complete, "which" starts
#     53.58 - 55.93   "which had three address generation units"
#     55.94 - 56.43   silence
#     56.44  "And" resumes
#
# Cut 53.58 -> 56.10, which leaves 0.34 s of the room tone before "And", so the
# sentence ends and a new one starts rather than the two colliding.
#
# The in-point is the one place the splice can go. There is no silence between
# "four" and "which": the words run together, and the last thing before "which"
# is the decaying /r/ of "four" at 53.53 - 53.58. A hard cut there stops a
# voiced tail dead and clicks. The 0.08 s crossfade eats its length out of that
# tail, which is already falling, so the word reads as trailing off on its own.
#
# The dissolve is NOT hiding a jump here, unlike the first lift: the frame
# either side scores 1.94 mean absolute difference against cut-fillers.py's
# JUMP_OK of 4.0, so his pose is the same and a hard cut would have been
# invisible. The video is dissolved anyway and at exactly the audio's length,
# because acrossfade shortens the audio by d and the two streams have to stay
# the same length or everything downstream drifts out of sync.
#
#
# THE ARITHMETIC
#
# Every xfade offset is on the ACCUMULATED timeline, not on its new input.
#   take 1 after lift 1   : 50.90 + (53.58 - 51.60) - 0.16          = 52.72
#   L2  = 52.72 - 0.08  (the second lift's offset)                  = 52.64
#   take 1 after lift 2   : 52.72 + (114.465 - 56.10) - 0.08        = 111.005
#   O1  = 111.005 - 0.5                                             = 110.505
#   O2  = 111.005 + 15.256667 - 0.5 - 0.5                           = 125.261667
#   out = 111.005 + 15.256667 + 11.848333 - 0.5 - 0.5               = 137.110
#
# settb=1/30 after every fps AND after every xfade: the filter's output timebase
# is not guaranteed to be what the next stage wants. aformat on every audio
# branch or acrossfade dies with "Error reinitializing filters".
set -e
cd "$(dirname "$0")/.."

TM="zscale=w=1280:h=720:f=lanczos:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
AF="aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo"

ffmpeg -y -hide_banner \
  -i video-masters/ieu-explainer1.mov \
  -i video-masters/ieu-explainer2.mov \
  -i video-masters/ieu-explainer3.mov \
  -filter_complex "
    [0:v]split=3[s1][s2][s3];
    [s1]trim=start=0:end=50.90,setpts=PTS-STARTPTS,fps=30,settb=1/30[v0a];
    [s2]trim=start=51.60:end=53.58,setpts=PTS-STARTPTS,fps=30,settb=1/30[v0b];
    [s3]trim=start=56.10,setpts=PTS-STARTPTS,fps=30,settb=1/30[v0c];
    [v0a][v0b]xfade=transition=fade:duration=0.16:offset=50.74,settb=1/30[v0ab];
    [v0ab][v0c]xfade=transition=fade:duration=0.08:offset=52.64,settb=1/30[v0];
    [1:v]fps=30,settb=1/30[v1];
    [2:v]fps=30,settb=1/30[v2];
    [v0][v1]xfade=transition=fade:duration=0.5:offset=110.505,settb=1/30[vx];
    [vx][v2]xfade=transition=fade:duration=0.5:offset=125.261667[vj];
    [vj]$TM[vout];
    [0:a]asplit=3[t1][t2][t3];
    [t1]atrim=start=0:end=50.90,asetpts=PTS-STARTPTS,$AF[a0a];
    [t2]atrim=start=51.60:end=53.58,asetpts=PTS-STARTPTS,$AF[a0b];
    [t3]atrim=start=56.10,asetpts=PTS-STARTPTS,$AF[a0c];
    [a0a][a0b]acrossfade=d=0.16:c1=tri:c2=tri[a0ab];
    [a0ab][a0c]acrossfade=d=0.08:c1=tri:c2=tri[a0];
    [1:a]$AF[a1];
    [2:a]$AF[a2];
    [a0][a1]acrossfade=d=0.5:c1=tri:c2=tri[ax];
    [ax][a2]acrossfade=d=0.5:c1=tri:c2=tri[aout]
  " \
  -map "[vout]" -map "[aout]" -r 30 \
  -c:v libx264 -profile:v high -level 4.0 -crf 22 -preset medium \
  -c:a aac -b:a 128k -ac 2 \
  -movflags +faststart \
  meet-the-processor/assets/video/integer-execution.mp4
