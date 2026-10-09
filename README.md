# Retirement Fortress Blueprint — source handoff

Everything needed to continue development of Alto Financial Group's Retirement Fortress Blueprint
in a repository, starting from exactly what is published as **Version 140** of the artifact.

## What is here

| Folder | Contents |
|---|---|
| `src/fortress-mapper.html` | The application: one self-contained HTML file (no doctype — the claude.ai artifact wraps it). ~12,000 lines of JavaScript in a single script block, all CSS inline, logo / cover / Fortress images and the 21-page educational PDF embedded as base64. |
| `src/standalone-head.html` | The `<head>` prepended to the mapper to produce the standalone `retirement-fortress.html` that opens from a desktop. |
| `scripts/build.py` | Builds `dist/preview.html` (for tests), `dist/retirement-fortress.html` (standalone) and `dist/_x.js` (the script extracted for `node --check`). `scripts/build-guide-pdf.js` prints the advisor guide to PDF. |
| `modules/*.js` | The source files from which the larger features were spliced into the mapper: Social Security optimizer (`sso.js`, `sso-report.js`), Nitrogen PDF reader (`nitrogen.js`), scenarios A/B/C (`scenarios.js`), sensitivity analysis (`sens.js`), LTC benefits and care-event projections (`ltcben.js`, `ltcscn.js`). They are snapshots at the time each feature was added; **the mapper is the source of truth** — these are a map of where things live. |
| `tests/` | Playwright scripts; `tests/run.js` runs the maintained set. Each loads `dist/preview.html`, exercises one feature and prints what it finds; `t-report.js` builds the executive summary and checks every text box for overflow. |
| `tests/mk-nitro-pdf.js` | Generates `samples/nitrogen-sample.pdf`, the mock Nitrogen report the parser tests use. |
| `assets/fonts/` | Montserrat and Playfair Display (variable TTFs). Install locally so report renders match the browser and the overflow checks are reliable. |
| `assets/edu/` | The educational slides PDF (21 pages, 960×540 pt) and the HTML source of the added "Long-Term Care in America" slide. The PDF is embedded in the mapper as `EDU_PDF_B64`. |
| `samples/default-case-smith.json` | The case block baked into the mapper as `DEFAULT_CASE` (the Smith household, anonymized). Paste into section 22 → *Load pasted case*. |
| `samples/*.pdf` | The executive summary, Social Security analysis and Nitrogen mock, as printed from the Smith case. |
| `docs/` | The advisor guide (HTML as published, and the PDF). |

## Building

```bash
npm install && npm run browser   # once
npm run build                    # dist/preview.html, dist/retirement-fortress.html, dist/_x.js + syntax check
```

Publishing: the artifact takes `fortress-mapper.html` as-is (no doctype). The standalone download is
`retirement-fortress.html`.

## Running the tests

```bash
npm test                   # build + the maintained suite (tests/run.js): PASS/FAIL per check
node tests/run.js t-report # one check
node tests/t-sso.js        # a raw script, prints everything it finds
```

Each script loads `dist/preview.html`, drives one feature and prints what it finds; `run.js` fails
on page errors or any overflowing text box in the executive summary. `CHROMIUM_PATH` points the
tests at a Chromium binary when Playwright's own is not installed. Install `assets/fonts/` locally
(Montserrat, Playfair Display) so report renders match the browser. See `CLAUDE.md` for the
conventions, engine rules and release process.

## How the code is organized (inside `fortress-mapper.html`)

Reading order, by line region as of v140:

1. **CSS** (top) — tokens on `:root`, dark theme, the `.pj` chart classes, `.tax-tiles`, the deck
   is styled separately inside `buildDeck`.
2. **Markup** — sections 01–22 in page order. Collapsible blocks are made at load from
   `.inc-title` / `.bkt-head` / `[data-tgl]` (see `initCollapsibles`).
3. **Inputs** — `readInputs()` → `readInputs0()`, `readEmployment()` (incl. `extra` jobs),
   `readBenefits()` (SS incl. `optimizer`, pensions, annuities, non-guaranteed income).
4. **Engine**
   - `compute()` — the Fortress waterfall: targets, funding, moves, `transferPlan`, `lineLedger`.
   - `foundationSizing()` — Needs gap averaged or peaked over the first N retirement years.
   - `projectIncome(r)` — year-by-year income/expense rows with first-year proration (`planStart`,
     `act`, `actPre`), annuity contracts, additional jobs, stress hooks (`r.stress`).
   - `projectTax(r, opts)` — balances by tier, RMDs, QCDs (`qcdPlan`), Roth conversions
     (`opts.convert`), withdrawal order, federal + state tax, LTC pools (`opts.ltc`).
   - `statusQuoRun`, `sensDefs`/`sensRun`, `ltcScenarios`/`ltcScenarioRun`.
   - Social Security: `ssPlan` (benefit at the chosen age), `ssoRun`/`ssoSimulate` (optimizer).
5. **Renderers** — one `render*` per section; `renderAll()` ties them together; `render()` is the
   debounced re-render every input calls.
6. **Scenarios** — `SCN_META`, `scnSnapshot`/`scnRestore`, `withScnView(k, fn)` runs a report with
   scenario k on the page.
7. **Reports** — `buildDeck()` (executive summary), `buildSsReport()` (Social Security analysis),
   the internal worksheet PDF writer (`makePdf`), Nitrogen upload text, educational slides blob.
8. **Save / load** — `caseData()` and `loadCase(txt)`; section 22. `DEFAULT_CASE` at the bottom
   is loaded over the sample on every open.
9. **Events** — one listener block per section, near the bottom; `initCollapsibles()`; the
   startup block ending in `renderAll()`.

## Suggested next steps

1. Put Chromium and `npm test` in CI so every pull request runs the suite.
2. Turn the engine figures printed by `t-qcd.js`, `t-rmd.js`, `t-sso.js`, `t-prorate.js` into
   asserted golden values for the Smith case.
3. Split the script block into modules (engine / renderers / reports / events) with a bundler
   step that still emits the single file; keep `scripts/build.py`'s outputs as the release artifacts.
4. Keep the published demo artifact frozen at v140; publish development builds to a separate
   artifact (or a static host) until a release is ready.

## Things worth knowing

- Carrier/product lists (`CARRIER_KEYS`, `PRODUCTS`), the 2026 tax tables (`TAX_2026`,
  `IRMAA_2026`, `QCD_LIMIT_2026`), the LTC cost defaults (`LTC_AVG_COST`, 4.5% to age 80) and the
  stress-test constants (`SENS_SEQ`, `SENS_SS`, `SENS_INFL`) are plain constants near their users.
- Every money figure in the reports comes from the same run as the page; the deck clones the
  page's SVG charts by element id (`dkSvg`), so a chart change on the page changes the slide.
- The Nitrogen reader is pure JS (`pdfObjects`, `pdfInflate` via `DecompressionStream`,
  `pdfCMap`, `nitroParse`); when the page runs inside claude.ai it also asks Claude to summarize
  the extracted text (`sampleFn`), otherwise it falls back to the label parser.
- Settings that live per scenario: transfers, income adjustments, annuity income, LTC benefits,
  Roof growth, withdrawal order, Roth config, QCD config. Everything else is shared.
