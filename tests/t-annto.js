/* Section 14: an annuity in force can be picked as a line's To account; the carrier, product and tax type follow
   the contract, the registration carries its name and carrier, and the pick survives a case reload. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  // a Qualified roof line from an account that is not itself an annuity
  const rows=await p.$$('#adjBody tr[data-adj]');
  let target=null;
  for(const r of rows){ const acct=await r.$eval('[data-ak=acctId] option:checked',e=>e.textContent); const bk=await r.$eval('[data-ak=bucket]',e=>e.value); if(bk==='roof' && !/Annuity|Sentinel|Heritage/.test(acct)){ target=r; break; } }
  console.log('target found:', !!target, target && await target.$eval('[data-ak=acctId] option:checked',e=>e.textContent));
  const opts=await target.$$eval('[data-ok=to] option',os=>os.map(o=>o.textContent));
  console.log('To options:', JSON.stringify(opts));
  for(const n of ['Fixed Annuity','RILA Annuity','Variable Annuity2']) if(!opts.includes(n)) errs.push('annuity in force should be offered as a To account: ' + n);
  if(opts.some(o=>/Sentinel|Investor/.test(o))) errs.push('an income annuity in payment should not be offered');
  // pick the MYGA (Non-Qualified, ISDA Financial Life)
  await target.$eval('[data-ok=to]',e=>{ e.value='Fixed Annuity'; e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(500);
  const to=await target.$eval('[data-ok=to] option:checked',e=>e.textContent), ttax=await target.$eval('[data-ttax]',e=>e.textContent);
  const cust=await target.$eval('[data-ok=cust] option:checked',e=>e.textContent), prod=await target.$eval('[data-ok=prod] option:checked',e=>e.textContent);
  console.log('to:', to, '| tax:', ttax, '| carrier:', cust, '| product:', prod);
  if(to!=='Fixed Annuity') errs.push('the pick should hold');
  if(ttax!=='Non-Qualified') errs.push('the tax type should follow the contract: ' + ttax);
  if(cust!=='ISDA Financial Life') errs.push('the carrier should follow the contract: ' + cust);
  if(prod!=='MYGA') errs.push('the product should follow the contract: ' + prod);
  // the registration: ending positions and the transfer sequence carry the contract's name and carrier
  const hold=await txt('#holdings'), steps=await txt('#steps');
  const m=hold.match(/Fixed Annuity.{0,120}/g); console.log('holdings:', m && m.slice(0,3));
  if(!/Fixed Annuity/.test(hold)) errs.push('ending positions should carry the contract');
  if(!/ISDA Financial Life/.test(hold)) errs.push('ending positions should carry the contract’s carrier');
  if(!/Fixed Annuity/.test(steps)) errs.push('the transfer sequence should carry the contract');
  // reload keeps it
  const json=await p.$eval('#caseJson',e=>e.value); await p.evaluate(j => window.__rfb.loadCaseJson(j), json); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const again=await p.$$eval('#adjBody tr[data-adj]',trs=>trs.map(tr=>tr.querySelector('[data-ok=to] option:checked').textContent)).then(a=>a.filter(x=>x==='Fixed Annuity').length);
  console.log('lines to the contract after reload:', again); if(again<1) errs.push('the pick should survive a reload');
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
