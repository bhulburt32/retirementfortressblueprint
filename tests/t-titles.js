const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const [pop]=await Promise.all([p.waitForEvent('popup'),p.click('#makeDeck')]); await pop.waitForLoadState(); await pop.waitForTimeout(1500);
  const info=await pop.evaluate(()=>{ const sl=[...document.querySelectorAll('.slide, section.sl, .dk-slide')]; return sl.map((s,i)=>{ const h=s.querySelector('h1,h2,.dk-title,.ttl'); return (i+1)+': '+(h?h.textContent.trim():'?').slice(0,70)+' | '+s.innerText.replace(/\s+/g,' ').slice(0,160); }); });
  console.log(info.join('\n'));
  await b.close();
})();
