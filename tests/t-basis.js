/* Section 06 cost basis: an input on each taxable account (a dash elsewhere); blank everywhere keeps the 50% gain
   assumption; with a basis entered the taxable accounts carry it on average cost, so a withdrawal's gain is its share
   of the value above basis; basis = value means no gain at first, basis 0 means all gain; it saves with the case. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  await p.click('#scnTabs [data-scn="1"]'); await p.waitForTimeout(700);   // No Moat without Roth: taxable money in the Walls and Roof
  const out=[];
  const run=async()=>p.evaluate(()=>{ const X=window.__rfb.taxLast();
    const rows=X.rows.map(x=>({year:x.year, wdT:x.wd.taxable, cg:x.agiParts.cg, gf:x.gainFrac, basis:x.basis}));
    return {rows, fed:Math.round(X.lifetime), cg:Math.round(rows.reduce((a,x)=>a+x.cg,0)), wdT:Math.round(rows.reduce((a,x)=>a+x.wdT,0))}; });
  const accts=await p.$$eval('#acctBody tr[data-id]',rs=>rs.map(r=>({id:r.dataset.id, name:r.querySelector('input[data-k=name]').value, tax:r.querySelector('select[data-k=tax]').value,
    pos:r.querySelector('select[data-k=pos]').value, val:+r.querySelector('input[data-k=val]').value.replace(/[^0-9.]/g,''), hasBasis:!!r.querySelector('input[data-k=basis]')})));
  const tx=accts.filter(a=>a.hasBasis);
  console.log('accounts:', accts.length, '| with a cost basis input:', tx.map(a=>a.name+' ('+a.tax+', '+a.pos+')').join('; '));
  if(!tx.length) out.push('the Smith plan should have a taxable account with a cost basis input');
  if(accts.some(a=>a.hasBasis && (a.tax==='Qualified' || a.tax==='Roth'))) out.push('qualified and Roth accounts should not take a cost basis');
  const cell=a=>`#acctBody tr[data-id="${a.id}"] input[data-k=basis]`;
  const setAll=async v=>{ for(const a of tx){ await p.fill(cell(a), v===null?'':String(typeof v==='function'?v(a):v)); await p.keyboard.press('Tab'); await p.waitForTimeout(300); } await p.waitForTimeout(500); };

  // 1. blank: half of every taxable withdrawal is gain
  const B=await run();
  console.log('blank: taxable withdrawals', B.wdT, '| gains', B.cg, '| federal', B.fed);
  if(B.rows.some(x=>Math.abs(x.cg-0.5*x.wdT)>0.5 || x.basis!=null)) out.push('with no basis entered, gains should be half the taxable withdrawals');

  // 2. basis = value: no gain on the first draws, the gain share rising with growth; less tax
  await setAll(a=>a.val);
  const V=await run(), firstV=V.rows.find(x=>x.wdT>0.5), lastV=[...V.rows].reverse().find(x=>x.wdT>0.5);
  console.log('basis = value: gains', V.cg, '| federal', V.fed, '| gain share first draw', firstV?(firstV.year+' '+(firstV.gf*100).toFixed(1)+'%'):'-', '| last', lastV?(lastV.year+' '+(lastV.gf*100).toFixed(1)+'%'):'-');
  if(V.rows.some(x=>Math.abs(x.cg-x.wdT*x.gf)>0.5)) out.push('gains should be the withdrawal times the year\'s gain share');
  if(!(firstV && firstV.gf<0.1)) out.push('with basis = value the first draw should carry little gain');
  if(!(V.cg<B.cg && V.fed<=B.fed)) out.push('basis = value should mean less gain and no more tax than the 50% assumption ('+V.cg+' vs '+B.cg+')');

  // 3. basis 0: every dollar drawn is gain; more tax
  await setAll(0);
  const Z=await run();
  console.log('basis 0: gains', Z.cg, '| taxable withdrawals', Z.wdT, '| federal', Z.fed);
  if(Z.rows.some(x=>x.wdT>0.5 && Math.abs(x.cg-x.wdT)>0.5)) out.push('with basis 0 every taxable withdrawal should be gain');
  if(!(Z.fed>=B.fed)) out.push('basis 0 should mean no less tax than the 50% assumption');

  // 4. it saves with the case; a qualified account has no basis cell
  const saved=await p.evaluate(()=>{ try { return JSON.parse(document.getElementById('caseJson').value).accounts.filter(a=>a.basis!=null).map(a=>a.name+':'+a.basis); } catch(e){ return 'no case JSON: '+e; } });
  console.log('saved bases:', JSON.stringify(saved));
  if(!Array.isArray(saved) || saved.length!==tx.length) out.push('the cost basis should save with the case');
  const t0=tx[0];
  await p.selectOption(`#acctBody tr[data-id="${t0.id}"] select[data-k=tax]`,'Qualified'); await p.waitForTimeout(500);
  const gone=!(await p.$(cell(t0)));
  await p.selectOption(`#acctBody tr[data-id="${t0.id}"] select[data-k=tax]`,t0.tax); await p.waitForTimeout(500);
  const back=!!(await p.$(cell(t0)));
  console.log('tax type to Qualified hides the basis:', gone, '| back to', t0.tax, 'shows it:', back);
  if(!gone || !back) out.push('the basis cell should follow the account\'s tax type');

  // 5. cleared: back to the 50% assumption, the same figures
  await setAll(null);
  const C=await run();
  console.log('cleared: gains', C.cg, '| federal', C.fed);
  if(C.cg!==B.cg || C.fed!==B.fed) out.push('clearing every basis should restore the 50% figures');

  console.log('ERRORS:', errs.length||out.length ? [...errs, ...out] : 'none');
  await b.close();
})();
