const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  console.log('rows:', await p.$$eval('#roofGBody tr[data-roof]',rs=>rs.map(r=>r.dataset.roof+' | '+r.querySelector('td b').textContent+' | '+r.querySelector('[data-rf=amt]').textContent+' | ph '+r.querySelector('input').placeholder+' | '+r.querySelector('[data-rf=dflt]').textContent)));
  console.log('hint:', await txt('#roofGHint'));
  const endBefore=(await txt('#assetTiles')).match(/AT END OF PLAN\$[\d,]+/i)?.[0];
  const row=await p.$('#roofGBody tr[data-roof] input'); await row.fill('9%'); await row.dispatchEvent('input'); await row.dispatchEvent('blur'); await p.waitForTimeout(400);
  console.log('after 9% on first line:', await txt('#roofGHint'));
  console.log('value fmt:', await row.evaluate(e=>e.value), '| end of plan before', endBefore, 'after', (await txt('#assetTiles')).match(/At end of plan\$[\d,]+/)?.[0]);
  console.log('assetAssume:', (await txt('#assetAssume')).slice(0,160));
  console.log('card roof growth:', await p.$$eval('#scnGrid .scn-card dl div',ds=>ds.filter(d=>/Roof growth/.test(d.textContent)).map(d=>d.textContent.replace(/\s+/g,' '))));
  // switch scenario -> table should be blank there, back -> value kept
  await p.click('#scnTabs [data-scn="2"]'); await p.waitForTimeout(500);
  console.log('scn C first input:', await p.$eval('#roofGBody tr[data-roof] input',e=>e.value||'(blank)'));
  await p.click('#scnTabs [data-scn="0"]'); await p.waitForTimeout(500);
  console.log('scn A first input:', await p.$eval('#roofGBody tr[data-roof] input',e=>e.value));
  const json=await p.$eval('#caseJson',e=>e.value); const d=JSON.parse(json); console.log('saved roofGrowth:', JSON.stringify(d.roofGrowth), '| scnA:', JSON.stringify(d.scenarios[0].roofGrowth));
  await p.evaluate(j => window.__rfb.loadCaseJson(j), json); await p.waitForTimeout(800);
  console.log('after reload:', await p.$eval('#roofGBody tr[data-roof] input',e=>e.value), '|', (await txt('#roofGHint')).slice(0,60));
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
