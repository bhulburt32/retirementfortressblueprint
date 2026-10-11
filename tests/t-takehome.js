/* Initial Observations and Findings: three Letter pages (today, the problems, where the plan goes) plus the
   disclosures page, the starting-point language, no section numbers, run-out given as ages. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext(); const p=await ctx.newPage({viewport:{width:1400,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  const fail=[]; const check=(ok,msg)=>{ if(!ok) fail.push(msg); };
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(1000);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const btns = await p.$$eval('#reportsSec .btn-row button, section button#makeTakeHome', bs=>bs.map(b=>b.id));
  check(btns.includes('makeTakeHome'), 'the Reports section should have the take-home button');
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeTakeHome')]);
  pop.on('pageerror',e=>errs.push('report: '+String(e)));
  await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  console.log('title:', await pop.title());
  const sheets = await pop.$$eval('.sheet', ss=>ss.map(s=>({h:s.offsetHeight, head:(s.querySelector('h1,h2')||{}).textContent||''})));
  console.log('pages:', sheets.length, sheets.map(s=>Math.round(s.h)+'px · '+s.head.slice(0,40)));
  check(sheets.length===3, 'three sheets');
  const content = await pop.$$eval('.sheet', ss=>ss.map(s=>{ const kids=[...s.children].filter(k=>!k.classList.contains('foot')); return Math.round(kids[kids.length-1].getBoundingClientRect().bottom - s.getBoundingClientRect().top); }));
  console.log('content heights:', content.join(' / '), '(budget 905px, what a printed Letter page holds above the footer)');
  content.forEach((h,k)=>check(h<=905, 'page '+(k+1)+' content runs into the footer ('+h+'px)'));
  const text = await pop.evaluate(()=>document.body.innerText);
  for(const phrase of ['This is only a starting point','recommendation meeting','fully happy with','Where you are today','The problems we found','Current course versus the plan','IMPORTANT DISCLOSURES','first ten years of retirement','first fifteen years']) check(new RegExp(phrase,'i').test(text), 'missing: '+phrase);
  check(!/\bsection\s*\d/i.test(text), 'the report should not name a section of the application');
  check(!/take-home/i.test(text), 'the report should be titled Initial Observations and Findings');
  check(!/run out (in )?20\d\d/i.test(text), 'an exhausted plan should be given as ages, not a year');
  const disc = await pop.$$eval('.rfb-disc', d=>d.length); console.log('disclosure blocks:', disc); check(disc>=1, 'disclosures page');
  const tiles = await pop.$$eval('.tile', ts=>ts.map(t=>t.querySelector('.lab').textContent+': '+t.querySelector('.val').textContent));
  console.log('tiles:', tiles.join(' | '));
  const stress = await pop.$$eval('table', ts=>ts.map(t=>t.innerText.replace(/\s+/g,' ')));
  console.log('stress table:', stress[0].slice(0,220));
  check(/Sequence of returns risk/.test(stress[0]) && /Social Security cut/.test(stress[0]) && /Higher inflation/.test(stress[0]), 'three stress rows');
  await pop.pdf({path:'take-home-out.pdf', format:'Letter', printBackground:true});
  const pdfPages = (require('fs').readFileSync('take-home-out.pdf').toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length; console.log('printed pages:', pdfPages);
  check(pdfPages>=4 && pdfPages<=5, 'three report pages plus the disclosures when printed ('+pdfPages+')');
  console.log('ERRORS:', (errs.length||fail.length) ? errs.concat(fail) : 'none'); process.exit(0);
})();
