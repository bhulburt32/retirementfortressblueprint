const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  // pick the Roth IRA -> roof line (row with 'David Roth IRA' as To) and type a custom To
  const rows=await p.$$('#adjBody tr[data-adj]');
  let target=null; for(const r of rows){ const to=await r.$eval('[data-ok=to] option:checked',e=>e.textContent); const bk=await r.$eval('[data-ak=bucket]',e=>e.value); if(/Roth IRA/.test(to) && bk==='roof'){ target=r; break; } }
  console.log('target found:', !!target);
  await target.$eval('[data-ok=to]',e=>{ e.value='__custom'; e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(300);
  const inp=await target.$('[data-oi=to]'); await inp.fill('Schwab Growth Account'); await inp.dispatchEvent('input'); await p.waitForTimeout(500);
  console.log('target to now:', await target.$eval('[data-ok=to] option:checked',e=>e.textContent), '| custom input hidden?', await inp.evaluate(e=>e.hidden), '| ttax:', await target.$eval('[data-ttax]',e=>e.textContent));
  // is it offered on another row?
  const other=rows[1]===target?rows[2]:rows[1];
  console.log('other row options include custom:', await other.$$eval('[data-ok=to] option',os=>os.map(o=>o.textContent).includes('Schwab Growth Account')));
  // ending positions
  console.log('holdings mention:', (await txt('#holdings')).includes('Schwab Growth Account'), '|', (await txt('#holdings')).match(/Schwab Growth Account.{0,80}/)?.[0]);
  // roof growth rows
  console.log('roof rows:', await p.$$eval('#roofGBody tr[data-roof]',rs=>rs.map(r=>r.dataset.roof)));
  // steps / report still OK
  console.log('steps has:', (await txt('#steps')).includes('Schwab Growth Account'));
  const json=await p.$eval('#caseJson',e=>e.value); await p.fill('#caseJson', json); await p.click('#loadCase'); await p.waitForTimeout(800);
  console.log('after reload holdings:', (await txt('#holdings')).includes('Schwab Growth Account'));
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
