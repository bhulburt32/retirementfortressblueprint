/* Save on every section header: present on each section, never toggles the section, and (without Alto's server)
   downloads the case file with the outcome shown beside the button. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}, acceptDownloads:true});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  const counts = await p.evaluate(()=>({sections:document.querySelectorAll('section > .sec-head').length, saves:document.querySelectorAll('section > .sec-head > .sec-save > button').length}));
  console.log('headers:', JSON.stringify(counts));
  if(!counts.sections || counts.sections !== counts.saves) errs.push('every section header needs a Save button: ' + JSON.stringify(counts));
  // the scenario tag sits before Save on the scenario sections
  const order = await p.$eval('#adjSec .sec-head', h=>Array.from(h.children).map(c=>c.className||c.tagName).join(','));
  console.log('section 14 header:', order);
  if(!/scn-tag,sec-save$/.test(order)) errs.push('section 14 header should end with the scenario tag then Save: ' + order);
  // a save from a closed header leaves it closed and downloads the case file
  const closedBefore = await p.$eval('#budgetSec', s=>s.classList.contains('closed'));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#budgetSec .sec-head .sec-save button')]);
  const name = dl.suggestedFilename(); console.log('download:', name);
  if(!/^Retirement Fortress case - .* - \d{4}-\d{2}-\d{2}\.txt$/.test(name)) errs.push('unexpected file name: ' + name);
  await p.waitForTimeout(300);
  const closedAfter = await p.$eval('#budgetSec', s=>s.classList.contains('closed'));
  const msg = await p.$eval('#budgetSec .sec-head .sec-save small', e=>e.textContent);
  console.log('closed before/after:', closedBefore, closedAfter, '| message:', msg);
  if(!closedBefore || !closedAfter) errs.push('Save must not toggle the section');
  if(!/^Saved as Retirement Fortress case/.test(msg)) errs.push('outcome should read beside the button: ' + msg);
  // the file holds the case
  const fs = require('fs'); const txt = fs.readFileSync(await dl.path(), 'utf8');
  if(!/Retirement Fortress Blueprint/.test(txt) || !/"household"|"clientFirst"/.test(txt)) errs.push('downloaded file does not look like a case file');
  // an open section stays open too, and the header click still toggles
  await p.click('#assumeSec .sec-head'); await p.waitForTimeout(200);
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#assumeSec .sec-head .sec-save button')]);
  await dl2.path(); await p.waitForTimeout(200);
  const open2 = await p.$eval('#assumeSec', s=>!s.classList.contains('closed'));
  console.log('section 03 stays open after Save:', open2);
  if(!open2) errs.push('Save closed an open section');
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
