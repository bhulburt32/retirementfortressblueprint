const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const st = () => p.evaluate(() => ({ foot: document.getElementById('budFoot').textContent.replace(/\s+/g, ' ').trim().slice(0, 160), needs: document.getElementById('needs').value, wants: document.getElementById('wants').value, sum: document.getElementById('budSum').textContent.replace(/\s+/g, ' ').slice(0, 120), off: document.querySelectorAll('#budBody tr.bud-off').length, link: document.getElementById('budLink').checked }));
  console.log('start:', JSON.stringify(await st()));
  // find a need line with an amount, give it an end date in the past
  const row = await p.evaluate(() => { const tr = [...document.querySelectorAll('#budBody tr[data-bud]')].find(tr => +tr.querySelector('[data-bk="amt"]').value.replace(/,/g, '') > 100 && tr.querySelector('[data-bk="nw"]').value === 'need' && !tr.hasAttribute('data-med')); return tr ? { id: tr.getAttribute('data-bud'), amt: tr.querySelector('[data-bk="amt"]').value, name: tr.querySelector('td.name').textContent } : null; });
  console.log('line:', row);
  await p.fill(`#budBody tr[data-bud="${row.id}"] input[data-bk="end"]`, '2024-12'); await p.waitForTimeout(600);
  console.log('ended:', JSON.stringify(await st()));
  console.log('tag:', await p.evaluate((id) => (document.querySelector(`#budBody tr[data-bud="${id}"] .bud-when`) || {}).textContent, row.id));
  await p.fill(`#budBody tr[data-bud="${row.id}"] input[data-bk="end"]`, ''); await p.fill(`#budBody tr[data-bud="${row.id}"] input[data-bk="start"]`, '2031-06'); await p.waitForTimeout(600);
  console.log('later:', JSON.stringify(await st()));
  // apply to needs/wants
  if (!(await st()).link) { await p.click('#budApply'); await p.waitForTimeout(500); }
  console.log('after apply:', JSON.stringify(await st()));
  // projection still carries it on its dates: compare year-by-year needs in the income rows
  const rows = await p.evaluate(() => { const r = window.__rfb.compute(); const X = window.__rfb.projectTax(r, {convert:null}); return (X.income || {rows:[]}).rows.slice(0, 8).map(x => x.year + ':' + Math.round(x.needs)); });
  console.log('needs by year:', rows.join(' '));
  console.log('ERRORS:', errs.length ? errs : 'none'); await b.close();
})();
