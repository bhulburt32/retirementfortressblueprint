const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  // open section 14 only
  await p.$eval('#adjBody', e=>{ let n=e; while(n && n.tagName!=='SECTION') n=n.parentNode; n.querySelector('.sec-head').click(); });
  await p.waitForTimeout(300);
  const btn=await p.$('button.tgl-cta'); console.log('button text:', await btn.textContent(), '| expanded:', await btn.getAttribute('aria-expanded'));
  console.log('table visible before:', await p.$eval('#adjBody', e=>!!(e.offsetParent)));
  await btn.click(); await p.waitForTimeout(300);
  console.log('after click expanded:', await btn.getAttribute('aria-expanded'), '| open class:', await btn.evaluate(e=>e.classList.contains('open')), '| table visible:', await p.$eval('#adjBody', e=>!!(e.offsetParent)));
  await btn.scrollIntoViewIfNeeded(); const box=await btn.boundingBox();
  await p.screenshot({path:'tglbtn.png', clip:{x:Math.max(0,box.x-30), y:box.y-60, width:1200, height:260}});
  await btn.click(); await p.waitForTimeout(200);
  console.log('after 2nd click visible:', await p.$eval('#adjBody', e=>!!(e.offsetParent)));
  await p.click('#expandAll'); await p.waitForTimeout(300); console.log('expandAll -> visible:', await p.$eval('#adjBody', e=>!!(e.offsetParent)), '| btn text:', await btn.textContent());
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
