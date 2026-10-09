const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:2200,height:900}});
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(700);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  console.log('wrap width:', await p.$eval('.wrap',e=>e.getBoundingClientRect().width), '| section widths:', await p.$$eval('section',ss=>[...new Set(ss.map(s=>Math.round(s.getBoundingClientRect().width)))]), '| doc scrollWidth', await p.evaluate(()=>document.documentElement.scrollWidth));
  await p.$eval('#assetSec',e=>e.scrollIntoView()); await p.waitForTimeout(300); await p.screenshot({path:'shot-width.png'});
  await b.close();
})();
