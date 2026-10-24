const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  const annRows=async()=>p.$$eval('#annIncBody tr[data-ann]',rs=>rs.map(r=>({key:r.dataset.ann,name:r.querySelector('td').textContent.replace(/\s+/g,' ').trim(),amt:r.querySelector('[data-af=amt]').textContent,mo:r.querySelector('[data-ak=monthly]').value,auto:r.querySelector('[data-ak=monthly]').classList.contains('auto'),dis:r.querySelector('[data-ak=monthly]').disabled})));
  console.log('BEFORE:', JSON.stringify(await annRows(),null,1));
  // foundation lines in transfer table
  const rows=await p.$$('#adjBody tr[data-adj]');
  const found=[]; for(const r of rows){ const bk=await r.$eval('[data-ak=bucket]',e=>e.value); if(bk==='foundation') found.push(r); }
  console.log('foundation lines:', found.length);
  // point all foundation lines at one custom To "Athene Fixed Indexed Annuity"
  for(const r of found){
    await r.$eval('[data-ok=to]',e=>{ e.value='__custom'; e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(200);
    const inp=await r.$('[data-oi=to]'); await inp.fill('Athene FIA'); await inp.dispatchEvent('input'); await p.waitForTimeout(300);
    // product -> Fixed Indexed Annuity if there is a product control
    const prod=await r.$('[data-ak=prod], [data-ok=prod]');
    if(prod){ const tag=await prod.evaluate(e=>e.tagName); if(tag==='SELECT'){ await prod.evaluate(e=>{ const o=[...e.options].find(o=>/fixed indexed annuity/i.test(o.textContent)); if(o){ e.value=o.value; e.dispatchEvent(new Event('change',{bubbles:true})); } }); } else { await prod.fill('Fixed Indexed Annuity'); await prod.dispatchEvent('input'); } await p.waitForTimeout(300); }
  }
  await p.waitForTimeout(500);
  console.log('AFTER GROUP:', JSON.stringify(await annRows(),null,1));
  console.log('hint:', (await txt('#annIncHint')).slice(0,400));
  // type over the monthly default
  const mo=await p.$('#annIncBody tr[data-ann] [data-ak=monthly]');
  if(mo && !(await mo.evaluate(e=>e.disabled))){
    await mo.click({clickCount:3}); await mo.type('5000'); await p.waitForTimeout(400); await p.keyboard.press('Tab'); await p.waitForTimeout(400);
    console.log('TYPED 5000:', JSON.stringify(await annRows()));
    console.log('hint after:', (await txt('#annIncHint')).match(/paying about [^:]+/)?.[0]);
    await mo.click({clickCount:3}); await p.keyboard.press('Backspace'); await p.waitForTimeout(400); await p.keyboard.press('Tab'); await p.waitForTimeout(400);
    console.log('CLEARED:', JSON.stringify(await annRows()));
  } else console.log('monthly disabled (GLI off) — toggling gli');
  // save/reload
  const json=await p.$eval('#caseJson',e=>e.value); await p.evaluate(j => window.__rfb.loadCaseJson(j), json); await p.waitForTimeout(800);
  console.log('RELOADED:', JSON.stringify(await annRows()));
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
