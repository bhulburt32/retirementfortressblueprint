const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(1500);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const [pop]=await Promise.all([p.waitForEvent('popup'),p.click('#makeSS')]); await pop.waitForLoadState(); await pop.waitForTimeout(1200);
  const html=await pop.content(); require('fs').writeFileSync('ss-report-sample.html', html);
  await pop.pdf({path:'ss-report-sample.pdf', format:'Letter', printBackground:true});
  console.log('saved', html.length); await b.close();
})();
