/* The three scenarios on one chart (section 14) and the comparison page of the executive summary. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext(); const p=await ctx.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  const paths=async()=>p.$$eval('#scnCmpSvg path',ps=>ps.map(q=>q.getAttribute('stroke')+(q.getAttribute('stroke-dasharray')?' dashed':'')));
  const labels=async()=>p.$$eval('#scnCmpSvg .pj-label',ts=>ts.map(t=>t.textContent));
  const slideInfo=pop=>pop.evaluate(()=>{ const sl=[...document.querySelectorAll('.sl')].find(s=>/Three Ways to Build the Fortress/.test(s.textContent)); if(!sl) return null;
    const over=[...sl.querySelectorAll('.tx')].filter(e=>e.scrollHeight-e.clientHeight>6).length;
    return {page:sl.dataset.n, of:document.querySelectorAll('.sl').length, paths:sl.querySelectorAll('svg path').length, over, renamed:/No conversions/.test(sl.textContent), text:sl.textContent.replace(/\s+/g,' ').slice(0,520)}; });
  // the default case: A is adjusted, B and C follow the model — two lines, C dashed over B
  console.log('visible:', await p.$eval('#scnCmp',e=>!e.hidden), '| paths:', JSON.stringify(await paths()));
  console.log('labels:', JSON.stringify(await labels()));
  console.log('legend:', await txt('#scnCmpLegend'));
  console.log('note:', (await txt('#scnCmpNote')).slice(0,420));
  await (await p.$('#scnCmpSvg')).scrollIntoViewIfNeeded(); const bb=await (await p.$('#scnCmpSvg')).boundingBox(); await p.mouse.move(bb.x+bb.width*0.55, bb.y+bb.height*0.5); await p.waitForTimeout(150);
  console.log('tip:', await txt('#scnCmpTip'));
  let [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]); await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  const d1=await slideInfo(pop); console.log('deck page (A differs):', JSON.stringify(d1)); await pop.close();
  if(!d1) errs.push('comparison page missing when the scenarios differ'); else if(d1.over) errs.push('comparison page overflow: '+d1.over); else if(d1.paths<2) errs.push('comparison chart not cloned');
  // B: Roth off and renamed — three distinct lines, the name on the legend and the page
  await p.click('#scnTabs [data-scn="1"]'); await p.waitForTimeout(500);
  await p.$eval('#rothApply',e=>{e.checked=false; e.dispatchEvent(new Event('change',{bubbles:true}));}); await p.waitForTimeout(400);
  await p.fill('#scnName','No conversions'); await p.$eval('#scnName',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(300);
  console.log('B edited paths:', JSON.stringify(await paths()), '| labels:', JSON.stringify(await labels()));
  console.log('B edited legend:', await txt('#scnCmpLegend'));
  if((await paths()).filter(x=>!/dashed/.test(x)).length!==3) errs.push('expected three solid lines after editing B');
  [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]); await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  const d2=await slideInfo(pop); console.log('deck page (all differ):', JSON.stringify(d2)); await pop.close();
  if(!d2 || !d2.renamed) errs.push('renamed scenario missing from the comparison page'); else if(d2.over) errs.push('comparison page overflow: '+d2.over);
  // copy A into B and C: identical scenarios — dashed repeats on the page, no comparison page in the report
  await p.click('#scnTabs [data-scn="0"]'); await p.waitForTimeout(400);
  await p.selectOption('#scnCopyTo','1'); await p.waitForTimeout(400); await p.selectOption('#scnCopyTo','2'); await p.waitForTimeout(400);
  console.log('identical paths:', JSON.stringify(await paths()), '| legend:', await txt('#scnCmpLegend'));
  [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]); await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  const d3=await slideInfo(pop), n3=await pop.$$eval('.sl',s=>s.length); console.log('deck page (identical):', JSON.stringify(d3), '| slides:', n3); await pop.close();
  if(d3) errs.push('comparison page present although the scenarios are identical');
  if(d1 && n3 !== d1.of - 1) errs.push('expected one page fewer without the comparison, got '+n3+' vs '+d1.of);
  // no accounts: the chart hides with the cards
  await p.click('#clearAccts'); await p.waitForTimeout(100); await p.click('#clearAccts'); await p.waitForTimeout(500);
  console.log('no accounts → hidden:', await p.$eval('#scnCmp',e=>e.hidden));
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
