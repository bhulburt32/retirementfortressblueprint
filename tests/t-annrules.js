/* The annuity product rules in the projections: an income annuity in force stays in the Foundation and pays
   (single life or joint), a MYGA grows at its rate or pays it as income, a RILA's floor limits the stress loss. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext({acceptDownloads:true}); const p=await ctx.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  const tile=async(box,label)=>p.$eval(box,(e,l)=>{ const d=[...e.querySelectorAll('div')].find(x=>x.querySelector('dt') && x.querySelector('dt').textContent.trim().toLowerCase().startsWith(l)); return d? +d.querySelector('dd').textContent.replace(/[^0-9.-]/g,'') : NaN; }, label);
  const figs=async()=>({end:await tile('#assetTiles','at end of plan'), today:await tile('#assetTiles','assets today'), seqEnd:await tile('#sensseqTiles','at end of plan'), seqLow:await tile('#sensseqTiles','lowest point')});
  const acct=async name=>p.$$eval('#acctBody tr[data-id]',(rs,n)=>{ const r=rs.find(x=>x.querySelector('input[data-k=name]').value.trim()===n); return r? r.dataset.id : null; }, name);
  const setPos=async(id,pos)=>{ await p.selectOption(`#acctBody tr[data-id="${id}"] select[data-k="pos"]`,pos); await p.waitForTimeout(500); };
  const cell=async(id,k,v)=>{ const sel=`#anxBody tr[data-anx="${id}"] [data-ax="${k}"]`; const tag=await p.$eval(sel,e=>e.tagName); if(tag==='SELECT'){ await p.selectOption(sel,v); } else { await p.fill(sel,v); await p.$eval(sel,e=>{e.dispatchEvent(new Event('input',{bubbles:true})); e.blur();}); } await p.waitForTimeout(500); };
  const base=await figs(); console.log('baseline:', JSON.stringify(base));
  if(!(base.end>0 && base.seqEnd>0)) errs.push('baseline figures missing');
  // the three sample annuities load as MYGAs now
  console.log('sample annuity positions:', await p.$$eval('#acctBody select[data-k="pos"]',ss=>ss.map(s=>s.value).filter(v=>/Annuity/.test(v))));
  // 1. an income annuity in force: stays put, counted in the Foundation, pays its income
  const fixed=await acct('Fixed Annuity'); await setPos(fixed,'Income Annuity (FIA)');
  console.log('transfer flag after Income FIA:', await p.$eval(`#acctBody tr[data-id="${fixed}"] select[data-k="move"]`,s=>s.value), '| panel msg:', (await txt('#anxMsg')).slice(0,120));
  if((await p.$eval(`#acctBody tr[data-id="${fixed}"] select[data-k="move"]`,s=>s.value))!=='no') errs.push('an income annuity should default to Stay as is');
  const adjLine=await p.$$eval('#adjBody tr[data-adj]',(rs,id)=>rs.filter(r=>r.querySelector('select[data-ak=acctId]').value===String(id)).map(r=>r.querySelector('select[data-ak=bucket]').value+' | '+(r.nextElementSibling? r.nextElementSibling.textContent.replace(/\s+/g,' ').trim().slice(0,90):'')), fixed);
  console.log('section 14 line:', JSON.stringify(adjLine)); if(!adjLine.length || !/Foundation/.test(adjLine[0])) errs.push('the income annuity\'s line should say it counts in the Foundation');
  const holdings=await p.$eval('#holdings',e=>e.textContent.replace(/\s+/g,' ')); if(!/Fixed Annuity/.test(holdings)) errs.push('the income annuity should be listed in the ending positions');
  await cell(fixed,'monthly','400'); const single=await figs(); console.log('income annuity, single, $400/mo:', JSON.stringify(single));
  const incomeRow=await p.$eval('#incSrcTable',e=>e.textContent.replace(/\s+/g,' ').slice(0,200)).catch(()=>'');
  await cell(fixed,'payout','joint'); const joint=await figs(); console.log('income annuity, joint:', JSON.stringify(joint));
  if(!(joint.end>=single.end-1)) errs.push('a joint payout should pay at least as long as single life');
  if(Math.abs(single.today-base.today)>base.today*0.005) errs.push('today\'s assets should barely move when an account becomes an income annuity (got '+single.today+' vs '+base.today+')');
  await setPos(fixed,'MYGA Annuity'); await p.selectOption(`#acctBody tr[data-id="${fixed}"] select[data-k="move"]`,'yes'); await p.waitForTimeout(500);
  const back=await figs(); console.log('back to MYGA:', JSON.stringify(back)); if(Math.abs(back.end-base.end)>1) errs.push('restoring the position should restore the baseline ('+back.end+' vs '+base.end+')');
  // 2. a MYGA at its own rate, deferred, then with the interest taken
  const ih=await acct("Investor's Heritage"); await cell(ih,'rate','10');
  const myga10=await figs(); console.log('MYGA at 10% deferred:', JSON.stringify(myga10)); if(!(myga10.end>base.end)) errs.push('a 10% MYGA rate should lift the ending assets');
  await cell(ih,'interest','taken'); const taken=await figs(); console.log('MYGA interest taken:', JSON.stringify(taken));
  if(!(taken.end<myga10.end)) errs.push('taking the interest as income should leave less than compounding it');
  const srcText=await p.$eval('#incSrcNote',e=>e.textContent).catch(()=>''); console.log('income note:', srcText.slice(0,160));
  await cell(ih,'interest','deferred'); await cell(ih,'rate','');
  // 3. a RILA: the floor limits the stress loss, the base case is unchanged
  const sen=await acct('Sentinel'); await setPos(sen,'RILA Annuity');
  const rila=await figs(); console.log('RILA, no floor:', JSON.stringify(rila));
  await cell(sen,'floor','0.5'); const floored=await figs(); console.log('RILA, 0.5% floor:', JSON.stringify(floored));
  if(Math.abs(floored.end-rila.end)>1) errs.push('a floor should not change the base case');
  if(!(floored.seqEnd>rila.seqEnd)) errs.push('a floor should soften the bad-years stress ('+floored.seqEnd+' vs '+rila.seqEnd+')');
  await cell(sen,'cap','1'); const capped=await figs(); console.log('RILA, 1% cap:', JSON.stringify(capped)); if(!(capped.end<floored.end)) errs.push('a 1% cap should cut the base-case growth');
  // 4. a variable annuity's fees cut its growth; a growth FIA's cap too; a plain switch to Growth FIA changes nothing without a cap
  await cell(sen,'cap',''); await cell(sen,'floor',''); await setPos(sen,'Variable Annuity'); const va=await figs();
  await cell(sen,'fees','1.5'); const vaFee=await figs(); console.log('VA:', JSON.stringify(va), '| with 1.5% fees:', JSON.stringify(vaFee)); if(!(vaFee.end<va.end)) errs.push('fees should cut a variable annuity\'s growth');
  await cell(sen,'fees',''); await setPos(sen,'Growth Annuity (FIA)'); const fia=await figs(); console.log('Growth FIA, no cap:', JSON.stringify(fia));
  if(Math.abs(fia.end-base.end)>1) errs.push('a growth FIA without a cap should match the plan rate ('+fia.end+' vs '+base.end+')');
  if(!(fia.seqEnd>va.seqEnd)) errs.push('a growth FIA should not take the stress loss a variable annuity takes ('+fia.seqEnd+' vs '+va.seqEnd+')');
  // 4b. a MYGA matures: the interest stops and the money earns its level's rate from then on
  await cell(ih,'rate','10'); await cell(ih,'interest','taken'); const takenOpen=await figs();
  await cell(ih,'maturity','2029-01'); const takenMat=await figs(); console.log('MYGA taken, matures 2029:', JSON.stringify(takenMat), '| open-ended:', JSON.stringify(takenOpen));
  if(!(takenMat.end>takenOpen.end)) errs.push('after maturity the MYGA should grow at the level rate instead of paying 0% growth ('+takenMat.end+' vs '+takenOpen.end+')');
  await cell(ih,'interest','deferred'); const defMat=await figs(); console.log('MYGA 10% deferred, matures 2029:', JSON.stringify(defMat));
  if(!(defMat.end<myga10.end && defMat.end>base.end)) errs.push('a 10% MYGA that matures in 2029 should land between the baseline and an open-ended 10% ('+defMat.end+')');
  await cell(ih,'rate',''); await cell(ih,'maturity','');
  // 4c. Stay as is keeps its Fortress level, stays at its institution
  const at=await acct('After Tax'); await p.selectOption(`#acctBody tr[data-id="${at}"] select[data-k="move"]`,'no'); await p.waitForTimeout(600);
  const held=await figs(); const hold=await p.$eval('#holdings',e=>e.textContent.replace(/\s+/g,' '));
  const levelOf=await p.$$eval('#adjBody tr[data-adj]',(rs,id)=>rs.filter(r=>r.querySelector('select[data-ak=acctId]').value===String(id)).map(r=>r.querySelector('select[data-ak=bucket]').value+' | '+(r.nextElementSibling? r.nextElementSibling.textContent.replace(/\s+/g,' ').trim().slice(0,80):'')), at);
  console.log('After Tax held:', JSON.stringify(held), '| line:', JSON.stringify(levelOf), '| in holdings:', /After Tax/.test(hold), '| outside layer:', /Held outside the plan/.test(await p.$eval('#assetLegend',e=>e.textContent)));
  if(!levelOf.length || /inplace/.test(levelOf[0]) || !/no transfer/.test(levelOf[0])) errs.push('a held account should keep its level with a no-transfer note');
  if(/Held outside the plan/.test(await p.$eval('#assetLegend',e=>e.textContent))) errs.push('a held account should not sit outside the plan');
  await p.selectOption(`#acctBody tr[data-id="${at}"] select[data-k="move"]`,'yes'); await p.waitForTimeout(500);
  // 5. save/load keeps the new cells, the worksheet and the deck still build
  await cell(sen,'cap','6'); const json=await p.$eval('#caseJson',e=>e.value), d=JSON.parse(json); const sv=d.accounts.find(a=>a.name==='Sentinel'); console.log('saved Sentinel:', JSON.stringify(sv));
  if(!sv.ann || sv.ann.cap!==0.06) errs.push('cap not saved');
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:60000}), p.click('#makePdf')]); console.log('worksheet:', dl.suggestedFilename());
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]); await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  const over=await pop.$$eval('.tx',els=>els.filter(e=>e.scrollHeight-e.clientHeight>6).length); console.log('deck slides:', await pop.$$eval('.sl',s=>s.length), 'overflow:', over); if(over) errs.push('deck overflow '+over); await pop.close();
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
