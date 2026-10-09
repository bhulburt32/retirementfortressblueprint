const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext(); const p=await ctx.newPage({viewport:{width:1500,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(800);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  console.log('rows:', await p.$$eval('#ltcBenBody tr[data-ltc]',rs=>rs.map(r=>r.dataset.ltc+' | '+r.querySelector('td').textContent.replace(/\s+/g,' ')+' | '+r.querySelector('[data-lf=amt]').textContent+' | ph monthly '+r.querySelector('[data-lk=monthly]').placeholder+' | ph years '+r.querySelector('[data-lk=years]').placeholder)));
  console.log('hint:', await txt('#ltcBenHint'));
  const tileB=async()=>(await p.$$eval('#assetLtc .ltc-scn .tax-tiles',e=>e.map(x=>x.textContent.replace(/\s+/g,' ').match(/Paid by the Moat\$[\d,]+[^F]*/)?.[0])));
  console.log('plan scenario moat tiles (defaults):', await tileB());
  // set the first contract: $5,000 a month at 80 for 3 years, 3% inflation
  const row=await p.$('#ltcBenBody tr[data-ltc]');
  for(const [k,v] of [['monthly','5000'],['years','3'],['infl','3%']]){ const el=await row.$('[data-lk='+k+']'); await el.fill(v); await el.dispatchEvent('input'); await el.dispatchEvent('blur'); await p.waitForTimeout(200); }
  console.log('after edit hint:', await txt('#ltcBenHint'));
  console.log('after edit values:', await row.$$eval('input',i=>i.map(x=>x.value)));
  console.log('plan scenario moat tiles (edited):', await tileB());
  console.log('moat panel benefit text:', (await txt('#moatPanel').catch(()=>'')).slice(0,0));
  const json=JSON.parse(await p.$eval('#caseJson',e=>e.value)); console.log('saved:', JSON.stringify(json.ltcBenefits));
  // report
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:20000}), p.click('#makeDeck')]);
  await pop.waitForLoadState('load'); await pop.waitForTimeout(600);
  const t=await pop.evaluate(()=>[...document.querySelectorAll('.sl')].map(s=>s.textContent).filter(x=>/Benefit the Moat buys/.test(x))[0]);
  console.log('report moat page:', t && t.replace(/\s+/g,' ').match(/Benefit the Moat buys.{0,80}/)[0]);
  console.log('ERRORS:', errs.length?errs:'none'); process.exit(0);
})();
