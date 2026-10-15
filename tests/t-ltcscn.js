const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  const t0=Date.now();
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(600);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  for(const pfx of ['sqLtc','assetLtc']){
    console.log('\n== '+pfx+' lead:', await txt('#'+pfx+'Lead'));
    const boxes=await p.$$('#'+pfx+' .ltc-scn');
    for(const bx of boxes){
      const h=await bx.$eval('h4',e=>e.textContent), sub=await bx.$eval('.scn-sub',e=>e.textContent);
      const tiles=await bx.$eval('.tax-tiles',e=>e.textContent.replace(/\s+/g,' ').trim());
      const note=await bx.$eval('.hint',e=>e.textContent.replace(/\s+/g,' ').trim());
      const nrect=await bx.$$eval('svg rect',r=>r.length), poly=await bx.$$eval('svg polyline',r=>r.length);
      console.log('--',h,'|',sub); console.log('  tiles:',tiles); console.log('  note:',note); console.log('  rects',nrect,'poly',poly);
    }
  }
  // timing of a re-render
  const t1=Date.now(); await p.fill('#sizeYears','10'); await p.$eval('#sizeYears',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(100);
  const t2=await p.evaluate(()=>{const a=performance.now(); document.getElementById('sizeYears').dispatchEvent(new Event('input',{bubbles:true})); return performance.now()-a;});
  console.log('\nrender ms:', t2.toFixed(0));
  await p.$eval('#sqLtc',e=>e.scrollIntoView()); await p.waitForTimeout(300);
  await p.screenshot({path:'shot-sqltc.png', fullPage:false});
  await p.$eval('#assetLtc',e=>e.scrollIntoView()); await p.waitForTimeout(300);
  await p.screenshot({path:'shot-assetltc.png', fullPage:false});
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
