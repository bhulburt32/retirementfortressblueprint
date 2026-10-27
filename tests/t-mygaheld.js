/* A MYGA marked Stay as is (section 06, Transfer = no) renews at half its pre-maturity rate after its maturity date and
   stays a fixed product in the bad years; one that transfers into the plan is market money at the level's rate after
   maturity, as before. Checked on the Smith Fixed Annuity (5%, matures 2029-10) through the growth helpers and the
   projection. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.click('#expandAll'); await p.waitForTimeout(500);
  const id = await p.$$eval('#acctBody tr[data-id]', rs => { const r = rs.find(x => x.querySelector('input[data-k=name]').value.trim() === 'Fixed Annuity'); return r ? +r.dataset.id : null; });
  if(!id){ errs.push('the Smith case should have the Fixed Annuity MYGA'); }
  const rules = async () => p.evaluate(id => { const R = window.__rfb; const m = R.acctGrowth(id, 0.06, 0), a = R.acctGrowth(id, 0.06, 10), sPre = R.acctStressReturn(id, -0.16, 0.06, 0), sPost = R.acctStressReturn(id, -0.16, 0.06, 10); return { before: m, after: a, stressBefore: sPre, stressAfter: sPost }; }, id);
  // the status quo projection (section 06): every account where it sits, so the mark's rule shows there; the scenarios place this account by their own transfer lists
  const at2046 = async () => p.evaluate(() => { const r = window.__rfb.sqTotals().find(x => x.year === 2046); return r ? Math.round(r.total) : null; });   // the status quo's assets in 2046, well after the 2029 maturity and before the accounts run out
  const g = await p.$eval(`#acctBody tr[data-id="${id}"] input[data-k="growth"]`, e => +e.value.replace(/[^0-9.]/g, '') / 100);   // the typed Growth cell comes first for the level rate
  console.log('typed growth cell:', g);
  const moving = await rules(), endMoving = await at2046();
  console.log('transferred (as the case has it):', JSON.stringify(moving), '| status quo assets in 2046', endMoving);
  if(Math.abs(moving.before - 0.05) > 1e-9 || Math.abs(moving.after - g) > 1e-9 || Math.abs(moving.stressAfter + 0.16) > 1e-9) errs.push('a transferred MYGA should earn its rate, then the level rate and the stress loss after maturity');
  await p.selectOption(`#acctBody tr[data-id="${id}"] select[data-k="move"]`, 'no'); await p.waitForTimeout(900);
  const held = await rules(), endHeld = await at2046();
  console.log('stay as is:', JSON.stringify(held), '| status quo assets in 2046', endHeld);
  if(Math.abs(held.before - 0.05) > 1e-9 || Math.abs(held.after - 0.025) > 1e-9) errs.push('a held MYGA should renew at half its rate after maturity');
  if(Math.abs(held.stressBefore - 0.05) > 1e-9 || Math.abs(held.stressAfter - 0.025) > 1e-9) errs.push('a held MYGA should take no loss in a bad year, before or after maturity');
  // without a maturity the held contract keeps its full rate, so it ends higher than with one
  await p.fill(`#anxBody tr[data-anx="${id}"] [data-ax="maturity"]`, ''); await p.$eval(`#anxBody tr[data-anx="${id}"] [data-ax="maturity"]`, e => e.dispatchEvent(new Event('change', { bubbles: true }))); await p.waitForTimeout(900);
  const open = await rules(), endOpen = await at2046();
  console.log('stay as is, no maturity:', JSON.stringify(open), '| status quo assets in 2046', endOpen);
  if(Math.abs(open.after - 0.05) > 1e-9) errs.push('with no maturity the held MYGA keeps its rate');
  if(!(endOpen > endHeld + 0.5)) errs.push('halving the rate after maturity should leave less in the accounts (' + endHeld + ' vs ' + endOpen + ')');
  // no rate typed: half the plan rate after maturity
  await p.fill(`#anxBody tr[data-anx="${id}"] [data-ax="maturity"]`, '2029-10'); await p.$eval(`#anxBody tr[data-anx="${id}"] [data-ax="maturity"]`, e => e.dispatchEvent(new Event('change', { bubbles: true })));
  await p.fill(`#anxBody tr[data-anx="${id}"] [data-ax="rate"]`, ''); await p.$eval(`#anxBody tr[data-anx="${id}"] [data-ax="rate"]`, e => { e.dispatchEvent(new Event('input', { bubbles: true })); e.blur(); }); await p.waitForTimeout(900);
  const noRate = await rules();
  console.log('stay as is, no rate typed:', JSON.stringify(noRate));
  if(Math.abs(noRate.after - g / 2) > 1e-9) errs.push('with no rate typed the renewal is half the rate the contract was earning: ' + noRate.after);
  console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
