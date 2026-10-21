const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ acceptDownloads: true }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dlCase')]);
  const path = await dl.path(); const txt = fs.readFileSync(path, 'utf8');
  console.log('file:', dl.suggestedFilename(), 'bytes', txt.length, '| msg:', await p.evaluate(() => document.getElementById('caseMsg').textContent));
  console.log('head:', txt.split('\n')[0].slice(0, 90));
  // round trip: new case, upload the downloaded file
  await p.click('#newCase'); await p.waitForTimeout(200); await p.click('#newCase'); await p.waitForTimeout(500);
  fs.copyFileSync(path, '_case-dl.txt'); await p.setInputFiles('#caseFile', '_case-dl.txt'); await p.waitForTimeout(1500);
  console.log('after upload:', await p.evaluate(() => document.getElementById('caseMsg').textContent + ' | ' + document.getElementById('clientFirst').value + ' | accounts ' + document.querySelectorAll('#acctBody tr[data-id]').length));
  console.log('ERRORS:', errs.length ? errs : 'none'); await b.close();
})();
