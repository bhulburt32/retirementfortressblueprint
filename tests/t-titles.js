const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await b.newContext(); const p = await ctx.newPage({ viewport: { width: 1500, height: 1000 } });
  await p.goto('file://' + process.cwd() + '/preview.html',{waitUntil:'load'}); await p.waitForTimeout(500); await p.click('#expandAll'); await p.waitForTimeout(300);
  if(!process.env.NOPF){ await p.setInputFiles('#pfFile', 'nitro2/proposal.pdf'); await p.waitForTimeout(8000); }
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 20000 }), p.click('#makeDeck')]);
  await pop.waitForLoadState('load'); await pop.waitForTimeout(2000);
  const t = await pop.evaluate(() => [...document.querySelectorAll('.sl')].map((sl, k) => (k + 1) + ': ' + [...sl.querySelectorAll('.tx')].map(t => t.textContent.trim()).filter(x => x.length > 3 && !/Illustrative only|DRAFT|altofinancial/.test(x)).slice(0, 2).map(x => x.slice(0, 48)).join(' | ')));
  console.log(t.slice(30).join('\n'));
  await b.close();
})();
