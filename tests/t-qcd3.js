const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  await p.fill('#qcdC','10000'); await p.dispatchEvent('#qcdC','input'); await p.waitForTimeout(900);
  const [pop]=await Promise.all([p.waitForEvent('popup'),p.click('#makeDeck')]); await pop.waitForLoadState(); await pop.waitForTimeout(1800);
  const sl=await pop.$$('.slide, section.sl, .dk-slide'); console.log('slides', sl.length);
  const idx=await pop.evaluate(()=>[...document.querySelectorAll('.slide, section.sl, .dk-slide')].findIndex(s=>/Qualified Charitable/.test(s.innerText)));
  console.log('QCD slide index', idx+1);
  await pop.evaluate(k=>{ document.querySelectorAll('.slide, section.sl, .dk-slide')[k].scrollIntoView(); },idx);
  await sl[idx].screenshot({path:'slide-qcd.png'});
  // overflow check
  const over=await pop.evaluate(()=>{ const out=[]; document.querySelectorAll('.slide, section.sl, .dk-slide').forEach((s,i)=>{ s.querySelectorAll('.tb, .dk-body, .dk-tile, [data-tb]').forEach(e=>{ if(e.scrollHeight>e.clientHeight+6) out.push((i+1)+': '+e.textContent.trim().slice(0,50)+' over '+(e.scrollHeight-e.clientHeight)); }); }); return out; });
  console.log('overflow:', over.length?over:'none');
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
