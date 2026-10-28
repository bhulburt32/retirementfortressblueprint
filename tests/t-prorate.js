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
  if(!cells.some(c=>/earlier this year/.test(c)) || !cells.some(c=>/of \$[\d,]+ for the year/.test(c))) errs.push('the first row should note the Social Security earlier in the year and the year’s benefit under Taxable SS: ' + cells.slice(2,6).join(' | '));
  // the senior deduction phases out once per return
  const sen=await p.evaluate(()=>[window.__rfb.fedTax(200000, 0, 0, 2, 'mfj', 1, 2026, 0).senior, window.__rfb.fedTax(200000, 0, 0, 1, 'mfj', 1, 2026, 0).senior, window.__rfb.fedTax(100000, 0, 0, 1, 'single', 1, 2026, 0).senior]);
  console.log('senior deduction, MAGI $200,000 joint both 65 / one 65, $100,000 single:', sen);
  if(Math.abs(sen[0] - 9000) > 1 || Math.abs(sen[1] - 3000) > 1 || Math.abs(sen[2] - 4500) > 1) errs.push('the senior deduction should be $6,000 a person less 6% of the excess once: ' + sen);
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
