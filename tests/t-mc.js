/* Section 19 Monte Carlo: a seeded run on the Smith case prints its figures; the tiles, the fan chart and the
   strip row agree; a change to the case marks the result stale; another scenario starts unrun. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await b.newContext({ acceptDownloads: true }); const p = await ctx.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1200);
  await p.click('#expandAll'); await p.waitForTimeout(500);
  const txt = async sel => (await p.$eval(sel, e => e.textContent)).replace(/\s+/g, ' ').trim();
  console.log('before:', await txt('#mcStatus'));
  if(!/Not run yet/.test(await txt('#mcStatus'))) errs.push('the block should say it has not run yet');
  await p.selectOption('#mcTrials', '100'); await p.fill('#mcSeed', '7'); await p.$eval('#mcSeed', e => e.dispatchEvent(new Event('change', { bubbles: true }))); await p.waitForTimeout(300);
  const t0 = Date.now(); await p.click('#mcRun');
  await p.waitForFunction(() => !window.__rfb.mcRunning() && window.__rfb.mcResult(), null, { timeout: 180000 });
  const R = await p.evaluate(() => { const r = window.__rfb.mcResult(); return { trials: r.trials, seed: r.seed, success: r.success, endP10: Math.round(r.endP10), endP50: Math.round(r.endP50), endP90: Math.round(r.endP90), depShare: r.depShare, depMedian: r.depMedian && r.depMedian.year, ms: r.ms, bands: r.bands.length, base: r.base.length }; });
  console.log('result (seed 7, 100 trials):', JSON.stringify(R), '| wall', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  if(R.trials !== 100 || R.seed !== 7) errs.push('the run should use the trials and seed set');
  if(!(R.success >= 0 && R.success <= 1)) errs.push('the success rate should be a share');
  if(!(R.endP10 <= R.endP50 && R.endP50 <= R.endP90)) errs.push('the end-of-plan percentiles should be ordered');
  if(R.bands !== R.base) errs.push('one band per plan year');
  const tiles = await p.$$eval('#mcTiles div', ds => ds.map(d => d.querySelector('dt').textContent + ': ' + d.querySelector('dd').textContent));
  console.log('tiles:', JSON.stringify(tiles));
  if(tiles.length !== 5 || tiles[0] !== 'Probability of success: ' + Math.round(R.success * 100) + '%') errs.push('the tiles should lead with the probability of success');
  const chart = await p.evaluate(() => ({ polylines: document.querySelectorAll('#mcSvg polyline').length, bands: document.querySelectorAll('#mcSvg polygon').length }));
  console.log('chart:', JSON.stringify(chart));
  if(chart.polylines !== 3 || chart.bands !== 2) errs.push('the fan chart should draw two bands, the median, the plan line and the current course\u2019s median');
  const SQ = await p.evaluate(() => { const q = window.__rfb.mcResult().sq; return q && { trials: q.trials, success: q.success, endP10: Math.round(q.endP10), endP50: Math.round(q.endP50), endP90: Math.round(q.endP90), depShare: q.depShare, depMedian: q.depMedian && q.depMedian.year, base: Math.round(q.base[q.base.length - 1]) }; });
  console.log('current course (same draws):', JSON.stringify(SQ));
  if(!SQ || SQ.trials !== R.trials || !(SQ.success >= 0 && SQ.success <= 1) || !(SQ.endP10 <= SQ.endP50 && SQ.endP50 <= SQ.endP90)) errs.push('the current course should run on every trial with ordered percentiles');
  const cmp = await p.$$eval('#mcCompare tbody tr', trs => trs.map(t => t.textContent.replace(/\s+/g, ' ').trim()));
  console.log('comparison table:', JSON.stringify(cmp));
  if(cmp.length !== 5 || cmp[0] !== 'Probability of success' + Math.round(SQ.success * 100) + '%' + Math.round(R.success * 100) + '%') errs.push('the comparison table should set the current course beside the scenario');
  const strip = await p.evaluate(() => [...document.querySelectorAll('#scnGrid .scn-card')].map(c => { const d = [...c.querySelectorAll('dl div')].find(x => /Monte Carlo success/.test(x.textContent)); return d ? d.querySelector('dd').textContent.replace(/\s+/g, ' ').trim() : null; }));
  console.log('strip row:', JSON.stringify(strip));
  if(!/^\d+%100 trials, same draws$/.test(strip[0] || '')) errs.push('the baseline column should show the current course on the same draws');
  const act = await p.evaluate(() => document.querySelector('#scnGrid .scn-card.on').querySelector('dd') && [...document.querySelector('#scnGrid .scn-card.on').querySelectorAll('dl div')].find(x => /Monte Carlo success/.test(x.textContent)).querySelector('dd').textContent.replace(/\s+/g, ' ').trim());
  if(!new RegExp('^' + Math.round(R.success * 100) + '%\\s*100 trials$').test(act)) errs.push('the active scenario’s strip cell should carry the same rate and the trial count: ' + act);
  if(strip.filter(x => x === 'not run').length !== 2) errs.push('the other two scenarios should read not run');
  // the disclosure: beneath the chart, and in the Important Disclosures at the foot of the page
  const disc = await p.evaluate(() => ({ block: /Monte Carlo Analysis\. The Monte Carlo analysis is a hypothetical illustration/.test(document.getElementById('mcOut').textContent), foot: [...document.querySelectorAll('#rfbDiscBody h3')].map(h => h.textContent).includes('Monte Carlo Analysis') }));
  console.log('disclosure:', JSON.stringify(disc));
  if(!disc.block || !disc.foot) errs.push('the Monte Carlo disclosure should sit beneath the chart and in the Important Disclosures');
  // switching scenarios is not a change to the case: the result stays fresh
  const k0 = +(await p.$eval('#scnTabs .scn-tab.on', e => e.getAttribute('data-scn'))), k1 = (k0 + 1) % 3;
  await p.click('#scnTabs .scn-tab[data-scn="' + k1 + '"]'); await p.waitForTimeout(900);
  const other = await txt('#mcStatus'); console.log('scenario', k1, ':', other.slice(0, 60));
  if(!/Not run yet/.test(other)) errs.push('another scenario should start unrun');
  await p.click('#scnTabs .scn-tab[data-scn="' + k0 + '"]'); await p.waitForTimeout(900);
  const back = await p.evaluate(() => ({ kept: !!window.__rfb.mcResult(), fresh: !/run it again/.test(document.getElementById('mcStatus').textContent) }));
  if(!back.kept || !back.fresh) errs.push('switching scenarios and back should keep the result fresh: ' + JSON.stringify(back));
  const rs0 = +(await p.$eval('#reportScn', e => e.value));
  if(rs0 !== k0){ const hint = await txt('#mcStatus'); if(!/run the analysis there/.test(hint)) errs.push('the block should say the reports build from another scenario without a result'); }
  await p.selectOption('#reportScn', String(k0)); await p.waitForTimeout(900);
  // the reports carry the result and the disclosure while it is fresh: the findings report's stress table row…
  const [th] = await Promise.all([p.waitForEvent('popup'), p.click('#makeTakeHome')]); await th.waitForLoadState(); await th.waitForTimeout(1500);
  const thInfo = await th.evaluate(() => ({ row: [...document.querySelectorAll('tr')].some(tr => /Many possible markets \(Monte Carlo\)/.test(tr.textContent) && /% of trials reach \d{4}/.test(tr.textContent)), disc: [...document.querySelectorAll('.rfb-disc h3')].map(h => h.textContent).includes('Monte Carlo Analysis'), sheets: [...document.querySelectorAll('.sheet')].map(s => Math.round(s.scrollHeight)) }));
  console.log('findings report:', JSON.stringify(thInfo));
  if(!thInfo.row || !thInfo.disc) errs.push('the findings report should carry the Monte Carlo row and the disclosure');
  if(thInfo.sheets.some(h => h > 1056 + 6)) errs.push('a findings page overflows: ' + thInfo.sheets.join(','));
  await th.close();
  // …and the Plan deck's Many Possible Markets page, with no text box overflowing
  const [dk] = await Promise.all([ctx.waitForEvent('page', { timeout: 30000 }), p.click('#makeDeck')]); await dk.waitForLoadState('load'); await dk.waitForTimeout(1200);
  const dkInfo = await dk.evaluate(() => { const sl = [...document.querySelectorAll('.sl')].filter(s => /Many Possible Markets/.test(s.textContent)).pop(); /* the Contents slide lists the title too */ const tx = sl ? [...sl.querySelectorAll('.tx')] : [];
    return { slide: !!sl, svg: !!(sl && sl.querySelector('svg')), prob: !!(sl && /Probability of success/.test(sl.textContent)), over: tx.filter(e => e.scrollHeight - e.clientHeight > 6).length, disc: /Monte Carlo Analysis/.test(document.body.textContent), foot: (sl.textContent.match(/See Important Disclosures, (pages [\d\u2013]+ and [\d\u2013]+)\./) || [])[1], n: document.querySelectorAll('.sl').length, discSlide: (() => { const d = [...document.querySelectorAll('.sl')].filter(s => /Monte Carlo Analysis/.test(s.textContent)).pop(); return d && /Important Disclosures/.test(d.textContent) && !/Contents/.test(d.textContent.slice(0, 40)) ? { over: [...d.querySelectorAll('.tx')].filter(e => e.scrollHeight - e.clientHeight > 6).length } : null; })() }; });
  console.log('deck:', JSON.stringify(dkInfo));
  if(!dkInfo.slide || !dkInfo.svg || !dkInfo.prob || !dkInfo.disc) errs.push('the deck should carry the Monte Carlo page with its chart, tiles and disclosure');
  if(!dkInfo.discSlide || dkInfo.discSlide.over) errs.push('the deck should end with a Monte Carlo disclosure page that fits');
  if(dkInfo.foot !== 'pages 3\u20134 and ' + (dkInfo.n - 2) + '\u2013' + dkInfo.n) errs.push('the footer should name the front disclosure pages and the three at the end of the deck: ' + dkInfo.foot);
  if(dkInfo.over) errs.push('text overflows on the Monte Carlo page: ' + dkInfo.over + ' boxes');
  await dk.close();
  // a change to the case marks the result stale, on the block and in the strip
  await p.fill('#inflation', '3.1%'); await p.$eval('#inflation', e => e.dispatchEvent(new Event('input', { bubbles: true }))); await p.waitForTimeout(900);
  const stale = await p.evaluate(() => ({ block: /run it again/.test(document.getElementById('mcStatus').textContent), strip: /run again/.test(document.querySelector('#scnGrid .scn-card.on').textContent) }));
  console.log('after a change:', JSON.stringify(stale));
  if(!stale.block || !stale.strip) errs.push('a change to the case should mark the result stale in the block and the strip');
  // the settings save with the case
  const saved = await p.evaluate(() => JSON.parse(document.getElementById('caseJson').value).monteCarlo);
  console.log('saved settings:', JSON.stringify(saved));
  if(!saved || saved.trials !== 100 || saved.seed !== 7) errs.push('the Monte Carlo settings should save with the case');
  console.log('ERRORS:', errs.length ? errs : 'none'); await b.close();
})();
