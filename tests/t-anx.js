/* Section 06: the account list opens with the section, the four annuity position types, and the Annuities subsection. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext({acceptDownloads:true}); const p=await ctx.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  // 1. opening the Assets section opens the account list
  const listClosed=async()=>p.$eval('#acctSec .tgl-head.tbl-head',h=>h.classList.contains('closed'));
  console.log('before: section closed', await p.$eval('#acctSec',s=>s.classList.contains('closed')), '| list closed', await listClosed());
  await p.click('#acctSec .sec-head h2'); await p.waitForTimeout(300);
  console.log('after click: section closed', await p.$eval('#acctSec',s=>s.classList.contains('closed')), '| list closed', await listClosed());
  if(await listClosed()) errs.push('the account list should open with the section');
  await p.click('#expandAll'); await p.waitForTimeout(300);
  // 2. the position choices
  const posOpts=await p.$eval('#acctBody select[data-k="pos"]',s=>[...s.options].map(o=>o.value)); console.log('positions:', JSON.stringify(posOpts));
  for(const want of ['MYGA Annuity','Variable Annuity','Income Annuity (FIA)','Growth Annuity (FIA)','RILA Annuity']) if(!posOpts.includes(want)) errs.push('missing position '+want);
  if(posOpts.includes('Annuity')) errs.push('the plain Annuity position should be gone');
  // 3. the Annuities subsection follows the annuity positions (the Smith case has three generic ones)
  const rows=async()=>p.$$eval('#anxBody tr[data-anx]',rs=>rs.map(r=>({id:r.dataset.anx, owner:r.querySelector('[data-af=owner]').textContent, name:r.querySelector('[data-af=name]').textContent, type:r.querySelector('select').value,
    company:r.querySelector('[data-ax=company]').value, companyAuto:r.querySelector('[data-ax=company]').classList.contains('auto'),
    rateOn:!r.querySelector('[data-ax=rate]').disabled, monthlyOn:!r.querySelector('[data-ax=monthly]').disabled, capOn:!r.querySelector('[data-ax=cap]').disabled})));
  console.log('annuity rows at load:', JSON.stringify(await rows()));
  console.log('msg:', await txt('#anxMsg'));
  // set the first account's position to MYGA from the account list: the row changes type and the rate cell opens
  const firstId=await p.$eval('#acctBody tr[data-id]',r=>r.dataset.id);
  await p.selectOption(`#acctBody tr[data-id="${firstId}"] select[data-k="pos"]`,'MYGA Annuity'); await p.waitForTimeout(500);
  let R=await rows(); const my=R.find(r=>r.id===firstId); console.log('after MYGA:', JSON.stringify(my));
  if(!my || !my.rateOn || my.monthlyOn || my.capOn) errs.push('a MYGA row should enable the rate and nothing FIA-only');
  // type a rate, fees, maturity and a company
  const tr=`#anxBody tr[data-anx="${firstId}"]`;
  await p.fill(tr+' [data-ax="rate"]','5.25'); await p.$eval(tr+' [data-ax="rate"]',e=>{e.dispatchEvent(new Event('input',{bubbles:true})); e.blur();});
  await p.fill(tr+' [data-ax="fees"]','0.5'); await p.$eval(tr+' [data-ax="fees"]',e=>{e.dispatchEvent(new Event('input',{bubbles:true})); e.blur();});
  await p.fill(tr+' [data-ax="maturity"]','2031-06'); await p.$eval(tr+' [data-ax="maturity"]',e=>e.dispatchEvent(new Event('change',{bubbles:true})));
  await p.fill(tr+' [data-ax="company"]','Athene'); await p.$eval(tr+' [data-ax="company"]',e=>{e.dispatchEvent(new Event('input',{bubbles:true})); e.blur();});
  await p.waitForTimeout(300);
  console.log('typed:', await p.$eval(tr,r=>[...r.querySelectorAll('input')].map(i=>i.getAttribute('data-ax')+'='+i.value).join(' ')));
  // change the type from the subsection: the account list follows, monthly income opens
  await p.selectOption(tr+' select[data-ax="pos"]','Income Annuity (FIA)'); await p.waitForTimeout(500);
  console.log('account list pos:', await p.$eval(`#acctBody tr[data-id="${firstId}"] select[data-k="pos"]`,s=>s.value));
  R=await rows(); const inc=R.find(r=>r.id===firstId); console.log('after Income FIA:', JSON.stringify(inc));
  if((await p.$eval(`#acctBody tr[data-id="${firstId}"] select[data-k="pos"]`,s=>s.value))!=='Income Annuity (FIA)') errs.push('the account list should follow the type picked in the subsection');
  if(!inc.monthlyOn || !inc.capOn || inc.rateOn) errs.push('an income FIA row should enable monthly, cap and participation, not the MYGA rate');
  await p.fill(tr+' [data-ax="monthly"]','1,250'); await p.$eval(tr+' [data-ax="monthly"]',e=>{e.dispatchEvent(new Event('input',{bubbles:true})); e.blur();});
  await p.fill(tr+' [data-ax="cap"]','8'); await p.$eval(tr+' [data-ax="cap"]',e=>{e.dispatchEvent(new Event('input',{bubbles:true})); e.blur();});
  await p.fill(tr+' [data-ax="part"]','100'); await p.$eval(tr+' [data-ax="part"]',e=>{e.dispatchEvent(new Event('input',{bubbles:true})); e.blur();}); await p.waitForTimeout(300);
  // the fees typed earlier survived the type change
  console.log('after edits:', await p.$eval(tr,r=>[...r.querySelectorAll('input')].map(i=>i.getAttribute('data-ax')+'='+i.value).join(' ')));
  // 4. saved with the case and reloaded
  const json=await p.$eval('#caseJson',e=>e.value), d=JSON.parse(json); const saved=d.accounts.find(a=>a.pos==='Income Annuity (FIA)'); console.log('saved:', JSON.stringify(saved));
  if(!saved || !saved.ann || saved.ann.fees!==0.005 || saved.ann.monthly!==1250 || saved.ann.cap!==0.08 || saved.ann.part!==1 || saved.ann.maturity!=='2031-06' || saved.ann.company!=='Athene') errs.push('contract details not saved');
  await p.fill('#caseJson', json); await p.click('#loadCase'); await p.waitForTimeout(900);
  R=await rows(); console.log('after reload:', JSON.stringify(R.map(r=>r.type+' '+r.company+(r.companyAuto?' (auto)':''))));
  const re=await p.$eval('#anxBody tr[data-anx] [data-ax="monthly"]:not([disabled])',e=>e.value); console.log('monthly after reload:', re); if(re!=='1,250') errs.push('reload lost the contract details');
  // 5. the worksheet and the deck still build (the deck shows the short label)
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:60000}), p.click('#makePdf')]); console.log('worksheet:', dl.suggestedFilename());
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]); await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  const deck=await pop.evaluate(()=>{ const sl=[...document.querySelectorAll('.sl')].find(s=>/Your Assets and Net Worth/.test(s.textContent)); return {incomeFia:/Income FIA/.test(sl.textContent), long:/Income Annuity \(FIA\)/.test(sl.textContent)}; });
  console.log('deck assets page:', JSON.stringify(deck)); if(!deck.incomeFia || deck.long) errs.push('deck should show the short position label'); await pop.close();
  // 6. pasted positions resolve to the right type
  const before=await p.$$eval('#acctBody tr[data-id]',rs=>rs.length);
  await p.$eval('details.paste-box',d=>d.open=true);
  await p.fill('#pasteArea', ['A1\tJeff Smith\tAthene\tNon-Qualified\tMYGA 5yr\t100000','A2\tJeff Smith\tJackson\tNon-Qualified\tVariable annuity\t100000','A3\tJeff Smith\tAllianz\tQualified\tFIA with income rider\t100000','A4\tJeff Smith\tAllianz\tQualified\tFixed indexed annuity\t100000','A5\tJeff Smith\tNY Life\tNon-Qualified\tSPIA\t100000','A6\tJeff Smith\tSchwab\tNon-Qualified\tMutual funds\t100000'].join('\n'));
  await p.click('#pasteAppend'); await p.waitForTimeout(600);
  const m=await p.$$eval('#acctBody tr[data-id] select[data-k="pos"]',ss=>ss.map(s=>s.value)); const added=m.slice(before); console.log('pasted positions:', JSON.stringify(added));
  if(JSON.stringify(added)!==JSON.stringify(['MYGA Annuity','Variable Annuity','Income Annuity (FIA)','Growth Annuity (FIA)','Income Annuity (FIA)','Market'])) errs.push('pasted positions resolved wrongly');
  console.log('annuity rows now:', (await rows()).length);
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
