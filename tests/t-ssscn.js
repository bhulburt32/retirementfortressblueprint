const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const row = () => p.evaluate(() => [...document.querySelectorAll('#scnGrid .scn-card')].map(c => { const d = [...c.querySelectorAll('dl div')].find(x => x.querySelector('dt') && x.querySelector('dt').textContent.startsWith('Social Security')); return d.querySelector('dd').textContent; }));
  const endRow = () => p.evaluate(() => [...document.querySelectorAll('#scnGrid .scn-card')].map(c => { const d = [...c.querySelectorAll('dl div')].find(x => x.querySelector('dt') && x.querySelector('dt').textContent.startsWith('Assets at end')); return d.querySelector('dd').textContent; }));
  console.log('start:', await row(), await endRow());
  console.log('hint:', await p.evaluate(() => document.getElementById('adjSsHint').textContent.slice(0, 120)));
  console.log('opts:', await p.evaluate(() => document.getElementById('adjSsC').options.length + ' / spouse disabled ' + document.getElementById('adjSsS').disabled));
  await p.selectOption('#adjSsC', '70'); await p.waitForTimeout(700);
  console.log('A client 70:', await row(), await endRow());
  console.log('hint:', await p.evaluate(() => document.getElementById('adjSsHint').textContent.slice(0, 160)));
  console.log('sec04 foot:', await p.evaluate(() => document.getElementById('ssFoot').textContent.slice(0, 140)));
  await p.click('[data-scn="1"]'); await p.waitForTimeout(700);
  console.log('viewing B, control:', await p.evaluate(() => document.getElementById('adjSsC').value || '(blank)'), await row());
  await p.selectOption('#adjSsS', '62'); await p.waitForTimeout(700);
  console.log('B spouse 62:', await row());
  await p.click('[data-scn="0"]'); await p.waitForTimeout(700);
  console.log('back to A, control:', await p.evaluate(() => document.getElementById('adjSsC').value), await row());
  // save/load round trip
  const json = await p.evaluate(() => document.getElementById('caseJson').value);
  const o = JSON.parse(json); console.log('saved scenarios ssC/ssS:', (o.scenarios || []).map(s => s && s.incomeAdj ? [s.incomeAdj.ssC, s.incomeAdj.ssS] : null), 'top incomeAdj', o.incomeAdj && [o.incomeAdj.ssC, o.incomeAdj.ssS]);
  await p.click('#newCase'); await p.waitForTimeout(600);
  console.log('after new case control:', await p.evaluate(() => document.getElementById('adjSsC').value || '(blank)'));
  await p.evaluate(j => window.__rfb.loadCaseJson(j), json); await p.waitForTimeout(1000);
  console.log('after reload:', await row(), 'control', await p.evaluate(() => document.getElementById('adjSsC').value));
  // deck still builds
  const [pop] = await Promise.all([p.waitForEvent('popup'), p.click('#makeDeck')]); await pop.waitForLoadState(); await pop.waitForTimeout(2500);
  console.log('deck pages:', await pop.evaluate(() => document.querySelectorAll('.slide').length), '| SS mention:', await pop.evaluate(() => (document.body.textContent.match(/claim[^.]{0,80}70/) || [''])[0].slice(0, 100)));
  await p.screenshot({ path: '_ss-shot.png', clip: { x: 0, y: 0, width: 1500, height: 10 } });
  console.log('ERRORS:', errs.length ? errs : 'none'); await b.close();
})();
