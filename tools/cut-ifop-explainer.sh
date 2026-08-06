#!/bin/sh
# Builds meet-the-processor/assets/video/ifop-phy.mp4.
#
# This file, not tools/cut-fillers.py, is what reproduces the clip that shipped.
# Same reasoning as tools/cut-ieu-explainer.sh and tools/cut-ls-explainer.sh: the
# edit is hand-chosen, and a tool that re-derives it from a detector would not
# necessarily land on the same frames next time.
#
# Five takes, joined in order, and they really are one script rather than five
# angles on the same one:
#
#   1  what the IFOP PHY is, ending "But when would we need to use this
#      piece of hardware?"
#   2  the example that answers it, a core missing data in its caches
#   3  "And to do this, the IFOP PHY takes the slow moving wide buses..."
#   4  why it has to, the substrate, the solder balls, the serialising
#   5  the closing line
#
# Take 1 was re-shot on 2026-08-05. The take it replaced ran 1:50 and contained
# the whole explanation, which takes 3 and 4 then re-did word for word — joining
# THAT version to these would have played the piece twice. If a take turns up
# that duplicates another, this is the check to run before splicing: transcribe
# them all and read them side by side.
#
# Everything is spliced BEFORE the tone-map so the expensive HLG chain runs once
# over the joined timeline rather than five times.
#
#
# THE JOINS, one at a time
#
# Each is measured the way cut-fillers.py measures a splice: mean absolute
# greyscale difference between the frame that plays last and the frame that
# plays first, against its JUMP_OK of 4.0, and the silence either side, which is
# the room a dissolve has to fit into.
#
#   join   jump   tail    head   what it gets
#   1 -> 2  4.54  0.08s   0.24s  dissolve 0.20s
#   2 -> 3  8.00  0.37s   0.04s  dissolve 0.16s   (see below)
#   3 -> 4  3.01  0.11s   0.15s  dissolve 0.15s
#   4 -> 5  8.10  0.47s   0.45s  dissolve 0.40s
#
# EVERY JOIN DISSOLVES, and the lengths are uneven because the takes are.
#
# The binding constraint is not the jump, it is AIR. These five were shot tight:
# take 1 stops 0.08s after the last word, take 3 starts speaking 0.04s in. A
# dissolve eats its own length out of both sides, so the silence-only budget at
# three of the four joins is two to five frames — nothing that reads as a
# dissolve at all.
#
# What buys the rest is that at every one of these joins, ONE SIDE IS DEAD AIR.
# A crossfade against silence is not two voices smeared together: it is a
# trail-off on the outgoing word or a soft attack on the incoming one, and both
# are ordinary. So each join takes the longest fade the SILENT side can carry
# and spends the difference on the other side's decaying tail or onset:
#
#   1 -> 2   0.20s   take 2's head is 0.24s of silence. Costs a 0.12s fade on
#            the tail of "hardware?", which is a vowel already decaying into a
#            question mark, so the word reads as trailing off.
#   3 -> 4   0.15s   take 4's head is 0.15s of silence and take 3's tail is
#            0.11s, so this one costs 0.04s of a decaying "together" — free.
#   4 -> 5   0.40s   the only join with real air on BOTH sides, so the only one
#            that gets a proper half-second-ish dissolve. Take 5's in-point is
#            pulled back to 0.55 to open the room up rather than sitting at 0.90.
#
# If longer dissolves are ever wanted throughout, they have to be bought in the
# SHOOTING: a beat of silence held at the top and tail of each take is what a
# 0.5s crossfade needs, and no edit can manufacture it afterwards.
#
# 3 -> 4 scores 3.01, so a hard cut there would have been invisible and it was
# one until it was asked to dissolve. It costs nothing to give it one.
#
#
# 2 -> 3, AND WHY IT DISSOLVES ANYWAY
#
# This one breaks cut-fillers.py's rule, deliberately, and the reason is worth
# writing down.
#
# The jump is 8.00 and take 3 starts speaking 0.04s in, so by that rule — a
# splice with less than FADE+0.04s of silence around it stays a hard cut however
# badly it scores — this is a hard cut. It was worth checking whether the cut
# could simply be moved instead: take 2 has 0.93s of tail silence, which is 55
# frames of out-point to choose from. Scanning all of them, the jump runs
# 8.00-8.23 the whole way. He MOVED between the two takes, so the difference is
# constant and no out-point hides it. 31.72 is the best of them and is used
# below, but it only buys 0.23.
#
# So the rule's premise does not hold here. It says crossfading speech is worse
# than any jump, and it is right — but it is written for a cut INSIDE one take,
# where both sides of the splice are mid-sentence. Here one side is 0.93s of
# dead air. A 0.16s crossfade against dead air is not two voices smeared
# together; it is a 0.12s fade-in on the first word, "And", which reads as a
# soft attack and nothing worse. Against a doubled jump that is the better
# trade, so this one dissolves.
#
#
# 4 -> 5, AND WHY IT IS NOT THE IEU'S "and"
#
# Take 4 ends "...works together and" and take 5 opens "and our whole processor
# would not be able to work without it" — the same restarted-conjunction shape
# as the integer-execution splice, where a 0.5s dissolve overlapped the two
# "and"s into one word.
#
# It does not need that trick, because this time there is silence to work with.
# Take 4's trailing "and" is a separate 0.39s run with 0.68s of room in front of
# it:
#
#     65.48  "...works together" ends
#     65.48 - 66.16   silence
#     66.16 - 66.55   "and"          <- orphan, dropped
#     66.55 - 66.84   silence
#
# Cutting at 65.95 lands in that silence and takes the orphan with it, so take
# 5 supplies the only "and" in the sentence and there is nothing to overlap.
# Take 5 comes in at 0.55 for the same reason from the other side, which leaves
# 0.45s of head silence for the dissolve to sit in and about half a second of
# beat between "together" and "and" — a comma, which is what the sentence wants.
#
#
# THE ARITHMETIC
#
# Every xfade offset is on the ACCUMULATED timeline, not on its new input.
# Segments, after trimming:
#
#   G1  take 1, whole                                            53.190000
#   G2  take 2, to 31.72                                         31.720000
#   G3  take 3 whole + take 4 to 65.95, dissolved 0.15           82.208333
#   G4  take 5, from 0.55                                         4.443333
#
#   G3 inner offset = 16.408333 - 0.15                         =  16.258333
#   O1  = 53.190000 - 0.20                                     =  52.990000
#   after G1+G2 : 53.190000 + 31.720000 - 0.20                 =  84.710000
#   O2  = 84.710000 - 0.16                                     =  84.550000
#   after +G3   : 84.710000 + 82.208333 - 0.16                 = 166.758333
#   O3  = 166.758333 - 0.40                                    = 166.358333
#   out = 166.758333 + 4.443333 - 0.40                         = 170.801666
#
# settb=1/30 after every fps AND after every xfade and concat: the filter's
# output timebase is not guaranteed to be what the next stage wants. aformat on
# every audio branch or acrossfade dies with "Error reinitializing filters".
set -e
cd "$(dirname "$0")/.."

TM="zscale=w=1280:h=720:f=lanczos:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
AF="aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo"

ffmpeg -y -hide_banner \
  -i video-masters/ifop-explainer1.mov \
  -i video-masters/ifop-explainer2.mov \
  -i video-masters/ifop-explainer3.mov \
  -i video-masters/ifop-explainer4.mov \
  -i video-masters/ifop-explainer5.mov \
  -filter_complex "
    [0:v]fps=30,settb=1/30[v1];
    [1:v]trim=start=0:end=31.72,setpts=PTS-STARTPTS,fps=30,settb=1/30[v2];
    [2:v]fps=30,settb=1/30[v3];
    [3:v]trim=start=0:end=65.95,setpts=PTS-STARTPTS,fps=30,settb=1/30[v4];
    [4:v]trim=start=0.55,setpts=PTS-STARTPTS,fps=30,settb=1/30[v5];
    [v3][v4]xfade=transition=fade:duration=0.15:offset=16.258333,settb=1/30[v34];
    [v1][v2]xfade=transition=fade:duration=0.20:offset=52.990000,settb=1/30[vA];
    [vA][v34]xfade=transition=fade:duration=0.16:offset=84.550000,settb=1/30[vB];
    [vB][v5]xfade=transition=fade:duration=0.40:offset=166.358333[vj];
    [vj]$TM[vout];
    [0:a]$AF[a1];
    [1:a]atrim=start=0:end=31.72,asetpts=PTS-STARTPTS,$AF[a2];
    [2:a]$AF[a3];
    [3:a]atrim=start=0:end=65.95,asetpts=PTS-STARTPTS,$AF[a4];
    [4:a]atrim=start=0.55,asetpts=PTS-STARTPTS,$AF[a5];
    [a3][a4]acrossfade=d=0.15:c1=tri:c2=tri[a34];
    [a1][a2]acrossfade=d=0.20:c1=tri:c2=tri[aA];
    [aA][a34]acrossfade=d=0.16:c1=tri:c2=tri[aB];
    [aB][a5]acrossfade=d=0.40:c1=tri:c2=tri[aout]
  " \
  -map "[vout]" -map "[aout]" -r 30 \
  -c:v libx264 -profile:v high -level 4.0 -crf 22 -preset medium \
  -c:a aac -b:a 128k -ac 2 \
  -movflags +faststart \
  meet-the-processor/assets/video/ifop-phy.mp4
