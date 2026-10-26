/* Section 14, Annuity income: the Payout (single / joint) and LTC income doubler cells. On the Smith case a Foundation
   annuity ticked as a doubler is listed under LTC benefits with its months and "continues after value is zero" cells,
   joins the care-event pools (the tiles say the rider pays), and saves per scenario; an in-force income annuity's
   payout set to joint keeps paying the survivor in the widow's curse; its rider is the contract's own and pays
   before the plan too. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.click('#expandAll'); await p.waitForTimeout(600);
  const num = s => +String(s).replace(/[^0-9.\-]/g, '') || 0;
  const heads = await p.$$eval('#annIncTable thead th', ths => ths.map(t => t.childNodes[0].textContent.trim()));
  console.log('annuity income columns:', heads.length, '|', heads.slice(-2).join(' | '));
  if(heads.length !== 9 || heads[7] !== 'Payout' || !/LTC income doubler/.test(heads[8])) errs.push('the annuity income table should end with Payout and LTC income doubler');
  const rows = await p.$$eval('#annIncBody tr', rs => rs.map(r => ({ inc: r.dataset.inc || null, ann: r.dataset.ann || null, name: r.querySelector('td').textContent.replace(/\s+/g, ' ').trim().slice(0, 50), payout: (r.querySelector('[data-ak=payout]') || {}).value, ltc: !!(r.querySelector('[data-ak=ltc]') || {}).checked })));
  console.log('rows:', JSON.stringify(rows));
  if(!rows.length || rows.some(r => !r.payout)) errs.push('every row should carry a payout cell');
  const fia = rows.find(r => r.ann), inc = rows.find(r => r.inc);
  if(!fia || !inc) errs.push('the Smith case should list an in-force income annuity and a Foundation annuity');
  const care = async () => p.evaluate(() => { const box = [...document.querySelectorAll('#assetLtc .ltc-scn')].find(d => /Jeff needs care|Jane needs care/.test(d.textContent)); if(!box) return null;
    const t = [...box.querySelectorAll('dt')].map(dt => dt.textContent.trim() + ' ' + (dt.nextElementSibling ? dt.nextElementSibling.textContent.trim() : '')); return { title: box.querySelector('h4, h3, .scn-title') ? box.querySelector('h4, h3, .scn-title').textContent.trim().slice(0, 30) : '', tiles: t }; });
  const ltcRows = async () => p.$$eval('#ltcBenBody tr', rs => rs.map(r => ({ ltc: r.dataset.ltc || null, dbl: r.dataset.dbl || null, months: (r.querySelector('[data-dk=months]') || {}).value, cont: (r.querySelector('[data-dk=cont]') || {}).value, text: r.querySelector('td').textContent.replace(/\s+/g, ' ').trim().slice(0, 60) })));
  const before = { care: await care(), ltc: await ltcRows(), pools: await p.evaluate(() => window.__rfb.ltcPools('plan')) };
  console.log('before — care:', JSON.stringify(before.care), '| LTC benefit rows:', before.ltc.length, '| pool entries:', before.pools.client.length + before.pools.spouse.length);
  // the Foundation annuity takes the doubler
  const trF = `#annIncBody tr[data-ann="${fia.ann}"]`;
  await p.$eval(trF + ' [data-ak="ltc"]', e => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(900);
  const on = { care: await care(), ltc: await ltcRows(), pools: await p.evaluate(() => window.__rfb.ltcPools('plan')) };
  const dblRow = on.ltc.find(r => r.dbl === fia.ann);
  console.log('doubler on — LTC benefit row:', JSON.stringify(dblRow), '| pool entries:', on.pools.client.length + on.pools.spouse.length, '| care:', JSON.stringify(on.care && on.care.tiles));
  if(!dblRow || dblRow.months !== '60' || dblRow.cont !== 'no') errs.push('the ticked annuity should be listed under LTC benefits with 60 months and "while the value lasts"');
  const dblPool = on.pools.client.concat(on.pools.spouse).filter(k => k.dbl);
  if(dblPool.length !== 1 || Math.abs(dblPool[0].years - 5) > 1e-9) errs.push('the pools should carry one rider entry of five years');
  const paidB = num((before.care.tiles.find(t => /^Paid by/.test(t)) || '').split(' ').pop()), paidOn = num((on.care.tiles.find(t => /^Paid by/.test(t)) || '').split(' ').pop());
  const paidLbl = (on.care.tiles.find(t => /^Paid by/.test(t)) || '');
  if(!/annuity rider/.test(paidLbl)) errs.push('the care tile should say the rider pays: ' + paidLbl);
  console.log('paid by the Moat before:', paidB, '| with the rider:', paidOn);
  // continues after the value is zero pays at least as much; twelve months no more than sixty
  await p.selectOption(`#ltcBenBody tr[data-dbl="${fia.ann}"] [data-dk="cont"]`, 'yes'); await p.waitForTimeout(900);
  const cont = await care(); const paidCont = num((cont.tiles.find(t => /^Paid by/.test(t)) || '').split(' ').pop());
  await p.fill(`#ltcBenBody tr[data-dbl="${fia.ann}"] [data-dk="months"]`, '12'); await p.$eval(`#ltcBenBody tr[data-dbl="${fia.ann}"] [data-dk="months"]`, e => e.dispatchEvent(new Event('input', { bubbles: true }))); await p.waitForTimeout(900);
  const short = await care(); const paidShort = num((short.tiles.find(t => /^Paid by/.test(t)) || '').split(' ').pop());
  console.log('continues:', paidCont, '| 12 months:', paidShort);
  if(!(paidCont >= paidOn - 0.5)) errs.push('continuing after the value is zero cannot pay less');
  if(!(paidShort <= paidCont + 0.5)) errs.push('twelve months cannot pay more than sixty');
  const poolShort = await p.evaluate(() => window.__rfb.ltcPools('plan').client.concat(window.__rfb.ltcPools('plan').spouse).filter(k => k.dbl)[0]);
  if(!poolShort || Math.abs(poolShort.years - 1) > 1e-9 || !poolShort.dbl.cont) errs.push('the rider entry should follow the cells: ' + JSON.stringify(poolShort));
  // saved per scenario
  const saved = await p.evaluate((k) => { const d = JSON.parse(window.__rfb.caseData()); const S = d.scenarios[d.activeScenario] || d.scenarios[0]; return { ann: S.annuityIncome && S.annuityIncome[k], ben: S.ltcBenefits && S.ltcBenefits['dbl:' + k] }; }, fia.ann);
  console.log('saved:', JSON.stringify(saved));
  if(!saved.ann || saved.ann.ltc !== 'yes' || !saved.ben || saved.ben.cont !== 'yes' || saved.ben.months !== '12') errs.push('the rider should save with the scenario');
  // an in-force income annuity (Jeff's, paying jointly): single life stops it at his death, so the survivor's income falls; its rider is the contract's own
  const W0 = await p.evaluate(() => window.__rfb.widow());
  const trI = `#annIncBody tr[data-inc="${inc.inc}"]`;
  await p.selectOption(trI + ' [data-ak="payout"]', 'single'); await p.waitForTimeout(900);
  const W1 = await p.evaluate(() => window.__rfb.widow());
  console.log('widow survivor income, joint:', Math.round(W0.survivor.income), '| single life:', Math.round(W1.survivor.income));
  if(!(W1.survivor.income < W0.survivor.income - 0.5)) errs.push('a single-life payout should stop at the owner\u2019s death');
  const anxPayout = await p.$eval(`#anxBody tr[data-anx="${inc.inc.replace('income:', '')}"] [data-ax="payout"]`, e => e.value);
  if(anxPayout !== 'single') errs.push('the section 06 payout cell should mirror the change');
  await p.$eval(trI + ' [data-ak="ltc"]', e => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(900);
  const sq = await p.evaluate(() => window.__rfb.ltcPools('sq')), ltcNow = await ltcRows();
  console.log('status-quo pool entries with the in-force rider:', sq.client.length + sq.spouse.length, '| LTC benefit rows:', ltcNow.length);
  if(sq.client.length + sq.spouse.length !== 1 || !ltcNow.some(r => r.dbl === inc.inc)) errs.push('an in-force rider should pay before the plan and be listed');
  const acctSaved = await p.evaluate(() => { const d = JSON.parse(window.__rfb.caseData()); return d.accounts.filter(a => a.ann && a.ann.ltcDoubler === 'yes').map(a => a.ann.payout + '/' + a.ann.ltcMonths); });
  console.log('in-force rider saved on the account:', JSON.stringify(acctSaved));
  if(acctSaved.length !== 1 || acctSaved[0] !== 'single/60') errs.push('the in-force rider and payout should save on the account');
  console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
