/* Section 14, Walls income by account: one row per Walls line, each on its own start and stop dates, total yield,
   distribution rate and growth before and after; restarts; the yield above the distribution reinvested (a distribution
   above the yield comes out of the balance); blank table = the pooled Walls lines, figures unchanged; per scenario;
   the deck's Walls slide. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext(); const p=await ctx.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  await p.click('#scnTabs [data-scn="0"]'); await p.waitForTimeout(500);
  const tile=async(box,label)=>p.$eval(box,(e,l)=>{ const d=[...e.querySelectorAll('div')].find(x=>x.querySelector('dt') && x.querySelector('dt').textContent.trim().toLowerCase().startsWith(l)); return d? +d.querySelector('dd').textContent.replace(/[^0-9.-]/g,'') : NaN; }, label);
  /* the Walls yield by year, from the income-sources table */
  const wy=async()=>p.$eval('#incSrcTable',t=>{ const hs=[...t.querySelectorAll('thead th')].map(h=>h.textContent.trim()); const k=hs.findIndex(h=>h.startsWith('Walls yield'));
    const out={}; if(k<0) return out; t.querySelectorAll('tbody tr').forEach(tr=>{ const c=tr.children; out[+c[0].textContent]= +c[k].textContent.replace(/[^0-9.-]/g,''); }); return out; });
  const sum=o=>Object.values(o).reduce((a,v)=>a+v,0);
  const rows=async()=>p.$$eval('#wallsSBody tr[data-ws]',rs=>rs.map(r=>({key:r.dataset.ws, k:+r.dataset.wp, name:r.children[0].textContent.trim().slice(0,40)})));
  const hint=async()=>(await p.$eval('#wallsSHint',e=>e.textContent)).trim();
  const cell=(key,k,f)=>`#wallsSBody tr[data-ws="${key.replace(/"/g,'\\"')}"][data-wp="${k}"] [data-wk="${f}"]`;
  const set=async(key,k,f,v)=>{ await p.fill(cell(key,k,f),v); await p.keyboard.press('Tab'); await p.waitForTimeout(450); };
  const clear=async(key,k,f)=>set(key,k,f,'');
  const errsOut=[];

  // 1. the table: one row per Walls line, blank, the pooled lines in charge
  const R0=await rows(); const keys=[...new Set(R0.map(r=>r.key))];
  console.log('walls lines:', keys.length, '|', R0.map(r=>r.name).join(' / '));
  if(!keys.length) errsOut.push('no Walls rows');
  console.log('hint (blank):', await hint());
  if(!/^All blank/.test(await hint())) errsOut.push('a blank table should say the pooled lines run the Walls');
  const base={wy:await wy(), end:await tile('#assetTiles','at end of plan')};
  const years=Object.keys(base.wy).map(Number).sort((a,b)=>a-b), firstPay=years.find(y=>base.wy[y]>0.5);
  console.log('base: Walls yield total', Math.round(sum(base.wy)), '| first paid', firstPay, Math.round(base.wy[firstPay]), '| end of plan', base.end);

  // 2. the defaults typed in (same rates as the pooled lines): the per-account path lands close to the pooled one
  const ph=await p.$$eval('#wallsSBody tr[data-wp="0"]',rs=>rs.map(r=>({key:r.dataset.ws, ty:r.querySelector('[data-wk=ty]').placeholder, dist:r.querySelector('[data-wk=dist]').placeholder})));
  console.log('defaults (total yield / distribution):', ph.map(x=>x.ty+' / '+x.dist).join(', '));
  await set(keys[0],0,'dist',ph[0].dist);
  const par={wy:await wy(), end:await tile('#assetTiles','at end of plan')};
  console.log('defaults typed: Walls yield total', Math.round(sum(par.wy)), '| end of plan', par.end, '| hint:', (await hint()).slice(0,110));
  if(!/^The Walls follow this schedule/.test(await hint())) errsOut.push('a typed cell should put the Walls on the schedule');
  if(Math.abs(sum(par.wy)/sum(base.wy)-1)>0.01) errsOut.push('defaults typed should match the pooled Walls income within 1% ('+Math.round(sum(par.wy))+' vs '+Math.round(sum(base.wy))+')');
  if(Math.abs(par.end/base.end-1)>0.01) errsOut.push('defaults typed should match the pooled end of plan within 1% ('+par.end+' vs '+base.end+')');

  // 3. total yield = distribution: nothing reinvested, the balance is level, so the payout is level while it pays
  for(const k of keys){ await set(k,0,'ty','4%'); await set(k,0,'dist','4%'); }
  const lvl=await wy(), lv=years.filter(y=>y>firstPay+1 && y<firstPay+8).map(y=>lvl[y]);
  console.log('4% yield, 4% paid:', lv.map(Math.round).join(', '));
  if(!(lv.length>3 && Math.max(...lv)-Math.min(...lv)<2)) errsOut.push('a distribution equal to the yield should pay a level amount');

  // 4. yield above the distribution is reinvested: the payout grows by the difference
  for(const k of keys) await set(k,0,'ty','7%');
  const up=await wy(), g=up[firstPay+3]/up[firstPay+2]-1;
  console.log('7% yield, 4% paid: payout grows', (g*100).toFixed(2)+'% a year');
  if(Math.abs(g-0.03)>0.002) errsOut.push('7% yield less 4% paid should grow the payout 3% a year (got '+(g*100).toFixed(2)+'%)');

  // 5. a distribution above the yield comes out of the balance
  for(const k of keys){ await set(k,0,'ty','2%'); await set(k,0,'dist','6%'); }
  const dn=await wy(), gd=dn[firstPay+3]/dn[firstPay+2]-1;
  console.log('2% yield, 6% paid: payout changes', (gd*100).toFixed(2)+'% a year');
  if(Math.abs(gd+0.04)>0.002) errsOut.push('6% paid on a 2% yield should shrink the payout 4% a year (got '+(gd*100).toFixed(2)+'%)');

  // 6. a stop date, then a restart: nothing paid between, paying again from the restart
  for(const k of keys){ await set(k,0,'ty','6%'); await set(k,0,'dist','4%'); await set(k,0,'gAfter','5%'); }
  const stopY=firstPay+4, restartY=firstPay+9;
  for(const k of keys) await set(k,0,'end',stopY+'-01');
  let st=await wy();
  console.log('stop '+stopY+'-01:', [stopY-1,stopY,stopY+1,stopY+5].map(y=>y+' '+Math.round(st[y])).join(', '));
  if(!(st[stopY-1]>0.5 && st[stopY]<0.5 && st[stopY+5]<0.5)) errsOut.push('nothing should be paid from the stop date');
  await p.click(`#wallsSBody tr[data-ws="${keys[0]}"][data-wp="0"] [data-wsadd]`); await p.waitForTimeout(500);
  if(!(await p.$(cell(keys[0],1,'start')))) errsOut.push('+ Add restart should add a row');
  console.log('restart row gPre cell:', (await p.$eval(`#wallsSBody tr[data-ws="${keys[0]}"][data-wp="1"]`,r=>r.children[6].textContent.trim())));
  await set(keys[0],1,'start',restartY+'-01');
  st=await wy();
  console.log('restart '+restartY+'-01 on '+keys[0]+':', [restartY-1,restartY,restartY+1].map(y=>y+' '+Math.round(st[y])).join(', '));
  if(!(st[restartY-1]<0.5 && st[restartY]>0.5)) errsOut.push('the restart should pay again from its start');
  // the gap grows at the rate after stop: the first restart payment reflects 5% a year since the stop
  await set(keys[0],1,'start',(stopY-1)+'-01');
  if(!/starts before the line above stops/.test(await hint())) errsOut.push('a restart before the stop should be flagged and ignored');
  console.log('overlap hint:', (await hint()).replace(/^.*Not used: /,'Not used: '));
  await set(keys[0],1,'start',restartY+'-01');

  // 7. per scenario: scenario B is blank, A keeps its schedule
  await p.click('#scnTabs [data-scn="1"]'); await p.waitForTimeout(700);
  const bVals=await p.$$eval('#wallsSBody input[data-wk]',es=>es.filter(e=>e.value.trim()!=='').length);
  await p.click('#scnTabs [data-scn="0"]'); await p.waitForTimeout(700);
  const aVals=await p.$$eval('#wallsSBody input[data-wk]',es=>es.filter(e=>e.value.trim()!=='').length);
  console.log('cells set: scenario B', bVals, '| scenario A', aVals);
  if(bVals!==0) errsOut.push('scenario B should start blank');
  if(!(aVals>=keys.length*4+1)) errsOut.push('scenario A should keep its schedule');

  // 8. the deck's Walls slide describes the schedule
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]); await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  const dk=await pop.evaluate(()=>{ const sl=[...document.querySelectorAll('.sl')].find(s=>/What.s in the Walls/.test(s.textContent) && !/Contents/.test(s.textContent.slice(0,40)));
    return sl ? {byAcct:/By account/.test(sl.textContent), own:/own dates/.test(sl.textContent), over:[...sl.querySelectorAll('.tx')].filter(e=>e.scrollHeight-e.clientHeight>6).length} : null; });
  console.log('deck Walls slide:', JSON.stringify(dk)); await pop.close();
  if(!dk || !dk.byAcct || !dk.own) errsOut.push('the deck Walls slide should describe the schedule');
  if(dk && dk.over) errsOut.push('deck Walls slide overflow '+dk.over);

  // 9. cleared: back to the pooled lines, the base figures
  await p.click(`#wallsSBody tr[data-ws="${keys[0]}"][data-wp="1"] [data-wsdel]`); await p.waitForTimeout(500);
  for(const k of keys) for(const f of ['end','ty','dist','gAfter']) await clear(k,0,f);
  const back={wy:await wy(), end:await tile('#assetTiles','at end of plan')};
  console.log('cleared: Walls yield total', Math.round(sum(back.wy)), '| end of plan', back.end, '| hint:', (await hint()).slice(0,40));
  if(Math.round(sum(back.wy))!==Math.round(sum(base.wy)) || back.end!==base.end) errsOut.push('clearing the table should restore the pooled figures exactly');

  // 10. typing: the cell under the cursor survives every keystroke (the table was rebuilt mid-typing: a decimal or a
  // four-digit year could not be entered). A percentage typed key by key, and a month as Chrome reports it while the
  // year is typed (0002, 0020, 0203, 2031).
  const k0=keys[0], dSel=cell(k0,0,'dist'), sSel=cell(k0,0,'start');
  await p.$eval(dSel,e=>{ window.__keep=e; }); await p.click(dSel);
  for(const ch of '4.25'){ await p.keyboard.type(ch); await p.waitForTimeout(250); }
  const tDist=await p.evaluate(s=>({same:document.querySelector(s)===window.__keep, focus:document.activeElement===window.__keep, val:window.__keep.value}), dSel);
  console.log('typing 4.25 into Distribution:', JSON.stringify(tDist));
  if(!tDist.same || !tDist.focus || tDist.val!=='4.25') errsOut.push('a decimal typed key by key should stay in the cell ('+JSON.stringify(tDist)+')');
  await p.keyboard.press('Tab'); await p.waitForTimeout(400);
  await p.$eval(sSel,e=>{ window.__keep=e; e.focus(); });
  for(const v of ['0002-03','0020-03','0203-03','2031-03']){ await p.$eval(sSel,(e,v)=>{ e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); }, v); await p.waitForTimeout(300); }
  const tStart=await p.evaluate(s=>({same:document.querySelector(s)===window.__keep, focus:document.activeElement===window.__keep, val:window.__keep.value}), sSel);
  const savedStart=await p.evaluate(k=>{ try { const w=JSON.parse(document.getElementById('caseJson').value).wallsSchedule||{}; return (w[k]||[{}])[0].start; } catch(e){ return 'n/a'; } }, k0);
  console.log('typing a year into Distributions start:', JSON.stringify(tStart), '| saved:', savedStart);
  if(!tStart.same || !tStart.focus || tStart.val!=='2031-03') errsOut.push('a four-digit year typed into the start should stay in the cell ('+JSON.stringify(tStart)+')');
  if(savedStart!=='2031-03') errsOut.push('the typed start should be saved ('+savedStart+')');
  await clear(k0,0,'dist'); await clear(k0,0,'start');

  console.log('ERRORS:', errs.length||errsOut.length ? [...errs, ...errsOut] : 'none');
  await b.close();
})();
