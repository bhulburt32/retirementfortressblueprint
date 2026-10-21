/* The claiming optimizer always shows six scenarios in a fixed order (four for a single person), each with its
   true rank among every combination tested; the Social Security report follows the same order. Smith sample. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext(); const p = await ctx.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1000);
  await p.click('#expandAll'); await p.waitForTimeout(500);
  const rows = await p.$$eval('#ssoTable tbody tr', trs => trs.map(tr => { const td = tr.querySelectorAll('td'); return { n: td[0].firstChild.textContent, rank: td[0].querySelector('small').textContent, strat: td[1].querySelector('b').textContent, lifetime: td[2].querySelector('b').textContent, note: td[1].querySelector('small').textContent.slice(0, 50) }; }));
  console.log('rows:', rows.length); rows.forEach(r => console.log(' ', r.n, '|', r.strat, '|', r.lifetime, '|', r.rank, '|', r.note));
  const tags = rows.map(r => r.strat.split(' — ')[1] || '');
  const want = [/^Highest lifetime benefit$/, /^File late: both at 70/, /^File early: both at 62/, / early at 62, .* late at 70/, / late at 70, .* early at 62/, /^File at full retirement age: both at FRA/];   // a label may add '(an age already past files at the earliest open)'
  const order = rows.length === 6 && want.every((w, k) => w.test(tags[k]));
  const lines = await p.$$eval('#ssoSvg polyline', e => e.length), legend = await p.$$eval('#ssoLegend .pj-key', e => e.length);
  console.log('order ok:', order, '| chart lines:', lines, '| legend keys:', legend, '| first cell is numeric-only rank? ', /^\d$/.test(rows[0].n));
  const be = await p.$$eval('#ssoBeTable thead th', th => th.map(t => t.textContent)); console.log('break-even heads:', be.join(' | '));
  const el = await p.$('#ssoTable'); await el.screenshot({ path: '_sso6.png' });
  // the report
  const [pop] = await Promise.all([ctx.waitForEvent('page'), p.click('#makeSS')]); await pop.waitForLoadState(); await pop.waitForTimeout(1500);
  const heads = await pop.$$eval('.scen:not(.plan) h4', h => h.map(x => x.textContent.slice(0, 70)));
  console.log('report scenarios:', heads.length); heads.forEach(h => console.log('  ', h));
  const pages = await pop.$$eval('section.page h2', h => h.map(x => x.textContent.slice(0, 50))); console.log('report pages:', pages.join(' | '));
  const bars = await pop.$$eval('svg.bar', s => s.map(x => x.querySelectorAll('rect').length)); console.log('bar charts (bars each):', bars.join(','));
  const ok = order && heads.length === 6 && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); console.log('ERRORS:', errs.length ? errs : 'none'); await b.close(); process.exit(ok ? 0 : 1);
})();
