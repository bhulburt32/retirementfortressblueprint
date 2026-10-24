/* Drives dist/azure/index.html against the stub API: sign-in line, Saved cases, save → open → delete, summary route. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_TUNNEL/.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto('http://127.0.0.1:8787/', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  const who = await p.evaluate(() => ({ hidden: document.getElementById('whoami').hidden, text: document.getElementById('whoami').textContent, advisor: document.getElementById('advisor').value, panel: document.getElementById('casesPanel').hidden, api: window.__rfb ? 'hooks' : 'nohooks' }));
  console.log('whoami:', JSON.stringify(who));
  await p.click('#expandAll'); await p.waitForTimeout(300);
  console.log('empty list:', await p.evaluate(() => document.getElementById('casesBody').textContent.trim().slice(0, 60)));
  // fill a few fields, save
  await p.fill('#clientFirst', 'Test'); await p.fill('#clientLast', 'Household'); await p.waitForTimeout(400);
  await p.click('#caseSave'); await p.waitForTimeout(800);
  console.log('after save:', await p.evaluate(() => document.getElementById('casesMsg').textContent), '| rows:', await p.evaluate(() => document.querySelectorAll('#casesBody tr').length), '| marked open:', await p.evaluate(() => document.querySelectorAll('#casesBody tr.grp').length));
  // save again should update, not add
  await p.fill('#clientLast', 'Household2'); await p.waitForTimeout(400); await p.click('#caseSave'); await p.waitForTimeout(800);
  console.log('after resave rows:', await p.evaluate(() => document.querySelectorAll('#casesBody tr').length), await p.evaluate(() => document.querySelector('#casesBody td').textContent));
  // save as new
  await p.fill('#clientFirst', 'Second'); await p.waitForTimeout(400); await p.click('#caseSaveAs'); await p.waitForTimeout(800);
  console.log('after save-as rows:', await p.evaluate(() => document.querySelectorAll('#casesBody tr').length));
  // the Find box narrows the list by client or saver, any words in any order; a miss says so; clearing restores the list
  const rowsNow = () => p.evaluate(() => [...document.querySelectorAll('#casesBody tr')].map(r => r.querySelector('td').textContent.trim()));
  await p.fill('#casesFind', 'second'); await p.waitForTimeout(200); const f1 = await rowsNow();
  await p.fill('#casesFind', 'household2 ben'); await p.waitForTimeout(200); const f2 = await rowsNow();
  await p.fill('#casesFind', 'nobody'); await p.waitForTimeout(200); const f3 = await rowsNow();
  await p.fill('#casesFind', ''); await p.waitForTimeout(200); const f4 = await rowsNow();
  console.log('find "second":', JSON.stringify(f1), '| "household2 ben":', f2.length, '| "nobody":', JSON.stringify(f3), '| cleared:', f4.length);
  if(f1.length !== 1 || !/Second/.test(f1[0])) errs.push('Find "second" should leave the one matching case');
  if(f2.length !== 2) errs.push('Find by a word from the client and a word from the saver should match both cases');
  if(f3.length !== 1 || !/No saved case matches/.test(f3[0])) errs.push('a search that matches nothing should say so');
  if(f4.length !== 2) errs.push('clearing the Find box should restore the list');
  // new case resets, then open the first
  await p.click('#newCase'); await p.waitForTimeout(800);
  console.log('after new case:', await p.evaluate(() => document.getElementById('clientFirst').value || '(empty)'), '| marked open:', await p.evaluate(() => document.querySelectorAll('#casesBody tr.grp').length));
  await p.click('#casesBody [data-case-open]'); await p.waitForTimeout(1200);
  console.log('after open:', await p.evaluate(() => document.getElementById('clientFirst').value + ' ' + document.getElementById('clientLast').value), '|', await p.evaluate(() => document.getElementById('casesMsg').textContent));
  // delete the second
  const dels = await p.$$('#casesBody [data-case-del]'); await dels[dels.length - 1].click(); await p.waitForTimeout(800);
  console.log('after delete rows:', await p.evaluate(() => document.querySelectorAll('#casesBody tr').length), await p.evaluate(() => document.getElementById('casesMsg').textContent));
  // the header's Load saved case button opens section 23 at the Saved cases list with the Find box focused
  await p.click('#collapseAll'); await p.waitForTimeout(300);
  const lsHidden = await p.$eval('#loadSaved', b => b.hidden); await p.click('#loadSaved'); await p.waitForTimeout(900);
  const ls = await p.evaluate(() => ({ secOpen: !document.getElementById('dataSec').classList.contains('closed'), focused: document.activeElement && document.activeElement.id }));
  console.log('Load saved case:', JSON.stringify({ hidden: lsHidden, ...ls }));
  if(lsHidden) errs.push('the Load saved case button should show on Alto\u2019s site');
  if(!ls.secOpen || ls.focused !== 'casesFind') errs.push('Load saved case should open section 23 and focus the Find box');
  // sharing: Ben shares his case with Jane
  await p.click('#casesBody [data-case-share]'); await p.waitForTimeout(300);
  const sh0 = await p.evaluate(() => (document.querySelector('#casesBody tr.share-row') || {}).textContent || '');
  await p.fill('#shareEmail', 'Jane@Example.test'); await p.click('#shareAdd'); await p.waitForTimeout(700);
  const sh1 = await p.evaluate(() => ({ chips: [...document.querySelectorAll('#casesBody .share-box .chip')].map(c => c.textContent.replace(/\u00d7/g, '').trim()), msg: document.getElementById('casesMsg').textContent, tag: (document.querySelector('#casesBody small.shared-n') || {}).textContent }));
  console.log('share editor:', JSON.stringify({ before: sh0.slice(0, 40), ...sh1 }));
  if(!/no one yet/.test(sh0)) errs.push('the share editor should open empty');
  if(sh1.chips.join() !== 'jane@example.test' || !/Shared with jane@example\.test/.test(sh1.msg) || sh1.tag !== 'shared with 1') errs.push('adding a colleague should share the case with their lower-cased email');
  await p.click('#shareDone'); await p.waitForTimeout(200);
  if(await p.$('#casesBody tr.share-row')) errs.push('Done should close the share editor');
  // Jane signs in: she sees the shared case, can open it and keep her own copy, but not change or delete it
  await p.evaluate(() => fetch('/__as', { method: 'POST', body: JSON.stringify({ userId: 'u-jane', userDetails: 'jane@example.test', name: 'Jane Advisor' }) }).then(r => r.json()));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500); await p.click('#expandAll'); await p.waitForTimeout(400);
  const jane = await p.evaluate(() => ({ who: document.getElementById('whoami').textContent.slice(0, 40), rows: document.querySelectorAll('#casesBody tr').length, tag: (document.querySelector('#casesBody small.shared-tag') || {}).textContent, share: document.querySelectorAll('#casesBody [data-case-share]').length, del: document.querySelectorAll('#casesBody [data-case-del]').length }));
  console.log('as Jane:', JSON.stringify(jane));
  if(jane.rows !== 1 || jane.tag !== 'shared with you' || jane.share || jane.del) errs.push('Jane should see the shared case tagged, with Open only');
  await p.click('#casesBody [data-case-open]'); await p.waitForTimeout(1200);
  await p.click('#caseSave'); await p.waitForTimeout(400);
  const janeSave = await p.evaluate(() => document.getElementById('casesMsg').textContent);
  await p.click('#caseSaveAs'); await p.waitForTimeout(900);
  const janeRows = await p.evaluate(() => [...document.querySelectorAll('#casesBody tr')].map(r => r.querySelector('td').textContent.trim()));
  console.log('Jane saves:', janeSave, '| rows after Save as new:', JSON.stringify(janeRows));
  if(!/Save as new/.test(janeSave)) errs.push('Save on a case shared with you should point to Save as new');
  if(janeRows.length !== 2) errs.push('Save as new should give Jane her own copy beside the shared case');
  // Ben again: his list is his own case, shared with 1; Jane is now in the picker; the cross stops sharing
  await p.evaluate(() => fetch('/__as', { method: 'POST', body: JSON.stringify({ userId: 'u-ben', userDetails: 'ben@example.test', name: 'Ben Hulburt' }) }).then(r => r.json()));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500); await p.click('#expandAll'); await p.waitForTimeout(400);
  const ben = await p.evaluate(() => ({ rows: document.querySelectorAll('#casesBody tr').length, tag: (document.querySelector('#casesBody small.shared-n') || {}).textContent, picker: [...document.querySelectorAll('#advisorList option')].map(o => o.value) }));
  await p.click('#casesBody [data-case-share]'); await p.waitForTimeout(300); await p.click('#casesBody [data-unshare]'); await p.waitForTimeout(700);
  const unshared = await p.evaluate(() => ({ msg: document.getElementById('casesMsg').textContent, chips: document.querySelectorAll('#casesBody .share-box .chip').length }));
  console.log('as Ben:', JSON.stringify(ben), '| after unshare:', JSON.stringify(unshared));
  if(ben.rows !== 1 || ben.tag !== 'shared with 1') errs.push('Ben should see his own case, shared with 1, and not Jane\u2019s copy');
  if(ben.picker.join() !== 'jane@example.test') errs.push('the share picker should offer the colleagues who have saved a case');
  if(unshared.chips || !/Not shared with anyone/.test(unshared.msg)) errs.push('the cross should stop sharing');
  await p.click('#shareDone'); await p.waitForTimeout(200);
  // the Claude helper routes to /api/summary
  const sum = await p.evaluate(() => window.__rfb && window.__rfb.askClaudeJson ? window.__rfb.askClaudeJson('{"a":1}').then(j => JSON.stringify(j)).catch(e => 'ERR ' + JSON.stringify(e)) : 'no hook');
  console.log('summary via api:', sum, '| canAskClaude:', await p.evaluate(() => window.__rfb && window.__rfb.canAskClaude ? window.__rfb.canAskClaude() : 'no hook'));
  await p.screenshot({ path: '_azure-shot.png', clip: { x: 0, y: 0, width: 1400, height: 260 } });
  const log = await (await fetch('http://127.0.0.1:8787/__log')).json();
  console.log('api calls:', log.filter(l => /api|auth/.test(l)).join(' ; '));
  console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
