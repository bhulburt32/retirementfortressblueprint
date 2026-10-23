const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1000);
  await p.click('#expandAll'); await p.waitForTimeout(500);
  console.log('sq sens boxes:', await p.evaluate(() => [...document.querySelectorAll('#sqSens .ltc-scn')].map(d => d.querySelector('h4').textContent + ' → ' + d.querySelector('[id$="Note"]').textContent.slice(0, 90))));
  console.log('sq svg paths:', await p.evaluate(() => [...document.querySelectorAll('#sqSens svg')].map(s => s.querySelectorAll('rect').length)));
  console.log('plan sens boxes:', await p.evaluate(() => document.querySelectorAll('#sens .ltc-scn').length));
  const el = await p.$('#sqSens'); await el.screenshot({ path: '_sqsens.png' });
  // findings report
  const [pop] = await Promise.all([p.waitForEvent('popup'), p.click('#makeTakeHome')]); await pop.waitForLoadState(); await pop.waitForTimeout(2000);
  const info = await pop.evaluate(() => ({ sheets: [...document.querySelectorAll('.sheet')].map(s => Math.round(s.getBoundingClientRect().height)), three: document.querySelectorAll('.three svg').length, res: [...document.querySelectorAll('.three .res')].map(r => r.textContent) }));
  console.log('take-home sheets (px, 11in=1056):', JSON.stringify(info));
  await pop.setViewportSize({ width: 900, height: 1200 }); const sh = await pop.$$('.sheet'); await sh[1].screenshot({ path: '_takehome2.png' });
  // the risk list carries only the risks checked or typed in the Risk section, never the ones the plan data merely suggests
  const risksOn = await pop.evaluate(() => [...document.querySelectorAll('ol.risks li b')].map(b => b.textContent));
  const checked = await p.evaluate(() => [...document.querySelectorAll('#riskList input[data-risk]:checked')].map(c => c.closest('label').querySelector('b').textContent));
  const custom = await p.evaluate(() => [...document.querySelectorAll('#riskCustom .risk-row')].filter(r => r.querySelector('[data-ck="on"]').checked && r.querySelector('[data-ck="text"]').value.trim()).map(r => r.querySelector('[data-ck="text"]').value.trim()));
  const suggested = await p.evaluate(() => [...document.querySelectorAll('#riskList .risk-item')].filter(l => l.querySelector('.sug')).map(l => l.querySelector('b').textContent));
  console.log('take-home risks:', JSON.stringify(risksOn), '| checked:', JSON.stringify(checked), '| suggested only:', JSON.stringify(suggested));
  const picked = checked.concat(custom);
  if(risksOn.length !== Math.min(6, picked.length)) errs.push('the findings report should list the checked and typed risks (' + picked.length + ', six at most), not ' + risksOn.length);
  risksOn.forEach(x => { if(!picked.includes(x)) errs.push('a risk that is not checked appeared in the findings report: ' + x); if(suggested.includes(x)) errs.push('a risk only suggested by the plan data appeared in the findings report: ' + x); });
  await pop.close();
  // untick everything, one at a time (the list re-renders after each change): the page says nothing has been flagged yet
  for(let n = 0; n < 20 && await p.$('#riskList input[data-risk]:checked'); n++){ await p.click('#riskList input[data-risk]:checked'); await p.waitForTimeout(250); }
  for(let n = 0; n < 20 && await p.$('#riskCustom [data-ck="on"]:checked'); n++){ await p.click('#riskCustom [data-ck="on"]:checked'); await p.waitForTimeout(250); }
  console.log('risks still checked:', await p.$$eval('#riskList input[data-risk]:checked, #riskCustom [data-ck="on"]:checked', c => c.length));
  const [pop2] = await Promise.all([p.waitForEvent('popup'), p.click('#makeTakeHome')]); await pop2.waitForLoadState(); await pop2.waitForTimeout(1500);
  const none = await pop2.evaluate(() => ({ list: document.querySelectorAll('ol.risks li').length, note: /No specific problems have been flagged yet/.test(document.body.textContent) }));
  console.log('take-home with nothing checked:', JSON.stringify(none));
  if(none.list || !none.note) errs.push('with no risk checked the findings report should list none and say so');
  await pop2.close();
  // tick one: that one, and only that one
  await p.click('#riskList input[data-risk="ltc"]'); await p.waitForTimeout(600);
  const [pop3] = await Promise.all([p.waitForEvent('popup'), p.click('#makeTakeHome')]); await pop3.waitForLoadState(); await pop3.waitForTimeout(1500);
  const one = await pop3.evaluate(() => [...document.querySelectorAll('ol.risks li b')].map(b => b.textContent));
  console.log('take-home with one checked:', JSON.stringify(one));
  if(one.length !== 1 || !/long-term care/i.test(one[0])) errs.push('with one risk checked the findings report should list that one risk');
  await pop3.close();
  console.log('ERRORS:', errs.length ? errs : 'none'); await b.close();
})();
