const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  console.log(await p.$$eval('#adjBody tr[data-adj]',rs=>rs.map(r=>r.querySelector('.adj-acct option:checked').textContent.split(' · ')[0].padEnd(20)+' start '+r.querySelector('[data-bal]').textContent.padEnd(24)+' amt '+r.querySelector('[data-ak=amt]').value.padEnd(10)+' after '+r.querySelector('[data-rem]').textContent)));
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
