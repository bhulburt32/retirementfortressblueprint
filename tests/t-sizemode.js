const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(800);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  const note=async()=>(await txt('#fort')).match(/Annuity: over[^.]*\.[^.]*\./)[0];
  console.log('peak:', await note());
  await p.selectOption('#sizeMode','avg'); await p.waitForTimeout(500);
  console.log('avg:', await note());
  console.log('tile:', (await txt('#incSumTiles')).match(/Annual Needs income gap\$[\d,]+[^$]*/)?.[0].slice(0,160));
  const json=await p.$eval('#caseJson',e=>e.value); console.log('saved sizeMode:', JSON.parse(json).household.sizeMode);
  await p.evaluate(j => window.__rfb.loadCaseJson(j), json); await p.waitForTimeout(700);
  console.log('after reload mode:', await p.$eval('#sizeMode',e=>e.value), '|', (await note()).slice(0,120));
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
