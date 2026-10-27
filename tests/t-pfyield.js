/* Section 16, Investment Portfolio: the proposal's blocks collapse on their bars like the rest of the page, and each
   account row in Holdings by account carries the account's SEC yield (the holdings' yields weighted by amount, with the
   share of the account they cover when some holdings quote none). A minimal proposal is pasted in Nitrogen's layout. */
const { chromium } = require('playwright');
const TEXT = [
  '48 $300,000 · 2 ACCOUNTS', 'PORTFOLIO TOTAL $300,000',
  '$200,000   3.1', '52 Jeff Rollover IRA', 'TOTAL   GPA',
  'VTI · Vanguard Total Stock Market ETF', '52   $120,000   60.0%   40.0%   1.30%   3.2   -12.0% | +18.0%', 'ETF',
  'BND · Vanguard Total Bond Market ETF', '20   $80,000   40.0%   26.7%   4.10%   2.5   -4.0% | +6.0%', 'ETF',
  '$100,000   2.0', '30 Jane Roth IRA', 'TOTAL   GPA',
  'SCHD · Schwab U.S. Dividend Equity ETF', '45   $60,000   60.0%   20.0%   3.50%   3.0   -10.0% | +14.0%', 'ETF',
  'Money Market Fund', '1   $40,000   40.0%   13.3%   —   -0.0% | +0.0%', 'MM',
  'Portfolio Stress Tests'
].join('\n');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  await p.fill('#pfText', TEXT); await p.click('#pfAnalyze'); await p.waitForTimeout(1500);
  console.log('msg:', (await p.$eval('#pfMsg', e => e.textContent)).slice(0, 120));
  const heads = await p.$$eval('#pfOut .inc-title', hs => hs.map(h => ({ t: [...h.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim(), tgl: h.classList.contains('tgl-head'), closed: h.classList.contains('closed'), body: !!(h.nextElementSibling && h.nextElementSibling.classList.contains('tgl-body')) })));
  console.log('blocks:', JSON.stringify(heads.map(h => h.t + (h.tgl ? '' : ' (not collapsible)') + (h.closed ? '' : ' (open)'))));
  if(heads.length < 3 || heads.some(h => !h.tgl || !h.body || !h.closed)) errs.push('every proposal block should be collapsible, with its body, closed to start');
  const acct = heads.find(h => /Holdings by account/.test(h.t)); if(!acct) errs.push('the holdings by account block is missing');
  // open the holdings block and read the account rows
  await p.$$eval('#pfOut .inc-title', hs => { const h = hs.find(x => /Holdings by account/.test(x.textContent)); if(h) h.click(); }); await p.waitForTimeout(300);
  const opened = await p.$$eval('#pfOut .inc-title', hs => { const h = hs.find(x => /Holdings by account/.test(x.textContent)); return h && !h.classList.contains('closed') && h.nextElementSibling.getBoundingClientRect().height > 10; });
  if(!opened) errs.push('clicking the bar should open the block');
  const rows = await p.$$eval('#pfOut .pf-hold tr.grp', trs => trs.map(tr => ({ name: tr.children[0].textContent.trim(), total: tr.children[2].textContent.trim(), yld: tr.children[5].textContent.replace(/\s+/g, ' ').trim() })));
  console.log('account rows:', JSON.stringify(rows));
  const jeff = rows.find(r => /Jeff/.test(r.name)), jane = rows.find(r => /Jane/.test(r.name));
  if(!jeff || jeff.yld !== '2.42%') errs.push('Jeff’s account yield should be 2.42% (120,000 at 1.30% and 80,000 at 4.10%): ' + (jeff && jeff.yld));
  if(!jane || !/^3\.50%\s*on 60% of the account$/.test(jane.yld)) errs.push('Jane’s account yield should be 3.50% on 60% of the account: ' + (jane && jane.yld));
  const tot = rows.find(r => /Portfolio total/.test(r.name));
  if(!tot || !/^2\.67%\s*on 87% of the portfolio$/.test(tot.yld) || tot.total !== '$300,000') errs.push('the Portfolio total row should read $300,000 and 2.67% on 87% of the portfolio: ' + JSON.stringify(tot));
  const tile = await p.$eval('#pfOut .tax-tiles .pf-yield', e => e.textContent.replace(/\s+/g, ' ').trim());
  console.log('yield tile:', tile);
  if(!/^SEC yield ?2\.67% ?\$6,940 a year · every holding weighted by amount · on 87% of the portfolio, the rest quotes none$/.test(tile)) errs.push('the SEC yield tile should read 2.67%, $6,940 a year on 87% of the portfolio: ' + tile);
  const head = await p.$eval('#pfOut .pf-hold thead', e => e.textContent);
  if(!/SEC yield/.test(head)) errs.push('the yield column should be headed SEC yield');
  // collapse all closes them, expand all opens them
  await p.click('#collapseAll'); await p.waitForTimeout(300);
  const allClosed = await p.$$eval('#pfOut .inc-title', hs => hs.every(h => h.classList.contains('closed')));
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const allOpen = await p.$$eval('#pfOut .inc-title', hs => hs.every(h => !h.classList.contains('closed')));
  if(!allClosed || !allOpen) errs.push('the page’s collapse and expand buttons should take the proposal blocks with them');
  // the proposal re-renders after a reload of the case with the blocks collapsible again
  const json = await p.$eval('#caseJson', e => e.value);
  await p.evaluate(j => window.__rfb.loadCaseJson(j), json); await p.waitForTimeout(1200);
  const again = await p.$$eval('#pfOut .inc-title', hs => hs.length && hs.every(h => h.classList.contains('tgl-head')));
  if(!again) errs.push('the blocks should be collapsible again after the case reloads');
  console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
