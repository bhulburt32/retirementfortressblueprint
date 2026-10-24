const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html',{waitUntil:'load'}); await p.waitForTimeout(500); await p.click('#expandAll'); await p.waitForTimeout(300);
  const st0 = await p.$eval('#deckDraft', b => b.classList.contains('on'));
  await p.click('#deckFinal'); await p.waitForTimeout(200);
  const json = await p.$eval('#caseJson', e => e.value); const saved = JSON.parse(json).planStatus;
  const msg = await p.$eval('#deckStatusMsg', e => e.textContent);
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 20000 }), p.click('#makeDeck')]);
  await pop.waitForLoadState(); await pop.waitForTimeout(2000);
  const title = await pop.title();
  const cover = await pop.$eval('.sl[data-n="1"]', s => s.textContent.includes('FINAL PLAN'));
  const stamps = await pop.$$eval('.sl', ss => ss.filter(s => /FINAL/.test(s.textContent)).length);
  const total = await pop.$$eval('.sl', ss => ss.length);
  await pop.$eval('.sl[data-n="1"]', s => s.scrollIntoView());
  const sl = await pop.$$('.sl'); await sl[0].screenshot({ path: 'final-cover.png' }); await sl[5].screenshot({ path: 'final-6.png' });
  // reload from the saved case: status should come back final
  const cont = await ctx.newPage(); await cont.goto('file://' + process.cwd() + '/preview-smith.html',{waitUntil:'load'}); await cont.waitForTimeout(500); await cont.click('#expandAll'); await cont.waitForTimeout(300);
  await cont.evaluate(j => window.__rfb.loadCaseJson(j), json); await cont.waitForTimeout(800);
  const reloaded = await cont.$eval('#deckFinal', b => b.classList.contains('on')).catch(()=>'n/a');
  console.log({ st0, saved, msg, title, cover, stamps, total, reloaded }); console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
