#!/bin/sh
# Builds meet-the-processor/assets/video/l2-cache.mp4.
#
# This file, not tools/cut-fillers.py, is what reproduces the clip that shipped.
# Same reasoning as tools/cut-l3-explainer.sh and the four before it: the edit is
# hand-chosen, and a tool that re-derives it from a detector would not
# necessarily land on the same frames next time.
#
# Five takes were shot and ALL FIVE SHIP. Nothing is cut for what it says; the
# removals are a false start the speaker asked for by name, an "um" he asked for
# by name too, a stumble that is also a repeat across a seam, and the orphaned
# particle behind it.
#
# The numbering IS the edit order, checked rather than assumed, because the IFOP
# shoot's numbering was not and the test/debug shoot's was not either. All five
# were transcribed and read side by side: every take after the first opens on a
# connective that refers to the one numbered before it, and no take duplicates
# another once the 2 -> 3 repeat argued below comes off.
#
#   1  blocks and lines, hit and miss, hit rate and miss rate, hit time and
#      miss penalty, and what a miss actually costs
#   2  "So now that we kind of know the idea of how a cache works..."
#      -> direct mapped caches, and many addresses sharing one block
#   3  "Okay, so wait a minute..."   -> why the block alone is not enough: tags
#   4  "So, if we have 16 memory addresses in one block..."
#      -> the 4-bit tag, index-then-tag, fully associative, set associative
#   5  the closing line, pointing at L1i and L1d
#
# The masters arrived in the repository root as L2-explainer1..5, one of them
# carrying an uppercase extension. They are video-masters/l2-explainer1..5.mov
# now, matching every other shoot.
#
# Everything is spliced BEFORE the tone-map so the expensive HLG chain runs once
# over the joined timeline rather than five times.
#
#
# THE FOUR TRIMS
#
# TAKE 1 CARRIES AN "um" AND A SECOND OF DEAD AIR IN FRONT OF IT. In "and if the
# processor requests information, um, from the cache", named run by run:
#
#   23.19-23.71  "information", in two runs split by a dip at 23.52
#   23.71-24.63  silence, 0.92s of it
#   24.63-24.96  the "um", 0.33s of it
#   24.96-25.04  silence
#   25.04-       "from the cache"
#
# **Take 1 goes out at 23.95 and comes back at 24.99**, which keeps the word
# whole, takes the filler and the air around it, and leaves 0.30s of pause.
# Closing the gap to nothing was refused: the sentence is being thought through,
# and no pause at all reads as spliced even though nothing is audible at the
# seam.
#
# THIS CUT WAS MADE WRONG THE FIRST TIME AND THE WAY IT WAS WRONG IS THE LESSON.
# It went out at 23.52 and in at 24.38, on the belief that the 0.18s run at
# 23.53 was the "um" and that the 0.33s run at 24.63 was the word "from". That
# is backwards: 23.53-23.71 is the tail of "information" and 24.63-24.96 is the
# filler. So the shipped clip lost the end of a word and kept the "um", and
# Elliot heard it immediately.
#
# The check that would have caught it is the one cut-fillers.py already
# prescribes: **name every run of sound individually, and do it on the OUTPUT as
# well as the master.** Transcribed on its own the run at 24.63 comes back as
# "um" in as many words. What was done instead was a plain transcript of the
# finished encode, which read "requests information from the cache" and looked
# like proof. It is not proof of anything: whisper DELETES fillers, so a clean
# transcript is exactly what a surviving "um" also produces. A filler cut is
# verified run by run or it is not verified.
#
# A second false comfort, for the same reason: transcribing the encode with a
# disfluent initial_prompt put an "um" back into the text at the pause. That
# tells you nothing either. Only the run naming separates the two cases.
#
# WHY THIS ONE IS A HARD CUT WHILE EVERY OTHER SEAM DISSOLVES. The jump is 1.46,
# a third of cut-fillers.py's JUMP_OK of 4.0, because it is one take against
# itself 1.04s later with the pose unmoved, so there is nothing for a dissolve to
# hide. Sliding the in-point from 24.91 to 25.03 moves it 1.46 to 1.57, which is
# to say nowhere, so the point is chosen on the length of the pause and on
# nothing else. Both edges sit in silence, so the audio cut is inaudible.
#
# TAKE 4 CARRIES A FALSE START IN ITS MIDDLE, AND IT IS THE ONE CUT THAT WAS
# ASKED FOR. After "...but in general, it will kind of increase our hit time."
# the take goes:
#
#   90.58        "...hit time."
#   90.58-91.34  silence
#   91.34-91.78  "So,"                    <- the false start
#   91.78-93.01  silence, 1.23s of it     <- the pause inside it
#   93.01-93.65  "since we have,"         <- and it restarts twice, not once
#   93.65-94.04  silence
#   94.04-       "since that piece of information can be in so many different
#                 spots, it takes a lot more time to look for it."
#
# So the sentence is begun three times. **Take 4 goes out at 91.10 and comes
# back at 93.75**, which takes the "So", the pause behind it and the abandoned
# "since we have" out together and lands the join in silence on both sides. What
# plays is "...it will kind of increase our hit time. Since that piece of
# information can be in so many different spots, it takes a lot more time to
# look for it.", which is the sentence that was wanted.
#
# The split makes take 4 two segments, G4a and G4b, so this is a five-dissolve
# edit from five takes, with the take 1 hard cut sitting inside the first of
# them.
#
# TAKE 2 ENDS ON A STUMBLE THAT TAKE 3 THEN DELIVERS PROPERLY. Take 2's last
# complete sentence closes at 75.88, "So you might have like 16 locations in
# main memory all mapped to one block in our cache." What follows it is:
#
#   76.79-77.97  "And so, well, wait a minute, that's still,"
#   77.97-79.11  silence, 1.14s of it
#   79.11-86.26  "it narrows down the possible memory addresses that lie in one
#                 block,"
#   86.26-86.40  silence
#   86.40-86.54  "but."                   <- orphan, and the take ends here
#
# Take 3 then opens "Okay, so wait a minute, we're saying that we can have 16
# different memory addresses in one block. So yes, we're kind of narrowing down
# where a certain memory address might be. But at the end of the day, we still
# have to sift through 16 memory addresses in one block." That is the same beat,
# said again, said better, and finished. Left whole, the viewer hears "wait a
# minute" twice four seconds apart and hears the thought abandoned before it is
# made.
#
# **Take 2 goes out at 76.60**, on the last complete sentence, and take 3 carries
# the turn. This is the l3 take-6 edit performed on the outgoing side: there the
# incoming take had said the clause worse, here the outgoing one has. The orphan
# "but." goes with it, so no separate trim is needed for it.
#
# Cutting the other way round was considered and refused: take 2's version never
# reaches the point, so keeping it would mean cutting take 3's opening instead
# and the piece would lose "at the end of the day, we still have to sift through
# 16 memory addresses in one block", which is the sentence that motivates tags.
#
# NOTHING ELSE IS TRIMMED. Every head and tail on this shoot is inside the
# range the series has been shipping: heads of 0.40, 0.27, 0.40, 0.85 and 0.07,
# tails of 0.64, 0.72 after the cut, 0.88, 1.00 and 0.42.
#
#
# THE JOINS
#
# Measured the way cut-fillers.py measures a splice: mean absolute greyscale
# difference between the frame that plays last and the frame that plays first,
# against its JUMP_OK of 4.0, and the silence either side, which is the room a
# dissolve has to fit into.
#
#   join      jump   tail   head   fade
#   1a -> 1b  1.46   0.24   0.05   HARD   the "um" cut, argued above
#   1  -> 2   3.79   0.64   0.27   0.27
#   2  -> 3   6.02   0.72   0.40   0.40   capped, after the stumble comes off
#   3  -> 4a  5.73   0.88   0.85   0.40   capped
#   4a -> 4b  1.88   0.52   0.29   0.29   the false-start cut, inside one take
#   4b -> 5   4.73   1.00   0.07   0.12   see below
#
# EVERY JOIN BETWEEN TAKES DISSOLVES, which is what was asked for, and two of
# them would not have had to. 1 -> 2 scores 3.79 and 4a -> 4b scores 1.88, both
# under JUMP_OK, so a hard cut would already have been invisible at each;
# 4a -> 4b is low because it is one take joined to itself 2.65s later and the
# pose has barely moved. The dissolve there is not hiding a jump, it is softening
# a cut that lands mid-thought, which is worth its 0.29s on its own. The "um" cut
# is the one seam that is not a dissolve, for the two reasons argued with it.
#
# The fade is min(tail, head) capped at 0.40, the longest the series uses, and
# the one departure is argued below.
#
# MEASURE THE AIR WITHOUT cut-fillers.py's MIN_RUN, as always. That constant is
# 0.22s and it exists to stop consonants being mistaken for fillers; used on a
# seam it discards any last word shorter than itself. It would have hidden take
# 2's 0.14s "but." completely, and 2 -> 3 would have been built on a tail of
# 0.12s that was really 0.00s.
#
#
# 4b -> 5, THE ONE JOIN WITH NO AIR ON THE INCOMING SIDE
#
# Take 4 has a full second of tail and take 5 has 0.07s of head, which is exactly
# cut-fillers.py's MIN_FADE and therefore the shortest thing that still counts as
# a dissolve. Somewhere better to sit was looked for before a fade was spent,
# which is the IFOP procedure: scanning take 4's tail the jump only moves 4.66 to
# 4.73, so no out-point hides it and the join is decided on air.
#
# The fade is 0.12. All 0.12s of it sits inside take 4's silence, so the outgoing
# side is dead air throughout and the join is a soft attack on the incoming word
# rather than two voices at once. Take 5 pays 0.05s of that attack on the /s/ of
# "So", a sustained fricative and the cheapest possible onset to soften, which is
# the same trade the l3 splice made at 5 -> 6 on the /sh/ of "shuttles" and the
# branch-predictor splice made at 4 -> 5 on the /th/ of "This". It is 0.12 rather
# than the 0.16 default because the principle cut-fillers.py is written around is
# that crossfading speech is worse than any jump.
#
#
# THE ARITHMETIC
#
# Every xfade offset is on the ACCUMULATED timeline, not on its new input.
# Segments, after trimming:
#
#   G1a  take 1, to 23.95                                        23.950000
#   G1b  take 1, from 24.99                                     102.030000
#   G1   the two concatenated                                   125.980000
#   G2   take 2, to 76.60                                        76.600000
#   G3   take 3, whole                                           56.058333
#   G4a  take 4, to 91.10                                        91.100000
#   G4b  take 4, from 93.75                                      45.248333
#   G5   take 5, whole                                            9.510000
#
#   O1  = 125.980000 - 0.27                                   = 125.710000
#   after G1+G2  : 125.980000 + 76.600000 - 0.27              = 202.310000
#   O2  = 202.310000 - 0.40                                   = 201.910000
#   after +G3    : 202.310000 + 56.058333 - 0.40              = 257.968333
#   O3  = 257.968333 - 0.40                                   = 257.568333
#   after +G4a   : 257.968333 + 91.100000 - 0.40              = 348.668333
#   O4  = 348.668333 - 0.29                                   = 348.378333
#   after +G4b   : 348.668333 + 45.248333 - 0.29              = 393.626666
#   O5  = 393.626666 - 0.12                                   = 393.506666
#   out = 393.626666 +  9.510000 - 0.12                       = 403.016666
#
# settb=1/30 after every fps AND after every xfade: the filter's output timebase
# is not guaranteed to be what the next stage wants. aformat on every audio
# branch or acrossfade dies with "Error reinitializing filters".
#
# Takes 1 and 4 are each used twice, so their video and audio are split with
# split/asplit. Feeding one input pad to two filters without them is a
# filtergraph error, not a silent duplication. Take 1's two pieces are rejoined
# with concat rather than xfade, because that seam is the hard cut, and the
# concatenated pair is what the rest of the graph then treats as take 1.
#
# All five masters are shot at 60000/1001, the first shoot where they agree, so
# fps=30 is a straight halving here rather than the reconciliation it was on the
# l3 set. It stays because the masters are variable frame rate and the encode is
# specified at 30.
#
#
# EVERY AUDIO BRANCH IS atrim'd TO ITS VIDEO LENGTH, AND THAT IS NOT COSMETIC
#
# The masters carry AAC, and AAC is encoded in 1024-sample frames, so the last
# frame of each take is padded out past where the container says the take ends.
# Decoded, all five run long:
#
#   take    1      2      3      4      5
#   over  .0090  .0190  .0070  .0210  .0160
#
# acrossfade concatenates what it is given, so without the trims each segment
# hands the next one a few extra milliseconds and the audio walks progressively
# LATE against the video. See tools/cut-bp-explainer.sh, where this was first
# found and cost a shipped clip 0.078s of drift.
#
# Takes 2 and 4 are trimmed at the head or the tail or both, so their audio
# branches carry the same bounds their video branches do; the end value on an
# untrimmed take is the container duration, not the decoded length.
set -e
cd "$(dirname "$0")/.."

TM="zscale=w=1280:h=720:f=lanczos:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
AF="aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo"

ffmpeg -y -hide_banner \
  -i video-masters/l2-explainer1.mov \
  -i video-masters/l2-explainer2.mov \
  -i video-masters/l2-explainer3.mov \
  -i video-masters/l2-explainer4.mov \
  -i video-masters/l2-explainer5.mov \
  -filter_complex "
    [0:v]split=2[v1s][v1t];
    [0:a]asplit=2[a1s][a1t];
    [3:v]split=2[v4s][v4t];
    [3:a]asplit=2[a4s][a4t];
    [v1s]trim=end=23.950000,setpts=PTS-STARTPTS[v1a];
    [v1t]trim=start=24.990000,setpts=PTS-STARTPTS[v1b];
    [a1s]atrim=end=23.950000,asetpts=PTS-STARTPTS[a1a];
    [a1t]atrim=start=24.990000:end=127.020000,asetpts=PTS-STARTPTS[a1b];
    [v1a][a1a][v1b][a1b]concat=n=2:v=1:a=1[v1c][a1c];
    [v1c]fps=30,settb=1/30[v1];
    [1:v]trim=end=76.600000,setpts=PTS-STARTPTS,fps=30,settb=1/30[v2];
    [2:v]fps=30,settb=1/30[v3];
    [v4s]trim=end=91.100000,setpts=PTS-STARTPTS,fps=30,settb=1/30[v4a];
    [v4t]trim=start=93.750000,setpts=PTS-STARTPTS,fps=30,settb=1/30[v4b];
    [4:v]fps=30,settb=1/30[v5];
    [v1][v2]xfade=transition=fade:duration=0.27:offset=125.710000,settb=1/30[vA];
    [vA][v3]xfade=transition=fade:duration=0.40:offset=201.910000,settb=1/30[vB];
    [vB][v4a]xfade=transition=fade:duration=0.40:offset=257.568333,settb=1/30[vC];
    [vC][v4b]xfade=transition=fade:duration=0.29:offset=348.378333,settb=1/30[vD];
    [vD][v5]xfade=transition=fade:duration=0.12:offset=393.506666[vj];
    [vj]$TM[vout];
    [a1c]$AF[a1];
    [1:a]atrim=end=76.600000,asetpts=PTS-STARTPTS,$AF[a2];
    [2:a]atrim=end=56.058333,asetpts=PTS-STARTPTS,$AF[a3];
    [a4s]atrim=end=91.100000,asetpts=PTS-STARTPTS,$AF[a4a];
    [a4t]atrim=start=93.750000:end=138.998333,asetpts=PTS-STARTPTS,$AF[a4b];
    [4:a]atrim=end=9.510000,asetpts=PTS-STARTPTS,$AF[a5];
    [a1][a2]acrossfade=d=0.27:c1=tri:c2=tri[aA];
    [aA][a3]acrossfade=d=0.40:c1=tri:c2=tri[aB];
    [aB][a4a]acrossfade=d=0.40:c1=tri:c2=tri[aC];
    [aC][a4b]acrossfade=d=0.29:c1=tri:c2=tri[aD];
    [aD][a5]acrossfade=d=0.12:c1=tri:c2=tri[aout]
  " \
  -map "[vout]" -map "[aout]" -r 30 \
  -c:v libx264 -profile:v high -level 4.0 -crf 22 -preset medium \
  -c:a aac -b:a 128k -ac 2 \
  -movflags +faststart \
  meet-the-processor/assets/video/l2-cache.mp4
