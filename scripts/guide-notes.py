#!/usr/bin/env python3
"""Copy the advisor guide's per-section instructions into the application as collapsible User Guide Notes.

Each numbered section of docs/advisor-guide.html (01 … 22; "19 · 20" serves two) is written for advisors,
one <dt>/<dd> per control. This script takes the body of each (everything after its <h2>) and writes it
into src/fortress-mapper.html beneath the matching section header, between

    <!-- guide-notes:NN --> … <!-- /guide-notes:NN -->

markers, as <details class="guide-notes">. The guide is the source: edit it, then run
`python3 scripts/guide-notes.py` (npm run build does it). The mapper is only rewritten when a block changed.
"""
import io, os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUIDE = os.path.join(root, 'docs', 'advisor-guide.html')
MAPPER = os.path.join(root, 'src', 'fortress-mapper.html')

def guide_sections(html):
    """{section number: body html} from the guide's numbered sections."""
    out = {}
    for m in re.finditer(r'<section>\s*<div class="num">(.*?)</div>\s*<div class="body">\s*<h2>(.*?)</h2>(.*?)\s*</div>\s*</section>', html, flags=re.S):
        label = re.sub(r'<small>.*?</small>', '', m.group(1)).strip()
        nums = re.findall(r'\d{2}', label)
        if not nums:
            continue
        body = m.group(3).strip('\n')
        lines = body.split('\n')
        indent = min((len(l) - len(l.lstrip()) for l in lines if l.strip()), default=0)
        body = '\n'.join(l[indent:] if l.strip() else '' for l in lines)
        for n in nums:
            out[n] = body
    return out

def block(num, body):
    inner = '\n'.join(('      ' + l) if l else '' for l in body.split('\n'))
    return ('<!-- guide-notes:%s -->\n' % num
            + '    <details class="guide-notes"><summary>User Guide Notes<small>how to use this section</small></summary>\n'
            + '      <div class="guide-body">\n' + inner + '\n      </div>\n'
            + '    </details>\n    <!-- /guide-notes:%s -->' % num)

def sync(write=True):
    guide = io.open(GUIDE, encoding='utf-8').read()
    mapper = io.open(MAPPER, encoding='utf-8').read()
    bodies = guide_sections(guide)
    changed, missing = [], []
    for m in reversed(list(re.finditer(r'<span class="sec-num">(\d{2})</span>', mapper))):   # last section first: the offsets before it stay valid
        num = m.group(1)
        if num not in bodies:
            missing.append(num)
            continue
        new = block(num, bodies[num])
        start = m.end()
        nxt = mapper.find('<section', start)
        region = mapper[start:nxt if nxt > 0 else len(mapper)]
        existing = re.search(r'<!-- guide-notes:%s -->.*?<!-- /guide-notes:%s -->' % (num, num), region, flags=re.S)
        if existing:
            if existing.group(0) == new:
                continue
            region2 = region[:existing.start()] + new + region[existing.end():]
        else:
            note = re.search(r'<p class="sec-note">.*?</p>', region, flags=re.S)
            if not note:
                missing.append(num + ' (no sec-note to replace)')
                continue
            region2 = region[:note.start()] + new + region[note.end():]
        mapper = mapper[:start] + region2 + mapper[start + len(region):]
        changed.append(num)
    changed.reverse()
    if changed and write:
        io.open(MAPPER, 'w', encoding='utf-8').write(mapper)
    return changed, missing

if __name__ == '__main__':
    changed, missing = sync()
    print('guide notes:', ('updated sections ' + ', '.join(changed)) if changed else 'up to date', ('; no guide text for ' + ', '.join(missing)) if missing else '')
    sys.exit(1 if missing else 0)
