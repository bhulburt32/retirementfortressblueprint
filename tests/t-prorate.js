const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(800);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const row=async(n)=>p.$eval('#incSrcTable tbody tr:nth-child('+n+')',e=>e.textContent.replace(/\s+/g,' ').trim());
  console.log('prepDate:', await p.$eval('#prepDate',e=>e.value));
  console.log('2026 row:', (await row(1)).slice(0,200));
  console.log('2027 row:', (await row(2)).slice(0,200));
  console.log('sq assume:', (await p.$eval('#sqAssume',e=>e.textContent)).match(/first year[^.]*\./)?.[0]);
  console.log('asset assume:', (await p.$eval('#assetAssume',e=>e.textContent)).match(/The first year[^.]*\./)?.[0]);
  await p.fill('#prepDate','2026-01-15'); await p.$eval('#prepDate',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(400);
  console.log('Jan prep 2026 row:', (await row(1)).slice(0,120));
  await p.fill('#prepDate','2026-07-01'); await p.$eval('#prepDate',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(400);
  console.log('Jul prep 2026 row:', (await row(1)).slice(0,120));
  // income already in payment before the plan date is annualized in the first year's tax base: federal, Social Security and state
  await p.fill('#prepDate','2026-10-08'); await p.$eval('#prepDate',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(300);
  const set=async(id,v)=>{ await p.fill('#'+id, v); await p.$eval('#'+id,e=>e.dispatchEvent(new Event('input',{bubbles:true}))); };
  await set('salaryC','120,000'); await p.fill('#retireC','2027-06'); await p.$eval('#retireC',e=>e.dispatchEvent(new Event('input',{bubbles:true})));
  await p.selectOption('#ssAgeC', '62'); await p.$eval('#ngAdd',e=>e.click()); await p.waitForTimeout(200);
  await p.$eval('#ngBody', body=>{ const rows=body.querySelectorAll('tr[data-ng]'); const tr=rows[rows.length-1]; const a=tr.querySelector('[data-nk=amt]'); a.value='2,000'; a.dispatchEvent(new Event('input',{bubbles:true})); const st=tr.querySelector('[data-nk=start]'); st.value='2024-01'; st.dispatchEvent(new Event('input',{bubbles:true})); st.dispatchEvent(new Event('change',{bubbles:true})); const o=tr.querySelector('[data-nk=ongoing]'); if(!o.checked){ o.checked=true; o.dispatchEvent(new Event('change',{bubbles:true})); } });
  await p.waitForTimeout(900);
  const R=await p.evaluate(()=>{ const X=window.__rfb.taxLast(); const r=X.rows[0]; return {year:r.year, emp:r.incParts.emp, ng:r.incParts.ng, ss:r.ss, preSS:r.preSS, pre:r.agiParts.pre, ssTaxable:r.ssTaxable, prov:r.prov, gross:r.gross, stateTax:r.stateTax, stateTaxable:r.stateTaxable, conv:r.agiParts.conv}; });
  console.log('first year with pre-plan income:', JSON.stringify(Object.fromEntries(Object.entries(R).map(([k,v])=>[k, typeof v==='number'?Math.round(v):v]))));
  if(!(R.pre > 100000)) errs.push('wages and other income before the plan date should sit in the first year’s tax base: pre ' + R.pre);
  if(!(R.preSS > 0.5) || Math.abs(R.ssTaxable - 0.85 * (R.ss + R.preSS)) > 2) errs.push('taxable Social Security should be 85% of the whole year’s benefit: ' + R.ssTaxable + ' of ' + (R.ss + R.preSS));
  const share = R.gross / (R.gross + R.pre + R.preSS), fullSt = 0.0307 * (120000 + 24000 + R.stateTaxable - (R.emp + R.ng) * 0 - 0);   // Pennsylvania: 3.07% of the year's wages and other income (the plan window plus earlier) and the gains
  const wantSt = 0.0307 * ((R.emp + R.ng) + (R.pre - 932)) * share;   // the annuity’s $932 of pre-plan income is retirement income, untaxed in PA
  if(!(R.stateTax > 500) || Math.abs(R.stateTax - wantSt) > 60) errs.push('the first year’s state tax should be the plan’s share of the whole year’s: ' + Math.round(R.stateTax) + ' vs about ' + Math.round(wantSt));
  const cells=await p.$$eval('#taxTable tbody tr:first-child td', tds=>tds.map(td=>td.textContent.replace(/\s+/g,' ').trim()));
  if(!cells.some(c=>/incl\. \$[\d,]+ before the plan date/.test(c)) || !cells.some(c=>/of \$[\d,]+ for the year/.test(c))) errs.push('the first row should note the income before the plan date and the year’s benefit under Taxable SS: ' + cells.slice(2,6).join(' | '));
  // a couple already on Social Security with a pension in payment, the plan prepared in late October: the first calendar
  // year carries the whole year's benefit and pension, and the draws before the plan date at the plan's pace, so the
  // taxable Social Security is in line with a full year's; the table's first row shows the year's figures
  const d=JSON.parse(await p.evaluate(()=>window.__rfb.caseData()));
  d.household.prepDate='2026-10-28'; d.household.clientDob='1956-07-17'; d.household.spouseDob='1960-03-14'; d.household.clientAge=70; d.household.spouseAge=66;
  d.household.employment.client.salary=0; d.household.employment.spouse.salary=0; d.household.employment.extra=[];
  d.household.benefits.ss.client={pia:4200, age:67}; d.household.benefits.ss.spouse={pia:4200, age:70};
  d.household.benefits.pensions=[{who:'client', name:'Pension', amt:1409, start:'2024-07', cola:0, surv:50}]; d.household.benefits.nonGuar=[]; d.household.benefits.annuities=[];
  await p.evaluate(j=>window.__rfb.loadCaseJson(j), JSON.stringify(d)); await p.waitForTimeout(1500); await p.click('#expandAll'); await p.waitForTimeout(300);
  const A=await p.evaluate(()=>{ const X=window.__rfb.taxLast(); const f=r=>({year:r.year, ss:Math.round(r.ss), preSS:Math.round(r.preSS), pen:Math.round(r.incParts.pen), prePen:Math.round(r.preParts?r.preParts.pen:0), wdT:Math.round(r.wd.taxable), preWdT:Math.round(r.preParts?r.preParts.wdTaxable:0), prov:Math.round(r.prov), ssTaxable:Math.round(r.ssTaxable)}); return {r0:f(X.rows[0]), r1:f(X.rows[1])}; });
  console.log('couple on Social Security, plan from late October:', JSON.stringify(A));
  if(Math.abs(A.r0.ss + A.r0.preSS - 53088) > 80) errs.push('the first calendar year should carry the whole year’s benefit, about $53,088: ' + (A.r0.ss + A.r0.preSS));
  if(Math.abs(A.r0.pen + A.r0.prePen - 16908) > 2) errs.push('the first calendar year should carry the whole year’s pension $16,908: ' + (A.r0.pen + A.r0.prePen));
  if(!(A.r0.preWdT > 0.5)) errs.push('the draws before the plan date should be carried at the plan’s pace');
  if(!(A.r0.ssTaxable > 0.75 * A.r1.ssTaxable && A.r0.ssTaxable < 1.3 * A.r1.ssTaxable)) errs.push('the first year’s taxable Social Security should be in line with a full year’s: ' + A.r0.ssTaxable + ' vs ' + A.r1.ssTaxable + ' in ' + A.r1.year);
  const fy=await p.$$eval('#taxTable tbody tr:first-child td', tds=>tds.map(td=>td.textContent.replace(/\s+/g,' ').trim()));
  if(!fy.some(c=>/^\$16,908/.test(c) && /before the plan date/.test(c))) errs.push('the Pensions cell should show the whole year’s pension with the pre-plan note: ' + fy.slice(2,6).join(' | '));
  if(!fy.some(c=>/^\$53,0\d\d/.test(c) && /before the plan date/.test(c))) errs.push('the Social Security cell should show the whole year’s benefit: ' + fy.slice(2,6).join(' | '));
  // the senior deduction phases out once per return
  const sen=await p.evaluate(()=>[window.__rfb.fedTax(200000, 0, 0, 2, 'mfj', 1, 2026, 0).senior, window.__rfb.fedTax(200000, 0, 0, 1, 'mfj', 1, 2026, 0).senior, window.__rfb.fedTax(100000, 0, 0, 1, 'single', 1, 2026, 0).senior]);
  console.log('senior deduction, MAGI $200,000 joint both 65 / one 65, $100,000 single:', sen);
  if(Math.abs(sen[0] - 9000) > 1 || Math.abs(sen[1] - 3000) > 1 || Math.abs(sen[2] - 4500) > 1) errs.push('the senior deduction should be $6,000 a person less 6% of the excess once: ' + sen);
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
