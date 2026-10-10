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
  // the care-event block lives in section 18 now; the Moat grows at the contracts' rate (3% unless set)
  console.log('care block in section 18:', await p.$eval('#sensSec #assetLtc',e=>!!e), '| gone from 17:', !(await p.$('#assetSec #assetLtc')));
  const moatEnd=async()=>p.$eval('#assetNote',e=>{ const m=e.textContent.match(/the Moat goes from \$([\d,]+) to \$([\d,]+) at ([\d.]+)%/); return m? {from:+m[1].replace(/,/g,''), to:+m[2].replace(/,/g,''), rate:+m[3]} : null; });
  const g3=await moatEnd(); console.log('moat growth default:', JSON.stringify(g3));
  if(!g3 || g3.rate!==3 || !(g3.to>g3.from)) errs.push('the Moat should grow 3% a year by default');
  const gEl=await row.$('[data-lk=growth]'); console.log('growth placeholder:', await gEl.getAttribute('placeholder')); await gEl.fill('5'); await gEl.dispatchEvent('input'); await gEl.dispatchEvent('blur'); await p.waitForTimeout(300);
  const g5=await moatEnd(); console.log('moat growth with 5% on one contract:', JSON.stringify(g5)); if(!g5 || !(g5.rate>3 && g5.to>g3.to)) errs.push('a 5% growth cell should lift the Moat');
  const json=JSON.parse(await p.$eval('#caseJson',e=>e.value)); console.log('saved:', JSON.stringify(json.ltcBenefits));
  if(!/"growth":"5\.0%"/.test(JSON.stringify(json.ltcBenefits))) errs.push('growth not saved');
  // report
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:20000}), p.click('#makeDeck')]);
  await pop.waitForLoadState('load'); await pop.waitForTimeout(600);
  const t=await pop.evaluate(()=>[...document.querySelectorAll('.sl')].map(s=>s.textContent).filter(x=>/Benefit the Moat buys/.test(x))[0]);
  console.log('report moat page:', t && t.replace(/\s+/g,' ').match(/Benefit the Moat buys.{0,80}/)[0]);
  console.log('ERRORS:', errs.length?errs:'none'); process.exit(0);
})();
