/* Payroll taxes: FICA on gross salary in every working year (none after retirement), the self-employed tick on an
   additional line, the payroll column in the cash flow and tax tables, and the section 04 breakdown. Smith sample. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/preview-smith.html', { waitUntil: 'load' }); await p.waitForTimeout(1000);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  await p.fill('#salaryC', '150000'); await p.fill('#retireC', '2031-06'); await p.waitForTimeout(600);
  const sal = await p.evaluate(() => ({ c: document.getElementById('salaryC').value, s: document.getElementById('salaryS').value, retC: document.getElementById('retireC').value, retS: document.getElementById('retireS').value }));
  console.log('salaries:', JSON.stringify(sal));
  const X = await p.evaluate(() => { const r = window.__rfb.compute(); const X = window.__rfb.projectTax(r); return { rows: X.rows.slice(0, 6).map(x => ({ y: x.year, emp: Math.round((window.__rfb.projectIncome ? 0 : 0)), pay: Math.round(x.payroll), fed: Math.round(x.tax), tot: Math.round(x.totalTax), parts: x.payrollParts && { ss: Math.round(x.payrollParts.ss), med: Math.round(x.payrollParts.med), addl: Math.round(x.payrollParts.addl) } })), lifetimePayroll: Math.round(X.lifetimePayroll), lastPay: Math.round(X.rows[X.rows.length - 1].payroll) }; });
  console.log('tax rows:', JSON.stringify(X));
  console.log('cf header has payroll:', await p.evaluate(() => /Payroll tax/.test(document.getElementById('cfTable').textContent)), '| tax table has payroll:', await p.evaluate(() => /Payroll tax/.test(document.getElementById('taxTable').textContent)));
  console.log('sec 04 net row:', await p.evaluate(() => document.getElementById('empFoot').textContent.replace(/\s+/g, ' ').slice(0, 260)));
  // a self-employed consulting line
  await p.click('#jobAdd'); await p.waitForTimeout(300);
  const row = (await p.$$('#jobBody tr[data-job]')).pop();
  await row.$eval('input[data-jk="name"]', e => { e.value = 'Consulting'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await row.$eval('input[data-jk="amt"]', e => { e.value = '50000'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForTimeout(400);
  const before = await p.evaluate(() => { const X = window.__rfb.projectTax(window.__rfb.compute()); return { pay: Math.round(X.rows[0].payroll), ord: Math.round(X.rows[0].taxable) }; });
  await row.$eval('input[data-jk="se"]', e => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(400);
  const after = await p.evaluate(() => { const X = window.__rfb.projectTax(window.__rfb.compute()); return { pay: Math.round(X.rows[0].payroll), se: Math.round(X.rows[0].payrollParts.se), ded: Math.round(X.rows[0].seDeduction), ord: Math.round(X.rows[0].taxable) }; });
  console.log('consulting 50k as wages:', JSON.stringify(before), '| as self-employed:', JSON.stringify(after));
  console.log('note:', await p.evaluate(() => [...document.querySelectorAll('#jobBody tr.adj-note td')].pop().textContent.slice(-120)));
  const saved = await p.evaluate(() => JSON.parse(document.getElementById('caseJson').value).household.employment.extra.map(x => x.se));
  console.log('saved se flags:', JSON.stringify(saved));
  const r1 = X.rows[1]; const ok = X.rows[0].pay > 0 && X.lastPay === 0 && r1.parts.ss === Math.round(150000 * 0.062) && r1.parts.med === Math.round(150000 * 0.0145) && after.se > 0 && after.ded > 0 && after.ord < before.ord && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); console.log('ERRORS:', errs.length ? errs : 'none'); await b.close(); process.exit(ok ? 0 : 1);
})();
