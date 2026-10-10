#!/usr/bin/env python3
"""Build the Retirement Fortress Blueprint outputs from src/fortress-mapper.html.

  dist/preview.html             the mapper wrapped in a minimal document, for the tests
  dist/retirement-fortress.html the standalone download (src/standalone-head.html + mapper)
  dist/_x.js                    every inline script, concatenated, for `node --check`

The published artifact takes src/fortress-mapper.html as-is (no doctype: claude.ai wraps it).
"""
import os, re, sys, subprocess
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
subprocess.run([sys.executable, os.path.join(root, 'scripts', 'guide-notes.py')], check=True)   # the User Guide Notes follow docs/advisor-guide.html
src = os.path.join(root, 'src'); dist = os.path.join(root, 'dist'); os.makedirs(dist, exist_ok=True)
m = open(os.path.join(src, 'fortress-mapper.html'), encoding='utf-8').read()
open(os.path.join(dist, 'preview.html'), 'w', encoding='utf-8').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n' + m + '\n</body></html>\n')
head = open(os.path.join(src, 'standalone-head.html'), encoding='utf-8').read()
open(os.path.join(dist, 'retirement-fortress.html'), 'w', encoding='utf-8').write(head + '<body>\n' + m + '\n</body></html>\n')
scripts = re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>', m, flags=re.S)
open(os.path.join(dist, '_x.js'), 'w', encoding='utf-8').write('\n'.join(scripts))
print('built', len(m), 'bytes,', len(scripts), 'script block(s) ->', dist)
