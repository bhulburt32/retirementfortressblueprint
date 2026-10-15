#!/usr/bin/env python3
"""Build the Retirement Fortress Blueprint outputs from src/fortress-mapper.html.

  dist/preview.html             the mapper wrapped in a minimal document, for the tests (opens empty)
  dist/preview-smith.html       the same with samples/default-case-smith.json injected as RFB_DEFAULT_CASE
  dist/retirement-fortress.html the standalone download (src/standalone-head.html + mapper)
  dist/_x.js                    every inline script, concatenated, for `node --check`

  --azure                       also writes the Azure Static Web App site:
  dist/azure/index.html         standalone head + <script>window.RFB_API='/api'</script> + mapper
  dist/azure/staticwebapp.config.json   copied from the repository root

The published claude.ai artifact takes src/fortress-mapper.html as-is (no doctype: claude.ai wraps it).
"""
import json, os, re, shutil, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(root, 'src'); dist = os.path.join(root, 'dist'); os.makedirs(dist, exist_ok=True)
azure = '--azure' in sys.argv[1:]

m = open(os.path.join(src, 'fortress-mapper.html'), encoding='utf-8').read()
MIN_HEAD = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n'

def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f: f.write(text)

write(os.path.join(dist, 'preview.html'), MIN_HEAD + m + '\n</body></html>\n')

sample = os.path.join(root, 'samples', 'default-case-smith.json')
if os.path.exists(sample):
    case = json.dumps(json.load(open(sample, encoding='utf-8')), ensure_ascii=False, separators=(',', ':'))
    inj = '<script>window.RFB_DEFAULT_CASE = ' + json.dumps(case, ensure_ascii=False) + ';</script>\n'
    write(os.path.join(dist, 'preview-smith.html'), MIN_HEAD + inj + m + '\n</body></html>\n')

head = open(os.path.join(src, 'standalone-head.html'), encoding='utf-8').read()
write(os.path.join(dist, 'retirement-fortress.html'), head + '<body>\n' + m + '\n</body></html>\n')

scripts = re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>', m, flags=re.S)
write(os.path.join(dist, '_x.js'), '\n'.join(scripts))

if azure:
    # The hosted page: same document as the standalone download, with the API base set ahead of the
    # app so the page signs the advisor in, shows Saved cases and routes the Claude summaries to /api.
    site = os.path.join(dist, 'azure')
    write(os.path.join(site, 'index.html'), head + '<body>\n<script>window.RFB_API = \'/api\';</script>\n' + m + '\n</body></html>\n')
    cfg = os.path.join(root, 'staticwebapp.config.json')
    if not os.path.exists(cfg):
        sys.exit('missing staticwebapp.config.json at the repository root')
    shutil.copy(cfg, os.path.join(site, 'staticwebapp.config.json'))
    txt = open(cfg, encoding='utf-8').read()
    if '<TENANT_ID>' in txt:
        print('WARNING: staticwebapp.config.json still has <TENANT_ID> in openIdIssuer — sign-in will fail until it is replaced', file=sys.stderr)

print('built', len(m), 'bytes,', len(scripts), 'script block(s) ->', dist + (' (+ azure site)' if azure else ''))
