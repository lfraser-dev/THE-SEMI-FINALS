#!/usr/bin/env python3
"""Cache-busting: writes an import map into index.html so every module loads as file.js?v=<version>.
Browsers (and GitHub Pages' 10-minute cache) then can't mix old and new scripts after an update.
Run after changing any file in src/:  python3 tools/stamp.py [version]
"""
import os, re, subprocess, sys, json

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) > 1:
    ver = sys.argv[1]
else:
    html = open(os.path.join(root, 'index.html')).read()
    m = re.search(r'BUILD (\d+\.\d+)', html)
    ver = (m.group(1) if m else '0') + '-' + str(int(__import__('time').time()))
mods = {}
for d, _, files in os.walk(os.path.join(root, 'src')):
    for f in sorted(files):
        if f.endswith('.js'):
            rel = os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/')
            mods['./' + rel] = './' + rel + '?v=' + ver
block = ('<script type="importmap">\n' + json.dumps({'imports': dict(sorted(mods.items()))}, indent=1) + '\n</script>\n'
         f'<script type="module" src="src/main.js?v={ver}"></script>')
p = os.path.join(root, 'index.html')
html = open(p).read()
html = re.sub(r'(<script type="importmap">.*?</script>\n)?<script type="module" src="src/main\.js[^"]*"></script>', lambda _: block, html, flags=re.S)
open(p, 'w').write(html)
print('stamped', ver, len(mods), 'modules')
