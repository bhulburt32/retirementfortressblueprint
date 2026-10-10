const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  console.log('empty:', (await txt('#jobBody')).slice(0,80));
  const inc0=await txt('#incSrcNote');
  await p.click('#jobAdd'); await p.waitForTimeout(400);
  const tr=await p.$('#jobBody tr[data-job]');
  await (await tr.$('[data-jk=name]')).fill('Consulting'); await (await tr.$('[data-jk=name]')).dispatchEvent('input');
  await (await tr.$('[data-jk=amt]')).fill('24000'); await (await tr.$('[data-jk=amt]')).dispatchEvent('input');
  await tr.$eval('[data-jk=start]',e=>{ e.value='2027-01'; e.dispatchEvent(new Event('change',{bubbles:true})); });
  await tr.$eval('[data-jk=end]',e=>{ e.value='2030-12'; e.dispatchEvent(new Event('change',{bubbles:true})); });
  await (await tr.$('[data-jk=raise]')).fill('2%'); await (await tr.$('[data-jk=raise]')).dispatchEvent('input');
  await p.waitForTimeout(700);
  console.log('note:', await txt('#jobBody tr[data-jnote] td'));
  console.log('hint:', await txt('#jobHint'));
  // income source table: employment column in 2028
  const rowTxt=await p.$$eval('#incSrcTable tbody tr', rs=>rs.map(r=>r.textContent.replace(/\s+/g,' ').trim()).filter(t=>/^202[6-9]|^203[01]/.test(t)).slice(0,6));
  console.log(rowTxt.join('\n'));
  // save/reload
  const json=await p.$eval('#caseJson',e=>e.value); console.log('saved extra:', JSON.stringify(JSON.parse(json).household.employment.extra));
  await p.fill('#caseJson', json); await p.click('#loadCase'); await p.waitForTimeout(900);
  console.log('reloaded rows:', await p.$$eval('#jobBody tr[data-job]',rs=>rs.length), '| name:', await p.$eval('#jobBody [data-jk=name]',e=>e.value));
  // deck slide 6
  const [pop]=await Promise.all([p.waitForEvent('popup'),p.click('#makeDeck')]); await pop.waitForLoadState(); await pop.waitForTimeout(1500);
  const s6=await pop.evaluate(()=>document.querySelectorAll('.slide, section.sl, .dk-slide')[5].innerText.replace(/\s+/g,' ').slice(0,400));
  console.log('slide 6:', s6);
  const over=await pop.evaluate(()=>{ const out=[]; document.querySelectorAll('.slide, section.sl, .dk-slide').forEach((s,i)=>{ s.querySelectorAll('.tb, .dk-body, .dk-tile, [data-tb]').forEach(e=>{ if(e.scrollHeight>e.clientHeight+6) out.push((i+1)+': '+e.textContent.trim().slice(0,50)); }); }); return out; });
  console.log('overflow:', over.length?over:'none');
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
