const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  console.log('tiles:', await txt('#rmdTiles'));
  console.log('legend:', await txt('#rmdLegend'));
  console.log('note:', await txt('#rmdNote'));
  console.log('rects:', await p.$$eval('#rmdSvg rect[rx]', r=>r.length));
  await p.$eval('#rmdSvg', e=>e.scrollIntoView({block:'center'})); await p.waitForTimeout(300);
  const el=await p.$('#rmdSvg'); const box=await el.boundingBox();
  await p.screenshot({path:'rmd-app.png', clip:{x:box.x-20,y:box.y-140,width:box.width+40,height:box.height+200}});
  // toggle apply off
  await p.click('#rothApply'); await p.waitForTimeout(600);
  console.log('OFF tiles:', (await txt('#rmdTiles')).slice(0,300));
  console.log('OFF legend:', await txt('#rmdLegend'));
  await p.click('#rothApply'); await p.waitForTimeout(400);
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
