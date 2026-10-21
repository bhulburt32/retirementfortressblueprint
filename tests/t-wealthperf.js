/* v180: Wealth Report performance analysis. Needs a Nitrogen Wealth Report PDF in WEALTH_PDF (or
   samples/wealth-report.pdf); without one it reports "skipped". No client report ships with the repo.
   Checks: the reader returns trailing returns, stats and the Modeled Performance chart; section 12 shows
   the performance block; the deck gains "Your Portfolio Against Its Benchmark" straight after the
   portfolio page with no overflowing text boxes. */
const { chromium } = require('playwright'); const fs = require('fs');
const pdf = process.env.WEALTH_PDF || 'samples/wealth-report.pdf';
if (!fs.existsSync(pdf)) { console.log('skipped: no Wealth Report PDF at', pdf, '(set WEALTH_PDF)'); process.exit(0); }
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext(); const p = await ctx.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1000);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  // reader
  const r = await p.evaluate(async (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const L = await window.__rfb.pdfLayoutText(u); const P = window.__rfb.nitroPerf(L.pages); return { pages: L.pages.length, trailing: P && P.trailing && P.trailing.periods ? P.trailing.periods.length : 0, stats: P && P.stats ? Object.keys(P.stats).length : 0, chart: P && P.chart ? [P.chart.portfolio.length, P.chart.benchmark.length] : null }; }, fs.readFileSync(pdf).toString('base64'));
  console.log('reader:', JSON.stringify(r));
  // page
  await p.setInputFiles('#nitroFile', pdf); await p.waitForTimeout(6000);
  console.log('nitro msg:', await p.evaluate(() => document.getElementById('nitroMsg').textContent.slice(0, 120)));
  const page = await p.evaluate(() => ({ svg: !!document.getElementById('nitroPerfSvg'), trailingRows: (() => { const t = [...document.querySelectorAll('#nitroOut table')].find(t => /Period/.test(t.textContent)); return t ? t.querySelectorAll('tbody tr').length : 0; })(), statRows: (() => { const t = [...document.querySelectorAll('#nitroOut table')].find(t => /Statistic/.test(t.textContent)); return t ? t.querySelectorAll('tbody tr').length : 0; })() }));
  console.log('section 12:', JSON.stringify(page));
  const saved = await p.evaluate(() => { const j = JSON.parse(document.getElementById('caseJson').value); const c = j.nitrogen && j.nitrogen.analysis && j.nitrogen.analysis.perf && j.nitrogen.analysis.perf.chart; return c ? c.portfolio.length : 0; });
  console.log('case file keeps chart points:', saved);
  // deck
  const [pop] = await Promise.all([ctx.waitForEvent('page'), p.click('#makeDeck')]); await pop.waitForLoadState(); await pop.waitForTimeout(3000);
  const titles = await pop.$$eval('.sl', els => els.map(s => s.textContent.replace(/\s+/g, ' ')));
  const last = t => titles.map((x, k) => x.indexOf(t) >= 0 ? k : -1).filter(k => k >= 0).pop(); // the contents page lists every title, so take the last match
  const iPf = last('Your Current Investment Portfolio'), iB = last('Your Portfolio Against Its Benchmark');
  const over = await pop.$$eval('.tx', els => els.filter(e => e.scrollHeight - e.clientHeight > 6).length);
  console.log('deck:', titles.length, 'slides | portfolio', iPf, '| benchmark', iB, '| overflowing text boxes', over);
  const ok = r.trailing > 0 && r.chart && r.chart[0] > 10 && page.svg && page.trailingRows > 0 && iB === iPf + 1 && over === 0 && saved > 10 && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); console.log('ERRORS:', errs.length ? errs : 'none'); await b.close(); process.exit(ok ? 0 : 1);
})();
