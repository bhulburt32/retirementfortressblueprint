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
  // the Claude helper routes to /api/summary
  const sum = await p.evaluate(() => window.__rfb && window.__rfb.askClaudeJson ? window.__rfb.askClaudeJson('{"a":1}').then(j => JSON.stringify(j)).catch(e => 'ERR ' + JSON.stringify(e)) : 'no hook');
  console.log('summary via api:', sum, '| canAskClaude:', await p.evaluate(() => window.__rfb && window.__rfb.canAskClaude ? window.__rfb.canAskClaude() : 'no hook'));
  await p.screenshot({ path: '_azure-shot.png', clip: { x: 0, y: 0, width: 1400, height: 260 } });
  const log = await (await fetch('http://127.0.0.1:8787/__log')).json();
  console.log('api calls:', log.filter(l => /api|auth/.test(l)).join(' ; '));
  console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
