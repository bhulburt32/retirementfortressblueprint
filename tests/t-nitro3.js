const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext({viewport:{width:1500,height:950}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  await p.setInputFiles('#nitroFile', 'nitro-sample.pdf'); await p.waitForTimeout(1500);
  const json=await p.$eval('#caseJson',e=>e.value); await p.evaluate(j => window.__rfb.loadCaseJson(j), json); await p.waitForTimeout(800);
  console.log('after reload out:', (await p.$eval('#nitroOut',e=>e.textContent)).replace(/\s+/g,' ').slice(0,80));
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]);
  await pop.waitForLoadState('load'); await pop.waitForTimeout(600);
  console.log('slides:', await pop.$$eval('.sl',s=>s.length));
  const over=await pop.$$eval('.tx',els=>els.map(e=>({sl:e.closest('.sl').dataset.n,over:e.scrollHeight-e.clientHeight,txt:e.textContent.slice(0,40)})).filter(o=>o.over>6)); console.log('overflow:', over);
  const pg=await pop.evaluate(()=>[...document.querySelectorAll('.sl')].findIndex(s=>/Nitrogen Analysis/.test(s.textContent))+1); console.log('nitrogen page:', pg);
  await pop.pdf({path:'report-nitro.pdf', preferCSSPageSize:true, printBackground:true});
  console.log('ERRORS:', errs.length?errs:'none'); process.exit(0);
})();
