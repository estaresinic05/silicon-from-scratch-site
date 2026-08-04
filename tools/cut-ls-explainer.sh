#!/bin/sh
# The cut of ls-explainer.mov that ships as the Load / Store sheet video, and
# the encode to the site's spec (README.md, "The sheet videos").
#
# SIX excisions. Two fillers of the word "essentially", and the four longest of
# the eight "um"s in the take. Every one was located acoustically and then named
# by transcribing that speech run on its own — whisper's word boundaries drift by
# half a second here, and it deletes "um" from its output entirely, so neither
# the text nor the timings can be trusted on their own.
#
#   1   48.45 -> 49.35   um    0.43s word, sat in a 1.08s pause
#   2   78.15 -> 78.90   "...we can load [essentially] four pieces..."
#   3   89.70 -> 91.05   "...and having a [essentially] multiport cache..."
#   4  111.93 -> 112.46  um    "...an increase in [um] the load pipe by one..."
#   5  117.85 -> 118.60  um    0.41s word after "yeah", into a long pause
#   6  124.90 -> 125.75  um    0.45s word between "big burden" and "and"
#
# The four kept "um"s are the four shortest (0.16s to 0.37s). Taking all eight
# reads as over-edited; these are the ones you hear.
#
# Every splice starts and ends inside a silence, not on a word boundary, so no
# consonant is clipped and there is no click.
#
# Hard cut or dissolve is decided by MEASUREMENT, not by eye: the frame that
# would play last before the cut against the one that would play first after it,
# mean absolute difference over the frame.
#
#   cut 1  6.66   dissolve 0.16s   he shifts in the chair
#   cut 2  2.71   hard
#   cut 3 11.35   dissolve 0.20s   a hand comes up to his face
#   cut 4  0.89   hard
#   cut 5  2.24   hard
#   cut 6  2.06   hard
#
# Cut 4 could not have taken a dissolve in any case: it has 0.10s of silence
# before it and 0.05s after, and a dissolve there would have crossfaded speech.
#
# Two ffmpeg traps, both of which fail loudly but unhelpfully:
#   * every audio branch needs an explicit aformat, or acrossfade dies with
#     "Error reinitializing filters" — branches may negotiate different sample
#     formats and it will not join two that differ;
#   * both xfade inputs need settb=1/30, because concat hands on a 1/1000000
#     timebase and fps=30 hands on 1/30.
#
# trim -> splice -> tone-map, in that order, so the expensive HLG chain runs once
# over the joined timeline instead of once per piece.
set -e
SRC=video-masters/ls-explainer.mov
DST=meet-the-processor/assets/video/load-store.mp4
AF='aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo'
TB='settb=1/30'

# Segment durations, for the xfade offsets:
#   S0 48.45  S1 28.80  S2 10.80 | S3 20.88  S4 5.39  S5 6.30  S6 10.37
#   A = S0 (+.16) [S1 S2]      = 48.45 + 39.60 - 0.16 = 87.89, offset 48.29
#   B = [S3 S4 S5 S6]          = 42.94
#   A (+.20) B                 = 130.63, offset 87.69

ffmpeg -y -i "$SRC" -filter_complex "
[0:v]trim=0:48.45,setpts=PTS-STARTPTS,fps=30,$TB[v0];
[0:v]trim=49.35:78.15,setpts=PTS-STARTPTS,fps=30,$TB[v1];
[0:v]trim=78.90:89.70,setpts=PTS-STARTPTS,fps=30,$TB[v2];
[0:v]trim=91.05:111.93,setpts=PTS-STARTPTS,fps=30,$TB[v3];
[0:v]trim=112.46:117.85,setpts=PTS-STARTPTS,fps=30,$TB[v4];
[0:v]trim=118.60:124.90,setpts=PTS-STARTPTS,fps=30,$TB[v5];
[0:v]trim=125.75,setpts=PTS-STARTPTS,fps=30,$TB[v6];
[v1][v2]concat=n=2:v=1:a=0,$TB[vA1];
[v0][vA1]xfade=transition=fade:duration=0.16:offset=48.29,$TB[vA];
[v3][v4][v5][v6]concat=n=4:v=1:a=0,$TB[vB];
[vA][vB]xfade=transition=fade:duration=0.20:offset=87.69[vc];
[0:a]atrim=0:48.45,asetpts=PTS-STARTPTS,$AF[a0];
[0:a]atrim=49.35:78.15,asetpts=PTS-STARTPTS,$AF[a1];
[0:a]atrim=78.90:89.70,asetpts=PTS-STARTPTS,$AF[a2];
[0:a]atrim=91.05:111.93,asetpts=PTS-STARTPTS,$AF[a3];
[0:a]atrim=112.46:117.85,asetpts=PTS-STARTPTS,$AF[a4];
[0:a]atrim=118.60:124.90,asetpts=PTS-STARTPTS,$AF[a5];
[0:a]atrim=125.75,asetpts=PTS-STARTPTS,$AF[a6];
[a1][a2]concat=n=2:v=0:a=1,$AF[aA1];
[a0][aA1]acrossfade=d=0.16:c1=tri:c2=tri,$AF[aA];
[a3][a4][a5][a6]concat=n=4:v=0:a=1,$AF[aB];
[aA][aB]acrossfade=d=0.20:c1=tri:c2=tri[ac];
[vc]zscale=w=1280:h=720:f=lanczos:t=linear:npl=100,format=gbrpf32le,
    zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,
    format=yuv420p[vout]" \
  -map "[vout]" -map "[ac]" \
  -r 30 -c:v libx264 -profile:v high -level 4.0 -crf 22 -preset medium \
  -c:a aac -b:a 128k -ac 2 -movflags +faststart \
  "$DST"
