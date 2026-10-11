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
  console.log('header motto:', await p.$eval('.masthead #motto', e=>e.textContent.trim()), '| Together styled:', await p.$eval('.masthead #motto .tg', e=>{ const c=getComputedStyle(e); return c.fontWeight+'/'+c.textDecorationLine; }));
  const miss0 = await p.$$eval('#acctBody input[data-k=growth].missing', e=>e.length); console.log('growth rates missing on the sample:', miss0, '| total line:', await p.$eval('#acctTotal', e=>e.textContent));
  if(miss0) errs.push('the sample case should carry a growth rate on every account');
  const gsel = await p.$$eval('#acctBody tr[data-id]', rs=>{ const r=rs.find(x=>x.querySelector('input[data-k=name]').value.trim()==="Jeff's IRA"); return r ? r.dataset.id : null; });
  await p.fill(`#acctBody tr[data-id="${gsel}"] input[data-k=growth]`, ''); await p.waitForTimeout(700);
  const gate = {sq:await p.$eval('#sqNote', e=>e.textContent), asset:await p.$eval('#assetNote', e=>e.textContent), sens:await p.$eval('#sensLead', e=>e.textContent), tiles:await p.$eval('#assetTiles', e=>e.textContent.trim().length), flagged:await p.$$eval('#acctBody input[data-k=growth].missing', e=>e.length), total:await p.$eval('#acctTotal', e=>e.textContent)};
  await p.click('#makeDeck'); await p.waitForTimeout(400); gate.deckMsg = await p.$eval('#pdfMsg', e=>e.textContent);
  console.log('gate with one rate cleared:', JSON.stringify(gate));
  if(!(/missing on Jeff's IRA/.test(gate.sq) && /missing on/.test(gate.asset) && /missing on/.test(gate.sens) && gate.tiles===0 && gate.flagged===1 && /missing on 1/.test(gate.total) && /missing on Jeff's IRA/.test(gate.deckMsg))) errs.push('the projections and the deck should wait for the missing growth rate');
  await p.fill(`#acctBody tr[data-id="${gsel}"] input[data-k=growth]`, '5.0%'); await p.waitForTimeout(700);
  if(!((await p.$eval('#assetTiles', e=>e.textContent.trim().length)) > 0) || (await p.$$eval('#acctBody input[data-k=growth].missing', e=>e.length))) errs.push('the projections should return once the rate is entered');
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
