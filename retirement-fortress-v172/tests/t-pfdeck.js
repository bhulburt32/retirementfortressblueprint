const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext(); const p = await ctx.newPage({ viewport: { width: 1500, height: 1000 } }); const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html',{waitUntil:'load'}); await p.waitForTimeout(500); await p.click('#expandAll'); await p.waitForTimeout(300);
  if(!process.env.NOPF){ await p.setInputFiles('#pfFile', (process.env.PROPOSAL_PDF || 'samples/portfolio-proposal.pdf')); await p.waitForTimeout(8000); }
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 20000 }), p.click('#makeDeck')]);
  await pop.waitForLoadState('load'); await pop.waitForTimeout(2500);
  const n = await pop.$$eval('.sl', s => s.length);
  const titles = await pop.$$eval('.sl', ss => ss.map((s, k) => (k + 1) + ': ' + (s.querySelector('.tx p') ? [...s.querySelectorAll('.tx')].slice(0, 3).map(t => t.textContent.trim().slice(0, 60)).join(' | ') : '')));
  const over = await pop.evaluate(() => { let out = []; document.querySelectorAll('.sl').forEach((sl, k) => { sl.querySelectorAll('.tx').forEach(t => { const r = t.getBoundingClientRect(); let maxB = 0; t.querySelectorAll('p').forEach(pp => { maxB = Math.max(maxB, pp.getBoundingClientRect().bottom); }); if(maxB - r.bottom > 10) out.push('slide ' + (k + 1) + ' over ' + Math.round(maxB - r.bottom) + 'px: ' + t.textContent.trim().slice(0, 50)); }); }); return out; });
  const tbl = await pop.evaluate(() => [...document.querySelectorAll('.sl')].map((sl, k) => { const t = sl.querySelectorAll('table.rt'); let bad = []; t.forEach(tb => { const hb = tb.closest('.hb'); if(tb.scrollHeight > hb.clientHeight + 4 || tb.scrollWidth > hb.clientWidth + 4) bad.push(Math.round(tb.scrollHeight) + '/' + Math.round(hb.clientHeight) + ' w' + Math.round(tb.scrollWidth) + '/' + Math.round(hb.clientWidth)); }); return bad.length ? 'slide ' + (k + 1) + ': ' + bad.join(', ') : null; }).filter(Boolean));
  console.log('slides', n); console.log(titles.filter(t => /Portfolio Today|Accounts and Holdings|Stress Tests and|Sectors, Regions|Largest Positions/.test(t)).join('\n'));
  console.log('text overflow:', over); console.log('table overflow:', tbl);
  const sl = await pop.$$('.sl');
  for (const [i, s] of sl.entries()) { const t = titles[i]; if (/Portfolio Today|Accounts and Holdings \(1|Stress Tests and|Sectors, Regions|Largest Positions/.test(t)) await s.screenshot({ path: 'pfdeck-' + (i + 1) + '.png' }); }
  console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
