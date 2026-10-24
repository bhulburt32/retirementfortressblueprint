const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext(); const p=await ctx.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  const t0=Date.now(); await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(900); console.log('load+first render ms', Date.now()-t0);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  const cards=async()=>p.$$eval('#scnGrid .scn-card',cs=>cs.map(c=>c.querySelector('.scn-card-head').textContent.replace(/\s+/g,' ')+' || '+[...c.querySelectorAll('dl div')].filter(d=>/Foundation|Roth conv|Assets at end|Withdrawal/.test(d.textContent)).map(d=>d.textContent.replace(/\s+/g,' ')).join(' | ')+' || '+c.querySelector('.scn-card-foot').textContent.replace(/\s+/g,' ')));
  console.log('cards A:', await cards());
  console.log('body class:', await p.$eval('body',b=>b.className), '| tag:', await txt('#adjSec .scn-tag'), '| tabs:', await txt('#scnTabs'));
  // time a render
  const ms=await p.evaluate(()=>{const a=performance.now(); document.getElementById('sizeYears').dispatchEvent(new Event('input',{bubbles:true})); return performance.now()-a;}); console.log('render ms', ms.toFixed(0));
  // switch to B, edit a transfer amount and turn Roth off
  await p.click('#scnTabs [data-scn="1"]'); await p.waitForTimeout(500);
  console.log('after switch body:', await p.$eval('body',b=>b.className), '| tag17:', await txt('#assetSec .scn-tag'));
  const amt=await p.$('#adjBody input[data-ak="amt"]'); const v0=await amt.evaluate(e=>e.value); await amt.fill('100000'); await amt.dispatchEvent('input'); await p.waitForTimeout(400);
  await p.$eval('#rothApply',e=>{e.checked=false; e.dispatchEvent(new Event('change',{bubbles:true}));}); await p.waitForTimeout(400);
  await p.fill('#scnName','Conservative'); await p.$eval('#scnName',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(200);
  console.log('cards after B edits:', await cards());
  console.log('B adj msg:', await txt('#adjMsg'));
  // back to A: adjustments must be the model's own, Roth on
  await p.click('#scnTabs [data-scn="0"]'); await p.waitForTimeout(500);
  console.log('A adj msg:', await txt('#adjMsg'), '| rothApply:', await p.$eval('#rothApply',e=>e.checked), '| first amt:', await p.$eval('#adjBody input[data-ak="amt"]',e=>e.value), 'was', v0);
  // report scenario B
  await p.selectOption('#reportScn','1'); await p.waitForTimeout(500);
  console.log('report msg:', await txt('#reportScnMsg'));
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]);
  await pop.waitForLoadState('load'); await pop.waitForTimeout(500);
  const roth=await pop.evaluate(()=>document.body.textContent.includes('$1,072,156')+' / A-end present: '+document.body.textContent.includes('$1,519,543'));
  console.log('report (B) roth page:', roth);
  console.log('after report body:', await p.$eval('body',b=>b.className), '| A first amt:', await p.$eval('#adjBody input[data-ak="amt"]',e=>e.value));
  // save & reload round trip
  const json=await p.$eval('#caseJson',e=>e.value); const d=JSON.parse(json); console.log('saved scenarios:', d.scenarios.map(s=>s.name+':'+(s.adjMoves?s.adjMoves.length:'auto')+':roth='+s.roth.apply), 'active', d.activeScenario, 'report', d.reportScenario);
  await p.evaluate(j => window.__rfb.loadCaseJson(j), json); await p.waitForTimeout(800);
  console.log('after reload cards:', (await cards()).map(c=>c.slice(0,60)));
  console.log('ERRORS:', errs.length?errs:'none'); process.exit(0);
})();
