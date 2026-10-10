const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{ if(m.type()==='warning'||m.type()==='error') errs.push('console:'+m.text()); });
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  const v=async id=>p.$eval('#'+id,e=>e.value);
  console.log('names:', await v('clientFirst'), await v('clientLast'), await v('spouseFirst'), await v('spouseLast'), '| advisor', await v('advisor'), '| date', await v('prepDate'));
  console.log('needs/wants:', await v('needs'), await v('wants'), '| infl', await v('inflation'), '| banner present?', !!(await p.$('#sampleBanner')));
  console.log('accounts rows:', await p.$$eval('#acctBody tr', rs=>rs.length));
  console.log('debts rows:', await p.$$eval('#debtBody tr[data-debt]', rs=>rs.length), '| pensions:', await p.$$eval('#penBody tr[data-pen]', rs=>rs.length), '| annuities:', await p.$$eval('#annBody tr[data-ann]', rs=>rs.length));
  console.log('transfer lines:', await p.$$eval('#adjBody tr[data-adj]', rs=>rs.length));
  console.log('ann income rows:', JSON.stringify(await p.$$eval('#annIncBody tr[data-ann]',rs=>rs.map(r=>({key:r.dataset.ann,name:r.querySelector('td').textContent.replace(/\s+/g,' ').trim().slice(0,90),amt:r.querySelector('[data-af=amt]').textContent,mo:r.querySelector('[data-ak=monthly]').value,auto:r.querySelector('[data-ak=monthly]').classList.contains('auto')})))));
  console.log('risk score/tol:', await v('riskScore'), await v('riskTol'), '| nitro out:', (await txt('#nitroOut')).slice(0,120));
  console.log('scn tabs:', await txt('#scnTabs'));
  const notesAll=await p.$$eval('#notesLog textarea',ts=>ts.map(t=>t.value).join('\n')); console.log('notes entries:', await p.$$eval('#notesLog textarea',ts=>ts.length), '| has Smith:', notesAll.includes('Smith'), 'Mara?', notesAll.includes('Mara'));
  console.log('goals:', (await txt('#goalsList')).slice(0,100));
  // report still builds
  const [pop]=await Promise.all([p.waitForEvent('popup'),p.click('#makeDeck')]); await pop.waitForLoadState(); await pop.waitForTimeout(1500);
  console.log('deck slides:', await pop.$$eval('.slide, section.sl, .dk-slide', s=>s.length), '| title:', await pop.title());
  // start new case clears
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
