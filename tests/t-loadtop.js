const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview.html', { waitUntil: 'load' }); await p.waitForTimeout(800);
  console.log('empty page client:', JSON.stringify(await p.evaluate(() => document.getElementById('clientFirst').value)), '| header button:', await p.$eval('#loadCaseTop', e => e.textContent));
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#loadCaseTop')]);
  await fc.setFiles(process.env.CASE_JSON || 'samples/default-case-smith.json'); await p.waitForTimeout(1500);
  const after = await p.evaluate(() => ({ client: document.getElementById('clientFirst').value, accounts: document.querySelectorAll('#acctBody tr[data-id]').length, prepared: document.getElementById('preparedFor').textContent, msg: document.getElementById('caseMsg').textContent.slice(0, 80) }));
  console.log('after load:', JSON.stringify(after));
  const ok = after.client === 'Jeff' && after.accounts > 5 && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); console.log('ERRORS:', errs.length ? errs : 'none'); await b.close(); process.exit(ok ? 0 : 1);
})();
