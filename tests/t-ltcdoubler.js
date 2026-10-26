/* Section 06 Annuities: the LTC income doubler cells. On the Smith case, marking Jeff's income annuity as a doubler
   puts its monthly income into the section 09 existing coverage (the field follows), the estimate's covered total
   rises by what the rider pays over the care, the care-event projection improves, "continues after the value is
   zero" pays more than "while the value lasts", and the cells save with the case. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.click('#expandAll'); await p.waitForTimeout(600);
  const num = s => +String(s).replace(/[^0-9.\-]/g, '') || 0;
  const state = async () => p.evaluate(() => {
    const est = window.__rfb.ltcEstimate ? window.__rfb.ltcEstimate() : null;
    const foot = [...document.querySelectorAll('#ltcFoot tr')].find(tr => /Covered by existing/.test(tr.textContent));
    const box = [...document.querySelectorAll('#assetLtc .ltc-scn')].find(d => /Jeff needs care/.test(d.textContent));
    const tile = box && [...box.querySelectorAll('dt, dd')].map(e => e.textContent.trim());
    return { cov: document.getElementById('ltcCovC').value, covRO: document.getElementById('ltcCovC').readOnly, foot: foot ? foot.children[1].textContent.replace(/\s+/g, ' ').trim() : null,
             care: tile ? tile.slice(0, 8).join(' ') : null };
  });
  const headers = await p.$$eval('#anxTable thead th', ths => ths.map(t => t.childNodes[0].textContent.trim()));
  console.log('columns:', headers.slice(-3).join(' | '), '| count', headers.length);
  if(headers.length !== 16 || !/LTC income doubler/.test(headers[13])) errs.push('the annuities table should end with the three doubler cells');
  const rows = await p.$$eval('#anxBody tr[data-anx]', rs => rs.map(r => ({ id: r.dataset.anx, name: r.querySelector('[data-af=name]').textContent, owner: r.querySelector('[data-af=owner]').textContent, type: r.querySelector('select[data-ax=pos]').value, dbl: r.querySelector('[data-ax=ltcDoubler]').value, contOff: r.querySelector('[data-ax=ltcContinue]').disabled, months: r.querySelector('[data-ax=ltcMonths]').value, monthsOff: r.querySelector('[data-ax=ltcMonths]').disabled, monthly: r.querySelector('[data-ax=monthly]').value })));
  console.log('annuities:', JSON.stringify(rows.map(r => r.owner + ' ' + r.name.slice(0, 28) + ' [' + r.type + '] dbl=' + r.dbl + ' months=' + r.months + (r.contOff ? ' (cells off)' : ''))));
  if(!rows.length || rows.some(r => r.dbl !== 'no' || !r.contOff || !r.monthsOff || r.months !== '60')) errs.push('every contract should start with the doubler off, 60 months, the other cells closed');
  const before = await state(); console.log('before:', JSON.stringify(before));
  // Jeff's income annuity in force takes the doubler
  const inc = rows.find(r => /Income Annuity/.test(r.type) && /Jeff/.test(r.owner)); if(!inc){ errs.push('the Smith case should have an income annuity of Jeff’s'); }
  const tr = `#anxBody tr[data-anx="${inc.id}"]`;
  await p.selectOption(tr + ' select[data-ax="ltcDoubler"]', 'yes'); await p.waitForTimeout(900);
  const cells = await p.$eval(tr, r => ({ contOff: r.querySelector('[data-ax=ltcContinue]').disabled, monthsOff: r.querySelector('[data-ax=ltcMonths]').disabled, monthlyOff: r.querySelector('[data-ax=monthly]').disabled, monthly: r.querySelector('[data-ax=monthly]').value }));
  if(cells.contOff || cells.monthsOff || cells.monthlyOff) errs.push('the doubler should open the continue, months and monthly cells');
  const no = await state(); console.log('doubler on, stops with the value:', JSON.stringify(no));
  const monthly = num(cells.monthly) || (await p.evaluate(id => { const a = window.__rfb.acct ? window.__rfb.acct(id) : null; return a ? 0 : 0; }, inc.id));
  console.log('monthly income used:', monthly || '(derived: ' + (num(no.cov) - num(before.cov)) + ')');
  if(!no.covRO || !(num(no.cov) > num(before.cov) + 0.5)) errs.push('the existing coverage field should follow and include the annuity’s monthly income');
  if(!/income doubler/.test(no.foot || '')) errs.push('the estimate footer should say how much the doubler covers');
  const covered = s => num((s.foot || '').match(/^\$[\d,]+/) || 0);
  if(!(covered(no) > covered(before) + 0.5)) errs.push('the covered total should rise with the doubler');
  // continues after the value is zero: at least as much coverage
  await p.selectOption(tr + ' select[data-ax="ltcContinue"]', 'yes'); await p.waitForTimeout(900);
  const yes = await state(); console.log('doubler continues after the value is zero:', JSON.stringify(yes));
  if(!(covered(yes) >= covered(no) - 0.5)) errs.push('continuing after the value is zero cannot cover less');
  // a shorter benefit length covers less
  await p.fill(tr + ' [data-ax="ltcMonths"]', '12'); await p.$eval(tr + ' [data-ax="ltcMonths"]', e => { e.dispatchEvent(new Event('input', { bubbles: true })); e.blur(); }); await p.waitForTimeout(900);
  const short = await state(); console.log('12 months:', JSON.stringify(short));
  if(!(covered(short) < covered(yes) - 0.5)) errs.push('a 12-month benefit should cover less than 60');
  const dblT = await p.evaluate(() => { const e = window.__rfb.ltcEstimate && window.__rfb.ltcEstimate(); return e && e.client ? Math.round(e.client.dblTotal) : null; });
  console.log('doubler total over the care, 12 months:', dblT, '| expected at most', Math.round(num(no.cov) - num(before.cov)) * 12);
  if(dblT == null || dblT > (num(no.cov) - num(before.cov)) * 12 + 1) errs.push('twelve months of the doubler cannot pay more than twelve months of income');
  // saved with the case; off again restores the field
  const saved = await p.evaluate(id => { const d = JSON.parse(window.__rfb.caseData()); const a = d.accounts.find(x => String(x.id) === String(id)) || d.accounts.find(x => x.ann && x.ann.ltcDoubler === 'yes'); return a && a.ann && { d: a.ann.ltcDoubler, c: a.ann.ltcContinue, m: a.ann.ltcMonths }; }, inc.id);
  console.log('saved:', JSON.stringify(saved));
  if(!saved || saved.d !== 'yes' || saved.c !== 'yes' || saved.m !== 12) errs.push('the doubler cells should save with the case');
  await p.selectOption(tr + ' select[data-ax="ltcDoubler"]', 'no'); await p.waitForTimeout(900);
  const off = await state(); console.log('off again:', JSON.stringify(off));
  if(off.cov !== before.cov || off.covRO !== before.covRO) errs.push('turning the doubler off should restore the coverage field');
  console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
