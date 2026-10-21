const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1000);
  await p.click('#expandAll'); await p.waitForTimeout(500);
  console.log('sq sens boxes:', await p.evaluate(() => [...document.querySelectorAll('#sqSens .ltc-scn')].map(d => d.querySelector('h4').textContent + ' → ' + d.querySelector('[id$="Note"]').textContent.slice(0, 90))));
  console.log('sq svg paths:', await p.evaluate(() => [...document.querySelectorAll('#sqSens svg')].map(s => s.querySelectorAll('rect').length)));
  console.log('plan sens boxes:', await p.evaluate(() => document.querySelectorAll('#sens .ltc-scn').length));
  const el = await p.$('#sqSens'); await el.screenshot({ path: '_sqsens.png' });
  // findings report
  const [pop] = await Promise.all([p.waitForEvent('popup'), p.click('#makeTakeHome')]); await pop.waitForLoadState(); await pop.waitForTimeout(2000);
  const info = await pop.evaluate(() => ({ sheets: [...document.querySelectorAll('.sheet')].map(s => Math.round(s.getBoundingClientRect().height)), three: document.querySelectorAll('.three svg').length, res: [...document.querySelectorAll('.three .res')].map(r => r.textContent) }));
  console.log('take-home sheets (px, 11in=1056):', JSON.stringify(info));
  await pop.setViewportSize({ width: 900, height: 1200 }); const sh = await pop.$$('.sheet'); await sh[1].screenshot({ path: '_takehome2.png' });
  console.log('ERRORS:', errs.length ? errs : 'none'); await b.close();
})();
