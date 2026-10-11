/* The Monthly Budget Worksheet upload: the filled sample PDF's form fields land in the detailed
   budget line for line and page 2 in Employment income. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const ctx=await b.newContext({acceptDownloads:true}); const p=await ctx.newPage({viewport:{width:1400,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  const fail=[]; const check=(ok,msg)=>{ if(!ok) fail.push(msg); };
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(1000);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  const dl = await p.evaluate(()=>{ const b=document.getElementById('dlWorksheet'); return b ? {inHeader:!!b.closest('.masthead'), label:b.textContent.trim()} : null; }); console.log('header button:', JSON.stringify(dl));
  check(dl && dl.inHeader && /Budget worksheet/.test(dl.label), 'the Budget worksheet button in the header');
  const [download] = await Promise.all([p.waitForEvent('download',{timeout:15000}), p.click('#dlWorksheet')]);
  const saved = await download.path(); const bytes = require('fs').readFileSync(saved); console.log('downloaded:', download.suggestedFilename(), bytes.length, 'bytes, AcroForm:', bytes.includes('/AcroForm'));
  check(/Alto Monthly Budget Worksheet\.pdf/.test(download.suggestedFilename()) && bytes.length > 300000 && bytes.includes('/AcroForm'), 'the blank fillable worksheet downloads');
  await p.fill('#salaryC','120,000'); await p.fill('#salaryS','68,000'); await p.waitForTimeout(400);
  await p.setInputFiles('#budFile', path.resolve(__dirname,'../samples/budget-worksheet-sample.pdf'));
  await p.waitForFunction(()=>/Read \d+ expense line/.test(document.getElementById('budUpMsg').textContent) || /could not|not look/.test(document.getElementById('budUpMsg').textContent), null, {timeout:20000});
  const msg = await p.$eval('#budUpMsg', e=>e.textContent); console.log('message:', msg);
  check(/Read 20 expense lines/.test(msg), 'twenty lines read: '+msg.slice(0,60));
  const line = async id => p.$eval(`#budTable tr[data-bud="${id}"]`, r=>({amt:r.querySelector('input.num').value, start:(r.querySelector('input[data-bk=start]')||{}).value||'', end:(r.querySelector('input[data-bk=end]')||{}).value||'', note:(r.querySelector('input[data-bk=note]')||{}).value||'', label:(r.querySelector('input.lbl')||{}).value||''})).catch(()=>null);
  const rows = await p.$$eval('#budTable tbody tr[data-bud]', rs=>rs.map(r=>r.dataset.bud+'='+[...r.querySelectorAll('input')].map(i=>i.value).join('|')));
  console.log('rows:', rows.filter(r=>!/=0?\|?$|=\|/.test(r)).slice(0,12).join('\n      '));
  const byId={}; rows.forEach(r=>{ const [id,rest]=r.split('='); byId[id]=rest; });
  check(/^1,250/.test(byId['hh:0']||'') && /2031-06/.test(byId['hh:0']||'') && /Mortgage ends/.test(byId['hh:0']||''), 'mortgage line with its end date and note: '+byId['hh:0']);
  check(/^1,000/.test(byId['hc:0']||'') && /2027-10/.test(byId['hc:0']||''), 'health insurance with the Oct 2027 end date: '+byId['hc:0']);
  check(/^120/.test(byId['hc:6']||''), 'life insurance premium from the worksheet: '+byId['hc:6']);
  check(/^2,000/.test(byId['eo:3']||'') && /2027-05/.test(byId['eo:3']||''), 'vacation line with its start date: '+byId['eo:3']);
  check(/Grandkids fund/.test(byId['eo:7']||'') && /150/.test(byId['eo:7']||''), 'Other 1 named from its note: '+byId['eo:7']);
  const emp = await p.evaluate(()=>['deductC','contribC','employerC','deductS','contribS','employerS'].map(id=>id+'='+document.getElementById(id).value).join(' '));
  console.log('employment:', emp);
  check(/deductC=4,800/.test(emp) && /contribC=5\.0%/.test(emp) && /employerC=3\.5%/.test(emp), 'client payroll: deductions (300+100)x12, 500x12 / 120,000, (250+100)x12 / 120,000');
  check(/deductS=2,880/.test(emp) && /contribS=4\.4%/.test(emp) && /employerS=2\.2%/.test(emp), 'spouse payroll: (200+40)x12, 250x12 / 68,000, 125x12 / 68,000');
  check(/Not carried: .*employer HSA.*IRA contributions/.test(msg), 'the uncarried items are reported');
  console.log('worksheet open:', await p.$eval('#budDetail', e=>!e.hidden), '| totals:', await p.$eval('#budTotals, .bud-sum', e=>e.textContent.replace(/\s+/g,' ').trim().slice(0,160)).catch(()=>'n/a'));
  console.log('ERRORS:', (errs.length||fail.length) ? errs.concat(fail) : 'none'); process.exit(0);
})();
