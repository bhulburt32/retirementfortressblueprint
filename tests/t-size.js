const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(700);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  const fort=async()=>(await txt('#fort')).match(/Foundation[^$]*\$[\d,]+[^$]*\$[\d,]+ target/)||[(await txt('#fort')).slice(0,300)];
  console.log('fort:', (await txt('#fort')).match(/Annuity: over[^.]*\.[^.]*\./)[0]);
  await p.fill('#sizeYears','10'); await p.$eval('#sizeYears',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(600);
  console.log('10 yrs:', (await txt('#fort')).match(/Annuity: over[^.]*\.[^.]*\./)[0]);
  await p.fill('#sizeYears','15'); await p.$eval('#sizeYears',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(600);
  const json=await p.$eval('#caseJson',e=>e.value); console.log('saved sizeYears:', JSON.parse(json).household.sizeYears);
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
