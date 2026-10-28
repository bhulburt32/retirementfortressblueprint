/* Advisory fee: annuity and life insurance money is never billable. A Walls line placed in a carrier's annuity
   product and a Roof line sent to an annuity in force both leave the billable base; the note names the amount. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const num=t=>+String(t).replace(/[^0-9.-]/g,'');
  const managed=async()=>num((await p.$eval('#feePanel .bkt-total',e=>e.textContent)));
  const note=async()=>(await p.$eval('#feePanel .fee-note',e=>e.textContent)).replace(/\s+/g,' ').trim();
  const m0=await managed(); console.log('managed before:', m0);
  const rows=await p.$$('#adjBody tr[data-adj]');
  const find=async(bk, re)=>{ for(const r of rows){ const acct=await r.$eval('[data-ak=acctId] option:checked',e=>e.textContent); const b=await r.$eval('[data-ak=bucket]',e=>e.value); if(b===bk && re.test(acct)) return r; } return null; };
  // 1. a Walls line placed in a carrier's annuity product
  const w=await find('walls', /Variable Annuity2/); const wAmt=num(await w.$eval('[data-ak=amt]',e=>e.value));
  await w.$eval('[data-ok=cust]',e=>{ e.value='Athene Annuity & Life (incl. Annexus-distributed)'; e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(500);
  const prods=await w.$$eval('[data-ok=prod] option',os=>os.map(o=>o.value)); const prod=prods.find(v=>/Athene/.test(v));
  await w.$eval('[data-ok=prod]',(e,v)=>{ e.value=v; e.dispatchEvent(new Event('change',{bubbles:true})); }, prod); await p.waitForTimeout(600);
  const m1=await managed(); console.log('Walls line', wAmt, 'into', prod, '→ managed:', m1);
  if(Math.abs(m0 - wAmt - m1) > 2) errs.push('a Walls line in an annuity product should leave the billable base: ' + m0 + ' - ' + wAmt + ' ≠ ' + m1);
  // 2. a Roof line sent to an annuity in force
  const r=await find('roof', /Jane's Roth IRA/); const rAmt=num(await r.$eval('[data-ak=amt]',e=>e.value));
  await r.$eval('[data-ok=to]',e=>{ e.value='Fixed Annuity'; e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(600);
  const m2=await managed(); console.log('Roof line', rAmt, 'to the MYGA in force → managed:', m2);
  if(Math.abs(m1 - rAmt - m2) > 2) errs.push('a Roof line sent to an annuity in force should leave the billable base: ' + m1 + ' - ' + rAmt + ' ≠ ' + m2);
  const n=await note(); console.log('note:', n.match(/Annuity and life insurance money[^.]*\./)?.[0]);
  const excl=n.match(/never billable, wherever it sits: \$([\d,]+)/); if(!excl || Math.abs(num(excl[1]) - (wAmt + rAmt)) > 2) errs.push('the fee note should name the excluded amount ' + (wAmt + rAmt) + ': ' + (excl && excl[1]));
  // 3. the product back to AUM restores the Walls line
  await w.$eval('[data-ok=prod]',e=>{ e.value='AUM'; e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(600);
  const m3=await managed(); console.log('Walls line back to AUM → managed:', m3);
  if(Math.abs(m3 - (m2 + wAmt)) > 2) errs.push('AUM at a carrier is managed money again: ' + m3);
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
