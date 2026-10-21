const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const f of ['preview-smith.html', 'preview.html']) {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.goto('file://' + process.cwd() + '/' + f, { waitUntil: 'load' }); await p.waitForTimeout(800);
    await p.click('#expandAll'); await p.waitForTimeout(500);
    const info = await p.evaluate(() => {
      const g = document.getElementById('scnGrid'); const cards = [...g.querySelectorAll('.scn-card')];
      return { cards: cards.length, heads: cards.map(c => c.querySelector('.scn-card-head b').textContent + ' / ' + c.querySelector('.scn-card-head span').textContent),
        base: cards[0] ? [...cards[0].querySelectorAll('dl div')].map(d => d.classList.contains('scn-sub') ? '## ' + d.textContent : d.querySelector('dt').textContent + ': ' + d.querySelector('dd').textContent) : null,
        a: cards[1] ? [...cards[1].querySelectorAll('dl div')].filter(d => !d.classList.contains('scn-sub')).slice(0, 11).map(d => d.querySelector('dt').textContent + ': ' + d.querySelector('dd').textContent) : null,
        empty: g.textContent.trim().slice(0, 80) };
    });
    console.log('==', f); console.log(JSON.stringify(info, null, 1)); console.log('ERRORS:', errs.length ? errs : 'none');
    if (f === 'preview-smith.html') { const el = await p.$('#scnGrid'); await el.screenshot({ path: '_base-shot.png' }); }
    // switch scenario and check marker moves
    if (f === 'preview-smith.html') { await p.click('[data-scn="1"]'); await p.waitForTimeout(600); console.log('after switch:', await p.evaluate(() => [...document.querySelectorAll('#scnGrid .scn-card')].map(c => c.classList.contains('on')))); }
    await p.close();
  }
  await b.close();
})();
