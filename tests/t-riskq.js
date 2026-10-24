/* The risk profile questionnaire in section 12: scoring, the tolerance cell that follows it, save/load, the deck line and the client report. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext(); const p=await ctx.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  const v=async id=>p.$eval('#'+id,e=>e.value);
  const isAuto=async id=>p.$eval('#'+id,e=>e.classList.contains('auto'));
  const panel=async()=>({score:await txt('#rqPanel .rq-big'), band:await txt('#rqPanel .rq-band'), kv:await txt('#rqPanel .rq-kv'), flag:await p.$eval('#rqPanel',e=>{const f=e.querySelector('.rq-flag'); return f?f.className+': '+f.textContent:'';}), prog:await txt('#rqPanel .rq-prog')});
  console.log('questions:', await p.$$eval('#rqForm .rq-q',q=>q.length), '| options:', await p.$$eval('#rqForm .rq-opt',o=>o.length), '| amount cell:', await v('rqAmt'), 'auto', await isAuto('rqAmt'));
  console.log('tolerance before:', JSON.stringify(await v('riskTol')), 'auto', await isAuto('riskTol'));
  console.log('theme at load:', await p.$eval('html',h=>h.dataset.theme), '| score colour:', await p.$eval('#rqPanel .rq-big',e=>getComputedStyle(e).color));
  if((await p.$eval('html',h=>h.dataset.theme))!=='dark') errs.push('dark should be the default theme');
  // the sample case carries a completed questionnaire: clear it so the plan's own answers show
  await p.click('#rqClear'); await p.waitForTimeout(300); if(await p.$eval('#rqClear',b=>b.classList.contains('armed'))){ await p.click('#rqClear'); await p.waitForTimeout(400); }
  const plan=await p.$$eval('#rqForm .rq-auto',n=>n.map(x=>x.getAttribute('data-auto')+': '+x.textContent)); console.log('plan answers:', JSON.stringify(plan));
  console.log('checked at load:', await p.$$eval('#rqForm input:checked',o=>o.map(x=>x.name+'='+x.value+(x.closest('.rq-opt').classList.contains('auto')?' auto':''))));
  if((await p.$$eval('#rqForm input:checked',o=>o.length))!==2) errs.push('q6 and q7 should be answered from the plan');
  console.log('panel at load:', JSON.stringify(await panel()));
  const q1=await p.$eval('#rqForm .rq-q',q=>q.textContent.replace(/\s+/g,' ').slice(0,220)); console.log('q1 labels:', q1);
  // answer the third option everywhere (q5: Avoid losses; q12: More than $50,000)
  const answer=async k=>{ for(const id of ['q1','q2','q3','q5','q6','q7','q8','q9','q10','q11','q12']){ const opts=await p.$$(`#rqForm input[name="rq_${id}"]`); const o=opts[Math.min(k,opts.length-1)]; await o.check(); } await p.waitForTimeout(500); };
  await answer(2);
  const P1=await panel(); console.log('panel all third options:', JSON.stringify(P1));
  console.log('tolerance after:', await v('riskTol'), 'auto', await isAuto('riskTol'), '| readout:', (await txt('#riskReadout')).slice(0,260));
  if(P1.score!=='46') errs.push('expected score 46 for all-third answers (eleven questions), got '+P1.score);
  if(await v('riskTol')!=='46' || !(await isAuto('riskTol'))) errs.push('a completed questionnaire must write its score over the typed 48');
  if(!/Avoid losses/.test(P1.flag)) errs.push('objective mismatch flag expected');
  // a typed tolerance wins; clearing it brings the questionnaire back
  await p.fill('#riskTol','60'); await p.$eval('#riskTol',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.$eval('#riskTol',e=>e.blur()); await p.waitForTimeout(400);
  console.log('typed 60:', await v('riskTol'), 'auto', await isAuto('riskTol'), '| prog:', await txt('#rqPanel .rq-prog'));
  if(await isAuto('riskTol')) errs.push('typed tolerance must not be auto');
  await (await p.$$('#rqForm input[name="rq_q1"]'))[1].check(); await p.waitForTimeout(400); console.log('after changing an answer:', await v('riskTol'), 'auto', await isAuto('riskTol'));
  if(!(await isAuto('riskTol'))) errs.push('changing an answer must refill the tolerance');
  await (await p.$$('#rqForm input[name="rq_q1"]'))[2].check(); await p.waitForTimeout(400);
  await p.fill('#riskTol','60'); await p.$eval('#riskTol',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.$eval('#riskTol',e=>e.blur()); await p.waitForTimeout(300);
  await p.fill('#riskTol',''); await p.$eval('#riskTol',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.$eval('#riskTol',e=>e.blur()); await p.waitForTimeout(400);
  console.log('cleared:', await v('riskTol'), 'auto', await isAuto('riskTol'));
  if(await v('riskTol')!=='46') errs.push('clearing the cell should refill from the questionnaire');
  // the portfolio amount drives the dollar labels
  await p.fill('#rqAmt','1,000,000'); await p.$eval('#rqAmt',e=>e.dispatchEvent(new Event('input',{bubbles:true}))); await p.waitForTimeout(400);
  const q3=await p.$$eval('#rqForm input[name="rq_q3"]',o=>o.map(x=>x.closest('label').textContent.replace(/\s+/g,' ').trim()));
  console.log('q3 at $1,000,000:', JSON.stringify(q3)); if(!/\$50,000/.test(q3[0])) errs.push('dollar labels did not follow the amount');
  console.log('answers kept after relabel:', await p.$$eval('#rqForm input:checked',o=>o.length));
  // the deck's risk page carries the category
  let [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#makeDeck')]); await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  const deck=await pop.evaluate(()=>{ const sl=[...document.querySelectorAll('.sl')].find(s=>/Your Risk Tolerance, and the Risks We Found/.test(s.textContent) && !/Contents/.test(s.textContent.slice(0,40))); const over=[...sl.querySelectorAll('.tx')].filter(e=>e.scrollHeight-e.clientHeight>6).length; return {over, text:sl.textContent.replace(/\s+/g,' ').slice(0,420)}; });
  console.log('deck risk page:', JSON.stringify(deck)); if(!/Moderate · willingness/.test(deck.text)) errs.push('deck risk page lacks the questionnaire category'); if(deck.over) errs.push('deck risk page overflow '+deck.over);
  await pop.close();
  // the client report
  [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), p.click('#rqReport')]); await pop.waitForLoadState('load'); await pop.waitForTimeout(500);
  const rep=await pop.evaluate(()=>({title:document.title, big:document.querySelector('.big').textContent, band:document.querySelector('.pill').textContent, nitro:/Nitrogen/.test(document.body.textContent), aewm:/AE Wealth Management/.test(document.body.textContent), answers:document.querySelectorAll('.answers dd').length}));
  console.log('client report:', JSON.stringify(rep)); if(rep.big!=='46' || rep.nitro || !rep.aewm || rep.answers!==7) errs.push('client report content wrong'); await pop.close();
  console.log('msg:', await txt('#rqMsg'));
  // worksheet PDF still builds
  const [d]=await Promise.all([p.waitForEvent('download',{timeout:60000}), p.click('#makePdf')]); console.log('worksheet:', d.suggestedFilename());
  // save and reload: answers, amount and the auto tolerance survive; a typed tolerance is saved as typed
  const json=await p.$eval('#caseJson',e=>e.value), dd=JSON.parse(json); console.log('saved:', JSON.stringify(dd.risk.questionnaire), '| tolerance saved as', JSON.stringify(dd.risk.tolerance));
  if(dd.risk.tolerance!=='') errs.push('an auto tolerance must save blank');
  await p.click('#rqClear'); await p.waitForTimeout(400); console.log('after clear:', JSON.stringify(await v('riskTol')), '|', await txt('#rqPanel .rq-band'), '| checked', await p.$$eval('#rqForm input:checked',o=>o.length), '| prog:', await txt('#rqPanel .rq-prog'));
  if((await p.$$eval('#rqForm input:checked',o=>o.length))!==2) errs.push('clear should leave the two plan answers');
  await p.evaluate(j => window.__rfb.loadCaseJson(j), json); await p.waitForTimeout(900);
  console.log('after reload:', await v('riskTol'), 'auto', await isAuto('riskTol'), '| answered', await p.$$eval('#rqForm input:checked',o=>o.length), '| amount', await v('rqAmt'));
  if(await v('riskTol')!=='46' || (await p.$$eval('#rqForm input:checked',o=>o.length))!==11) errs.push('reload lost the questionnaire');
  // theme: the page palette is the questionnaire's
  const tok=await p.evaluate(()=>{ const cs=getComputedStyle(document.documentElement); return ['--navy','--bg','--btn','--accent','--st-alert'].map(k=>k+'='+cs.getPropertyValue(k).trim()).join(' '); }); console.log('tokens:', tok);
  const navyTxt=await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--navy-text').trim()); console.log('navy text in dark:', navyTxt); if(navyTxt.toUpperCase()!=='#FFFFFF') errs.push('navy text should be white in dark');
  await p.click('#themeBtn'); await p.waitForTimeout(200); await p.reload({waitUntil:'load'}); await p.waitForTimeout(900); console.log('after switch + reload:', await p.$eval('html',h=>h.dataset.theme));
  if((await p.$eval('html',h=>h.dataset.theme))!=='light') errs.push('the light choice should be remembered');
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
