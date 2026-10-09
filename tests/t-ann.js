const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext({acceptDownloads:true, viewport:{width:1500,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(600);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  console.log('rows:', await p.$$eval('#annIncBody tr', r=>r.length), '| hint:', (await txt('#annIncHint')).slice(0,220));
  console.log('msg:', (await txt('#adjIncMsg')).slice(0,160));
  const tbl=async()=>p.$$eval('#incSrcTable tbody tr', rs=>rs.map(r=>[...r.children].map(c=>c.textContent.trim())));
  const hd=await p.$$eval('#incSrcTable thead th', th=>th.map(t=>t.textContent.replace(/All income.*|Federal.*/,'')));
  const ai=hd.indexOf('Annuity income');
  let R=await tbl(); console.log('default annuity 2028/2032/2050/2066:', [2,6,24,40].map(k=>R[k][0]+' '+R[k][ai]).join(' | '));
  // set: GLI yes, start 2030-01, monthly 2,000, inflation 2%
  const set=async(k,v)=>{ await p.$eval('#annIncBody tr [data-ak="'+k+'"]',(e,v)=>{ e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); },v); await p.waitForTimeout(400); };
  await set('gli','yes'); await set('start','2030-01'); await set('monthly','2,000'); await set('cola','2%');
  R=await tbl(); console.log('GLI 2029/2030/2031/2066:', [3,4,5,40].map(k=>R[k][0]+' '+R[k][ai]).join(' | '));
  console.log('hint:', (await txt('#annIncHint')).slice(0,200));
  // switch to No with 0.75%/mo
  await set('gli','no'); await set('wd','0.75%');
  R=await tbl(); console.log('No GLI 2030/2031/2050/2066:', [4,5,24,40].map(k=>R[k][0]+' '+R[k][ai]).join(' | '));
  // assets table sleeve balance
  const A=await p.$$eval('#assetTable tbody tr', rs=>rs.map(r=>[...r.children].map(c=>c.textContent.trim())));
  console.log('foundation annuity balance 2030/2040/2066:', [4,14,40].map(k=>A[k][0]+' '+A[k][3]).join(' | '));
  // product dropdown options on first foundation line
  const opts=await p.$$eval('#adjBody tr[data-adj] select[data-ok="prod"]', ss=>[...ss[1].options].map(o=>o.textContent).slice(0,9));
  console.log('product options:', opts.join(' | '));
  // save/reload
  const json=await p.$eval('#caseJson',e=>e.value); console.log('saved:', JSON.stringify(JSON.parse(json).annuityIncome));
  await p.click('#newCase'); await p.waitForTimeout(100); await p.click('#newCase'); await p.waitForTimeout(300);
  console.log('after new rows:', await p.$$eval('#annIncBody tr', r=>r.length), (await txt('#annIncHint')).slice(0,80));
  await p.$eval('#caseJson',(e,v)=>{e.value=v;},json); await p.click('#loadCase'); await p.waitForTimeout(600);
  console.log('after reload:', await p.$eval('#annIncBody tr [data-ak="wd"]',e=>e.value), await p.$eval('#annIncBody tr [data-ak="gli"]',e=>e.value));
  await p.click('#adjIncReset'); await p.waitForTimeout(300); console.log('after reset:', await p.$eval('#annIncBody tr [data-ak="wd"]',e=>e.value)||'(blank)');
  // report builds
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:60000}), p.click('#makeDeck')]); await pop.waitForLoadState('load'); console.log('report pages', await pop.$$eval('.sl',s=>s.length));
  const over=await pop.$$eval('.tx',els=>els.filter(e=>e.scrollHeight-e.clientHeight>6).map(e=>e.closest('.sl').dataset.n+': '+e.textContent.slice(0,60))); console.log('overflow:', over.length?over:'none');
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
