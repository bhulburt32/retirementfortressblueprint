const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const end = () => p.evaluate(() => [...document.querySelectorAll('#scnGrid .scn-card')].map(c => [...c.querySelectorAll('dl div')].find(x => x.querySelector('dt') && x.querySelector('dt').textContent.startsWith('Assets at end')).querySelector('dd').textContent));
  console.log('default chips:', await p.evaluate(() => [...document.querySelectorAll('#cashDestList label.def')].map(l => l.textContent.trim())), '| hint:', await p.evaluate(() => document.getElementById('cashDestHint').textContent.slice(0, 120)));
  console.log('no salary end:', JSON.stringify(await end()));
  await p.fill('#salaryC', '200000'); await p.fill('#retireC', '2034-06'); await p.waitForTimeout(700);
  console.log('salary, default (cash):', JSON.stringify(await end()));
  await p.click('#cashDestList input[data-cash]'); await p.waitForTimeout(700);
  console.log('first chip picked:     ', JSON.stringify(await end()), '| def chips now:', await p.evaluate(() => document.querySelectorAll('#cashDestList label.def').length));
  console.log('ERRORS:', errs.length ? errs : 'none'); await b.close();
})();
