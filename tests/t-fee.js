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
  const n=await note(); console.log('note:', n.match(/and \$[\d,]+ of annuity or life insurance money[^.]*\./)?.[0]);
  const excl=n.match(/and \$([\d,]+) of annuity or life insurance money/); if(!excl || Math.abs(num(excl[1]) - (wAmt + rAmt)) > 2) errs.push('the fee note should name the excluded amount ' + (wAmt + rAmt) + ': ' + (excl && excl[1]));
  // 3. the product back to AUM restores the Walls line
  await w.$eval('[data-ok=prod]',e=>{ e.value='AUM'; e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(600);
  const m3=await managed(); console.log('Walls line back to AUM → managed:', m3);
  if(Math.abs(m3 - (m2 + wAmt)) > 2) errs.push('AUM at a carrier is managed money again: ' + m3);
  // 4. the Managed AUM ticks in section 21: untick a default row, tick a default-off row, reload keeps both
  const ticks=async()=>p.$$eval('#holdings input[data-aum]',cs=>cs.map(c=>({k:c.dataset.aum, on:c.checked, amt:c.closest('tr').querySelector('td.num b').textContent})));
  const t0=await ticks(); console.log('ticks:', t0.length, 'on by default:', t0.filter(t=>t.on).length);
  const roofIra=t0.find(t=>/^roof\|ira:client$/.test(t.k)); if(!roofIra || !roofIra.on) errs.push('Jeff Rollover IRA in the Roof should be ticked by default');
  const found=t0.find(t=>/^foundation\|/.test(t.k)); if(!found || found.on) errs.push('a Foundation row should be unticked by default');
  const buf=t0.find(t=>/^reserve\|/.test(t.k)); if(!buf || buf.on) errs.push('the liquidity buffer row should be unticked by default');
  await p.$eval('#holdings input[data-aum="roof|ira:client"]',c=>{ c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(700);
  const m4=await managed(); console.log('Jeff Rollover IRA (Roof) unticked', roofIra.amt, '→ managed:', m4);
  if(Math.abs(m3 - num(roofIra.amt) - m4) > 2) errs.push('unticking a row should take it out of the billable base: ' + m3 + ' - ' + roofIra.amt + ' ≠ ' + m4);
  const tick=async k=>{ await p.$eval('#holdings',(h,k)=>{ const el=h.querySelector('input[data-aum="'+k+'"]'); el.checked=true; el.dispatchEvent(new Event('change',{bubbles:true})); }, k); await p.waitForTimeout(700); };
  await tick(found.k); const m5a=await managed(); console.log('Foundation annuity row ticked', found.amt, '→ managed:', m5a, '(an annuity bills nothing)');
  if(Math.abs(m5a - m4) > 2) errs.push('a ticked annuity row must still bill nothing: ' + m4 + ' → ' + m5a);
  const cellF=await p.$eval('#holdings input[data-aum="'+found.k+'"]',c=>c.closest('td').textContent.replace(/\s+/g,' ').trim()); if(!/\$0 billable/.test(cellF)) errs.push('the ticked annuity row should say $0 billable: ' + cellF);
  await tick(buf.k); const m5=await managed(); console.log('liquidity buffer row ticked', buf.amt, '→ managed:', m5);
  if(Math.abs(m4 + num(buf.amt) - m5) > 2) errs.push('ticking a managed-money row should add it to the billable base: ' + m4 + ' + ' + buf.amt + ' ≠ ' + m5);
  const n2=await note(); if(!/ticked by hand is counted/.test(n2) || !/unticked by hand is left out/.test(n2)) errs.push('the note should name what was set by hand: ' + n2.slice(0,300));
  const json=await p.$eval('#caseJson',e=>e.value); if(!JSON.parse(json).managedAum) errs.push('the ticks should save with the case');
  await p.evaluate(j => window.__rfb.loadCaseJson(j), json); await p.waitForTimeout(900); await p.click('#expandAll'); await p.waitForTimeout(300);
  const m6=await managed(); console.log('after reload managed:', m6); if(Math.abs(m6 - m5) > 2) errs.push('the ticks should survive a reload: ' + m6);
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
