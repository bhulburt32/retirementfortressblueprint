/* v184: the two donuts under the status-quo tiles — qualified vs non-qualified and at risk vs not at risk — add up
   to the accounts' total and carry the shares. Smith sample. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1000);
  await p.click('#expandAll'); await p.waitForTimeout(500);
  const cards = await p.$$eval('#sqPies .pie', cs => cs.map(c => ({ title: c.querySelector('h4').textContent, pct: [...c.querySelectorAll('.pk b')].map(b => parseInt(b.textContent)), amounts: [...c.querySelectorAll('.pk small')].map(s => +(s.textContent.match(/\$([\d,]+)/) || [0, '0'])[1].replace(/,/g, '')), slices: c.querySelectorAll('svg path, svg circle').length })));
  const total = await p.evaluate(() => Math.round(window.__rfb.accounts().reduce((a, x) => a + (x.val || 0), 0)));
  console.log('total', total); cards.forEach(c => console.log(' ', c.title, '|', c.pct.join('/'), '|', c.amounts.join(' + '), '=', c.amounts.reduce((a, v) => a + v, 0), '| slices', c.slices));
  const ok = cards.length === 2 && cards.every(c => Math.abs(c.amounts[0] + c.amounts[1] - total) <= 2 && c.pct[0] + c.pct[1] >= 99 && c.pct[0] + c.pct[1] <= 101 && c.slices >= 2) && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); console.log('ERRORS:', errs.length ? errs : 'none'); await b.close(); process.exit(ok ? 0 : 1);
})();
