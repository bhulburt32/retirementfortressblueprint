const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext(); const pg = await ctx.newPage({ viewport: { width: 1500, height: 1000 } }); const errs=[]; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto('file://' + process.cwd() + '/preview-smith.html',{waitUntil:'load'}); await pg.waitForTimeout(500); await pg.click('#expandAll'); await pg.waitForTimeout(300);
  await pg.setInputFiles('#pfFile', (process.env.PROPOSAL_PDF || 'samples/portfolio-proposal.pdf')); await pg.waitForTimeout(8000);
  const json = await pg.$eval('#caseJson', e => e.value);
  const regions = await pg.evaluate(() => JSON.parse(document.getElementById('caseJson').value).portfolio.analysis.regions.map(r => r.name).join(', '));
  console.log('regions:', regions, '| case bytes', json.length);
  // reload in a fresh page from the saved case
  const p2 = await ctx.newPage({ viewport: { width: 1500, height: 1000 } }); p2.on('pageerror', e => errs.push('p2 ' + String(e)));
  await p2.goto('file://' + process.cwd() + '/preview-smith.html',{waitUntil:'load'}); await p2.waitForTimeout(500); await p2.click('#expandAll'); await p2.waitForTimeout(300);
  await p2.$eval('#caseJson', (e, v) => { e.value = v; }, json); await p2.click('#loadCase'); await p2.waitForTimeout(1000);
  console.log('reloaded tiles:', await p2.$eval('#pfOut', e => e.querySelectorAll('.tax-tiles dd').length), 'rows:', await p2.$eval('#pfOut', e => e.querySelectorAll('.pf-hold tbody tr').length), 'clear visible:', await p2.$eval('#pfClear', e => !e.hidden));
  await p2.click('#pfClear'); await p2.waitForTimeout(300);
  console.log('after clear:', await p2.$eval('#pfOut', e => e.innerHTML.length), JSON.parse(await p2.$eval('#caseJson', e => e.value)).portfolio);
  // new case resets too
  await pg.click('#newCase').catch(() => {}); await pg.waitForTimeout(500);
  console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
