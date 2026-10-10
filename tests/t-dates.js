const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1500,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(500);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  await p.click('#budToggle'); await p.waitForTimeout(300);
  // fill: Mortgage 2,000/mo ending 2041-06; Food 1,500 (no dates); Vacation (want) 800 starting 2029-01
  const setLine=async(label, amt, start, end)=>{
    await p.evaluate(({label,amt,start,end})=>{
      const rows=[...document.querySelectorAll('#budBody tr[data-bud]')];
      const tr=rows.find(r=>r.textContent.includes(label) || (r.querySelector('[data-bk=label]')&&r.querySelector('[data-bk=label]').placeholder===label));
      const a=tr.querySelector('[data-bk=amt]'); a.value=String(amt); a.dispatchEvent(new Event('input',{bubbles:true}));
      if(start){ const s=tr.querySelector('[data-bk=start]'); s.value=start; s.dispatchEvent(new Event('input',{bubbles:true})); s.dispatchEvent(new Event('change',{bubbles:true})); }
      if(end){ const e=tr.querySelector('[data-bk=end]'); e.value=end; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); }
    },{label,amt,start,end});
  };
  await setLine('Mortgage Principal', 2000, null, '2041-06');
  await setLine('Food', 1500, null, null);
  await setLine('Vacation', 800, '2029-01', null);
  await p.waitForTimeout(200);
  console.log('hint before apply:', await p.$eval('#budHint',e=>e.textContent));
  await p.click('#budApply'); await p.waitForTimeout(600);
  console.log('needs/wants:', await p.$eval('#needs',e=>e.value), await p.$eval('#wants',e=>e.value));
  console.log('hint:', await p.$eval('#budHint',e=>e.textContent));
  const R=await p.$$eval('#incSrcTable tbody tr', rs=>rs.map(r=>[...r.children].map(c=>c.textContent.trim())));
  const hd=await p.$$eval('#incSrcTable thead th', th=>th.map(t=>t.textContent.replace(/All income.*|Federal.*/,'')));
  const ni=hd.indexOf('Needs'), wi=hd.indexOf('Wants');
  [0,2,3,14,15,16,40].forEach(k=>console.log(R[k][0], 'Needs', R[k][ni], 'Wants', R[k][wi]));
  console.log('gap note:', (await p.$eval('#gapNote',e=>e.textContent)).slice(0,260));
  // unlink + change needs manually -> falls back to flat
  await p.fill('#needs','50,000'); await p.$eval('#needs',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(500);
  const R2=await p.$$eval('#incSrcTable tbody tr', rs=>rs.map(r=>[...r.children].map(c=>c.textContent.trim())));
  console.log('after manual needs: 2026', R2[0][ni], '2042', R2[16][ni]);
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
