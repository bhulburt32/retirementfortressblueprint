/* Section 06: the account list opens with the section, the four annuity position types, and the Annuities subsection. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext({acceptDownloads:true}); const p=await ctx.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
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
  for(const want of ['MYGA Annuity','Variable Annuity','Income Annuity (FIA)','Growth Annuity (FIA)','RILA Annuity','Cash Value Life Insurance']) if(!posOpts.includes(want)) errs.push('missing position '+want);
  // the transfers table carries the current position, following section 06
  console.log('transfers header:', await p.$eval('#adjTable thead',h=>/Current position/.test(h.textContent)), '| first row:', await p.$eval('#adjBody tr[data-adj]',r=>r.querySelector('select[data-ak=acctId] option:checked').textContent.slice(0,30)+' => '+r.querySelector('[data-fpos]').textContent));
  if(!(await p.$eval('#adjTable thead',h=>/Current position/.test(h.textContent)))) errs.push('transfers table lacks the Current position column');
  const prodOpts=await p.$$eval('#adjBody tr[data-adj]',rs=>rs.slice(0,3).map(r=>[...r.querySelector('select[data-ok=prod]').options].map(o=>o.textContent)));
  console.log('product lists:', JSON.stringify(prodOpts));
  prodOpts.forEach(list=>{ const want=['TBD','Checking/Savings','CD','Money Market','AUM','AUM - Tax Free','Life Insurance Cash Value'].filter(x=>x!==list[0]); if(JSON.stringify(list.slice(1,1+want.length))!==JSON.stringify(want)) errs.push('product list should open with the generic choices: '+JSON.stringify(list)); if(list.some(x=>/Managed portfolio|^MYGA$|^Savings$/.test(x))) errs.push('old generic products still listed'); });
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
  const posCell=await p.$$eval('#adjBody tr[data-adj]',(rs,id)=>rs.filter(r=>r.querySelector('select[data-ak=acctId]').value===String(id)).map(r=>r.querySelector('[data-fpos]').textContent), firstId); console.log('position cells for that account:', JSON.stringify(posCell));
  if(!posCell.length || posCell.some(x=>x!=='MYGA Annuity')) errs.push('the transfers table position should follow section 06');
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
  const incRows=await p.$$eval('#annIncBody tr[data-inc]',rs=>rs.map(r=>r.textContent.replace(/\s+/g,' ').trim().slice(0,120))); console.log('annuity income rows (section 14):', JSON.stringify(incRows));
  if(!incRows.length || !/Inherited IRA/.test(incRows[0])) errs.push('the income annuity should be listed under Annuity income in section 14');
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
  await p.evaluate(j => window.__rfb.loadCaseJson(j), json); await p.waitForTimeout(900);
  R=await rows(); console.log('after reload:', JSON.stringify(R.map(r=>r.type+' '+r.company+(r.companyAuto?' (auto)':''))));
  const re=await p.$eval('#anxBody tr[data-anx] [data-ax="monthly"]:not([disabled])',e=>e.value); console.log('monthly after reload:', re); if(re!=='1,250') errs.push('reload lost the contract details');
  // 5. the worksheet and the deck still build (the deck shows the short label)
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:60000}), p.click('#makePdf')]); console.log('worksheet:', dl.suggestedFilename());
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]); await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  const deck=await pop.evaluate(()=>{ const sl=[...document.querySelectorAll('.sl')].find(s=>/Your Assets and Net Worth/.test(s.textContent) && !/Contents/.test(s.textContent.slice(0,40))); return {incomeFia:/Income FIA/.test(sl.textContent), long:/Income Annuity \(FIA\)/.test(sl.textContent)}; });
  console.log('deck assets page:', JSON.stringify(deck)); if(!deck.incomeFia || deck.long) errs.push('deck should show the short position label'); await pop.close();
  // 6. pasted positions resolve to the right type
  const before=await p.$$eval('#acctBody tr[data-id]',rs=>rs.length);
  await p.$eval('details.paste-box',d=>d.open=true);
  await p.fill('#pasteArea', ['A1\tJeff Smith\tAthene\tNon-Qualified\tMYGA 5yr\t100000','A2\tJeff Smith\tJackson\tNon-Qualified\tVariable annuity\t100000','A3\tJeff Smith\tAllianz\tQualified\tFIA with income rider\t100000','A4\tJeff Smith\tAllianz\tQualified\tFixed indexed annuity\t100000','A5\tJeff Smith\tNY Life\tNon-Qualified\tSPIA\t100000','A6\tJeff Smith\tSchwab\tNon-Qualified\tMutual funds\t100000'].join('\n'));
  await p.click('#pasteAppend'); await p.waitForTimeout(600);
  const m=await p.$$eval('#acctBody tr[data-id] select[data-k="pos"]',ss=>ss.map(s=>s.value)); const added=m.slice(before); console.log('pasted positions:', JSON.stringify(added));
  if(JSON.stringify(added)!==JSON.stringify(['MYGA Annuity','Variable Annuity','Income Annuity (FIA)','Growth Annuity (FIA)','Income Annuity (FIA)','Market'])) errs.push('pasted positions resolved wrongly');
  console.log('annuity rows now:', (await rows()).length);
  // the weighted average fee is measured against every account, the ones marked Stay as is or held back from a partial transfer included
  const fee=await p.evaluate(()=>{ const num=s=>+String(s).replace(/[^0-9.]/g,''); const vals=[...document.querySelectorAll('#acctBody tr[data-id] input[data-k="val"]')].map(i=>num(i.value));
    const tiles=[...document.querySelectorAll('#feePanel .strip div')].map(d=>d.textContent.replace(/\s+/g,' '));
    const w=tiles.find(t=>/Weighted average/.test(t))||'', m=/across \$([0-9,]+)/.exec(w), pct=/([0-9.]+)%/.exec(w);
    const managed=num((tiles.find(t=>/Assets under management/.test(t))||'').match(/\$[0-9,]+/)[0]), rate=+/([0-9.]+)%/.exec(tiles.find(t=>/Advisory fee/.test(t))||'0%')[1]/100;
    const held=[...document.querySelectorAll('#acctBody tr[data-id]')].filter(r=>r.querySelector('select[data-k="move"]').value!=='yes').length;
    return {sumAll:Math.round(vals.reduce((a,v)=>a+v,0)), base:m?num(m[1]):null, weighted:pct?+pct[1]:null, expect:+((managed*rate)/vals.reduce((a,v)=>a+v,0)*100).toFixed(2), heldRows:held}; });
  console.log('fee denominator:', JSON.stringify(fee));
  if(!fee.heldRows) errs.push('the default case should carry an account held out of the plan for this check');
  if(fee.base!==fee.sumAll) errs.push('the weighted average fee should be measured against all accounts ('+fee.sumAll+'), not '+fee.base);
  if(fee.weighted!==fee.expect) errs.push('the weighted average should be the fee over all accounts: '+fee.expect+'%, not '+fee.weighted+'%');
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
