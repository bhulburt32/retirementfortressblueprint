const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext({acceptDownloads:true, viewport:{width:1500,height:1000}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(500);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  // single client: blank the spouse
  for(const id of ['spouseFirst','spouseLast','spouseAge']){ await p.fill('#'+id,''); } await p.fill('#ltcSpouse','0'); await p.$eval('#ltcSpouse',e=>e.dispatchEvent(new Event('input',{bubbles:true})));
  await p.waitForTimeout(500);
  // tick two risks, answer estate, set an adjustment
  await p.evaluate(()=>{ const cbs=document.querySelectorAll('#riskList input[type=checkbox]'); cbs[1].click(); cbs[2].click(); });
  await p.selectOption('#estWill','yes'); await p.fill('#estWillDate','2015'); await p.waitForTimeout(300);
  await p.evaluate(()=>{ const tr=document.querySelectorAll('#adjBody tr[data-adj]')[2]; const s=tr.querySelector('select.adj-bkt'); s.value='roof'; s.dispatchEvent(new Event('change',{bubbles:true})); });
  await p.waitForTimeout(500);
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:60000}), p.click('#makeDeck')]);
  await pop.waitForLoadState('load'); await pop.waitForTimeout(600);
  console.log('single-client report:', await pop.$$eval('.sl',s=>s.length), 'pages;', await pop.title());
  const over=await pop.$$eval('.tx',els=>els.filter(e=>e.scrollHeight-e.clientHeight>6).map(e=>e.closest('.sl').dataset.n+': '+e.textContent.slice(0,60)));
  console.log('overflow:', over.length?over:'none');
  await pop.pdf({path:'report-single.pdf', preferCSSPageSize:true, printBackground:true}); await pop.close();
  for(const id of ['makePdf','makeNitrogen']){ const [d]=await Promise.all([p.waitForEvent('download',{timeout:60000}), p.click('#'+id)]); console.log('pdf ok', d.suggestedFilename()); }
  console.log('msg:', await p.$eval('#pdfMsg',e=>e.textContent));
  // no accounts
  await p.click('#clearAccts'); await p.waitForTimeout(100); await p.click('#clearAccts'); await p.waitForTimeout(400);
  await p.click('#makeDeck'); await p.waitForTimeout(300); console.log('no-accounts msg:', await p.$eval('#pdfMsg',e=>e.textContent));
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
