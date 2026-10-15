/* The asset map (section 20 and the executive summary), the sequence-of-returns stress at
   Walls -8% / Roof -16%, the 3.26% inflation default, and the protected-pieces slide continuing
   onto a further page instead of running into its totals. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext(); const p=await ctx.newPage({viewport:{width:1400,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  const fail=[]; const check=(ok,msg)=>{ if(!ok) fail.push(msg); };
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(1000);
  await p.click('#expandAll'); await p.waitForTimeout(400);

  const infl = await p.$eval('#inflation',e=>e.value); console.log('inflation:', infl);
  check(infl==='3.26%', 'inflation default is '+infl+', expected 3.26%');
  const seq = (await p.$$eval('#sens .scn-sub',e=>e.map(x=>x.textContent)))[0];
  console.log('sequence:', seq);
  check(/Walls -8% and Roof -16%/.test(seq), 'sequence stress text: '+seq);

  const map = await p.evaluate(()=>{ const svg=document.querySelector('#assetMap svg'); if(!svg) return null;
    const E=[...svg.querySelectorAll('.am-edge')], S=[...svg.querySelectorAll('.am-src')], D=[...svg.querySelectorAll('.am-dst')];
    const sid=new Set(S.map(g=>g.dataset.src)), did=new Set(D.map(g=>g.dataset.dst));
    return {src:S.length, dst:D.length, edges:E.length, eSum:E.reduce((a,e)=>a+ +e.dataset.amt,0), dSum:D.reduce((a,d)=>a+ +d.dataset.amt,0),
      dangling:E.filter(e=>!sid.has(e.dataset.src)||!did.has(e.dataset.dst)).length, accts:[...document.querySelectorAll('#acctBody tr[data-id] input[data-k="val"]')].filter(i=>+String(i.value).replace(/[^0-9.]/g,'')>0.5).length,
      labels:[...svg.querySelectorAll('text')].filter(t=>/\$\d+k/.test(t.textContent)).length}; });
  console.log('map:', JSON.stringify(map));
  check(map && map.src===map.accts, 'one box per account with a balance');
  check(map && map.dst>0 && map.edges>0, 'ending boxes and lines drawn');
  check(map && map.dangling===0, 'every line joins a drawn box');
  check(map && Math.abs(map.eSum-map.dSum)<2, 'lines total the ending boxes: '+(map&&map.eSum)+' vs '+(map&&map.dSum));

  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]);
  await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  const slides = await pop.$$eval('.sl',s=>s.map(x=>x.textContent));
  const mapSlides = slides.filter(t=>/Where Each Account Ends Up/.test(t)).length;
  console.log('slides:', slides.length, '| asset map slides:', mapSlides, '| protected-pieces slides:', slides.filter(t=>/Fund the Protected Pieces/.test(t)).length);
  check(mapSlides>=1, 'the deck carries the asset map');
  const over=await pop.$$eval('.tx',els=>els.map(e=>({sl:e.closest('.sl').dataset.n,over:e.scrollHeight-e.clientHeight})).filter(o=>o.over>6)); console.log('overflowing text boxes:', over.length);
  check(over.length===0, 'overflowing text boxes');
  /* rows on the totals slide stop above the tiles */
  const clash = await pop.$$eval('.sl', sl=>sl.filter(s=>/Total plan assets/.test(s.textContent)).map(s=>{
    const tx=[...s.querySelectorAll('.tx')]; const tile=tx.find(t=>/Total plan assets/.test(t.textContent)); if(!tile) return 0;
    const top=tile.getBoundingClientRect().top; return tx.filter(t=>t!==tile && !/plan assets|Transferring in total|Managed investments|\$[\d,]+$/.test(t.textContent.trim()) && t.getBoundingClientRect().top<top && t.getBoundingClientRect().bottom>top+2).length; }));
  console.log('rows crossing the totals tiles:', clash);
  check(clash.every(n=>n===0), 'rows run into the totals tiles');
  console.log('ERRORS:', (errs.length||fail.length) ? errs.concat(fail) : 'none'); process.exit(0);
})();
