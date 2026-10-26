/* Section 17: the projected income tax before strategic tax planning comes first, the widow's or widower's curse
   (a spouse dies at the chosen age; the survivor files single from the next year) sits between it and the
   strategies, and the after block sets the plan against before. Prints the Smith figures; ends with ERRORS. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.click('#expandAll'); await p.waitForTimeout(600);
  const tiles = async id => p.$$eval('#' + id + ' > div', ds => ds.map(d => d.querySelector('dt').textContent + ': ' + d.querySelector('dd').textContent));
  // order: before, the curse, the strategies, after
  const order = await p.evaluate(() => ['taxBTiles', 'widowTiles', 'wdList', 'rothTiles', 'qcdTiles', 'taxTiles'].map(id => document.getElementById(id).getBoundingClientRect().top));
  console.log('block order (page y):', order.map(Math.round).join(' < '));
  if(!order.every((y, k) => k === 0 || y > order[k - 1])) errs.push('section 17 should run before → the curse → withdrawal order → Roth → QCD → after');
  const titles = await p.$$eval('#taxSec .inc-title', es => es.map(e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()));
  console.log('titles:', JSON.stringify(titles));
  if(!/before strategic tax planning/.test(titles[0]) || !/curse/.test(titles[1]) || !/after strategic tax planning/.test(titles[titles.length - 1])) errs.push('the subsection titles should name before, the curse and after');
  // before and after
  const before = await tiles('taxBTiles'), after = await tiles('taxTiles');
  console.log('before:', JSON.stringify(before)); console.log('after:', JSON.stringify(after));
  const num = s => +((s.match(/\$([\d,]+)/) || [])[1] || '0').replace(/,/g, '');
  const fedB = num(before.find(t => /Lifetime federal tax/.test(t))), fedA = num(after.find(t => /Lifetime federal tax/.test(t)));
  if(!(fedB > 0) || !/^Lifetime tax saved/.test(after[0])) errs.push('the after block should lead with the lifetime tax saved against before');
  const savedTile = await p.$eval('#taxTiles > div small', e => e.textContent);
  if(!/before strategic tax planning/.test(savedTile)) errs.push('the saved tile should quote before and after');
  const dashed = await p.evaluate(() => ({ svg1: document.querySelectorAll('#taxSvg1 polyline').length, svg3: document.querySelectorAll('#taxSvg3 polyline').length, b1: document.querySelectorAll('#taxBSvg1 polyline').length, bars: document.querySelectorAll('#taxBSvg1 rect').length }));
  console.log('before lines on the after charts:', JSON.stringify(dashed));
  if(dashed.svg1 !== 1 || dashed.svg3 !== 1 || dashed.b1 !== 0 || dashed.bars < 10) errs.push('the after charts should carry the before as a dashed line; the before charts stand alone');
  if(!/After strategic tax planning/.test(await p.$eval('#taxNote', e => e.textContent))) errs.push('the after note should open with the comparison');
  if((await p.$$eval('#taxBTable tbody tr', trs => trs.length)) < 30) errs.push('the before block should carry its own year-by-year table');
  // the curse
  const W = await p.evaluate(() => window.__rfb.widow());
  console.log('widow (Jeff at 80):', JSON.stringify(W));
  const wt = await tiles('widowTiles'); console.log('widow tiles:', JSON.stringify(wt));
  if(!W || W.who !== 'client' || W.age !== 80) errs.push('the default is the client passing at 80');
  if(!(W.joint.status === 'mfj' && W.survivor.status === 'single')) errs.push('the survivor should file single from the year after the death');
  if(!(W.survivor.income < W.joint.income && W.survivor.tax > W.joint.tax)) errs.push('the curse: less income, more tax in the first survivor year');
  if(!(W.survivor.ss < W.joint.ss)) errs.push('the smaller Social Security benefit should stop');
  if(!(W.extraB > 0 && W.survA < W.survB)) errs.push('the strategies should cut the survivor’s tax');
  const rows = await p.$$eval('#widowTable tbody tr', trs => trs.map(t => [...t.children].map(c => c.textContent.trim())));
  console.log('widow table:', JSON.stringify(rows.map(r => r.slice(0, 3).join(' ') + ' | ' + r[6] + ' | ' + r[10] + ' | ' + r[13])));
  if(rows[0][2] !== 'Joint' || rows[1][2] !== 'Single' || rows[1][0] !== String(W.firstYear)) errs.push('the table should show the last joint year then the first single year');
  if((await p.$$eval('#widowSvg polyline', l => l.length)) !== 3) errs.push('the chart should draw both living, the survivor before and after');
  // the controls: the spouse at 75, saved with the case
  await p.selectOption('#widowWho', 'spouse'); await p.waitForTimeout(900);
  await p.fill('#widowAge', '75'); await p.$eval('#widowAge', e => e.dispatchEvent(new Event('change', { bubbles: true }))); await p.waitForTimeout(900);
  const W2 = await p.evaluate(() => window.__rfb.widow());
  console.log('widow (Jane at 75):', JSON.stringify({ who: W2.who, surv: W2.surv, age: W2.age, deathYear: W2.deathYear, firstYear: W2.firstYear, survTax: Math.round(W2.survivor.tax), jointTax: Math.round(W2.joint.tax) }));
  if(W2.who !== 'spouse' || W2.age !== 75 || W2.deathYear !== W.deathYear - 3) errs.push('the controls should move the death: Jane is two years younger, so 75 falls three years before Jeff\u2019s 80');
  const saved = await p.evaluate(() => JSON.parse(document.getElementById('caseJson').value).tax.widow);
  console.log('saved:', JSON.stringify(saved));
  if(!saved || saved.who !== 'spouse' || saved.age !== 75) errs.push('the widow settings should save with the case');
  const single = await p.evaluate(() => { const t = window.__rfb.taxLast(); return t.rows.filter(x => x.status === 'single').length; });
  if(single !== 0) errs.push('the plan projection itself still files jointly throughout');
  console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
