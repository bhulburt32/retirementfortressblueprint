/* v179: the status-quo stress page ("If Nothing Changes and Something Goes Wrong") follows the status-quo
   projection directly and precedes "The Cost of Long Term Care". Runs on the Smith sample deck. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1000);
  await p.click('#expandAll'); await p.waitForTimeout(500);
  const [pop] = await Promise.all([p.waitForEvent('popup'), p.click('#makeDeck')]); await pop.waitForLoadState(); await pop.waitForTimeout(3000);
  const titles = await pop.$$eval('.sl', els => els.map(s => (s.querySelector('h1,h2,.ttl') || s).textContent.replace(/\s+/g, ' ').trim().slice(0, 60)));
  const find = t => titles.findIndex(x => x.indexOf(t) >= 0);
  const iSQ = find('If Nothing Changes'), iStress = find('Something Goes Wrong'), iLTC = find('Cost of Long Term Care');
  console.log('slides:', titles.length, '| status quo', iSQ, '| stress', iStress, '| LTC', iLTC);
  const ok = iSQ >= 0 && iStress === iSQ + 1 && iLTC === iStress + 1;
  console.log(ok ? 'PASS order: status quo → stress → LTC' : 'FAIL slide order');
  console.log('ERRORS:', errs.length ? errs : 'none'); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
