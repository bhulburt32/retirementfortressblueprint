/* Layout and the balance sheet: subsection titles over an output graphic are gold (the Social Security
   subsection fixed navy); the numbered section headers are always navy; the Roth and QCD inputs fold behind green buttons; every section header starts at the same
   left edge (scenario sections no longer indented); the Net worth readout sits in section 07 with the debts subtracted,
   under it a gold "Net worth over time" chart; the Walls plan assumptions (start, growth before income starts, the
   tax-free line) live in section 03, and section 14 keeps only the by-account table, an earlier case's section 14
   Walls overrides showing until cleared. Smith sample. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(600);
  const out=[];
  const num=s=>+String(s).replace(/[^0-9.\-]/g,'');

  // 1. gold headers: subsections that hold a chart (the Social Security subsection fixed navy); the numbered
  //    section headers are never gold
  const G=await p.evaluate(()=>{ const sec=n=>[...document.querySelectorAll('section')].find(s=>{ const x=s.querySelector('.sec-num'); return x && x.textContent.trim()===n; });
    const gold=n=>{ const s=sec(n); return !!(s && s.querySelector('.sec-head').classList.contains('gold')); };
    const sub=t=>{ const h=[...document.querySelectorAll('.inc-title')].find(x=>x.textContent.includes(t)); return h ? h.classList.contains('gold') : null; };
    const r={nwSub:sub('Net worth over time'), roth:sub('Roth conversion analysis'), wd:sub('Withdrawal order'), ss:sub('Social Security'),
      bg:getComputedStyle(sec('17').querySelector('.sec-head')).backgroundColor};
    ['01','03','04','05','06','07','14','17','18','19','20'].forEach(n=>{ r['s'+n]=gold(n); }); return r; });
  console.log('gold headers:', JSON.stringify(G));
  if(G.s01 || G.s03 || G.s04 || G.s05 || G.s06 || G.s07 || G.s14 || G.s17 || G.s18 || G.s19 || G.s20 || G.bg!=='rgb(31, 49, 98)') out.push('every section header should be navy');
  if(G.ss) out.push('the Social Security subsection should be navy');
  if(!G.nwSub || !G.roth) out.push('the chart subsections should be gold');
  if(G.wd) out.push('Withdrawal order has no chart and should not be gold');

  // 1b. the Roth and QCD inputs fold behind green buttons, closed until pressed
  for(const [btn,id] of [['Roth Conversion Inputs','rothTarget'],['QCD Inputs','qcdC']]){
    await p.click('#collapseAll'); await p.waitForTimeout(300);
    await p.evaluate(()=>{ const s=[...document.querySelectorAll('section')].find(s=>s.querySelector('.sec-num').textContent.trim()==='17'); s.querySelector('.sec-head').click();
      [...s.querySelectorAll('.inc-title')].forEach(h=>{ if(h.classList.contains('closed')) h.click(); }); });
    await p.waitForTimeout(300);
    const st=await p.evaluate(([btn,id])=>{ const b=[...document.querySelectorAll('button.tgl-cta')].find(x=>x.textContent===btn); const vis=()=>!!document.getElementById(id).offsetParent;
      if(!b) return {found:false}; const bg=getComputedStyle(b).backgroundColor, closed=vis(); b.click(); const open=vis(); b.click(); return {found:true, bg, hiddenBefore:!closed, shownAfter:open, hiddenAgain:!vis()}; },[btn,id]);
    console.log(btn+':', JSON.stringify(st));
    if(!st.found || st.bg!=='rgb(46, 125, 50)' || !st.hiddenBefore || !st.shownAfter || !st.hiddenAgain) out.push('the '+btn+' should be a green button that shows and hides the inputs');
  }
  await p.click('#expandAll'); await p.waitForTimeout(400);

  // 2. no section is indented
  const lefts=await p.$$eval('section .sec-head',hs=>[...new Set(hs.map(h=>Math.round(h.getBoundingClientRect().left)))]);
  console.log('section header left edges:', lefts.join(', '));
  if(lefts.length!==1) out.push('every section header should start at the same left edge');

  // 3. net worth: in section 07, debts subtracted, today and over time
  const nw0=await p.evaluate(()=>({inDebts:!!document.querySelector('#debtSec #nwReadout'), inAssets:!!document.querySelector('#acctSec #nwReadout, section:has(#acctTable) #nwReadout'), txt:document.getElementById('nwReadout').textContent.replace(/\s+/g,' ')}));
  console.log('readout:', nw0.txt.slice(0,90), '| in section 07:', nw0.inDebts);
  if(!nw0.inDebts || nw0.inAssets) out.push('the Net worth readout should sit in section 07, not section 06');
  const before=num(nw0.txt.match(/Net worth\s*\$[\d,]+/)[0]);
  await p.click('#debtAdd'); await p.waitForTimeout(500);
  const d='#debtBody tr[data-debt]';
  for(const [k,v] of [['bal','150000'],['rate','6%'],['pmt','1500']]){ await p.fill(`${d} [data-dbk="${k}"]`,v); await p.keyboard.press('Tab'); await p.waitForTimeout(300); }
  await p.waitForTimeout(700);
  const nw1=await p.evaluate(()=>({txt:document.getElementById('nwReadout').textContent.replace(/\s+/g,' '), red:[...document.querySelectorAll('#nwSvg rect')].filter(r=>/alert/.test(r.getAttribute('fill'))).length, note:document.getElementById('nwNote').textContent, legend:document.getElementById('nwLegend').textContent}));
  const after=num(nw1.txt.match(/Net worth\s*\$[\d,]+/)[0]);
  console.log('with a $150,000 debt: net worth', before, '->', after, '| debt bars', nw1.red, '| note:', nw1.note.slice(0,170));
  if(Math.abs((before-after)-150000)>1) out.push('the debt should come off net worth today ('+before+' -> '+after+')');
  if(!/debts \$150,000/.test(nw1.txt)) out.push('the readout should show the debts subtracted');
  if(!(nw1.red>0) || !/Debts \(subtracted\)/.test(nw1.legend)) out.push('the chart should show the debts below the line');
  if(!/paid off by \d{4}/.test(nw1.note)) out.push('the note should say when the debt is paid off');
  await p.click(`${d} button.row-x`).catch(()=>{}); await p.waitForTimeout(500);

  // 4. Walls plan assumptions in section 03; section 14 keeps only the table
  const s3=await p.evaluate(()=>['wallsStart','growthWPre','yieldWt','growthWtPre','growthWt'].map(id=>{ const e=document.getElementById(id); const s=e&&e.closest('section'); const n=s&&s.querySelector('.sec-num'); return id+'@'+(n?n.textContent.trim():'-')+'='+(e?e.value:'missing'); }));
  console.log('section 03 Walls fields:', s3.join(' '));
  if(s3.some(x=>!/@03=/.test(x))) out.push('the Walls plan assumptions should be in section 03');
  const legacyHidden=await p.$eval('#adjWLegacy',e=>e.hidden);
  if(!legacyHidden) out.push('section 14 should not show the old Walls lines for a case without them');
  const phBefore=await p.$eval('#wallsSBody tr[data-wp="0"] [data-wk="gPre"]',e=>e.placeholder);
  await p.fill('#growthWPre','7%'); await p.keyboard.press('Tab'); await p.waitForTimeout(700);
  const phAfter=await p.$eval('#wallsSBody tr[data-wp="0"] [data-wk="gPre"]',e=>e.placeholder);
  console.log('Walls growth before income starts 5% -> 7%: the table default', phBefore, '->', phAfter);
  if(phAfter!=='7.0%') out.push('the by-account table should follow the section 03 growth before income starts');
  await p.fill('#growthWPre','5%'); await p.keyboard.press('Tab'); await p.waitForTimeout(500);
  // an earlier case with a section 14 Walls override: shown, still applied, cleared on request
  const cj=JSON.parse(await p.$eval('#caseJson',e=>e.value));
  (cj.scenarios||[]).forEach((S,k)=>{ if(S && k===0){ S.incomeAdj=Object.assign({}, S.incomeAdj||{}, {yW:'4.0%'}); } });
  cj.incomeAdj=Object.assign({}, cj.incomeAdj||{}, {yW:'4.0%'});
  await p.$eval('#caseJson',(e,v)=>{ e.value=v; },JSON.stringify(cj)); await p.click('#loadCase'); await p.waitForTimeout(1500);
  await p.click('#scnTabs [data-scn="0"]').catch(()=>{}); await p.waitForTimeout(700);
  const leg=await p.evaluate(()=>({hidden:document.getElementById('adjWLegacy').hidden, yw:document.getElementById('adjYW').value}));
  console.log('earlier case with a section 14 Walls yield of 4%:', JSON.stringify(leg));
  if(leg.hidden || leg.yw!=='4.0%') out.push('an earlier case\'s section 14 Walls override should show until cleared');
  await p.click('#adjWLegacyClear'); await p.waitForTimeout(700);
  const cleared=await p.evaluate(()=>({hidden:document.getElementById('adjWLegacy').hidden, yw:document.getElementById('adjYW').value}));
  console.log('after Clear them:', JSON.stringify(cleared));
  if(!cleared.hidden || cleared.yw!=='') out.push('Clear them should remove the override and hide the old lines');

  console.log('ERRORS:', errs.length||out.length ? [...errs, ...out] : 'none');
  await b.close();
})();
