/* Annuity income and the Walls yield in the tax projection: a federally tax-free Walls yield (section 14),
   annuity income taxable unless it is paid from a Roth account, the stress-test and care-event results on the
   scenario cards, the cash flow statement (section 17) and the header graphic. */
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
  // 1b. the care-event rows, matching the section 17 care-event projections
  for(const [key,label] of [['client','Jeff needs care'],['spouse','Jane needs care'],['both','Both need care']]){
    const s17=await tile('#assetLtc'+key+'Tiles','at end of plan'), card=cardNum(C[0],label); console.log(label+':', card, '| section 17:', s17);
    if(Math.abs(card-s17)>1) errs.push(label+' on the card should match section 17 ('+card+' vs '+s17+')');
  }
  // 1c. the cash flow statement: one row a year, the net cash flow never negative while funded, the ending balance the section 17 total; the header graphic loads
  const cf=await p.$$eval('#cfTable tbody tr',rs=>rs.map(r=>[...r.querySelectorAll('td')].map(t=>t.textContent.trim())));
  const cfHead=await p.$eval('#cfTable thead',e=>[...e.querySelectorAll('th')].map(t=>t.textContent));
  const col=n=>cfHead.indexOf(n); const num=t=>+t.replace(/[^0-9.-]/g,'')*(/^[−-]/.test(t)?-1:1);
  const years=await p.$$eval('#assetTable tbody tr',rs=>rs.length);
  console.log('cash flow rows:', cf.length, '| columns:', cfHead.join(' | '));
  if(cf.length!==years) errs.push('the cash flow statement should carry every projection year ('+cf.length+' vs '+years+')');
  for(const n of ['Total income','Needs','Wants','Federal tax','Cash flow before withdrawals','Withdrawals','Net cash flow','Ending account balance','Ending net worth']) if(col(n)<0) errs.push('cash flow column missing: '+n);
  const bad=cf.filter(r=>num(r[col('Net cash flow')])<-1); if(bad.length) errs.push('net cash flow negative in '+bad.length+' funded years, e.g. '+bad[0].join(' | '));
  const lastBal=num(cf[cf.length-1][col('Ending account balance')]), assetEnd=await tile('#assetTiles','at end of plan'); console.log('last ending balance:', lastBal, '| section 17 end:', assetEnd);
  if(Math.abs(lastBal-assetEnd)>1) errs.push('the ending balance should be the section 17 total');
  const r0=cf[0]; const check=num(r0[col('Total income')])-Math.abs(num(r0[col('Needs')]))-Math.abs(num(r0[col('Wants')]))-Math.abs(num(r0[col('Federal tax')]))-Math.abs(num(r0[col(cfHead.find(h=>/ tax$/.test(h) && !/Federal/.test(h)))]));
  console.log('first row arithmetic:', check.toFixed(0), 'vs before withdrawals', num(r0[col('Cash flow before withdrawals')]));
  if(Math.abs(check-num(r0[col('Cash flow before withdrawals')]))>2) errs.push('cash flow before withdrawals should be income less expenses and tax');
  // 1d. every section carries its User Guide Notes, collapsed, with the guide's text; no section-note paragraphs remain
  const notes=await p.$$eval('section details.guide-notes',ds=>ds.map(d=>({open:d.open, len:d.querySelector('.guide-body').textContent.replace(/\s+/g,' ').trim().length, sum:d.querySelector('summary').textContent.trim().slice(0,16)})));
  console.log('guide notes:', notes.length, 'shortest', Math.min(...notes.map(n=>n.len)), '| sec-notes left:', await p.$$eval('.sec-note',e=>e.length));
  if(notes.length!==22) errs.push('every section should carry User Guide Notes ('+notes.length+')');
  if(notes.some(n=>n.open || n.len<150 || !/^User Guide Notes/.test(n.sum))) errs.push('guide notes should be collapsed, titled User Guide Notes and carry the guide text');
  if(await p.$$eval('.sec-note',e=>e.length)) errs.push('section-note paragraphs should be gone');
  await p.click('#acctSec details.guide-notes summary'); await p.waitForTimeout(200);
  console.log('section 06 notes open:', await p.$eval('#acctSec details.guide-notes',d=>d.open), '|', (await p.$eval('#acctSec .guide-body',e=>e.textContent.replace(/\s+/g,' ').trim())).slice(0,120));
  if(!(await p.$eval('#acctSec details.guide-notes',d=>d.open))) errs.push('the notes should open on a click');
  // 1e. the Pension Benefits Calculator (section 04): a PSERS T-D case, then added to the pension list; the video card in Reports
  const penRows0=await p.$$eval('#penBody tr[data-pen]',rs=>rs.length);
  await p.selectOption('#pbcState','PA-PSERS'); await p.waitForTimeout(200);
  for(const [id,v] of [['pbcDob','1965-03-15'],['pbcStart','1990-08-20'],['pbcRet','2027-06-30']]){ await p.fill('#'+id,v); await p.$eval('#'+id,e=>e.dispatchEvent(new Event('change',{bubbles:true}))); }
  await p.selectOption('#pbcClass','TD'); await p.waitForTimeout(100); await p.fill('#pbcAfc','80000'); await p.fill('#pbcSpAge','60'); await p.selectOption('#pbcOpt','j50');
  console.log('calculator derived: age', await p.$eval('#pbcRetAge',e=>e.value), '| yos', await p.$eval('#pbcYos',e=>e.value), '| suggestion:', await p.$eval('#pbcSuggest',e=>e.textContent));
  await p.click('#pbcCalc'); await p.waitForTimeout(300);
  const pbcOut=await p.$eval('#pbcOut',e=>e.textContent.replace(/\s+/g,' ').trim()); console.log('calculator result:', pbcOut.slice(0,260));
  const monthly=await p.$eval('#pbcOut .pbc-metric dd',e=>+e.textContent.replace(/[^0-9.]/g,'')), maxMonthly=await p.$$eval('#pbcOut .pbc-metric dd',ds=>+ds[2].textContent.replace(/[^0-9.]/g,''));
  console.log('monthly', monthly, '| single-life max', maxMonthly, '| disclaimer present:', await p.$eval('#pbcResults .pbc-disclaimer',e=>/IMPORTANT DISCLAIMER/.test(e.textContent)));
  if(Math.abs(maxMonthly-6150)>1) errs.push('PSERS T-D: 36.9 years x 2.5% x 80,000 should give 6,150 a month single life ('+maxMonthly+')');
  if(!(monthly<maxMonthly)) errs.push('a joint and 50% option should reduce the monthly benefit');
  if(!/Normal retirement eligible/.test(pbcOut)) errs.push('a 62-year-old with 36.9 years should be eligible for normal retirement');
  await p.click('#pbcUse'); await p.waitForTimeout(600);
  const penRows=await p.$$eval('#penBody tr[data-pen]',rs=>rs.map(r=>({name:r.querySelector('[data-pk=name]').value, amt:r.querySelector('[data-pk=amt]').value, start:r.querySelector('[data-pk=start]').value, surv:r.querySelector('[data-pk=surv]').value})));
  console.log('pension rows:', penRows0, '->', penRows.length, JSON.stringify(penRows[penRows.length-1]), '|', await txt('#pbcMsg'));
  const added=penRows[penRows.length-1]; if(penRows.length!==penRows0+1 || !added || Math.abs(+added.amt.replace(/,/g,'')-monthly)>1 || added.start!=='2027-06' || added.surv!=='50') errs.push('Add to pension income should add the line with the monthly benefit, the retirement month and the survivor share');
  const lastPen=await p.$$eval('#penBody tr[data-pen]',rs=>rs[rs.length-1].dataset.pen); await p.click(`#penBody tr[data-pen="${lastPen}"] [data-pdel]`); await p.waitForTimeout(400);
  if((await p.$$eval('#penBody tr[data-pen]',rs=>rs.length))!==penRows0) errs.push('removing the added pension should restore the list');
  console.log('video link:', await p.$eval('#roadVideo',a=>a.href+' '+a.target), '|', await p.$eval('.video-card b',e=>e.textContent));
  if(!(await p.$eval('#roadVideo',a=>/claude\.ai\/artifact\/4betJJT5zWc21C6KhEAQN5/.test(a.href) && a.target==='_blank'))) errs.push('the Reports section should link to The Road to Retirement Fortress video');
  console.log('header background image:', (await p.$eval('.masthead',e=>getComputedStyle(e).backgroundImage)).slice(0,60)); if(!/url\("data:image\/jpeg/.test(await p.$eval('.masthead',e=>getComputedStyle(e).backgroundImage))) errs.push('the header should carry the Fortress graphic as its background');
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
  // 1f. birthdates set the ages; a tax-deferred withdrawal before 59½ carries the 10% penalty; the Nitrogen upload is gone; the navy header
  console.log('nitrogen button:', (await p.$('#makeNitrogen')) ? 'present' : 'gone', '| logo:', (await p.$eval('#brandImg',e=>e.src.slice(0,22))), '| header background:', /url\(/.test(await p.$eval('.masthead',e=>getComputedStyle(e).backgroundImage)));
  if(await p.$('#makeNitrogen')) errs.push('the Nitrogen account upload should be gone from Reports');
  if(!/^data:image\/png/.test(await p.$eval('#brandImg',e=>e.src)) || !/url\(/.test(await p.$eval('.masthead',e=>getComputedStyle(e).backgroundImage))) errs.push('the header should carry the transparent logo over the Fortress background');
  const ages0=[await p.$eval('#clientAge',e=>e.value), await p.$eval('#spouseAge',e=>e.value)];
  for(const [id,v] of [['clientDob','1969-05-10'],['spouseDob','1971-02-01']]){ await p.fill('#'+id,v); await p.$eval('#'+id,e=>e.dispatchEvent(new Event('change',{bubbles:true}))); await p.waitForTimeout(500); }
  console.log('ages from birthdates:', await p.$eval('#clientAge',e=>e.value+(e.readOnly?' (calculated)':'')), await p.$eval('#spouseAge',e=>e.value), '| pension calculator DOB:', await p.$eval('#pbcDob',e=>e.value));
  if(await p.$eval('#clientAge',e=>e.value)!=='57' || await p.$eval('#spouseAge',e=>e.value)!=='55' || !(await p.$eval('#clientAge',e=>e.readOnly))) errs.push('the ages should be calculated from the birthdates at the plan date');
  if(!JSON.parse(await p.$eval('#caseJson',e=>e.value)).household.clientDob) errs.push('the birthdate should save with the case');
  await p.click('#wdList button[data-wd="up"][data-k="1"]'); await p.waitForTimeout(700);   // tax-deferred first, so the early years draw on the IRAs
  const th=await p.$eval('#taxTable thead',e=>[...e.querySelectorAll('th')].map(t=>t.textContent.trim()));
  const tr=await p.$$eval('#taxTable tbody tr',rs=>rs.map(r=>[...r.querySelectorAll('td')].map(t=>t.textContent.trim())));
  const iPen=th.findIndex(h=>/Early withdrawal penalty/.test(h)), iWd=th.findIndex(h=>/^Withdrawals/.test(h));
  console.log('penalty column:', iPen>=0, '| first rows:', tr.slice(0,3).map(r=>r[1]+' wd '+r[iWd]+' pen '+(iPen>=0?r[iPen]:'-')).join(' ; '));
  if(iPen<0) errs.push('the tax table should show the early-withdrawal penalty column');
  else tr.filter(r=>r[1].split('/').every(a=>+a<59)).forEach(r=>{ const def=+(r[iWd].split('/')[1]||'0').replace(/[^0-9.]/g,''), pen=+r[iPen].replace(/[^0-9.]/g,''); if(def>0.5 && Math.abs(pen-def*0.10)>2) errs.push('penalty should be 10% of the tax-deferred draw while both are under 59 ('+r[0]+': '+pen+' vs '+def+')'); });
  if(!tr.some(r=>r[1].split('/').every(a=>+a<59) && +(r[iWd].split('/')[1]||'0').replace(/[^0-9.]/g,'')>0.5)) errs.push('no tax-deferred draw before 59 to test the penalty on');
  const after595=tr.filter(r=>r[1].split('/').every(a=>+a>=61)); if(iPen>=0 && after595.some(r=>+r[iPen].replace(/[^0-9.]/g,'')>0.5)) errs.push('no penalty should apply once both are past 59½');
  await p.click('#wdList button[data-wd="down"][data-k="0"]'); await p.waitForTimeout(500);
  for(const id of ['clientDob','spouseDob']){ await p.fill('#'+id,''); await p.$eval('#'+id,e=>e.dispatchEvent(new Event('change',{bubbles:true}))); }
  await p.fill('#clientAge',ages0[0]); await p.$eval('#clientAge',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.fill('#spouseAge',ages0[1]); await p.$eval('#spouseAge',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(700);
  console.log('restored ages:', await p.$eval('#clientAge',e=>e.value), await p.$eval('#spouseAge',e=>e.value), '| end of plan:', await tile('#assetTiles','at end of plan'));
  // 4. the worksheet and the deck still build
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:60000}), p.click('#makePdf')]); console.log('worksheet:', dl.suggestedFilename());
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]); await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  const over=await pop.$$eval('.tx',els=>els.filter(e=>e.scrollHeight-e.clientHeight>6).length); console.log('deck slides:', await pop.$$eval('.sl',s=>s.length), 'overflow:', over); if(over) errs.push('deck overflow '+over); await pop.close();
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
