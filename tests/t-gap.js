/* Section 05, Income Gap: the Largest gap tile names the year with the biggest shortfall in the series (it used to land
   on the last year with any gap), the note agrees, and the Plan deck's Your Income Gap page shows the same figure. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await b.newContext(); const p = await ctx.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.click('#expandAll'); await p.waitForTimeout(500);
  const num = s => +String(s).replace(/[^0-9.\-]/g, '') || 0;
  // a large expense that ends in 2035 makes the gap peak early, not in the last year — the shape the old search got wrong
  const S0 = await p.evaluate(() => window.__rfb.gapSeries());
  console.log('as loaded: largest', Math.round(Math.max(...S0.gaps)), 'in', S0.years[S0.gaps.indexOf(Math.max(...S0.gaps))]);
  const line = '#budBody tr[data-bud="eo:4"]';   // Miscellaneous (a Want)
  await p.fill(line + ' [data-bk="amt"]', '20000'); await p.$eval(line + ' [data-bk="amt"]', e => e.dispatchEvent(new Event('input', { bubbles: true })));
  await p.fill(line + ' [data-bk="end"]', '2035-12'); await p.$eval(line + ' [data-bk="end"]', e => e.dispatchEvent(new Event('change', { bubbles: true }))); await p.waitForTimeout(1200);
  const S = await p.evaluate(() => window.__rfb.gapSeries());
  const maxGap = Math.max(...S.gaps), maxYear = S.years[S.gaps.indexOf(maxGap)], lastGapYear = S.years[S.gaps.map((g, n) => g > 0.5 ? n : -1).filter(n => n >= 0).pop()];
  const tiles = await p.$$eval('#gapTiles > div', ds => Object.fromEntries(ds.map(d => [d.querySelector('dt').textContent.trim(), { v: d.querySelector('dd').textContent.trim(), s: d.querySelector('small').textContent.trim() }])));
  console.log('series: largest', Math.round(maxGap), 'in', maxYear, '| last year with a gap', lastGapYear, '| tile:', JSON.stringify(tiles['Largest gap']));
  if(Math.abs(num(tiles['Largest gap'].v) - Math.round(maxGap)) > 1) errs.push('the Largest gap tile should show the biggest shortfall: ' + tiles['Largest gap'].v + ' vs ' + Math.round(maxGap));
  if(!tiles['Largest gap'].s.startsWith(String(maxYear))) errs.push('the Largest gap tile should name the year of the biggest shortfall (' + maxYear + '): ' + tiles['Largest gap'].s);
  if(!(num(tiles['Largest gap'].v) >= num(tiles['Gap at full retirement'].v) - 1)) errs.push('the largest gap cannot be smaller than the gap at full retirement');
  if(maxYear === lastGapYear) errs.push('the check needs the peak before the last year with a gap; the dated expense did not take');
  const note = await p.$eval('#gapNote', e => e.textContent);
  if(!note.includes('widening to ' + tiles['Largest gap'].v + ' in ' + maxYear)) errs.push('the note should name the same largest gap and year');
  // the deck page agrees
  await p.selectOption('#reportScn', await p.$eval('#scnTabs .scn-tab.on', e => e.dataset.scn)); await p.waitForTimeout(600);
  const [dk] = await Promise.all([ctx.waitForEvent('page', { timeout: 30000 }), p.click('#makeDeck')]); await dk.waitForLoadState('load'); await dk.waitForTimeout(1200);
  const deck = await dk.evaluate(() => { const sl = [...document.querySelectorAll('.sl')].filter(s => /Your Income Gap/.test(s.textContent)).pop(); return sl ? sl.textContent.replace(/\s+/g, ' ') : null; });
  const m = deck && deck.match(/Largest gap\s*(\$[\d,]+)\s*(\d{4})/);
  console.log('deck tile:', m ? m[1] + ' in ' + m[2] : null);
  if(!m || m[1] !== tiles['Largest gap'].v || m[2] !== String(maxYear)) errs.push('the deck page should show the same largest gap and year');
  console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
