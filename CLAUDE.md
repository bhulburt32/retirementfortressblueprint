# Retirement Fortress Blueprint — working notes for Claude

Alto Financial Group's retirement-income planning application. One self-contained HTML file an
advisor opens in a browser (or as a claude.ai artifact), fills in for a household, and prints
client reports from. Owner: Ben Hulburt (Co-CEO). Advisory services run through AE Wealth
Management, LLC (AEWM) — the disclosure wording in the reports has been reviewed and must not be
reworded casually.

## Commands

```bash
npm install && npm run browser     # once: Playwright + Chromium
npm run build                      # src → dist/ (preview.html, retirement-fortress.html, _x.js) + syntax check
npm test                           # build, then the maintained Playwright suite (tests/run.js)
node tests/run.js t-report         # one check
node tests/t-report.js             # the raw script, prints what it finds (run from dist/ or set cwd there)
npm run guide:pdf                  # docs/advisor-guide.html → dist/…Advisor Guide.pdf
```

`CHROMIUM_PATH=/path/to/chrome` overrides the browser. The report overflow check is only reliable
with Montserrat and Playfair Display installed locally (`assets/fonts/` → `~/.fonts`).

## What is where

- `src/fortress-mapper.html` — **the application and the source of truth.** No doctype/html/head:
  the claude.ai artifact wraps it. ~12k lines of JS in one `<script>`, CSS inline, images and the
  educational PDF embedded as base64 constants near the bottom (`LOGO_PNG_B64`, `COVER_B64`,
  `FORT_B64`, `EDU_PDF_B64`).
- `src/standalone-head.html` — the `<head>` for the desktop download.
- `modules/*.js` — the source of the larger features at the time they were spliced in (optimizer,
  Nitrogen reader, scenarios, sensitivity, LTC). Read them to understand a feature; **edit the mapper**.
- `tests/` — Playwright scripts; `tests/run.js` runs the maintained set. Older scripts kept for reference.
- `samples/default-case-smith.json` — the case embedded as `DEFAULT_CASE` (anonymized). Real client
  data must never be committed or baked in.
- `docs/advisor-guide.html` — the advisor guide, published as its own artifact. Update it whenever a
  section's behaviour changes; it is written for advisors, in prose, one `<dt>/<dd>` per control.
  Its numbered sections are also the in-app **User Guide Notes**: `scripts/guide-notes.py` (run by
  `npm run build`, or `npm run notes`) copies each section body into the mapper between
  `<!-- guide-notes:NN -->` markers. Edit the guide, never the generated blocks.

Published artifacts (claude.ai): the Blueprint (shared with the org — the **demo**, frozen at v140
unless Ben asks) and the advisor guide (private). Development builds go to a separate artifact or
host; the demo is updated only as a deliberate release.

## Code conventions (match what is there)

- ES5-style JavaScript: `var`, `function`, string concatenation, no modules, no build-time
  dependencies, no external libraries or CDNs. The file must run from `file://` and inside the
  claude.ai artifact sandbox (external hosts blocked except Google Fonts).
- Money via `money(v)` / `fmtN` / `fmtKM(v)`; percentages via `pctIn()` (parse) and local `pc1`/`pct`
  helpers. Inputs are text with `inputmode`; parse with `num()`.
- Every section has a `render<Section>(r)`; `renderAll()` calls them; `render()` is the debounced
  re-render every input listener calls. Don't call compute() from a renderer — take `r`.
- "Following the plan" defaults: an input left blank follows the plan and gets class `auto`; a value
  typed is a setting. When a cell shows a *calculated* default as its value (annuity monthly income,
  QCD etc.), guard with `document.activeElement !== el` before overwriting and don't persist the
  default on blur.
- Per-scenario state (A/B/C) is exactly: `adjMoves`, `INC_ADJ`, `ANN_INC`, `LTC_BEN`, `ROOF_G`,
  `wdOrder`, `rothCfg`, `qcdCfg`. Adding per-scenario state means touching `scnDefault`,
  `scnSnapshot`, `scnRestoreGlobals`, `scnSerialize`/parse, `caseData`, `loadCase` and the new-case
  reset. Everything else is shared across scenarios.
- Keys that persist in saved cases (ANN_INC, LTC_BEN, ROOF_G) have had their schemes change; keep the
  legacy fallbacks (`g.legacy`, `roofGOverrideKey`) so older cases still load.
- Text in the UI and reports: plain American English, no vendor names on client pages (the
  portfolio slide says "Your Current Investment Portfolio", not Nitrogen), "TBD" for an unknown
  carrier, annuities are always called annuities.

## Engine rules that are easy to break

- **First-year proration.** Row 0 runs from the month the plan is prepared (`planStart()`); income,
  expenses, conversions and tax are prorated via `act()/actPre()`; pre-plan income sits in the tax
  base (`row.pre`) but not the cash flow, and so do the first year's withdrawals before the plan date,
  taken at the plan window's pace (`k0`, `preWdOf`). The section 17 table shows that first row on a
  calendar-year basis (`preParts`). Any new income or expense line must use `act()`.
- **Dates:** `planYears(ym)` places a `yyyy-mm` on the plan timeline; an "end" month is exclusive.
  Ages are whole years from section 02 unless a feature takes a date of birth (the optimizer does).
- **RMDs** are computed on the balance before the year's distributions; a QCD reduces the taxable
  excess (`extra = req − qualDraw − qcd`). Spare RMD money and freed QCD cash are reinvested in the
  taxable Roof; surplus guaranteed income is otherwise *not* banked — don't build a comparison that
  pays something out of that surplus.
- **Roth conversions** re-size to bracket/IRMAA headroom each year, so anything that changes taxable
  income pre-RMD also changes the conversion schedule; say so when comparing runs.
- `projectTax(r, opts)`: `opts.convert` (Roth), `opts.qcd` (`undefined` follows settings, `null` off,
  `'qcd'` force, `'cash'` the cash-gift comparison), `opts.ltc` (care-event costs/pools), `r.stress`
  (sequence / SS cut / inflation). The status quo (`statusQuoRun`) never has conversions or QCDs.
- Social Security: `ssPlan` gives the benefit at the chosen age for the projections; the optimizer
  (`ssoRun`) ranks claiming ages separately and only writes back when the advisor presses "Use".

## Reports

- `buildDeck()` builds the executive summary as HTML slides (20 × 11.25 in, 16:9). Rules: nothing
  under 16 pt, Alto logo every page, disclosure footer every page, charts are **cloned from the page
  by element id** (`dkSvg`, `dkAppLegend`) — so the page must have rendered the chart for the report
  scenario (`withScnView(reportScn, buildDeck)` handles that). After any deck change run `t-report`
  and keep "overflowing text boxes: 0"; shorten text or move tiles, never shrink below 16 pt.
- Slide builders are IIFEs in page order inside `buildDeck`; `page++` per slide; conditional slides
  (Nitrogen portfolio, QCD, consolidation continuation) must stay conditional.
- `buildSsReport()` — Social Security Planning Analysis, Letter pages; the internal worksheet PDF
  (`makePdf`) is **not for client distribution** and says so. (The Nitrogen account upload was removed
  from the Reports section; `buildNitrogenPdf` remains in the file, unused.)

## Testing expectations

- Any engine change: run `npm test`, and compare the printed figures for the Smith case before and
  after; explain every figure that moved in the commit message.
- Any UI/markup change: the relevant `t-*.js` plus `t-default` (the default case still loads) and
  `t-report` (the deck still builds).
- Prefer adding an assertion to an existing script over a new file; new features get a `t-<name>.js`
  that prints the key figures and ends with `ERRORS: none`.

## Gotchas

- Editing a 5 MB file: anchor on exact text; the file mixes literal Unicode (`—`, `’`) and JS escapes
  (`—`) — check which one the target line uses before writing a replacement.
- `fonts.googleapis.com` is unreachable in sandboxes; the page degrades to system fonts. The deck's
  overflow numbers differ without Montserrat installed locally.
- `[data-tgl]` / `.inc-title` blocks are made collapsible at load; new subsections placed between two
  `.inc-title`s join the preceding one's body automatically.
- The Nitrogen parser was built against `samples/nitrogen-sample.pdf` (a mock) and one real report;
  real layouts may need `nitroClean`/`nitroParse` tuning — keep the label list in one place.
- Don't commit screenshots, `dist/`, or anything under `node_modules/` (see `.gitignore`).

## Release process

1. Work on a branch; `npm test` green; update `docs/advisor-guide.html` for behaviour changes.
2. PR with the figures that moved and why. Compliance reviews any change to disclosure text.
3. Merge → tag `vNNN` → publish `src/fortress-mapper.html` to the development artifact; the demo
   artifact only on Ben's say-so.
