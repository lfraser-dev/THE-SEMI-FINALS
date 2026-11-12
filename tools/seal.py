#!/usr/bin/env python3
"""Builds the locked copy of the game in site/ (what gets published).

The whole game (index.html + every module in src/) is gzipped and encrypted with AES-256-GCM into site/g.bin, using
a key made from the password with PBKDF2-SHA256. site/index.html is just the password screen (tools/gate.html), which
makes the same key in the browser and unscrambles the game. Without the password, site/ contains nothing playable.

The password is read from the SF_PASS environment variable or from .sealpass (which git ignores). It is never written
into the repo. The salt and iteration count live in tools/seal.json; changing the password makes a new salt, so every
device has to type the new one.

Run after stamp.py:  python3 tools/seal.py            (re-seal with the current password)
                     SF_PASS=new-pass python3 tools/seal.py --new   (change the password)
"""
import base64, gzip, hashlib, json, os, posixpath, re, secrets, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg_path = os.path.join(root, 'tools', 'seal.json')

pw = os.environ.get('SF_PASS')
if not pw and os.path.exists(os.path.join(root, '.sealpass')):
    pw = open(os.path.join(root, '.sealpass')).read()
if not pw:
    sys.exit('seal: no password (set SF_PASS or write it to .sealpass)')
pw = re.sub(r'\s+', '', pw.strip().lower())

cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else None
if cfg is None or '--new' in sys.argv:
    cfg = {'salt': base64.b64encode(secrets.token_bytes(16)).decode(), 'iter': 600000}
    json.dump(cfg, open(cfg_path, 'w'), indent=1)
bits = hashlib.pbkdf2_hmac('sha256', pw.encode(), base64.b64decode(cfg['salt']), cfg['iter'], 64)
k_bundle = bits[:32]

# every module, with its relative imports rewritten to '@sf/<path>' (the loader maps those to in-memory copies)
mods = {}
imp = re.compile(r"""((?:\bfrom|\bimport)\s*)(['"])(\.\.?/[^'"]+)\2""")
for d, _, files in os.walk(os.path.join(root, 'src')):
    for f in sorted(files):
        if not f.endswith('.js'):
            continue
        rel = os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/')
        here = posixpath.dirname(rel)
        code = open(os.path.join(d, f), encoding='utf-8').read()
        code = imp.sub(lambda m: m.group(1) + m.group(2) + '@sf/' + posixpath.normpath(posixpath.join(here, m.group(3).split('?')[0])) + m.group(2), code)
        mods[rel] = code

html = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
html = re.sub(r'<script type="importmap">.*?</script>\n?', '', html, flags=re.S)
html = re.sub(r'<script type="module" src="src/main\.js[^"]*"></script>\n?', '', html)
m = re.search(r'BUILD (\d+\.\d+)', html)
ver = (m.group(1) if m else '0') + '-' + secrets.token_hex(3)

payload = gzip.compress(json.dumps({'html': html, 'mods': mods}, separators=(',', ':')).encode(), 9, mtime=0)
iv = secrets.token_bytes(12)
os.makedirs(os.path.join(root, 'site'), exist_ok=True)
open(os.path.join(root, 'site', 'g.bin'), 'wb').write(iv + AESGCM(k_bundle).encrypt(iv, payload, None))

gate = open(os.path.join(root, 'tools', 'gate.html'), encoding='utf-8').read()
gate = gate.replace('%SALT%', cfg['salt']).replace('%ITER%', str(cfg['iter'])).replace('%VER%', ver)
open(os.path.join(root, 'site', 'index.html'), 'w', encoding='utf-8').write(gate)
open(os.path.join(root, 'site', 'robots.txt'), 'w').write('User-agent: *\nDisallow: /\n')
print('sealed', ver, len(mods), 'modules,', os.path.getsize(os.path.join(root, 'site', 'g.bin')) // 1024, 'KB')
