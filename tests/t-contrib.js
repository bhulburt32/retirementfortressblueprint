const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const st = () => p.evaluate(() => ({ end: [...document.querySelectorAll('#scnGrid .scn-card')].map(c => [...c.querySelectorAll('dl div')].find(x => x.querySelector('dt') && x.querySelector('dt').textContent.startsWith('Assets at end')).querySelector('dd').textContent), tax: [...document.querySelectorAll('#scnGrid .scn-card')].map(c => [...c.querySelectorAll('dl div')].find(x => x.querySelector('dt') && x.querySelector('dt').textContent.startsWith('Lifetime')).querySelector('dd').textContent) }));
  await p.fill('#salaryC', '120000'); await p.fill('#retireC', '2032-06'); await p.fill('#contribC', '6%'); await p.fill('#employerC', '4%'); await p.waitForTimeout(700);
  console.log('salary, no destination   ', JSON.stringify(await st()));
  console.log('empFoot:', await p.evaluate(() => document.getElementById('empFoot').textContent.replace(/\s+/g, ' ').slice(0, 300)));
  await p.selectOption('#contribAcctC', '15'); await p.waitForTimeout(700);   // Jeff's IRA pre-tax
  console.log('employee→IRA             ', JSON.stringify(await st()));
  await p.selectOption('#contribAcctC', '17'); await p.waitForTimeout(700);   // Roth IRA
  console.log('employee→Roth            ', JSON.stringify(await st()));
  await p.selectOption('#employerAcctC', '15'); await p.waitForTimeout(700);
  console.log('employee→Roth, employer→IRA', JSON.stringify(await st()));
  console.log('ERRORS:', errs.length ? errs : 'none'); await b.close();
})();
