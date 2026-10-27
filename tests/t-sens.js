const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext(); const p=await ctx.newPage({viewport:{width:1400,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  console.log('lead:', await txt('#sensLead'));
  for(const bx of await p.$$('#sens .ltc-scn')){
    console.log('--', await bx.$eval('.inc-title',e=>Array.from(e.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()), '|', await bx.$eval('.scn-sub',e=>e.textContent));
    console.log('  tiles:', await bx.$eval('.tax-tiles',e=>e.textContent.replace(/\s+/g,' ').trim()));
    console.log('  note:', await bx.$eval('.hint',e=>e.textContent.replace(/\s+/g,' ').trim()));
    console.log('  marker:', await bx.$$eval('svg .pj-band',t=>t.map(x=>x.textContent).join(' / ')), '| legend:', await bx.$eval('.pj-legend',e=>e.textContent.replace(/\s+/g,' ').trim().slice(-60)));
  }
  console.log('base end:', (await txt('#assetTiles')).match(/At end of plan\$[\d,]+/)?.[0], '| tag:', await txt('#sensSec .scn-tag'), '| secnums:', await p.$$eval('.sec-num',e=>e.map(x=>x.textContent).slice(16).join(',')));
  const ms=await p.evaluate(()=>{const a=performance.now(); document.getElementById('sizeYears').dispatchEvent(new Event('input',{bubbles:true})); return performance.now()-a;}); console.log('render ms', ms.toFixed(0));
  // section 19: each test on a collapsible gold bar; an open bar stays open through a re-render; Monte Carlo and the care-event block too
  const bars=await p.$$eval('#sensSec .inc-title', hs=>hs.map(h=>({t:h.textContent.trim().slice(0,28), tgl:h.classList.contains('tgl-head'), gold:h.classList.contains('gold'), closed:h.classList.contains('closed')})));
  console.log('section 19 bars:', JSON.stringify(bars));
  if(bars.length < 5 || bars.some(b=>!b.tgl || !b.gold)) errs.push('section 19 should carry five collapsible gold bars (three stresses, Monte Carlo, care event): ' + JSON.stringify(bars));
  const rerender=async()=>{ await p.evaluate(()=>{ document.getElementById('sizeYears').dispatchEvent(new Event('input',{bubbles:true})); }); await p.waitForTimeout(900); };
  const seqState=()=>p.$eval('#sensseqBox .inc-title', h=>!h.classList.contains('closed') && h.nextElementSibling.getBoundingClientRect().height > 10);
  await p.$eval('#sensseqBox .inc-title', h=>h.click()); await p.waitForTimeout(200);   // expand all had opened it: close it
  const closedNow=await seqState(); await rerender(); const closedAfter=await seqState();
  await p.$eval('#sensseqBox .inc-title', h=>h.click()); await p.waitForTimeout(200);   // open it again
  const openNow=await seqState(); await rerender(); const openAfter=await seqState();
  console.log('sequence bar closed/closed after re-render/open/open after re-render:', closedNow, closedAfter, openNow, openAfter);
  if(closedNow || closedAfter || !openNow || !openAfter) errs.push('a stress test should keep its open or closed state through a re-render');
  await p.$eval('#sensSec',e=>e.scrollIntoView()); await p.waitForTimeout(300); await p.screenshot({path:'shot-sens.png'});
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]);
  await pop.waitForLoadState('load'); await pop.waitForTimeout(600);
  console.log('slides:', await pop.$$eval('.sl',s=>s.length));
  const rnRow=await pop.$$eval('.sl', sl=>{ const s=sl.find(x=>/How Your Situation Improves/.test(x.textContent) && /Portfolio Risk Number/.test(x.textContent)); if(!s) return null; const tx=[...s.querySelectorAll('.tx')].map(e=>e.textContent.replace(/\s+/g,' ').trim()); const k=tx.indexOf('Portfolio Risk Number'); return k<0?null:tx.slice(k,k+4); });
  console.log('deck Risk Number row:', JSON.stringify(rnRow));
  if(!rnRow || !/^\d+$/.test(rnRow[1]) || !/^\d+$/.test(rnRow[2]) || +rnRow[2] >= +rnRow[1] || !/^Estimated by layer/.test(rnRow[3])) errs.push('the comparison slide should show the Risk Number before and after, the Fortress figure lower, with the note: ' + JSON.stringify(rnRow));
  const over=await pop.$$eval('.tx',els=>els.map(e=>({sl:e.closest('.sl').dataset.n,over:e.scrollHeight-e.clientHeight,txt:e.textContent.slice(0,40)})).filter(o=>o.over>6)); console.log('overflow:', over);
  await pop.pdf({path:'report-out.pdf', preferCSSPageSize:true, printBackground:true});
  console.log('ERRORS:', errs.length?errs:'none'); process.exit(0);
})();
