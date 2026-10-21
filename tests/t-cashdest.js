const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const st = () => p.evaluate(() => ({ end: [...document.querySelectorAll('#scnGrid .scn-card')].map(c => [...c.querySelectorAll('dl div')].find(x => x.querySelector('dt') && x.querySelector('dt').textContent.startsWith('Assets at end')).querySelector('dd').textContent), held: [...document.querySelectorAll('#scnGrid .scn-card')].map(c => [...c.querySelectorAll('dl div')].find(x => x.querySelector('dt') && x.querySelector('dt').textContent.startsWith('Held as is')).querySelector('dd').textContent) }));
  console.log('chips:', await p.evaluate(() => [...document.querySelectorAll('#cashDestList label')].map(l => l.textContent.trim()).join(' | ')));
  console.log('hint:', await p.evaluate(() => document.getElementById('cashDestHint').textContent.slice(0, 100)));
  console.log('start', JSON.stringify(await st()));
  // give the household a surplus: a salary, then pick a destination
  await p.fill('#salaryC', '200000'); await p.fill('#retireC', '2034-06'); await p.waitForTimeout(600);
  console.log('with salary, not banked', JSON.stringify((await st()).end));
  const first = await p.$('#cashDestList input[data-cash]'); await first.click(); await p.waitForTimeout(700);
  console.log('banked into first chip ', JSON.stringify((await st()).end), '| hint:', await p.evaluate(() => document.getElementById('cashDestHint').textContent.slice(0, 90)));
  // partial transfer: set the first Market account to transfer part
  const row = await p.evaluate(() => { const tr = [...document.querySelectorAll('#acctBody tr')].find(tr => tr.querySelector('select[data-k="pos"]').value === 'Market' && tr.querySelector('select[data-k="move"]').value === 'yes'); return tr ? { id: tr.getAttribute('data-id'), name: tr.querySelector('input[data-k="name"]').value, val: tr.querySelector('input[data-k="val"]').value } : null; });
  console.log('partial on:', row);
  await p.selectOption(`#acctBody tr[data-id="${row.id}"] select[data-k="move"]`, 'part'); await p.waitForTimeout(300);
  console.log('part input visible:', await p.evaluate((id) => !document.querySelector(`#acctBody tr[data-id="${id}"] input[data-k="part"]`).hidden, row.id));
  await p.fill(`#acctBody tr[data-id="${row.id}"] input[data-k="part"]`, '30000'); await p.waitForTimeout(700);
  console.log('after partial     ', JSON.stringify(await st()));
  console.log('moves table mention:', await p.evaluate(() => (document.body.textContent.match(/held[^.]{0,60}/i) || [''])[0].slice(0, 80)));
  const json = await p.evaluate(() => document.getElementById('caseJson').value); const o = JSON.parse(json);
  console.log('saved cashFlowTo:', JSON.stringify(o.cashFlowTo), 'part acct:', JSON.stringify(o.accounts.find(a => a.move === 'part')));
  await p.click('#newCase'); await p.waitForTimeout(500); await p.fill('#caseJson', json); await p.click('#loadCase'); await p.waitForTimeout(1200);
  console.log('after reload      ', JSON.stringify(await st()), 'chips on:', await p.evaluate(() => document.querySelectorAll('#cashDestList label.on').length), 'part sel:', await p.evaluate(() => [...document.querySelectorAll('#acctBody select[data-k="move"]')].filter(s => s.value === 'part').length));
  console.log('ERRORS:', errs.length ? errs : 'none'); await b.close();
})();
