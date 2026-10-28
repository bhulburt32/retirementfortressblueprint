const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  await p.click('#scnTabs [data-scn="0"]'); await p.waitForTimeout(500);   // Scenario A carries the Moat lines in the sample
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  const rows=async()=>p.$$eval('#ltcBenBody tr[data-ltc]',rs=>rs.map(r=>({key:r.dataset.ltc,name:r.querySelector('td').textContent.replace(/\s+/g,' ').trim(),amt:r.querySelector('[data-lf=amt]').textContent,mo:r.querySelector('[data-lk=monthly]').placeholder,val:r.querySelector('[data-lk=monthly]').value})));
  console.log(JSON.stringify(await rows(),null,1));
  console.log('hint:', await txt('#ltcBenHint'));
  // every contract row carries a Benefit period cell under that heading, with its unit
  const hdr=await p.$$eval('#ltcBenTable thead th',ths=>ths.map(t=>t.textContent.trim()));
  const col=hdr.findIndex(h=>/^Benefit period/.test(h));
  const cells=await p.$$eval('#ltcBenBody tr[data-ltc]',rs=>rs.map(r=>{ const tds=r.querySelectorAll('td'); return Array.from(tds).map(td=>({inp:!!td.querySelector('[data-lk=years]'), ph:(td.querySelector('[data-lk=years]')||{}).placeholder, unit:(td.querySelector('small.sub')||{}).textContent})); }));
  console.log('benefit period column', col, 'cells:', JSON.stringify(cells.map(c=>c[col])));
  if(col<0 || cells.some(c=>!c[col] || !c[col].inp || c[col].unit!=='years' || c[col].ph!=='5.0')) errs.push('each LTC contract needs a Benefit period cell (years, default 5.0) under the Benefit period heading');
  // set Jane's monthly to 9,000 and check it sticks + reload
  const tr=(await p.$$('#ltcBenBody tr[data-ltc]'))[1]; const inp=await tr.$('[data-lk=monthly]'); await inp.click({clickCount:3}); await inp.type('9000'); await p.keyboard.press('Tab'); await p.waitForTimeout(600);
  console.log('after edit:', JSON.stringify((await rows())[1]));
  const json=await p.$eval('#caseJson',e=>e.value); console.log('saved ltcBenefits:', JSON.stringify(JSON.parse(json).ltcBenefits));
  await p.evaluate(j => window.__rfb.loadCaseJson(j), json); await p.waitForTimeout(900);
  console.log('reloaded:', JSON.stringify((await rows())[1]));
  // legacy key fallback: load a case with old per-line key
  const d=JSON.parse(json); d.ltcBenefits={"12:moat:spouse":{monthly:"7,500"}}; d.scenarios[0].ltcBenefits=d.ltcBenefits;
  await p.evaluate(j => window.__rfb.loadCaseJson(j), JSON.stringify(d)); await p.waitForTimeout(900);
  console.log('legacy:', JSON.stringify((await rows())[1]));
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
