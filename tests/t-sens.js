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
    console.log('--', await bx.$eval('h4',e=>e.textContent), '|', await bx.$eval('.scn-sub',e=>e.textContent));
    console.log('  tiles:', await bx.$eval('.tax-tiles',e=>e.textContent.replace(/\s+/g,' ').trim()));
    console.log('  note:', await bx.$eval('.hint',e=>e.textContent.replace(/\s+/g,' ').trim()));
    console.log('  marker:', await bx.$$eval('svg .pj-band',t=>t.map(x=>x.textContent).join(' / ')), '| legend:', await bx.$eval('.pj-legend',e=>e.textContent.replace(/\s+/g,' ').trim().slice(-60)));
  }
  console.log('base end:', (await txt('#assetTiles')).match(/At end of plan\$[\d,]+/)?.[0], '| tag:', await txt('#sensSec .scn-tag'), '| secnums:', await p.$$eval('.sec-num',e=>e.map(x=>x.textContent).slice(16).join(',')));
  const ms=await p.evaluate(()=>{const a=performance.now(); document.getElementById('sizeYears').dispatchEvent(new Event('input',{bubbles:true})); return performance.now()-a;}); console.log('render ms', ms.toFixed(0));
  await p.$eval('#sensSec',e=>e.scrollIntoView()); await p.waitForTimeout(300); await p.screenshot({path:'shot-sens.png'});
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]);
  await pop.waitForLoadState('load'); await pop.waitForTimeout(600);
  console.log('slides:', await pop.$$eval('.sl',s=>s.length));
  const over=await pop.$$eval('.tx',els=>els.map(e=>({sl:e.closest('.sl').dataset.n,over:e.scrollHeight-e.clientHeight,txt:e.textContent.slice(0,40)})).filter(o=>o.over>6)); console.log('overflow:', over);
  await pop.pdf({path:'report-out.pdf', preferCSSPageSize:true, printBackground:true});
  console.log('ERRORS:', errs.length?errs:'none'); process.exit(0);
})();
