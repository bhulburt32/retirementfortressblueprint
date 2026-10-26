#!/usr/bin/env node
/* Runs the maintained Playwright checks and fails if any reports page errors or report overflow.
   Build first: python3 scripts/build.py. Browser: `npx playwright install chromium`, or set
   CHROMIUM_PATH to a Chromium binary. Run one test directly with `node tests/t-xxx.js`. */
const { spawnSync } = require('child_process');
const path = require('path');
const SUITE = [
  't-cfneg', 't-status', 't-empty',
  't-report',    // executive summary: slide count, zero overflowing text boxes
  't-sso',       // Social Security claiming optimizer + report
  't-qcd',       // qualified charitable distributions
  't-rmd',       // RMD comparison chart
  't-scn',       // scenarios A/B/C
  't-sens',      // sensitivity analysis
  't-prorate',   // first-year proration
  't-anngroup',  // annuity contracts combined by To account
  't-anx',       // section 06: account list opens with the section, annuity position types, the Annuities subsection
  't-annrules',  // the annuity product rules in the projections and the stress test
  't-anntax',    // tax: the federally tax-free Walls yield, Roth annuity income, the stress rows on the scenario cards
  't-ltcmerge',  // one LTC contract per insured
  't-ltcscn',    // care-event projections
  't-jobs',      // additional employment incomes
  't-tbd',       // TBD carrier option; top banner removed
  't-riskq',     // risk profile questionnaire, the tolerance cell that follows it, the client report
  't-tglbtn',    // Adjust Target Allocations button
  't-assetmap',  // the asset map (page and deck), the -8%/-16% sequence stress, the 3.26% inflation default, the protected-pieces continuation slide
  't-wallssched', // section 14 Walls income by account: start/stop dates, total yield vs distribution, restarts; blank = pooled, unchanged
  't-taxcols',    // section 17 tax table: All income and AGI built up, MAGI for IRMAA, provisional income; senior deduction; IRMAA guard on MAGI
  't-basis',      // section 06 cost basis on taxable accounts: average-cost gains on withdrawals; blank = the 50% assumption
  't-sqsens',     // status-quo stress charts; the findings report lists only the risks checked or typed in the Risk section
  't-mc',         // section 19 Monte Carlo: a seeded run, the tiles, the fan chart, the strip row, staleness, the saved settings
  't-widow',      // section 17: before strategic tax planning first, the widow's or widower's curse, the after block set against before
  't-ltcdoubler', // section 06: the LTC income doubler cells feed the section 09 coverage and the care-event projections
  't-networth',   // gold headers over graphics, no indented sections, net worth in section 07 (debts subtracted) and over time, Walls plan assumptions in section 03
];
const only = process.argv.slice(2);
let failed = 0;
for (const name of SUITE) {
  if (only.length && !only.includes(name)) continue;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, name + '.js')], { encoding: 'utf8', cwd: path.join(__dirname, '..', 'dist') });
  const out = (r.stdout || '') + (r.stderr || '');
  const errs = /ERRORS: none/.test(out) ? [] : (out.match(/ERRORS: \[([\s\S]*?)\]/) || [, out.slice(-800)])[1].split('\n').filter(l => l.trim() && !/ERR_TUNNEL_CONNECTION_FAILED|fonts.googleapis/.test(l));
  const overflow = /overflowing text boxes: (\d+)/.exec(out);
  const ok = r.status === 0 && errs.length === 0 && (!overflow || overflow[1] === '0');
  console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(12) + ((Date.now() - t0) / 1000).toFixed(1) + 's' + (overflow ? '  overflow=' + overflow[1] : ''));
  if (!ok) {
    failed++; console.log(out.split('\n').slice(-25).join('\n'));
    /* on GitHub Actions, surface the failure as a check annotation too: the run's own log is not always reachable */
    if (process.env.GITHUB_ACTIONS) {
      const tail = out.split('\n').filter(l => l.trim() && !/ERR_TUNNEL_CONNECTION_FAILED|fonts.googleapis/.test(l)).slice(-14).join('\n').replace(/\r/g, '');
      console.log('::error title=' + name + ' failed::' + tail.replace(/%/g, '%25').replace(/\n/g, '%0A').slice(0, 3800));
    }
  }
}
console.log(failed ? `\n${failed} failing` : '\nall passing');
process.exit(failed ? 1 : 0);
