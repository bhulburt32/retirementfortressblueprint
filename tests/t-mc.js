/* Section 19 Monte Carlo: a seeded run on the Smith case prints its figures; the tiles, the fan chart and the
   strip row agree; a change to the case marks the result stale; another scenario starts unrun. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
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
  if(chart.polylines !== 2 || chart.bands !== 2) errs.push('the fan chart should draw two bands, the median and the plan line');
  const strip = await p.evaluate(() => [...document.querySelectorAll('#scnGrid .scn-card')].map(c => { const d = [...c.querySelectorAll('dl div')].find(x => /Monte Carlo success/.test(x.textContent)); return d ? d.querySelector('dd').textContent.replace(/\s+/g, ' ').trim() : null; }));
  console.log('strip row:', JSON.stringify(strip));
  if(strip[0] !== '—') errs.push('the baseline column should show a dash');
  const act = await p.evaluate(() => document.querySelector('#scnGrid .scn-card.on').querySelector('dd') && [...document.querySelector('#scnGrid .scn-card.on').querySelectorAll('dl div')].find(x => /Monte Carlo success/.test(x.textContent)).querySelector('dd').textContent.replace(/\s+/g, ' ').trim());
  if(!new RegExp('^' + Math.round(R.success * 100) + '%\\s*100 trials$').test(act)) errs.push('the active scenario’s strip cell should carry the same rate and the trial count: ' + act);
  if(strip.filter(x => x === 'not run').length !== 2) errs.push('the other two scenarios should read not run');
  // a change to the case marks the result stale, on the block and in the strip
  await p.fill('#inflation', '3.1%'); await p.$eval('#inflation', e => e.dispatchEvent(new Event('input', { bubbles: true }))); await p.waitForTimeout(900);
  const stale = await p.evaluate(() => ({ block: /run it again/.test(document.getElementById('mcStatus').textContent), strip: /run again/.test(document.querySelector('#scnGrid .scn-card.on').textContent) }));
  console.log('after a change:', JSON.stringify(stale));
  if(!stale.block || !stale.strip) errs.push('a change to the case should mark the result stale in the block and the strip');
  // another scenario starts unrun; the first keeps its result when switched back
  const k0 = +(await p.$eval('#scnTabs .scn-tab.on', e => e.getAttribute('data-scn'))), k1 = (k0 + 1) % 3;
  await p.click('#scnTabs .scn-tab[data-scn="' + k1 + '"]'); await p.waitForTimeout(900);
  const other = await txt('#mcStatus'); console.log('scenario', k1, ':', other.slice(0, 60));
  if(!/Not run yet/.test(other)) errs.push('another scenario should start unrun');
  await p.click('#scnTabs .scn-tab[data-scn="' + k0 + '"]'); await p.waitForTimeout(900);
  if(!(await p.evaluate(k => !!window.__rfb.mcResult(k), k0))) errs.push('the scenario that ran should keep its result');
  // the settings save with the case
  const saved = await p.evaluate(() => JSON.parse(document.getElementById('caseJson').value).monteCarlo);
  console.log('saved settings:', JSON.stringify(saved));
  if(!saved || saved.trials !== 100 || saved.seed !== 7) errs.push('the Monte Carlo settings should save with the case');
  console.log('ERRORS:', errs.length ? errs : 'none'); await b.close();
})();
