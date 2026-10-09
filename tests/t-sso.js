const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(1500);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  console.log('tiles:', await txt('#ssoTiles'));
  console.log('rows:', await p.$$eval('#ssoTable tbody tr', rs=>rs.map(r=>r.textContent.replace(/\s+/g,' ').trim().slice(0,150))));
  console.log('legend:', await txt('#ssoLegend'));
  console.log('note:', (await txt('#ssoNote')).slice(0,500));
  console.log('msg:', await txt('#ssoMsg'), '| use disabled?', await p.$eval('#ssoUse',e=>e.disabled));
  console.log('be rows:', await p.$$eval('#ssoBeTable tbody tr', rs=>rs.length), '| polylines:', await p.$$eval('#ssoSvg polyline', r=>r.length));
  await p.$eval('#ssoSvg', e=>e.scrollIntoView({block:'center'})); await p.waitForTimeout(300);
  const el=await p.$('#ssoSvg'); const box=await el.boundingBox();
  await p.screenshot({path:'sso-app.png', clip:{x:box.x-20,y:box.y-520,width:box.width+40,height:box.height+600}});
  // use strategy
  await p.click('#ssoUse'); await p.waitForTimeout(800);
  console.log('after use: ages', await p.$eval('#ssAgeC',e=>e.value), await p.$eval('#ssAgeS',e=>e.value), '| msg', await txt('#ssoMsg'));
  // life expectancy change
  await p.fill('#ssoLifeS','92'); await p.dispatchEvent('#ssoLifeS','input'); await p.waitForTimeout(700);
  console.log('life 92 tiles:', (await txt('#ssoTiles')).slice(0,200));
  // save/reload
  const json=await p.$eval('#caseJson',e=>e.value); console.log('saved optimizer:', JSON.stringify(JSON.parse(json).household.benefits.ss.optimizer));
  // report
  const [pop]=await Promise.all([p.waitForEvent('popup'),p.click('#makeSS')]); await pop.waitForLoadState(); await pop.waitForTimeout(1200);
  console.log('report title:', await pop.title(), '| pages:', await pop.$$eval('section.page, section.cover', s=>s.length), '| yr tables:', await pop.$$eval('table.yr', s=>s.length));
  console.log('pdfMsg:', await txt('#pdfMsg'));
  await pop.setViewportSize({width:1000,height:1400}); await pop.screenshot({path:'sso-report.png', fullPage:false});
  const h=await pop.evaluate(()=>document.body.innerText.slice(0,900).replace(/\s+/g,' ')); console.log(h);
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
