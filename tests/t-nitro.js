const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  await p.setInputFiles('#nitroFile', 'nitro-sample.pdf'); await p.waitForTimeout(1500);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  console.log('msg:', await txt('#nitroMsg'));
  const text=await p.$eval('#nitroText',e=>e.value); console.log('extracted chars:', text.length); console.log(text.slice(0,700));
  console.log('OUT:', (await txt('#nitroOut')).slice(0,900));
  console.log('riskScore filled:', await p.$eval('#riskScore',e=>e.value));
  const json=JSON.parse(await p.$eval('#caseJson',e=>e.value)); console.log('saved analysis:', JSON.stringify(json.nitrogen.analysis).slice(0,600));
  await p.$eval('#riskSec',e=>e.scrollIntoView()); await p.waitForTimeout(300); await p.screenshot({path:'shot-nitro.png'});
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
