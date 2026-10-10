const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  console.log('banner present?', !!(await p.$('#sampleBanner')), '| confidential present?', !!(await p.$('p.confidential')));
  await p.click('#expandAll'); await p.waitForTimeout(300);
  await p.click('#scnTabs [data-scn="0"]'); await p.waitForTimeout(500);   // Scenario A carries the Moat lines in the sample
  const rows=await p.$$('#adjBody tr[data-adj]'); let moat=null;
  for(const r of rows){ if((await r.$eval('[data-ak=bucket]',e=>e.value))==='moat'){ moat=r; break; } }
  const opts=await moat.$$eval('[data-ok=cust] option',os=>os.map(o=>o.textContent));
  console.log('cust options head:', opts.slice(0,4), '| selected:', await moat.$eval('[data-ok=cust] option:checked',e=>e.textContent));
  console.log('ltc ben:', (await p.$eval('#ltcBenBody',e=>e.textContent)).replace(/\s+/g,' ').slice(0,120));
  // pick TBD on a foundation line that has a carrier
  let found=null; for(const r of rows){ if((await r.$eval('[data-ak=bucket]',e=>e.value))==='foundation'){ found=r; break; } }
  console.log('foundation cust before:', await found.$eval('[data-ok=cust] option:checked',e=>e.textContent));
  await found.$eval('[data-ok=cust]',e=>{ e.value='TBD'; e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(600);
  console.log('foundation cust after:', await found.$eval('[data-ok=cust] option:checked',e=>e.textContent), '| ann income row:', (await p.$eval('#annIncBody',e=>e.textContent)).replace(/\s+/g,' ').slice(0,100));
  await p.click('#newCase'); await p.waitForTimeout(300); await p.click('#newCase'); await p.waitForTimeout(600);
  console.log('after new case ok; ERRORS:', errs.length?errs:'none'); await b.close();
})();
