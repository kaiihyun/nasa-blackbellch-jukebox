#!/usr/bin/env python3
"""Saves one frame of every MP4 as a JPG next to it (precip.mp4 -> precip.jpg).
The carousel shows these pictures first, so it never has to open the video.
Run from the folder that holds index.html:   python3 make-thumbnails.py
Needs ffmpeg (https://ffmpeg.org). Optional: python3 make-thumbnails.py 0.6   = take the frame 60% in (default 0.4)."""
import glob, shutil, subprocess, sys

if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
    sys.exit("ffmpeg and ffprobe are needed. Install ffmpeg, then run this again.")
at = float(sys.argv[1]) if len(sys.argv) > 1 else 0.4
videos = sorted(set(glob.glob("assets/**/*.mp4", recursive=True) + glob.glob("jukebox/**/*.mp4", recursive=True)))
if not videos:
    sys.exit("No .mp4 files found in assets/ or jukebox/. Run this from the folder that holds index.html.")
for v in videos:
    out = v[:-4] + ".jpg"
    try:
        dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                             "-of", "default=nw=1:nk=1", v]).decode().strip())
    except Exception:
        dur = 0
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(dur * at), "-i", v, "-frames:v", "1",
                    "-vf", "scale=960:-2", "-q:v", "3", out], check=True)
    print("saved", out)
