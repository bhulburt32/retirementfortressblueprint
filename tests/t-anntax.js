/* Annuity income and the Walls yield in the tax projection: a federally tax-free Walls yield (AUM - Tax Free, section 14),
   annuity income taxable unless it is paid from a Roth account, the stress-test and care-event results on the
   scenario cards, the cash flow statement (section 17) and the header graphic. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext({acceptDownloads:true}); const p=await ctx.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  await p.click('#scnTabs [data-scn="0"]'); await p.waitForTimeout(500);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  const tile=async(box,label)=>p.$eval(box,(e,l)=>{ const d=[...e.querySelectorAll('div')].find(x=>x.querySelector('dt') && x.querySelector('dt').textContent.trim().toLowerCase().startsWith(l)); return d? +d.querySelector('dd').textContent.replace(/[^0-9.-]/g,'') : NaN; }, label);
  const figs=async()=>({fed:await tile('#taxTiles','lifetime federal'), state:await tile('#taxTiles','lifetime pennsylvania'), end:await tile('#assetTiles','at end of plan')});
  const acct=async name=>p.$$eval('#acctBody tr[data-id]',(rs,n)=>{ const r=rs.find(x=>x.querySelector('input[data-k=name]').value.trim()===n); return r? r.dataset.id : null; }, name);
  const cell=async(id,k,v)=>{ const sel=`#anxBody tr[data-anx="${id}"] [data-ax="${k}"]`; const tag=await p.$eval(sel,e=>e.tagName); if(tag==='SELECT'){ await p.selectOption(sel,v); } else { await p.fill(sel,v); await p.$eval(sel,e=>{e.dispatchEvent(new Event('input',{bubbles:true})); e.blur();}); } await p.waitForTimeout(500); };
  const cards=async()=>p.$$eval('#scnGrid .scn-card:not(.base)',cs=>cs.map(c=>[...c.querySelectorAll('dl div')].map(d=>d.textContent.replace(/\s+/g,' ').trim())));
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
  if(notes.length!==23) errs.push('every section should carry User Guide Notes ('+notes.length+')');
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
  console.log('video link in header:', await p.$$eval('.masthead #roadVideo, .masthead .video-btn',a=>a.length));
  if(await p.$$eval('.masthead #roadVideo, .masthead .video-btn',a=>a.length)) errs.push('the header should no longer carry The Road to Retirement Fortress video button');
  const hd=await p.evaluate(()=>{ const m=document.querySelector('.masthead .rfb-mark'), r=m&&m.getBoundingClientRect(); return {loadCase:document.querySelectorAll('.masthead #loadCaseTop').length, mark:!!m, markW:r?Math.round(r.width):0, besideTitle:!!(m&&m.parentElement.querySelector('h1'))}; });
  console.log('header mark:', JSON.stringify(hd));
  if(hd.loadCase) errs.push('the header should no longer carry the Load case button');
  if(!hd.mark || hd.markW<60 || !hd.besideTitle) errs.push('the header should show the Retirement Fortress Blueprint mark beside the title');
  console.log('header background image:', (await p.$eval('.masthead',e=>getComputedStyle(e).backgroundImage)).slice(0,60)); if(!/url\("data:image\/jpeg/.test(await p.$eval('.masthead',e=>getComputedStyle(e).backgroundImage))) errs.push('the header should carry the Fortress graphic as its background');
  // 2. AUM - Tax Free: a Walls line in that product pays a federally tax-free yield; no change while the Walls hold only IRA money
  // (at the 3.26% default the Smith plan spends the small After Tax account in its first years, so the comparison runs at 2.5%)
  await p.fill('#inflation','2.5%'); await p.$eval('#inflation',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(700);
  await p.$eval('#rothApply',e=>{ e.checked=false; e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(600);   // conversions re-size to federal headroom, so they are off while the state model is compared
  const at=await acct('After Tax'); const line=await p.$$eval('#adjBody tr[data-adj]',(rs,id)=>{ const r=rs.find(x=>x.querySelector('select[data-ak=acctId]').value===String(id)); return r? r.dataset.adj : null; }, at);
  const prodOpts=await p.$eval(`#adjBody tr[data-adj="${line}"] select[data-ok="prod"]`,s=>[...s.options].map(o=>o.value)); console.log('product choices:', JSON.stringify(prodOpts.slice(0,8)));
  if(!prodOpts.includes('AUM - Tax Free')) errs.push('the product list should offer AUM - Tax Free');
  if(await p.$('#adjYWtf')) errs.push('the Walls tax-free box should be gone');
  await p.selectOption(`#adjBody tr[data-adj="${line}"] select[data-ak="bucket"]`,'walls'); await p.waitForTimeout(700);
  const txNq=await figs(); console.log('After Tax in the Walls, AUM:', JSON.stringify(txNq));
  await p.selectOption(`#adjBody tr[data-adj="${line}"] select[data-ok="prod"]`,'AUM - Tax Free'); await p.waitForTimeout(700);
  const tfNq=await figs(); console.log('After Tax in the Walls, AUM - Tax Free:', JSON.stringify(tfNq));
  if(!(tfNq.fed<txNq.fed-100)) errs.push('AUM - Tax Free on non-qualified Walls money should cut the federal tax ('+tfNq.fed+' vs '+txNq.fed+')');
  if(!(tfNq.end>txNq.end)) errs.push('less tax should leave more at the end of plan');
  // the state still taxes the yield; only the second-order effect of a smaller federal tax on the withdrawals (and their gains) may move it
  if(Math.abs(tfNq.state-txNq.state)>50) errs.push('the state model should be unchanged by the federal exemption, bar the smaller draw ('+tfNq.state+' vs '+txNq.state+')');
  if(!/AUM - Tax Free/.test(await txt('#taxAssume'))) errs.push('the section 16 assumptions should name the tax-free share');
  // saved and reloaded with the case
  const json=await p.$eval('#caseJson',e=>e.value); console.log('product saved with the case:', /AUM - Tax Free/.test(json));
  if(!/AUM - Tax Free/.test(json)) errs.push('the product should save with the case');
  await p.evaluate(j => window.__rfb.loadCaseJson(j), json); await p.waitForTimeout(900); await p.click('#expandAll'); await p.waitForTimeout(300);
  console.log('after reload: federal:', (await figs()).fed);
  if(Math.abs((await figs()).fed-tfNq.fed)>1) errs.push('reload changed the federal tax ('+(await figs()).fed+' vs '+tfNq.fed+')');
  const line2=await p.$$eval('#adjBody tr[data-adj]',(rs,id)=>{ const r=rs.find(x=>x.querySelector('select[data-ak=acctId]').value===String(id)); return r? r.dataset.adj : null; }, await acct('After Tax'));
  await p.selectOption(`#adjBody tr[data-adj="${line2}"] select[data-ok="prod"]`,'AUM'); await p.waitForTimeout(700);
  if(Math.abs((await figs()).fed-txNq.fed)>1) errs.push('back on AUM the tax should return ('+(await figs()).fed+' vs '+txNq.fed+')');
  await p.$eval('#rothApply',e=>{ e.checked=true; e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(600);
  // 2b. existing life insurance and long term care policies feed the calculators and the budget
  const bud=async pol=>p.$eval(`#budBody tr[data-pol="${pol}"] [data-bk="amt"]`,e=>({v:e.value, auto:e.classList.contains('auto')}));
  const lifeBefore=await bud('life');   // the sample budget already types a Life Insurance amount: a typed amount is "already in the budget" and wins
  console.log('budget premium lines before:', JSON.stringify(lifeBefore), JSON.stringify(await bud('ltc')), '| life exist:', await p.$eval('#lifeExistC',e=>e.value), '| ltc cov:', await p.$eval('#ltcCovC',e=>e.value));
  await p.click('#lifePolAdd'); await p.waitForTimeout(300);
  const lrow='#lifePolBody tr[data-lpol]'; const lfill=async(k,v)=>{ await p.fill(`${lrow} [data-lk="${k}"]`,v); await p.$eval(`${lrow} [data-lk="${k}"]`,e=>{e.dispatchEvent(new Event('input',{bubbles:true})); e.blur();}); await p.waitForTimeout(300); };
  await lfill('company','Protective'); await lfill('benefit','500000'); await lfill('years','20'); await lfill('prem','150'); await p.fill(`${lrow} [data-lk="beneficiary"]`,'Jane'); await p.$eval(`${lrow} [data-lk="beneficiary"]`,e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(400);
  console.log('life policy: exist field', await p.$eval('#lifeExistC',e=>e.value+(e.readOnly?' (follows)':'')), '| foot:', (await p.$eval('#lifePolFoot',e=>e.textContent.replace(/\s+/g,' ').trim())).slice(0,120), '| budget life line:', JSON.stringify(await bud('life')));
  if(await p.$eval('#lifeExistC',e=>e.value)!=='500,000' || !(await p.$eval('#lifeExistC',e=>e.readOnly))) errs.push('the client\'s existing coverage should follow the policy');
  if(!/500,000/.test(await p.$eval('#lifeFoot',e=>e.textContent))) errs.push('the needs analysis should take the policy as coverage in force');
  const lifeAfter=await bud('life'); if(lifeBefore.auto ? (lifeAfter.v!=='150' || !lifeAfter.auto) : (lifeAfter.v!==lifeBefore.v || lifeAfter.auto)) errs.push('the Life Insurance budget line should carry the premium unless an amount was already typed ('+JSON.stringify(lifeAfter)+')');
  await p.click('#ltcPolAdd'); await p.waitForTimeout(300);
  const trow='#ltcPolBody tr[data-tpol]'; const tfill=async(k,v)=>{ await p.fill(`${trow} [data-tk="${k}"]`,v); await p.$eval(`${trow} [data-tk="${k}"]`,e=>{e.dispatchEvent(new Event('input',{bubbles:true})); e.blur();}); await p.waitForTimeout(300); };
  await tfill('company','Genworth'); await tfill('daily','200'); await tfill('term','3'); await tfill('prem','120'); await p.waitForTimeout(400);
  console.log('ltc policy: cov field', await p.$eval('#ltcCovC',e=>e.value+(e.readOnly?' (follows)':'')), '| total:', await p.$eval(`${trow} [data-ttot]`,e=>e.textContent), '| budget ltc line:', JSON.stringify(await bud('ltc')));
  if(await p.$eval('#ltcCovC',e=>e.value)!=='6,000' || !(await p.$eval('#ltcCovC',e=>e.readOnly))) errs.push('the client\'s LTC coverage should follow the policy (daily x 30)');
  if(await p.$eval(`${trow} [data-ttot]`,e=>e.textContent)!=='$219,000') errs.push('the LTC policy total should be daily x 365 x term');
  if((await bud('ltc')).v!=='120' || !(await bud('ltc')).auto) errs.push('the Long Term Care Insurance budget line should carry the premium');
  await p.fill('#budBody tr[data-pol="ltc"] [data-bk="amt"]','200'); await p.$eval('#budBody tr[data-pol="ltc"] [data-bk="amt"]',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(400);
  console.log('typed over the LTC line:', JSON.stringify(await bud('ltc')));
  if((await bud('ltc')).v!=='200' || (await bud('ltc')).auto) errs.push('a typed budget amount should win over the policy premium');
  const j2=JSON.parse(await p.$eval('#caseJson',e=>e.value)); console.log('saved policies:', JSON.stringify(j2.lifePolicies), JSON.stringify(j2.ltcPolicies));
  if(!j2.lifePolicies || j2.lifePolicies[0].benefit!==500000 || !j2.ltcPolicies || j2.ltcPolicies[0].daily!==200) errs.push('policies should save with the case');
  await p.click(`${lrow} [data-lpdel]`); await p.click(`${trow} [data-tpdel]`); await p.waitForTimeout(500);
  console.log('after removal: exist field editable', !(await p.$eval('#lifeExistC',e=>e.readOnly)), '| ltc cov editable', !(await p.$eval('#ltcCovC',e=>e.readOnly)));
  if(await p.$eval('#lifeExistC',e=>e.readOnly) || await p.$eval('#ltcCovC',e=>e.readOnly)) errs.push('without policies the coverage fields should be typed again');
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
  const th=await p.$eval('#taxTable thead',e=>[...e.querySelectorAll('tr:last-child th')].map(t=>t.textContent.trim()));
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
  // 1g. the optimizer and the pension calculator take the section 02 birthdate and the section 04 retirement date; the notes log; the reports
  await p.fill('#clientDob','1963-04-02'); await p.$eval('#clientDob',e=>e.dispatchEvent(new Event('change',{bubbles:true}))); await p.waitForTimeout(600);
  console.log('optimizer DOB:', await p.$eval('#ssoDobC',e=>e.value+(e.readOnly?' (from section 02)':'')), '| calculator DOB:', await p.$eval('#pbcDob',e=>e.value));
  if(await p.$eval('#ssoDobC',e=>e.value)!=='1963-04-02' || !(await p.$eval('#ssoDobC',e=>e.readOnly))) errs.push('the optimizer should take the section 02 birthdate');
  await p.fill('#pbcRet',''); await p.$eval('#pbcRet',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.selectOption('#pbcWho','client'); await p.waitForTimeout(300);
  console.log('calculator retirement date:', await p.$eval('#pbcRet',e=>e.value+(e.classList.contains('auto')?' (from section 04)':'')), '| section 04:', await p.$eval('#retireC',e=>e.value), '| age at retirement:', await p.$eval('#pbcRetAge',e=>e.value));
  if(await p.$eval('#pbcRet',e=>e.value)!==(await p.$eval('#retireC',e=>e.value))+'-01') errs.push('the calculator should take the section 04 retirement date');
  await p.fill('#clientDob',''); await p.$eval('#clientDob',e=>e.dispatchEvent(new Event('change',{bubbles:true}))); await p.fill('#clientAge',ages0[0]); await p.$eval('#clientAge',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(500);
  const n0=await p.$$eval('#notesLog textarea',t=>t.length); await p.click('#notesAdd'); await p.waitForTimeout(200);
  await p.fill('#notesLog .notes-entry:last-child textarea','Second meeting, October 2026.\nGoals:\nPay off the mortgage: clear the mortgage before Jeff retires.\nTravel: a trip to Italy every other year.'); await p.$eval('#notesLog .notes-entry:last-child textarea',e=>e.dispatchEvent(new Event('input',{bubbles:true})));
  await p.click('#goalsDraft'); await p.waitForTimeout(800);
  const goalsNow=await p.$$eval('#goalsList .goal input.gtitle',es=>es.map(e=>e.value)); console.log('notes entries:', n0, '->', await p.$$eval('#notesLog textarea',t=>t.length), '| goals after update:', JSON.stringify(goalsNow).slice(0,200), '|', await txt('#goalsMsg'));
  if((await p.$$eval('#notesLog textarea',t=>t.length))!==n0+1) errs.push('Add meeting notes should add a dated entry');
  if(!goalsNow.some(g=>/mortgage|Italy|travel/i.test(g))) errs.push('drafting again should take the later meeting\'s notes into the goals');
  const saved=JSON.parse(await p.$eval('#caseJson',e=>e.value)); if(!saved.meetingNotes || saved.meetingNotes.length!==n0+1) errs.push('the notes log should save with the case');
  console.log('questionnaire questions:', await p.$$eval('#rqForm .rq-q',q=>q.length), '| q4 present:', !!(await p.$('#rqForm input[name="rq_q4"]')), '| report buttons in section 21:', await p.$$eval('#reportSec button',bs=>bs.map(b=>b.id).join(',')));
  if(await p.$('#rqForm input[name="rq_q4"]')) errs.push('question 4 should be gone');
  if(!(await p.$('#reportSec #rqReport')) || !(await p.$('#reportSec #makePension')) || !(await p.$('#reportSec #makeSS'))) errs.push('the risk profile, pension and Social Security reports should sit in the Reports section');
  await p.selectOption('#pbcState','PA-PSERS'); await p.waitForTimeout(200); await p.fill('#pbcDob','1965-03-15'); await p.fill('#pbcStart','1990-08-20'); await p.fill('#pbcRet','2027-06-30'); for(const id of ['pbcDob','pbcStart','pbcRet']) await p.$eval('#'+id,e=>e.dispatchEvent(new Event('change',{bubbles:true})));
  await p.selectOption('#pbcClass','TD'); await p.fill('#pbcAfc','80000'); await p.click('#pbcCalc'); await p.waitForTimeout(300);
  const [pr]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makePension')]); await pr.waitForLoadState('load'); await pr.waitForTimeout(500);
  const prep=await pr.evaluate(()=>({title:document.title, monthly:(document.querySelector('.pbc-metric dd')||{}).textContent, disc:/IMPORTANT DISCLAIMER/.test(document.body.textContent), logo:!!document.querySelector('.top img')}));
  const pageMonthly=await p.$eval('#pbcOut .pbc-metric dd',e=>e.textContent);
  console.log('pension report:', JSON.stringify(prep), '| on the page:', pageMonthly); if(!/Pension Benefit Estimate/.test(prep.title) || prep.monthly!==pageMonthly || !prep.disc || !prep.logo) errs.push('pension report content wrong'); await pr.close();
  // 1h. the Important Disclosures block at the foot of the page and the last page of the reports
  console.log('disclosures block:', await p.$eval('#rfbDisc',d=>d.open?'open':'closed'), '|', await p.$eval('#rfbDiscBody h2',e=>e.textContent), '|', await p.$$eval('#rfbDiscBody h3',h=>h.length), 'headings');
  if(await p.$eval('#rfbDisc',d=>d.open) || (await p.$$eval('#rfbDiscBody h3',h=>h.length))!==7 || !/BLUEPRINT™/.test(await p.$eval('#rfbDiscBody h2',e=>e.textContent))) errs.push('the Important Disclosures block should sit closed at the foot with the seven headings');
  if(/For internal illustration and planning discussion only/.test(await p.$eval('footer',e=>e.textContent))) errs.push('the old footer paragraph should be gone');
  const [ssr]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeSS')]); await ssr.waitForLoadState('load'); await ssr.waitForTimeout(400);
  const ssDisc=await ssr.evaluate(()=>{ const d=[...document.querySelectorAll('.rfb-disc')].pop(); return d ? d.querySelectorAll('h3').length : 0; }); console.log('Social Security report disclosure headings:', ssDisc); if(ssDisc!==7) errs.push('the Social Security report should end with the Important Disclosures'); await ssr.close();
  // 4. the worksheet and the deck still build
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:60000}), p.click('#makePdf')]); console.log('worksheet:', dl.suggestedFilename());
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]); await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  const over=await pop.$$eval('.tx',els=>els.filter(e=>e.scrollHeight-e.clientHeight>6).length); console.log('deck slides:', await pop.$$eval('.sl',s=>s.length), 'overflow:', over); if(over) errs.push('deck overflow '+over);
  if(!(await pop.evaluate(()=>/© 2026 AFG II, LLC/.test([...document.querySelectorAll('.sl')].pop().textContent)))) errs.push('the deck should end with the Important Disclosures'); await pop.close();
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
