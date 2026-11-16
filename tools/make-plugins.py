#!/usr/bin/env python3
"""Lists every .js file in locationmode/instruments/custom/ and locationmode/scenes/custom/ inside locationmode/plugins.js.
Run from the folder that holds index.html:   python3 tools/make-plugins.py"""
import glob, re, sys
files = sorted(glob.glob("locationmode/instruments/custom/*.js")) + sorted(glob.glob("locationmode/scenes/custom/*.js"))
try:
    src = open("locationmode/plugins.js", encoding="utf-8").read()
except FileNotFoundError:
    sys.exit("Run this from the folder that holds index.html.")
lines = "".join('    "%s",\n' % f for f in files)
new = re.sub(r"/\* AUTO-LIST-START \*/.*?/\* AUTO-LIST-END \*/", lambda m: "/* AUTO-LIST-START */\n" + lines + "/* AUTO-LIST-END */", src, flags=re.S)
open("locationmode/plugins.js", "w", encoding="utf-8").write(new)
print("listed %d plugin file(s)" % len(files))
for f in files: print(" ", f)
