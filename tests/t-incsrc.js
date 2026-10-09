const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1500,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(500);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  console.log('note:', await txt('#incSrcNote'));
  console.log('head:', await p.$$eval('#incSrcTable thead th', th=>th.map(t=>t.textContent).join(' | ')));
  const R=await p.$$eval('#incSrcTable tbody tr', rs=>rs.map(r=>[...r.children].map(c=>c.textContent.trim()+(c.title?' {'+c.title+'}':''))));
  [0,2,6,14,40].forEach(k=>console.log(R[k].join(' | ')));
  // reconcile: all income - expenses - tax == net
  const num=s=>parseFloat(s.replace(/[^0-9.\-−]/g,'').replace('−','-'))||0;
  const bad=R.filter(r=>{const n=r.length; const a=num(r[n-6]),e=num(r[n-3]),t=num(r[n-2].split(' {')[0]),net=num(r[n-1]); return Math.abs(a-e-t-net)>1.5;});
  console.log('reconcile mismatches:', bad.length);
  // compare tax column to section 16 table
  const T16=await p.$$eval('#taxTable tbody tr', rs=>rs.map(r=>[...r.children].map(c=>c.textContent.trim())));
  console.log('tax16 sample:', T16[6]&&T16[6].join(' | '));
  await p.$eval('#incSrcTable', e=>e.scrollIntoView({block:'start'})); await p.waitForTimeout(200); await p.screenshot({path:'shot-incsrc.png'});
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
