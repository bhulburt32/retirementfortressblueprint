const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const [pop]=await Promise.all([p.waitForEvent('popup'),p.click('#makeDeck')]); await pop.waitForLoadState(); await pop.waitForTimeout(1500);
  const n=await pop.$$eval('.slide, section.sl, .dk-slide', s=>s.length); console.log('slides', n);
  for(const k of (process.env.SL||"33,34,35").split(",").map(Number)){
    const t=await pop.evaluate(k=>{ const sl=[...document.querySelectorAll('.slide, section.sl, .dk-slide')][k-1]; return sl? sl.innerText.replace(/[ \t]+/g,' ').replace(/\n{2,}/g,'\n').slice(0,1400):'none'; },k);
    console.log('--- slide',k,'---\n'+t);
    await pop.evaluate(k=>{ const sl=[...document.querySelectorAll('.slide, section.sl, .dk-slide')][k-1]; sl.scrollIntoView(); },k);
    const el=(await pop.$$('.slide, section.sl, .dk-slide'))[k-1]; await el.screenshot({path:'slide'+k+'.png'});
  }
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
