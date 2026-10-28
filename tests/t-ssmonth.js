/* Section 04 Social Security: "From a month, as shown" pays the PIA as entered from a start month — a past month is in
   payment (pre-plan months in the first year's tax base), a future month starts then; the month is required; a
   scenario's own claiming age still overrides; the choice saves with the case; the deck names the month. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext({viewport:{width:1500,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const set=async(id,v)=>{ await p.fill('#'+id, v); await p.$eval('#'+id,e=>{ e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(700); };
  const rowC=async()=>p.$eval('#ssTable tbody tr:first-child', tr=>tr.children[1].textContent.replace(/\s+/g,' ').trim()).catch(()=>'');
  const ssCell=async()=>p.$eval('#ssFoot', e=>e.textContent.replace(/\s+/g,' ').trim()).catch(()=>'');
  const first=async()=>p.evaluate(()=>{ const X=window.__rfb.taxLast(); const r=X.rows[0], r1=X.rows[1]; return {y0:r.year, ss0:Math.round(r.ss), pre0:Math.round(r.preSS), ss1:Math.round(r1.ss), y1:r1.year}; });
  await set('piaC',''); const base=await first(); console.log('with no benefit for Jeff:', JSON.stringify(base));
  await set('piaC','2,000');
  const opts=await p.$$eval('#ssAgeC option',os=>os.map(o=>o.value)); if(!opts.includes('month')) errs.push('the starting-age list should offer From a month');
  await p.selectOption('#ssAgeC','month'); await p.waitForTimeout(600);
  const st=await p.$eval('#ssStartC', e=>({hidden:e.hidden, missing:e.classList.contains('missing')}));
  console.log('month input after choosing From a month:', JSON.stringify(st));
  if(st.hidden || !st.missing) errs.push('the start month should appear and be flagged until entered');
  const benefitTxt=async()=>p.$$eval('#ssTable tbody tr', trs=>trs.map(tr=>tr.textContent.replace(/\s+/g,' ')).join(' ') + ' ' + document.getElementById('ssFoot').textContent.replace(/\s+/g,' '));
  if(!/enter the start month/.test(await benefitTxt())) errs.push('the benefit cell should ask for the start month');
  // a past month: in payment, the whole first calendar year in the tax base
  await set('ssStartC','2025-03');
  const a=await first(); const txt=await benefitTxt(); console.log('from Mar 2025:', JSON.stringify(a), '|', (txt.match(/as shown[^$]*/)||[''])[0].slice(0,60));
  if(Math.abs((a.ss0 - base.ss0) + (a.pre0 - base.pre0) - 24000) > 2) errs.push('a benefit in payment should total the year’s $24,000 in the first calendar year (plan months + earlier): ' + (a.ss0 + a.pre0));
  if(!(a.pre0 > 0.5)) errs.push('the months before the plan date should sit in the pre-plan tax base');
  if(!/as shown, from Mar 2025 — in payment/.test(txt)) errs.push('the row should say as shown, from Mar 2025 — in payment');
  if(/delayed credits|reduction|full benefit/.test(txt.split('COLA assumption')[0])) errs.push('no SSA factor wording for a benefit as shown');
  // a future month: nothing this year, nine months of next year's COLA-grown benefit
  await set('ssStartC','2027-04');
  const c=await first(); console.log('from Apr 2027:', JSON.stringify(c));
  if(c.ss0 - base.ss0 > 0.5 || c.pre0 - base.pre0 > 0.5) errs.push('a start next year should pay nothing this year: ' + JSON.stringify(c));
  const want1 = 2000 * 12 * 1.025 * 9 / 12; if(Math.abs((c.ss1 - base.ss1) - want1) > 3) errs.push('2027 should carry nine months of the COLA-grown benefit ' + Math.round(want1) + ': ' + (c.ss1 - base.ss1));
  // the case file keeps the choice
  const json=await p.$eval('#caseJson',e=>e.value); const d=JSON.parse(json); console.log('saved:', JSON.stringify(d.household.benefits.ss.client));
  if(d.household.benefits.ss.client.mode !== 'month' || d.household.benefits.ss.client.start !== '2027-04') errs.push('the case should save mode month and the start');
  await p.evaluate(j => window.__rfb.loadCaseJson(j), json); await p.waitForTimeout(900); await p.click('#expandAll'); await p.waitForTimeout(300);
  const back=await p.evaluate(()=>({sel:document.getElementById('ssAgeC').value, st:document.getElementById('ssStartC').value, hidden:document.getElementById('ssStartC').hidden}));
  console.log('after reload:', JSON.stringify(back)); if(back.sel !== 'month' || back.st !== '2027-04' || back.hidden) errs.push('the choice should survive a reload');
  // a scenario claiming age in section 14 overrides it as an ordinary claim
  await p.selectOption('#adjSsC','70'); await p.waitForTimeout(800);
  const o=await first(); console.log('with the scenario claiming at 70:', JSON.stringify(o));
  if(o.ss1 - base.ss1 > 0.5) errs.push('a scenario claiming age of 70 should override the month: nothing in 2027: ' + (o.ss1 - base.ss1));
  await p.selectOption('#adjSsC',''); await p.waitForTimeout(600);
  // the deck names the month
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]); await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  const deckTxt=await pop.evaluate(()=>document.body.textContent.replace(/\s+/g,' '));
  console.log('deck mentions:', (deckTxt.match(/a year from Apr 2027|From Apr 2027|mo as shown/g)||[]).join(' | '));
  if(!/a year from Apr 2027/.test(deckTxt) || !/From Apr 2027/.test(deckTxt)) errs.push('the deck should name the start month');
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
