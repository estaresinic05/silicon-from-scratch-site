#!/bin/sh
# Builds meet-the-processor/assets/video/branch-predictor.mp4.
#
# This file, not tools/cut-fillers.py, is what reproduces the clip that shipped.
# Same reasoning as tools/cut-ieu-explainer.sh, tools/cut-ls-explainer.sh and
# tools/cut-ifop-explainer.sh: the edit is hand-chosen, and a tool that
# re-derives it from a detector would not necessarily land on the same frames
# next time.
#
# Nine takes were shot. EIGHT SHIP — take 6 is cut, and it is cut for what it
# says rather than for anything about the edit. See the next section.
#
# The numbering IS the edit order, which is the first time in three shoots, so it
# was checked rather than assumed: all nine were transcribed and read side by
# side, and every take opens by referring to the one numbered before it.
#
#   1  why a pipeline wants sequential flow, PC+4, and branches breaking it
#   2  the problem stated, stalling rejected, "guess one way or the other"
#   3  "And in the latter..."      <- the always-not-taken arm 2 ends on
#   4  "So, this is another way..." <- history lookup, better than either
#   5  "This way of going about it is called dynamic branch prediction"
#   6  correlating predictors                                        <- CUT
#   7  "But another way..."        <- tournament predictors
#   8  speculation as the larger idea, and the accuracy payoff
#   9  the closing line
#
# No take duplicates another, which was the IFOP trap, and no take is stranded
# out of sequence, which was the test/debug trap.
#
# Everything is spliced BEFORE the tone-map so the expensive HLG chain runs once
# over the joined timeline rather than eight times.
#
#
# WHY TAKE 6 IS CUT
#
# It defines the wrong thing. Take 6 is "There are other ways that we can make
# this prediction even better. One of them is called correlating predictors,
# where we look at the local history of that branch, as well as global history of
# that branch, and together use them to predict what we should do next."
#
# A correlating, or two-level, predictor is defined by using the behaviour of
# OTHER branches — global information, and the literature contrasts it against
# local behaviour rather than combining the two. Combining a local predictor with
# a global one under a selector is the TOURNAMENT predictor, which is exactly
# what take 7 goes on to describe. The mechanism is real and correctly explained;
# it is attributed one predictor too early.
#
# THE COST OF CUTTING IT IS THAT CORRELATING PREDICTORS LEAVE THE VIDEO
# ENTIRELY. The piece now goes from the branch prediction buffer in take 5
# straight to tournament predictors in take 7. If that topic is wanted back, it
# needs a re-shot take 6 and this script grows an input again.
#
# The discourse still closes, which was the thing to check before cutting: take 7
# opens "But another way that we could do this is called a tournament branch
# predictor", and take 5 has just finished describing one way of doing it, so
# "another way" still refers to something. That is not luck — it is the same test
# the test/debug splice failed on take 8's "That way", and it was run here before
# the take came out. "But another way" is a single unbroken 0.92s run from 0.10
# to 1.02, so the word could not have been trimmed off take 7 had it dangled.
#
#
# THE JOINS
#
# Measured the way cut-fillers.py measures a splice: mean absolute greyscale
# difference between the frame that plays last and the frame that plays first,
# against its JUMP_OK of 4.0, and the silence either side, which is the room a
# dissolve has to fit into.
#
#   join   jump   tail   head   fade
#   1 -> 2  9.88  0.44   0.30   0.30
#   2 -> 3  8.75  0.71   0.24   0.24
#   3 -> 4  5.73  0.70   1.18   0.40   capped
#   4 -> 5 13.85  0.24   0.01   0.12   see below
#   5 -> 7 10.38  0.11   0.10   0.10   the join take 6 leaving created
#   7 -> 8 12.47  1.21   0.40   0.40   capped, take 8 trimmed
#   8 -> 9  8.86  0.54   0.46   0.40   capped
#
# EVERY JOIN DISSOLVES: all seven score well above 4.0, so there is no hard cut
# anywhere in the piece. The fade is min(tail, head) capped at 0.40, which is the
# longest the rest of the series uses, and the two departures are argued below.
#
# 5 -> 7 is short but it is honest: take 5 has 0.11s of tail and take 7 has 0.10s
# of head, so at 0.10 BOTH SIDES ARE SILENT for the whole dissolve and nothing is
# borrowed from either. It is three frames, against a MIN_FADE of 0.07. Scanning
# take 5's tail and take 7's head the jump only ever runs 10.38 to 10.99, so
# there is no better frame to sit on and no reason to spend more.
#
# MEASURE THE AIR WITHOUT cut-fillers.py's MIN_RUN. That constant is 0.22s and it
# exists to stop consonants being mistaken for fillers; used on a seam it throws
# away any last word shorter than itself. It reported take 4 as having 0.92s of
# tail, when take 4 ends on "cache" at 40.03-40.23 and has 0.24s. Every number in
# the table above is the edge of the last run over BLIP, so it is where sound
# actually stops, and only a sub-0.05s mouth click is discarded.
#
# THESE TAKES WERE SHOT TIGHT — tighter than the IFOP set and much tighter than
# test/debug, where three joins reached the 0.40 cap on air alone. Here three
# reach it, but one of the three only because a take was trimmed to open the room
# up. The shooting note from the IFOP splice still stands and is still the only
# thing that would buy longer dissolves throughout: hold a beat of silence at the
# top and tail of every take. No edit can manufacture it afterwards.
#
#
# TAKE 8'S ORPHANED PARTICLE
#
# Take 8 opens on a discourse particle followed by a long pause, which is the one
# shape that lets an in-point move without touching the sentence:
#
#   take 8   0.05-0.23  "So"    then 0.75s of silence, content from 0.98
#
# The particle is dropped and the in-point lands inside the gap behind it. This
# is the IFOP splice's orphaned "and" arrived at from the other side: there the
# trailing particle was cut off the outgoing take, here the leading one comes off
# the incoming take. Take 7 ends on a full stop, so take 8 becomes "Branch
# prediction is a part of this larger theme of ideas called speculation."
#
# The gain is the whole reason to do it: take 8's head goes from 0.05s, which is
# no dissolve at all, to 0.40s, which is the cap — 7 -> 8 is the best-fitting
# join in the piece and would have been the worst.
#
# Take 6 opened the same way, on an "And" with 0.83s behind it, and was trimmed
# to 0.93 for the same reason while it was still in the edit.
#
#
# 4 -> 5, THE ONE JOIN WITH NO AIR ON EITHER SIDE
#
# Take 4 stops 0.24s before it ends and take 5 starts speaking at 0.01s. There is
# nothing to trim into on either side: take 5's first gap over 0.05s is the 0.20s
# between "dynamic" and "branch", which is mid-phrase, and take 4's tail is the
# 0.24s already counted.
#
# So the cut was checked for somewhere better to sit before a dissolve was spent
# on it, which is the IFOP procedure. Take 4's tail is 7 frames of out-point;
# scanning all of them the jump runs 13.85 down to 13.69. He MOVED between the
# two takes, so the difference is constant and no out-point hides it. Same result
# on every other scan run here: 5 -> 7 stays 10.4-11.0 across both sides of the
# seam, and 7 -> 8 stays 11.5-12.5 across take 8's gap and 12.2-13.1 across take
# 7's 36 frames of tail. Not one join in this shoot can be moved into a better
# frame, so all seven are decided on air alone.
#
# The fade is 0.12. All of it sits inside take 4's silence, so the outgoing side
# is dead air throughout and the join is a soft attack on the incoming word
# rather than two voices at once. Take 5 pays 0.11s of that attack on "This",
# whose /th/ is the cheapest syllable there is to soften — the same trade the
# test/debug splice made at 5 -> 8, where 0.10s was borrowed from "That", and the
# same size of borrow. 0.12 rather than the 0.16 default because the principle
# cut-fillers.py is written around is that crossfading speech is worse than any
# jump, and past about 0.12 the fade stops being an attack on "This" and starts
# swallowing the word.
#
#
# THE ARITHMETIC
#
# Every xfade offset is on the ACCUMULATED timeline, not on its new input.
# Segments, after trimming:
#
#   G1  take 1, whole                                            44.011667
#   G2  take 2, whole                                            44.800000
#   G3  take 3, whole                                            35.841700
#   G4  take 4, whole                                            40.451700
#   G5  take 5, whole                                            28.898333
#   G6  take 7, whole                                            14.273333
#   G7  take 8, from 0.58                                        30.373333
#   G8  take 9, whole                                            11.355000
#
#   O1  = 44.011667 - 0.30                                     =  43.711667
#   after G1+G2 : 44.011667 + 44.800000 - 0.30                 =  88.511667
#   O2  = 88.511667 - 0.24                                     =  88.271667
#   after +G3   : 88.511667 + 35.841700 - 0.24                 = 124.113367
#   O3  = 124.113367 - 0.40                                    = 123.713367
#   after +G4   : 124.113367 + 40.451700 - 0.40                = 164.165067
#   O4  = 164.165067 - 0.12                                    = 164.045067
#   after +G5   : 164.165067 + 28.898333 - 0.12                = 192.943400
#   O5  = 192.943400 - 0.10                                    = 192.843400
#   after +G6   : 192.943400 + 14.273333 - 0.10                = 207.116733
#   O6  = 207.116733 - 0.40                                    = 206.716733
#   after +G7   : 207.116733 + 30.373333 - 0.40                = 237.090066
#   O7  = 237.090066 - 0.40                                    = 236.690066
#   out = 237.090066 + 11.355000 - 0.40                        = 248.045066
#
# settb=1/30 after every fps AND after every xfade: the filter's output timebase
# is not guaranteed to be what the next stage wants. aformat on every audio
# branch or acrossfade dies with "Error reinitializing filters".
#
#
# EVERY AUDIO BRANCH IS atrim'd TO ITS VIDEO LENGTH, AND THAT IS NOT COSMETIC
#
# The masters carry AAC, and AAC is encoded in 1024-sample frames, so the last
# frame of each take is padded out past where the container says the take ends.
# Decoded, all of them run long:
#
#   take   1      2      3      4      5      7      8      9
#   over  .0103  .0100  .0127  .0197  .0057  .0083  .0063  .0020
#
# acrossfade concatenates what it is given, so without the trims each segment
# hands the next one a few extra milliseconds and the audio walks progressively
# LATE against the video: on the nine-take cut this reached 0.078s by the closing
# line, which is over two frames of lip sync, and that cut shipped 268.625s of
# audio against 268.533s of video for exactly this reason.
#
# It does not show up as a seam in the wrong place — the joins all still land in
# silence — so it is only visible by adding the column up or by measuring the
# last word against the plan. The fix is to cut each branch at the container
# duration, which is the frame the video segment ends on. Nothing is lost: what
# comes off is encoder padding past the end of the take, and the nearest real
# speech to any of it is take 4's last word, which stops 0.22s earlier.
set -e
cd "$(dirname "$0")/.."

TM="zscale=w=1280:h=720:f=lanczos:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
AF="aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo"

ffmpeg -y -hide_banner \
  -i video-masters/bp-explainer1.mov \
  -i video-masters/bp-explainer2.mov \
  -i video-masters/bp-explainer3.mov \
  -i video-masters/bp-explainer4.mov \
  -i video-masters/bp-explainer5.mov \
  -i video-masters/bp-explainer7.mov \
  -i video-masters/bp-explainer8.mov \
  -i video-masters/bp-explainer9.mov \
  -filter_complex "
    [0:v]fps=30,settb=1/30[v1];
    [1:v]fps=30,settb=1/30[v2];
    [2:v]fps=30,settb=1/30[v3];
    [3:v]fps=30,settb=1/30[v4];
    [4:v]fps=30,settb=1/30[v5];
    [5:v]fps=30,settb=1/30[v7];
    [6:v]trim=start=0.58,setpts=PTS-STARTPTS,fps=30,settb=1/30[v8];
    [7:v]fps=30,settb=1/30[v9];
    [v1][v2]xfade=transition=fade:duration=0.30:offset=43.711667,settb=1/30[vA];
    [vA][v3]xfade=transition=fade:duration=0.24:offset=88.271667,settb=1/30[vB];
    [vB][v4]xfade=transition=fade:duration=0.40:offset=123.713367,settb=1/30[vC];
    [vC][v5]xfade=transition=fade:duration=0.12:offset=164.045067,settb=1/30[vD];
    [vD][v7]xfade=transition=fade:duration=0.10:offset=192.843400,settb=1/30[vE];
    [vE][v8]xfade=transition=fade:duration=0.40:offset=206.716733,settb=1/30[vF];
    [vF][v9]xfade=transition=fade:duration=0.40:offset=236.690066[vj];
    [vj]$TM[vout];
    [0:a]atrim=end=44.011667,asetpts=PTS-STARTPTS,$AF[a1];
    [1:a]atrim=end=44.800000,asetpts=PTS-STARTPTS,$AF[a2];
    [2:a]atrim=end=35.841700,asetpts=PTS-STARTPTS,$AF[a3];
    [3:a]atrim=end=40.451700,asetpts=PTS-STARTPTS,$AF[a4];
    [4:a]atrim=end=28.898333,asetpts=PTS-STARTPTS,$AF[a5];
    [5:a]atrim=end=14.273333,asetpts=PTS-STARTPTS,$AF[a7];
    [6:a]atrim=start=0.58:end=30.953333,asetpts=PTS-STARTPTS,$AF[a8];
    [7:a]atrim=end=11.355000,asetpts=PTS-STARTPTS,$AF[a9];
    [a1][a2]acrossfade=d=0.30:c1=tri:c2=tri[aA];
    [aA][a3]acrossfade=d=0.24:c1=tri:c2=tri[aB];
    [aB][a4]acrossfade=d=0.40:c1=tri:c2=tri[aC];
    [aC][a5]acrossfade=d=0.12:c1=tri:c2=tri[aD];
    [aD][a7]acrossfade=d=0.10:c1=tri:c2=tri[aE];
    [aE][a8]acrossfade=d=0.40:c1=tri:c2=tri[aF];
    [aF][a9]acrossfade=d=0.40:c1=tri:c2=tri[aout]
  " \
  -map "[vout]" -map "[aout]" -r 30 \
  -c:v libx264 -profile:v high -level 4.0 -crf 22 -preset medium \
  -c:a aac -b:a 128k -ac 2 \
  -movflags +faststart \
  meet-the-processor/assets/video/branch-predictor.mp4
