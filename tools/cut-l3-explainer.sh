#!/bin/sh
# Builds meet-the-processor/assets/video/l3-cache.mp4.
#
# This file, not tools/cut-fillers.py, is what reproduces the clip that shipped.
# Same reasoning as tools/cut-bp-explainer.sh, tools/cut-ieu-explainer.sh,
# tools/cut-ls-explainer.sh and tools/cut-ifop-explainer.sh: the edit is
# hand-chosen, and a tool that re-derives it from a detector would not
# necessarily land on the same frames next time.
#
# Seven takes were shot and ALL SEVEN SHIP. Nothing is cut for what it says;
# the only removals are two defects at the head of a take and one orphaned
# particle at the tail of another, all three argued below.
#
# The numbering IS the edit order, checked rather than assumed, because the IFOP
# shoot's numbering was not and the test/debug shoot's was not either. All seven
# were transcribed and read side by side: every take after the first opens on a
# connective that refers to the one numbered before it, and no take duplicates
# another.
#
#   1  fast memory and lots of memory, and why you cannot have both
#   2  "And in general, larger banks..." -> the memory hierarchy, the library
#   3  "And this whole idea..."          -> temporal locality
#   4  "And the second concept..."       -> spatial locality, the desk is a cache
#   5  "And right now we're looking at the L3 cache on the Ryzen..."
#   6  "...shuttles the important information..." -> L1, and what comes next
#   7  the closing line
#
# The masters arrived in the repository root as L3-explainer1..7, one of them
# spelled L3-expainer4.MOV and two carrying an uppercase extension. They are
# video-masters/l3-explainer1..7.mov now, matching bp-explainer*.
#
# Everything is spliced BEFORE the tone-map so the expensive HLG chain runs once
# over the joined timeline rather than seven times.
#
#
# THE THREE TRIMS
#
# TAKE 6 OPENS ON A FALSE START, AND IT IS A REPEAT AS WELL AS A stumble.
# Take 5 ends "And so programmers and computer designers try to design
# processors in a way that...", trailing off. Take 6 then opens:
#
#   0.55-0.96   "Try to"          <- the false start
#   1.22-3.58   "try to design processors in a way that"
#   3.63-       "shuttles the important information..."
#
# So the clause is delivered three times across the seam: once by take 5, once
# abandoned at the top of take 6, once again in full. **Take 6 comes in at 3.58,
# on "shuttles"**, which removes the stumble AND the repeat in one cut and lets
# take 5's sentence finish through the join:
#
#   "...try to design processors in a way that" | "shuttles the important
#   information that we might need all the way down close to the processor"
#
# Cutting the other way round was tested on paper and refused: ending take 5
# after "designers" and letting take 6 carry the clause gives "computer
# designers tries to design", because take 6 says "tries" where take 5 says
# "try". Take 5 has the grammatical version, so take 5 keeps the clause.
#
# TAKE 4 OPENS ON 1.84s OF DEAD AIR, which is the pause to cut. Every other take
# starts speaking between 0.10 and 1.03: 0.37, 0.43, 0.48, 0.55, 0.10, 1.03.
# **Take 4 comes in at 1.44**, leaving 0.40s of head, which is the longest fade
# this series uses. The pause is not merely shortened, it is spent — 0.31s of
# what is left becomes the 3 -> 4 dissolve and 0.09s remains as silence.
#
# TAKE 1 ENDS ON AN ORPHANED "and" AND IT COSTS THE FIRST JOIN ITS DISSOLVE.
# The take ends "...you'd really take up tons of space", then 0.85s of silence,
# then a 0.21s "and" running to the last frame:
#
#   43.73-44.13  "space"
#   44.13-44.98  silence
#   44.98-45.19  "and"        <- take 1's final frame is 45.1867
#
# Whole, take 1 has a tail of 0.00 and 1 -> 2 cannot dissolve at all. **Take 1
# goes out at 44.98** and the out-point lands inside the gap behind the particle,
# which is the branch-predictor take 8 edit performed from the other side: there
# a leading "So" came off the incoming take, here a trailing "and" comes off the
# outgoing one. Take 2 opens "And in general, larger banks of memory...", so the
# conjunction is not lost, it is spoken once instead of twice, and the sentence
# reads "...take up tons of space. And in general, larger banks...".
#
# The gain is the whole reason to do it: take 1's tail goes from 0.00s, which is
# no dissolve, to 0.85s, which is more than the cap.
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
#   1 -> 2  6.49  0.85   0.37   0.37   after the "and" comes off
#   2 -> 3 11.95  1.25   0.43   0.40   capped
#   3 -> 4  6.50  0.31   0.40   0.31   after 1.44s comes off take 4
#   4 -> 5  6.37  1.61   0.48   0.40   capped
#   5 -> 6  4.88  0.14   0.05   0.12   see below
#   6 -> 7  6.46  0.32   0.10   0.10
#
# EVERY JOIN DISSOLVES: all six score above 4.0, so there is no hard cut in the
# piece. The fade is min(tail, head) capped at 0.40, which is the longest the
# rest of the series uses, and the one departure is argued below.
#
# THIS SHOOT IS THE ROOMIEST SO FAR. Four of the six joins are decided by the
# cap or within 0.09s of it, where the IFOP set had three joins worth two to five
# frames and the branch-predictor set had one join with no air on either side.
# The standing shooting note — hold a beat of silence at the top and tail of
# every take — is visibly being followed: takes 2 and 4 leave over a second at
# the tail. The two takes that still needed surgery needed it for a stumble and
# a stray particle, not for tightness.
#
# MEASURE THE AIR WITHOUT cut-fillers.py's MIN_RUN, as always. That constant is
# 0.22s and it exists to stop consonants being mistaken for fillers; used on a
# seam it discards any last word shorter than itself. It would have hidden take
# 1's 0.21s "and" completely, and the 1 -> 2 join would have been built on a
# tail of 0.85s that was really 0.00s.
#
#
# 5 -> 6, THE ONE JOIN WITH NO AIR ON EITHER SIDE
#
# Take 5 stops 0.14s before it ends and take 6, cut in at "shuttles", has 0.05s
# of head. Neither side can pay for a dissolve out of silence alone, and 0.05 is
# under cut-fillers.py's MIN_FADE of 0.07.
#
# Somewhere better to sit was looked for before a fade was spent, which is the
# IFOP procedure: scanning take 5's tail the jump only moves 4.75 to 4.88, so no
# out-point hides it and the join is decided on air.
#
# The fade is 0.12. All 0.12s of it sits inside take 5's silence, so the outgoing
# side is dead air throughout and the join is a soft attack on the incoming word
# rather than two voices at once. Take 6 pays 0.07s of that attack on the /sh/ of
# "shuttles", which is a sustained fricative and the cheapest possible onset to
# soften — the same trade the branch-predictor splice made at 4 -> 5 on the /th/
# of "This", and the same size of borrow. It is 0.12 rather than the 0.16 default
# because the principle cut-fillers.py is written around is that crossfading
# speech is worse than any jump.
#
#
# THE ARITHMETIC
#
# Every xfade offset is on the ACCUMULATED timeline, not on its new input.
# Segments, after trimming:
#
#   G1  take 1, to 44.98                                         44.980000
#   G2  take 2, whole                                           109.595000
#   G3  take 3, whole                                            45.323333
#   G4  take 4, from 1.44                                        81.013333
#   G5  take 5, whole                                            67.061700
#   G6  take 6, from 3.58                                        25.168333
#   G7  take 7, whole                                             5.390000
#
#   O1  = 44.980000 - 0.37                                    =  44.610000
#   after G1+G2 : 44.980000 + 109.595000 - 0.37               = 154.205000
#   O2  = 154.205000 - 0.40                                   = 153.805000
#   after +G3   : 154.205000 + 45.323333 - 0.40               = 199.128333
#   O3  = 199.128333 - 0.31                                   = 198.818333
#   after +G4   : 199.128333 + 81.013333 - 0.31               = 279.831666
#   O4  = 279.831666 - 0.40                                   = 279.431666
#   after +G5   : 279.831666 + 67.061700 - 0.40               = 346.493366
#   O5  = 346.493366 - 0.12                                   = 346.373366
#   after +G6   : 346.493366 + 25.168333 - 0.12               = 371.541699
#   O6  = 371.541699 - 0.10                                   = 371.441699
#   out = 371.541699 + 5.390000 - 0.10                        = 376.831699
#
# settb=1/30 after every fps AND after every xfade: the filter's output timebase
# is not guaranteed to be what the next stage wants. aformat on every audio
# branch or acrossfade dies with "Error reinitializing filters".
#
# The masters are shot at three different frame rates — take 1 at 359/12, take 4
# at 30000/1001, the other five at 60000/1001 — so fps=30 is doing real work
# here rather than passing everything through unchanged.
#
#
# EVERY AUDIO BRANCH IS atrim'd TO ITS VIDEO LENGTH, AND THAT IS NOT COSMETIC
#
# The masters carry AAC, and AAC is encoded in 1024-sample frames, so the last
# frame of each take is padded out past where the container says the take ends.
# Decoded, all seven run long:
#
#   take    1      2      3      4      5      6      7
#   over  .0186  .0157  .0100  .0213  .0103  .0303  .0287
#
# acrossfade concatenates what it is given, so without the trims each segment
# hands the next one a few extra milliseconds and the audio walks progressively
# LATE against the video. The overruns total 0.135s, which is four frames of lip
# sync by the closing line. See tools/cut-bp-explainer.sh, where this was first
# found and cost a shipped clip 0.078s of drift.
#
# Takes 4 and 6 are trimmed at the head as well, so their audio branches carry
# both bounds; the end value is the container duration, not the trimmed length.
set -e
cd "$(dirname "$0")/.."

TM="zscale=w=1280:h=720:f=lanczos:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
AF="aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo"

ffmpeg -y -hide_banner \
  -i video-masters/l3-explainer1.mov \
  -i video-masters/l3-explainer2.mov \
  -i video-masters/l3-explainer3.mov \
  -i video-masters/l3-explainer4.mov \
  -i video-masters/l3-explainer5.mov \
  -i video-masters/l3-explainer6.mov \
  -i video-masters/l3-explainer7.mov \
  -filter_complex "
    [0:v]trim=end=44.980000,setpts=PTS-STARTPTS,fps=30,settb=1/30[v1];
    [1:v]fps=30,settb=1/30[v2];
    [2:v]fps=30,settb=1/30[v3];
    [3:v]trim=start=1.44,setpts=PTS-STARTPTS,fps=30,settb=1/30[v4];
    [4:v]fps=30,settb=1/30[v5];
    [5:v]trim=start=3.58,setpts=PTS-STARTPTS,fps=30,settb=1/30[v6];
    [6:v]fps=30,settb=1/30[v7];
    [v1][v2]xfade=transition=fade:duration=0.37:offset=44.610000,settb=1/30[vA];
    [vA][v3]xfade=transition=fade:duration=0.40:offset=153.805000,settb=1/30[vB];
    [vB][v4]xfade=transition=fade:duration=0.31:offset=198.818333,settb=1/30[vC];
    [vC][v5]xfade=transition=fade:duration=0.40:offset=279.431666,settb=1/30[vD];
    [vD][v6]xfade=transition=fade:duration=0.12:offset=346.373366,settb=1/30[vE];
    [vE][v7]xfade=transition=fade:duration=0.10:offset=371.441699[vj];
    [vj]$TM[vout];
    [0:a]atrim=end=44.980000,asetpts=PTS-STARTPTS,$AF[a1];
    [1:a]atrim=end=109.595000,asetpts=PTS-STARTPTS,$AF[a2];
    [2:a]atrim=end=45.323333,asetpts=PTS-STARTPTS,$AF[a3];
    [3:a]atrim=start=1.44:end=82.453333,asetpts=PTS-STARTPTS,$AF[a4];
    [4:a]atrim=end=67.061700,asetpts=PTS-STARTPTS,$AF[a5];
    [5:a]atrim=start=3.58:end=28.748333,asetpts=PTS-STARTPTS,$AF[a6];
    [6:a]atrim=end=5.390000,asetpts=PTS-STARTPTS,$AF[a7];
    [a1][a2]acrossfade=d=0.37:c1=tri:c2=tri[aA];
    [aA][a3]acrossfade=d=0.40:c1=tri:c2=tri[aB];
    [aB][a4]acrossfade=d=0.31:c1=tri:c2=tri[aC];
    [aC][a5]acrossfade=d=0.40:c1=tri:c2=tri[aD];
    [aD][a6]acrossfade=d=0.12:c1=tri:c2=tri[aE];
    [aE][a7]acrossfade=d=0.10:c1=tri:c2=tri[aout]
  " \
  -map "[vout]" -map "[aout]" -r 30 \
  -c:v libx264 -profile:v high -level 4.0 -crf 22 -preset medium \
  -c:a aac -b:a 128k -ac 2 \
  -movflags +faststart \
  meet-the-processor/assets/video/l3-cache.mp4
