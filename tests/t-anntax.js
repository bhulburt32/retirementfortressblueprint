/* Annuity income and the Walls yield in the tax projection: a federally tax-free Walls yield (section 14),
   annuity income taxable unless it is paid from a Roth account, and the stress-test results on the scenario cards. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext({acceptDownloads:true}); const p=await ctx.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  await p.click('#scnTabs [data-scn="0"]'); await p.waitForTimeout(500);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  const tile=async(box,label)=>p.$eval(box,(e,l)=>{ const d=[...e.querySelectorAll('div')].find(x=>x.querySelector('dt') && x.querySelector('dt').textContent.trim().toLowerCase().startsWith(l)); return d? +d.querySelector('dd').textContent.replace(/[^0-9.-]/g,'') : NaN; }, label);
  const figs=async()=>({fed:await tile('#taxTiles','lifetime federal'), state:await tile('#taxTiles','lifetime pennsylvania'), end:await tile('#assetTiles','at end of plan')});
  const acct=async name=>p.$$eval('#acctBody tr[data-id]',(rs,n)=>{ const r=rs.find(x=>x.querySelector('input[data-k=name]').value.trim()===n); return r? r.dataset.id : null; }, name);
  const cell=async(id,k,v)=>{ const sel=`#anxBody tr[data-anx="${id}"] [data-ax="${k}"]`; const tag=await p.$eval(sel,e=>e.tagName); if(tag==='SELECT'){ await p.selectOption(sel,v); } else { await p.fill(sel,v); await p.$eval(sel,e=>{e.dispatchEvent(new Event('input',{bubbles:true})); e.blur();}); } await p.waitForTimeout(500); };
  const cards=async()=>p.$$eval('#scnGrid .scn-card',cs=>cs.map(c=>[...c.querySelectorAll('dl div')].map(d=>d.textContent.replace(/\s+/g,' ').trim())));
  const base=await figs(); console.log('baseline:', JSON.stringify(base));
  // 1. the scenario cards carry the three stress tests, and the viewed scenario's match section 18
  const C=await cards(); console.log('card A rows:', JSON.stringify(C[0].slice(-4)));
  if(!C.every(c=>c.some(x=>/^Stress tests/.test(x)) && c.some(x=>/^Sequence of returns/.test(x)) && c.some(x=>/^Social Security cut/.test(x)) && c.some(x=>/^Higher inflation/.test(x)))) errs.push('every scenario card should carry the three stress-test rows');
  const cardNum=(c,label)=>{ const x=c.find(r=>r.startsWith(label)); return x ? +x.replace(label,'').replace(/\s*\d{4}$/,'').replace(/[^0-9.-]/g,'') : NaN; };
  for(const [key,label] of [['sensseq','Sequence of returns'],['sensss','Social Security cut'],['sensinfl','Higher inflation']]){
    const sec18=await tile('#'+key+'Tiles','at end of plan'), card=cardNum(C[0],label); console.log(label+':', card, '| section 18:', sec18);
    if(Math.abs(card-sec18)>1) errs.push(label+' on the card should match section 18 ('+card+' vs '+sec18+')');
  }
  // 2. the Walls yield federally tax-free: no change while the Walls hold only IRA money, a lower federal tax once a non-qualified account is in the Walls
  await p.$eval('#adjYWtf',e=>{ e.checked=true; e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(700);
  const tfIra=await figs(); console.log('tax-free, IRA-funded Walls:', JSON.stringify(tfIra), '| msg mentions tax-free:', /federally tax-free/.test(await txt('#adjIncMsg')));
  if(!/federally tax-free/.test(await txt('#adjIncMsg'))) errs.push('the section 14 line should say the yield is federally tax-free');
  const at=await acct('After Tax'); const line=await p.$$eval('#adjBody tr[data-adj]',(rs,id)=>{ const r=rs.find(x=>x.querySelector('select[data-ak=acctId]').value===String(id)); return r? r.dataset.adj : null; }, at);
  await p.selectOption(`#adjBody tr[data-adj="${line}"] select[data-ak="bucket"]`,'walls'); await p.waitForTimeout(700);
  const tfNq=await figs(); console.log('tax-free, After Tax in the Walls:', JSON.stringify(tfNq));
  await p.$eval('#adjYWtf',e=>{ e.checked=false; e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(700);
  const txNq=await figs(); console.log('taxable, After Tax in the Walls:', JSON.stringify(txNq));
  if(!(tfNq.fed<txNq.fed-100)) errs.push('a federally tax-free yield on non-qualified Walls money should cut the federal tax ('+tfNq.fed+' vs '+txNq.fed+')');
  if(!(tfNq.end>txNq.end)) errs.push('less tax should leave more at the end of plan');
  if(Math.abs(tfNq.state-txNq.state)>1) errs.push('the state model should be unchanged by the federal exemption ('+tfNq.state+' vs '+txNq.state+')');
  console.log('assumptions mention:', /federally tax-free/.test(await txt('#taxAssume')) ? 'taxable wording (box off)' : 'ok');
  await p.$eval('#adjYWtf',e=>{ e.checked=true; e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(700);
  if(!/federally tax-free/.test(await txt('#taxAssume'))) errs.push('the section 16 assumptions should say the Walls yield is federally tax-free');
  // saved and reloaded with the case
  const json=await p.$eval('#caseJson',e=>e.value), d=JSON.parse(json); console.log('saved incomeAdj:', JSON.stringify(d.incomeAdj));
  if(d.incomeAdj.yWtf!=='yes') errs.push('the tax-free flag should save with the case');
  await p.fill('#caseJson', json); await p.click('#loadCase'); await p.waitForTimeout(900); await p.click('#expandAll'); await p.waitForTimeout(300);
  console.log('after reload: box checked', await p.$eval('#adjYWtf',e=>e.checked), '| federal:', (await figs()).fed);
  if(!(await p.$eval('#adjYWtf',e=>e.checked))) errs.push('reload lost the tax-free flag');
  if(Math.abs((await figs()).fed-tfNq.fed)>1) errs.push('reload changed the federal tax ('+(await figs()).fed+' vs '+tfNq.fed+')');
  await p.click('#adjIncReset'); await p.waitForTimeout(700); console.log('after reset: box checked', await p.$eval('#adjYWtf',e=>e.checked));
  if(await p.$eval('#adjYWtf',e=>e.checked)) errs.push('Follow the plan assumptions should clear the flag');
  // 3. annuity income is taxable unless it comes from a Roth account
  const inc=await acct("Investor's Heritage"); const q=await figs();
  await p.selectOption(`#acctBody tr[data-id="${inc}"] select[data-k="tax"]`,'Roth'); await p.waitForTimeout(700);
  const roth=await figs(); console.log('income annuity qualified:', JSON.stringify(q), '| Roth:', JSON.stringify(roth));
  if(!(roth.fed<q.fed-100)) errs.push('a Roth income annuity should not be taxed ('+roth.fed+' vs '+q.fed+')');
  await p.selectOption(`#acctBody tr[data-id="${inc}"] select[data-k="tax"]`,'Non-Qualified'); await p.waitForTimeout(700);
  const nq=await figs(); console.log('income annuity non-qualified:', JSON.stringify(nq));
  if(!(nq.fed<q.fed && nq.fed>roth.fed)) errs.push('a non-qualified income annuity should be taxed on part of its payout ('+nq.fed+' between '+roth.fed+' and '+q.fed+')');
  await p.selectOption(`#acctBody tr[data-id="${inc}"] select[data-k="tax"]`,'Qualified'); await p.waitForTimeout(700);
  if(Math.abs((await figs()).fed-q.fed)>1) errs.push('restoring Qualified should restore the tax');
  // a MYGA paying its interest: taxable, unless the contract is Roth
  const my=await acct('Fixed Annuity'); await cell(my,'rate','5'); await cell(my,'interest','taken'); const myNq=await figs();
  await p.selectOption(`#acctBody tr[data-id="${my}"] select[data-k="tax"]`,'Roth'); await p.waitForTimeout(700); const myRoth=await figs();
  console.log('MYGA interest taken, non-qualified:', JSON.stringify(myNq), '| Roth:', JSON.stringify(myRoth));
  if(!(myRoth.fed<myNq.fed-50)) errs.push('Roth MYGA interest should not be taxed ('+myRoth.fed+' vs '+myNq.fed+')');
  await p.selectOption(`#acctBody tr[data-id="${my}"] select[data-k="tax"]`,'Non-Qualified'); await cell(my,'interest','deferred'); await cell(my,'rate','');
  // a section 04 annuity line linked to a Roth account
  const lineBefore=await figs(); const jr=await acct("Jeff's Roth IRA");
  await p.selectOption('#annBody tr[data-ann] select[data-ak2="acctId"]', String(jr)); await p.waitForTimeout(700);
  const lineRoth=await figs(); console.log('section 04 line unlinked:', JSON.stringify(lineBefore), '| linked to a Roth IRA:', JSON.stringify(lineRoth));
  if(!(lineRoth.fed<lineBefore.fed-100)) errs.push('an annuity line paid from a Roth account should not be taxed ('+lineRoth.fed+' vs '+lineBefore.fed+')');
  await p.selectOption('#annBody tr[data-ann] select[data-ak2="acctId"]', ''); await p.waitForTimeout(700);
  if(Math.abs((await figs()).fed-lineBefore.fed)>1) errs.push('unlinking the line should restore the tax');
  // 4. the worksheet and the deck still build
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:60000}), p.click('#makePdf')]); console.log('worksheet:', dl.suggestedFilename());
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]); await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  const over=await pop.$$eval('.tx',els=>els.filter(e=>e.scrollHeight-e.clientHeight>6).length); console.log('deck slides:', await pop.$$eval('.sl',s=>s.length), 'overflow:', over); if(over) errs.push('deck overflow '+over); await pop.close();
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
