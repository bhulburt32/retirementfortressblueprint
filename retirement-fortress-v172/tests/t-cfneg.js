const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + __dirname + '/preview-smith.html'); await pg.waitForTimeout(1500);
  await pg.click('#expandAll').catch(() => {}); await pg.waitForTimeout(800);
  const r = await pg.evaluate(() => {
    const t = document.getElementById('cfTable'); if (!t) return 'no cfTable';
    const rows = [...t.querySelectorAll('tbody tr')];
    const out = { rows: rows.length, negBefore: 0, negAfter: 0, wrong: 0, sample: [] };
    rows.forEach(tr => {
      const tds = [...tr.querySelectorAll('td.num')];
      tds.forEach(td => {
        const neg = td.classList.contains('neg');
        const txt = td.textContent.trim();
        const isMinus = /^[-−(]|^-\$|^−\$/.test(txt) || txt.startsWith('-');
        if (neg) { if (td.classList.contains('grp')) out.negBefore++; else out.negAfter++; if (!isMinus) out.wrong++; if (out.sample.length < 4) out.sample.push(txt); }
      });
    });
    const foot = [...t.querySelectorAll('tfoot td.neg')].map(td => td.textContent.trim());
    const col = out.sample.length ? getComputedStyle(t.querySelector('td.neg')).color : null;
    return Object.assign(out, { foot, col });
  });
  console.log(JSON.stringify(r)); console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
