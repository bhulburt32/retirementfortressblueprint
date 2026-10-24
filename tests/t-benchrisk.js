/* The "underperformed its benchmark" risk: suggested from a Wealth Report performance analysis that trails,
   not suggested when the portfolio leads, and silent without a report. Drives it through a pasted case file
   carrying a synthetic performance block — no client report involved. Smith sample. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  p.on('dialog', d => d.accept());
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1000);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const item = () => p.evaluate(() => { const el = [...document.querySelectorAll('#riskList .risk-item')].find(x => /underperformed its benchmark/.test(x.textContent)); return el ? { text: el.querySelector('b').textContent, sub: el.querySelector('small').textContent, sug: !!el.querySelector('.sug') } : null; });
  console.log('no report:', JSON.stringify(await item()));
  const perf = (pTot, bTot, trailP, trailB) => ({ name: 'Sample report', text: 'x', src: 'text', at: new Date().toISOString(), analysis: { riskNumber: 70, clientRiskNumber: 73, perf: { period: 'Jan 1, 2020 – Dec 31, 2025', benchmark: { name: 'Sample 60/40 Index', riskNumber: 68 },
    stats: { totalReturn: { p: pTot, b: bTot }, stdev: { p: 12.1, b: 11.8 } }, trailing: { periods: ['3 MONTHS', '1 YEAR', '3 YEARS', '5 YEARS'], portfolio: { values: trailP }, benchmark: { values: trailB } } } } });
  const load = async (n) => { const json = await p.evaluate(() => document.getElementById('caseJson').value); const c = JSON.parse(json); c.nitrogen = n; await p.evaluate(j => window.__rfb.loadCaseJson(j), JSON.stringify(c)); await p.waitForTimeout(1200); };
  await load(perf(54.3, 83.4, [1.2, 8.1, 20.2, 45.1], [2.0, 11.4, 30.3, 70.2]));
  const lag = await item(); console.log('lagging:', JSON.stringify(lag));
  await load(perf(90.0, 83.4, [2.5, 12.0, 33.0, 80.0], [2.0, 11.4, 30.3, 70.2]));
  const lead = await item(); console.log('leading:', JSON.stringify(lead));
  // the findings report lists the suggested risks when none is ticked
  await load(perf(54.3, 83.4, [1.2, 8.1, 20.2, 45.1], [2.0, 11.4, 30.3, 70.2]));
  const ok = lag && lag.sug && /−29\.1 points/.test(lag.text) && /behind in 4 of 4/.test(lag.sub) && lead && !lead.sug && /ahead by 6\.6 points/.test(lead.text) && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); console.log('ERRORS:', errs.length ? errs : 'none'); await b.close(); process.exit(ok ? 0 : 1);
})();
