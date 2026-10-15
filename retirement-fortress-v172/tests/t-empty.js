const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview.html',{waitUntil:'load'}); await p.waitForTimeout(800);
  const r = await p.evaluate(() => ({ first: document.getElementById('clientFirst').value, salary: document.getElementById('salaryC').value, needs: document.getElementById('needs').value, accounts: document.querySelectorAll('#acctBody tr').length, debts: document.querySelectorAll('#debtBody tr').length, pensions: document.querySelectorAll('#penBody tr, #pensionBody tr').length, prep: document.getElementById('prepDate').value, banner: (document.getElementById('preparedFor')||{}).textContent, caseLen: document.getElementById('caseJson').value.length }));
  console.log(JSON.stringify(r)); console.log('ERRORS:', errs.length ? errs : 'none');
  const m = await p.$('.masthead'); await m.screenshot({ path: 'mast-empty.png' });
  const p2 = await b.newPage({ viewport: { width: 1400, height: 900 } }); const e2=[]; p2.on('pageerror', e => e2.push(String(e)));
  await p2.goto('file://' + process.cwd() + '/preview-smith.html',{waitUntil:'load'}); await p2.waitForTimeout(800);
  console.log('smith preview:', await p2.evaluate(() => document.getElementById('clientFirst').value + ' ' + document.querySelectorAll('#acctBody tr').length + ' accounts'), 'ERRORS:', e2.length ? e2 : 'none');
  await b.close();
})();
