  /* ---- section 16: the Nitrogen Investment Portfolio Proposal, read page by page ----
     portfolio = {name, text, analysis, src:'claude'|'text', at}. The analysis is what propParse reads from the
     positioned lines (pdfLayoutText); Claude, when the page runs inside it, writes the two summaries from those
     figures. Everything here is shared across scenarios and saved with the case. */
  var portfolio = null;
  function propNum(s){ return nitroNum(s); }
  function propPct(s){ var m = /([-+−]?\d+(?:\.\d+)?)\s*%/.exec(String(s || '')); return m ? propNum(m[1]) : null; }
  function propMoney(s){ var m = /([-+−]?)\s?\$\s?([\d,]+(?:\.\d+)?)/.exec(String(s || '')); return m ? ((m[1] === '-' || m[1] === '−') ? -1 : 1) * propNum(m[2]) : null; }
  /* pasted text back into pages of lines: the page markers and the three-space cell joins of pdfLayoutText */
  function propPagesFromText(text){
    var pages = [], cur = null;
    String(text || '').split(/\r?\n/).forEach(function(ln){
      var m = /^--- page (\d+) ---$/.exec(ln.trim());
      if(m || !cur){ cur = []; pages.push(cur); if(m) return; }
      var t = ln.replace(/\s+$/, ''); if(!t.trim()) return;
      var cells = t.split(/\s{3,}|\t/).map(function(x){ return x.trim(); }).filter(Boolean);
      cur.push({text:cells.join('   '), cells:cells.map(function(x){ return {x:0, t:x}; })});
    });
    return pages;
  }
  function propParse(pages){
    var A = {accounts:[], stress:[], perf:{}, trailing:null, costs:null, sectors:[], bondSectors:[], regions:[], cap:[], style:[], intersection:[]};
    var isFoot = function(t){ return /^Page \d+ \/ \d+|^Prepared for .+ on [A-Z]|^© \d{4} Nitrogen|^provided by your financial|^constitute an offer|^from the use of this|^required by SEC Rule/.test(t); };
    var raw = [], lines = [];
    pages.forEach(function(pg, pi){ pg.forEach(function(L){ var o = {p:pi, t:L.text.trim(), c:L.cells.map(function(x){ return x.t; })}; raw.push(o); if(!isFoot(o.t)) lines.push(o); }); });
    var flat = lines.map(function(L){ return L.t; }).join('\n'), m, i;
    var find = function(re, from){ for(var k = from || 0; k < lines.length; k++) if(re.test(lines[k].t)) return k; return -1; };
    /* the report */
    if((m = /Prepared for (.+?) on ([A-Z][a-z]+\.? \d{1,2}, \d{4})/.exec(raw.map(function(L){ return L.t; }).join('\n')))){ A.preparedFor = m[1].trim(); A.date = m[2]; }
    if((m = /^(Investment Portfolio Proposal|Portfolio Proposal|[A-Z][A-Za-z ]+ (?:Proposal|Report|Analysis))$/m.exec(flat))) A.title = m[1];
    if(!A.preparedFor && (m = /Prepared for\s*\n?\s*(.+)/.exec(flat))) A.preparedFor = m[1].trim();
    /* the household's Risk Number and comfort zone */
    if((m = /you are a Risk[^\n]*\n(?:\d{1,2}\s+)?Number (\d{1,2})\. This means over the next (\d+) months you are comfortable risking a loss of ([-−]?\$[\d,]+)\s*\n?\s*\(([-−][\d.]+)%\) in exchange for the chance of gaining \+?\$([\d,]+) \(\+?([\d.]+)%\)/.exec(flat))){
      A.clientRiskNumber = +m[1]; A.horizonMonths = +m[2];
      A.clientRange = {down:-Math.abs(propNum(m[4])), up:propNum(m[6]), downDollars:-Math.abs(propMoney(m[3])), upDollars:propNum(m[5])};
    } else if((m = /Number (\d{1,2})\. This means/.exec(flat))) A.clientRiskNumber = +m[1];
    if((m = /questionnaire[^\n]{0,80}? on ([A-Z][a-z]+\.? \d{1,2}, \d{4})/.exec(flat))) A.questionnaireDate = m[1];
    if((i = find(/^BIRTH YEAR\s+RETIREMENT AGE\s+RETIREMENT YEAR$/)) >= 0 && lines[i + 1] && (m = /^(\d{4})\s+(\d{2})\s+(\d{4})$/.exec(lines[i + 1].t))) A.horizon = {birthYear:+m[1], retireAge:+m[2], retireYear:+m[3]};
    if((i = find(/^MARKET SENTIMENT\s+FINANCIAL FUTURE$/)) >= 0 && lines[i + 1] && lines[i + 1].c.length >= 2) A.sentiment = {market:lines[i + 1].c[0], future:lines[i + 1].c[1]};
    /* the portfolio */
    if((m = /^(\d{1,2}) \$([\d,]+) ·\s*(\d+) ACCOUNTS?$/m.exec(flat))){ A.riskNumber = +m[1]; A.value = propNum(m[2]); A.accountCount = +m[3]; }
    if((m = /PORTFOLIO TOTAL \$([\d,]+(?:\.\d+)?)/.exec(flat))) A.value = A.value || propNum(m[1]);
    if((m = /ANNUAL DIVIDEND\s+([\d.]+)%/.exec(flat))) A.dividend = propNum(m[1]);
    if((m = /^([-−][\d.]+)% ([-−]\$[\d,]+)\s+\+\$([\d,]+) \+([\d.]+)%$/m.exec(flat))) A.range = {down:-Math.abs(propNum(m[1])), up:propNum(m[4]), downDollars:-Math.abs(propMoney(m[2])), upDollars:propNum(m[3])};
    if((m = /RISK DELTA\s+(-?\d+)/.exec(flat))) A.riskDelta = +m[1];
    if((m = /^GPA\s+(\d\.\d)$/m.exec(flat))) A.gpa = propNum(m[1]);
    if((m = /^Riskalyze GPA\s+(\d\.\d)\s+(\d\.\d)$/m.exec(flat))){ A.gpa = A.gpa || propNum(m[1]); A.benchGpa = propNum(m[2]); }
    if((m = /\d{1,2} Current Portfolio\s+(\d{1,2}) (.+?)$/m.exec(flat)) && !/^(?:S&P|Aggregate)/.test(m[2])){ A.benchmark = {name:m[2].trim(), riskNumber:+m[1]}; }
    /* asset classification: the first Stocks/Bonds/Cash/Other block; the benchmark's share when the multiview carries it */
    ['Stocks', 'Bonds', 'Cash', 'Other'].forEach(function(k){
      var r = new RegExp('^' + k + '\\s+([\\d.]+)%(?:\\s+([\\d.]+)%)?$', 'm'), mm = r.exec(flat);
      if(mm){ A.allocation = A.allocation || []; A.allocation.push({cls:k, pct:propNum(mm[1])}); }
      var r2 = new RegExp('^' + k + '\\s+([\\d.]+)%\\s+([\\d.]+)%$', 'm'), m2 = r2.exec(flat);
      if(m2){ A.benchAllocation = A.benchAllocation || []; A.benchAllocation.push({cls:k, pct:propNum(m2[2])}); }
    });
    if((m = /^Duration\s+(\S+ \S+ \S+)/m.exec(flat))) A.duration = m[1];
    if((m = /^Maturity\s+(\S+ \S+ \S+)/m.exec(flat))) A.maturity = m[1];
    /* holdings by account: "$total gpa" / "risk name" / "TOTAL GPA", then holdings until the next account */
    var start = find(/^PORTFOLIO TOTAL/), stop = find(/^Portfolio Stress Tests/, start + 1); if(stop < 0) stop = find(/^Performance Analysis|^Snapshot Report/, start + 1); if(stop < 0) stop = lines.length;
    var amountRe = /^(?:(\d{1,2})\s+)?\$([\d,]+(?:\.\d+)?)\s+([\d.]+)%\s+([\d.]+)%\s+(—|[\d.]+%)\s*(?:(\d\.\d)\s+)?([-+−][\d.]+)%\s*\|\s*([-+−][\d.]+)%$/;
    var typeRe = /^(MM|ETF|Stock|Fund|Bond|CD|Cash|Custom(?:\s*·\s*Proxy:\s*(\S+))?)$/i;
    var skipRe = /^(?:% OF|RISK\s+HOLDING|TOTAL\s+GPA|Return Mode|Custom Scenario|PORTFOLIO$|Portfolio Holdings)/;
    var acct = null;
    if(start >= 0) for(i = start + 1; i < stop; i++){
      var L = lines[i], t = L.t, n1 = lines[i + 1], n2 = lines[i + 2];
      var hm = /^\$([\d,]+)\s+(\d\.\d)$/.exec(t);
      if(hm && n1 && n2 && /^(\d{1,2})\s+(.+)$/.test(n1.t) && /^TOTAL\s+GPA$/.test(n2.t)){
        var am = /^(\d{1,2})\s+(.+)$/.exec(n1.t);
        acct = {name:am[2].trim(), riskNumber:+am[1], total:propNum(hm[1]), gpa:propNum(hm[2]), holdings:[]}; A.accounts.push(acct); i += 2; continue;
      }
      if(!acct || skipRe.test(t) || amountRe.test(t) || typeRe.test(t)) continue;
      /* a holding name: an amount line follows within two lines */
      var j = -1; for(var k = i + 1; k <= i + 2 && k < stop; k++) if(amountRe.test(lines[k].t)){ j = k; break; }
      if(j < 0) continue;
      var nm = t.replace(/\s+\d\.\d$/, ''), gpaOnName = /\s(\d\.\d)$/.exec(t), q = amountRe.exec(lines[j].t);
      var H = {name:nm, amount:propNum(q[2]), pctAccount:propNum(q[3]), pctPortfolio:propNum(q[4]), yield:q[5] === '—' ? null : propPct(q[5]), gpa:q[6] ? propNum(q[6]) : (gpaOnName ? propNum(gpaOnName[1]) : null),
               riskNumber:q[1] ? +q[1] : null, range:{down:propNum(q[7]), up:propNum(q[8])}, type:null, proxy:null};
      var tk = /^([A-Z][A-Z0-9.]{0,6})\s*·\s*(.+)$/.exec(nm); if(tk){ H.ticker = tk[1]; H.name = tk[2].trim(); }
      for(k = j + 1; k <= j + 3 && k < stop; k++){
        var tt = lines[k].t, tm = typeRe.exec(tt), rm = /^(\d{1,2})\s+Custom Scenario/.exec(tt);
        if(tm){ H.type = tm[1].replace(/\s*·.*$/, ''); if(tm[2]) H.proxy = tm[2]; }
        else if(rm) H.riskNumber = +rm[1];
        else if(/^Custom Scenario|^Return Mode/.test(tt)) continue;
        else break;
      }
      if(H.amount > 0.005) acct.holdings.push(H);
      i = j;
    }
    /* stress tests */
    for(i = 0; i < lines.length; i++){
      var sm = /^If an? (.+?) happened again/.exec(lines[i].t); if(!sm) continue;
      var T = {name:sm[1], period:null, pct:null, dollars:null, benchmark:null, benchPct:null, benchDollars:null, extra:null};
      for(var k2 = i + 1; k2 < Math.min(lines.length, i + 16); k2++){
        var u = lines[k2].t, pm, dm;
        if(/^If an? .+ happened again/.test(u) || /^Page |^Performance Analysis/.test(u)) break;
        if(!T.period && /^[A-Z]{3}\.\s*\d{2},\s*\d{4}/.test(u)) T.period = u.replace(/\s*-\s*/, ' – ');
        else if((pm = /^([-+−][\d.]+)%(?:\s+([-+−][\d.]+)%)?$/.exec(u))){ if(T.pct == null){ T.pct = propNum(pm[1]); if(pm[2]) T.benchPct = propNum(pm[2]); } else if(T.extra) T.extra.pct = propNum(pm[1]); }
        else if((dm = /^([-+−]\$[\d,]+)(?:\s+([-+−]\$[\d,]+))?$/.exec(u))){ if(T.dollars == null){ T.dollars = propMoney(dm[1]); if(dm[2]) T.benchDollars = propMoney(dm[2]); } else if(T.extra) T.extra.dollars = propMoney(dm[1]); }
        else if(/^\d{1,2} Current Portfolio(?:\s+(\d{1,2}))?$/.test(u)) continue;
        else if(/^PORTFOLIO$|^EST\./.test(u)) continue;
        else if(/^\d{1,2}$/.test(u)) continue;
        else if(!/^\d/.test(u) && u.length < 40){ if(!T.benchmark) T.benchmark = u; else if(T.pct != null && !T.extra) T.extra = {name:u, pct:null, dollars:null}; }
      }
      if(T.pct != null) A.stress.push(T);
    }
    /* performance: trailing returns and the statistics */
    var per = find(/^3 MONTHS\s+6 MONTHS/), pr = [], pk = per;
    while(pk >= 0 && pr.length < 2){ var ill = find(/^\((\d+(?:\.\d+)?)% Illustrated\)/, pk + 1); if(ill < 0) break; var cm = /^\(([\d.]+)% Illustrated\)\s+(.*)$/.exec(lines[ill].t); pr.push({illustrated:propNum(cm[1]), values:cm[2].split(/\s{2,}/).map(function(v){ return v === '—' ? null : propPct(v); })}); pk = ill; }
    if(pr.length){ A.trailing = {periods:lines[per].c.slice(0, 6), portfolio:pr[0], benchmark:pr[1] || null}; }
    var STATS = {'Beta':'beta', 'R^2':'r2', 'R²':'r2', 'Batting Average':'batting', 'Sharpe Ratio':'sharpe', 'Standard Deviation':'stdev', 'Drawdown':'drawdown', 'Draw Down':'drawdown', 'Total Return':'totalReturn', 'Alpha':'alpha', 'M²':'m2', 'Sortino Ratio':'sortino', 'Treynor Ratio':'treynor', 'ROMAD':'romad', 'Time to Recovery (in Years)':'recoveryYears', 'Gain to Pain':'gainToPain', 'Annual Range Midpoint':'midpoint', 'Modeled Performance':'modeled', '% Illustrated':'illustrated', 'Annual Dividend Yield %':'dividend', 'Net Expense Ratio':'expense', 'Tax Drag':'taxDrag'};
    lines.forEach(function(L){
      if(L.c.length < 2 || !STATS[L.c[0]]) return;
      var key = STATS[L.c[0]], pv = L.c[1] === '—' ? null : propNum(L.c[1]), bv = L.c[2] == null || L.c[2] === '—' ? null : propNum(L.c[2]);
      if(!A.perf[key] || (A.perf[key].p == null && pv != null)) A.perf[key] = {p:pv, b:bv};
    });
    if((m = /^(\d{1,2}) Current Portfolio\s+(\d{1,2}) (.+?)$/m.exec(flat)) && A.benchmark == null) A.benchmark = {name:m[3], riskNumber:+m[2]};
    var ps = find(/^PORTFOLIO STATS|^PERFORMANCE$/);
    for(i = ps + 1; ps >= 0 && i < ps + 5 && i < lines.length; i++){ if((m = /^([A-Za-z]{3}\.?\s?\d{1,2},\s?\d{4})\s?-\s?([A-Za-z]{3}\.?\s?\d{1,2},\s?\d{4})$/.exec(lines[i].t))){ A.perfPeriod = m[1].replace(/,(?=\d)/, ', ') + ' – ' + m[2].replace(/,(?=\d)/, ', '); break; } }
    /* costs */
    if((m = /^\$([\d,]+) \(([\d.]+)%\)\s+([\d.]+)%\s*(?:\[\d\])?\s*([\d.]+)%\s+([\d.]+)%$/m.exec(flat))) A.costs = {total:propNum(m[1]), totalPct:propNum(m[2]), taxDrag:propNum(m[3]), expense:propNum(m[4]), advisory:propNum(m[5])};
    else if((m = /^\$([\d,]+) \(([\d.]+)%\)/m.exec(flat))) A.costs = {total:propNum(m[1]), totalPct:propNum(m[2]), taxDrag:A.perf.taxDrag ? A.perf.taxDrag.p : null, expense:A.perf.expense ? A.perf.expense.p : null, advisory:null};
    /* sectors: a line of names, then the portfolio's percentages, then the benchmark's */
    var readSectors = function(from, to, into){
      for(var k = from; k < to - 2; k++){
        var N = lines[k], P = lines[k + 1], B = lines[k + 2];
        if(N.c.length < 2 || N.c.some(function(x){ return /\d%/.test(x); })) continue;
        if(!P.c.every(function(x){ return /^[\d.]+%$/.test(x); }) || !B.c.every(function(x){ return /^[\d.]+%$/.test(x); })) continue;
        N.c.forEach(function(nm, q){ if(P.c[q] != null) into.push({name:nm, pct:propNum(P.c[q]), bench:B.c[q] != null ? propNum(B.c[q]) : null}); });
        k += 2;
      }
    };
    var es = find(/^EQUITY SECTORS/), bs = find(/^BOND SECTORS/, es + 1), ae = find(/^AVG\.?\s*DURATION|^\d+Y \d+M \d+D/, bs + 1);
    if(es >= 0) readSectors(es + 1, bs > 0 ? bs : Math.min(lines.length, es + 20), A.sectors);
    if(bs >= 0) readSectors(bs + 1, ae > 0 ? ae : Math.min(lines.length, bs + 12), A.bondSectors);
    if((m = /^EQUITY SECTORS\s*·\s*([\d.]+)%/m.exec(flat))) A.equityPct = propNum(m[1]);
    if((m = /^(\d+Y \d+M \d+D)\s+(\d+Y \d+M \d+D)$/m.exec(flat))){ A.duration = A.duration || m[1]; A.maturity = A.maturity || m[2]; }
    /* regions: cells in threes, name / portfolio % / benchmark %, two groups to a line */
    var rg = find(/^Regional Exposure/), rgEnd = find(/^Diversification|^Page /, rg + 1);
    var rCols = [[], []];
    if(rg >= 0) for(i = rg + 1; i < (rgEnd > 0 ? rgEnd : Math.min(lines.length, rg + 30)); i++){
      var c = lines[i].c; for(var g = 0; g + 2 < c.length; g += 3) if(!/\d/.test(c[g]) && /^[\d.]+%$/.test(c[g + 1]) && /^[\d.]+%$/.test(c[g + 2])) rCols[g ? 1 : 0].push({name:c[g], pct:propNum(c[g + 1]), bench:propNum(c[g + 2]), sub:/^(United States|Canada|Europe Emerging|Eurozone|Ex-Eurozone|United Kingdom|Asia Developed|Asia Emerging|Japan)$/.test(c[g])});
    }
    A.regions = rCols[0].concat(rCols[1]);   // the report lays the regions out in two columns, most concentrated first
    /* diversification */
    if((m = /reduced its Risk(?:[^\n]*\n)?\s*Number by (\d+) points?, from (\d+) to (\d+)/.exec(flat))) A.diversification = {points:+m[1], from:+m[2], to:+m[3]};
    if((m = /captures ([\d.]+)% of the[\s\S]{0,80}?upside and ([\d.]+)% of its potential downside/.exec(flat))){ A.capture = {up:propNum(m[1]), down:propNum(m[2])}; }
    /* stock intersection: the aggregate single-stock positions */
    lines.forEach(function(L){ var im = /^(\d{1,2}) ([A-Z][A-Z0-9.]{0,6}) · (.+?)\s+([\d.]+)%\s+(-?\$[\d,]+)$/.exec(L.t); if(im) A.intersection.push({riskNumber:+im[1], ticker:im[2], name:im[3], pctEquities:propNum(im[4]), value:propMoney(im[5])}); });
    /* size and style */
    var ss = find(/^MARKET CAP\s+PORTFOLIO\s+BENCHMARK/);
    if(ss >= 0) for(i = ss + 1; i < Math.min(lines.length, ss + 14); i++){
      var cc = lines[i].c; if(cc.length < 3) break;
      if(/^(Large|Mid|Small) Cap$/.test(cc[0])) A.cap.push({name:cc[0], pct:propNum(cc[1]), bench:propNum(cc[2])});
      if(cc.length >= 6 && /^(Value|Blend|Growth)$/.test(cc[3])) A.style.push({name:cc[3], pct:propNum(cc[4]), bench:propNum(cc[5])});
    }
    return A;
  }
  /* what the reading adds up to: by type, by risk band, the largest positions, cash and annuities */
  function propDerived(A){
    var D = {byType:[], byRisk:[], largest:[], cash:0, annuity:0, singleStock:0, holdings:0, accounts:A.accounts.length, total:0};
    var types = {}, bands = [['1–20', 1, 20], ['21–40', 21, 40], ['41–60', 41, 60], ['61–80', 61, 80], ['81–99', 81, 99]], bandAmt = {}, unk = 0, pos = {};
    var isAnnuity = function(acct){ return /annuity|MYGA|index|structured|buffer/i.test(acct.name); };
    A.accounts.forEach(function(a){
      D.total += a.total || 0;
      a.holdings.forEach(function(h){
        D.holdings++;
        var cashLike = h.type === 'MM' || /^Cash/i.test(h.name), ann = isAnnuity(a);
        var ty = ann ? 'Annuity contracts' : cashLike ? 'Cash & money market' : h.type === 'ETF' ? 'ETFs' : h.type === 'Stock' ? 'Single stocks' : h.type === 'Fund' ? 'Mutual funds' : h.type === 'Bond' || h.type === 'CD' ? 'Bonds & CDs' : 'Other';
        types[ty] = (types[ty] || 0) + h.amount;
        if(cashLike && !ann) D.cash += h.amount;
        if(ann) D.annuity += h.amount;
        if(h.type === 'Stock') D.singleStock += h.amount;
        if(h.riskNumber != null){ var b = bands.filter(function(x){ return h.riskNumber >= x[1] && h.riskNumber <= x[2]; })[0]; if(b) bandAmt[b[0]] = (bandAmt[b[0]] || 0) + h.amount; } else unk += h.amount;
        var key = h.ticker || h.name; if(!pos[key]) pos[key] = {name:h.ticker ? h.ticker + ' · ' + h.name : h.name, amount:0, riskNumber:h.riskNumber, accounts:0, acct:a.name}; pos[key].amount += h.amount; pos[key].accounts++; if(pos[key].acct !== a.name) pos[key].acct = null;
      });
    });
    var tot = D.total || A.value || 1;
    D.byType = Object.keys(types).map(function(k){ return {name:k, amount:types[k], pct:types[k] / tot * 100}; }).sort(function(a, b){ return b.amount - a.amount; });
    D.byRisk = bands.map(function(b){ return {band:b[0], amount:bandAmt[b[0]] || 0, pct:(bandAmt[b[0]] || 0) / tot * 100}; });
    if(unk > 0.5) D.byRisk.push({band:'Not rated', amount:unk, pct:unk / tot * 100});
    D.largest = Object.keys(pos).map(function(k){ return pos[k]; }).filter(function(p){ return !/money market|^cash/i.test(p.name); }).sort(function(a, b){ return b.amount - a.amount; }).slice(0, 10).map(function(p){ p.pct = p.amount / tot * 100; return p; });
    D.top1 = D.largest[0] || null;
    D.top5Pct = D.largest.slice(0, 5).reduce(function(a, p){ return a + p.pct; }, 0);
    D.aggressive = D.byRisk.filter(function(b){ return b.band === '61–80' || b.band === '81–99'; }).reduce(function(a, b){ return a + b.pct; }, 0);
    D.conservative = D.byRisk.filter(function(b){ return b.band === '1–20'; }).reduce(function(a, b){ return a + b.pct; }, 0);
    return D;
  }
  var pfPct = function(v, signed, d){ if(v == null || !isFinite(v)) return '—'; var k = d == null ? 1 : d; return (signed && v > 0 ? '+' : '') + v.toFixed(k) + '%'; };
  var pfMoneyS = function(v){ if(v == null || !isFinite(v)) return '—'; return (v < 0 ? '−' : v > 0 ? '+' : '') + money(Math.abs(v)); };
  /* the two readings in the page's own words, used when Claude is not there to write them */
  function propSummaries(A, D){
    var alloc = function(k){ var x = (A.allocation || []).filter(function(a){ return a.cls === k; })[0]; return x ? x.pct : null; };
    var s1 = [], s2 = [];
    s1.push((A.value ? money(A.value) : 'The portfolio') + ' across ' + (A.accountCount || D.accounts) + ' accounts and ' + D.holdings + ' holdings' + (A.date ? ', as captured on ' + A.date : '') + '.');
    if(A.allocation) s1.push('Nitrogen classifies it as ' + (A.allocation.map(function(a){ return pfPct(a.pct) + ' ' + a.cls.toLowerCase(); }).join(', ')) + (alloc('Other') > 20 ? ' — the “other” share is the index-linked annuity segments, which Nitrogen models through proxy funds.' : '.'));
    if(D.annuity > 0.5) s1.push(money(D.annuity) + ' (' + pfPct(D.annuity / (D.total || 1) * 100) + ') sits in annuity contracts' + (D.cash > 0.5 ? ' and ' + money(D.cash) + ' (' + pfPct(D.cash / (D.total || 1) * 100) + ') in cash and money market' : '') + '.');
    else if(D.cash > 0.5) s1.push(money(D.cash) + ' (' + pfPct(D.cash / (D.total || 1) * 100) + ') sits in cash and money market.');
    if(D.top1) s1.push('The largest position is ' + D.top1.name + (D.top1.acct ? ' in ' + D.top1.acct : '') + ' at ' + pfPct(D.top1.pct) + ' of the portfolio; the five largest make up ' + pfPct(D.top5Pct) + '.');
    if(D.singleStock > 0.5) s1.push('Single stocks account for ' + money(D.singleStock) + (A.intersection.length ? ', led by ' + A.intersection.slice(0, 3).map(function(x){ return x.ticker + ' (' + pfPct(x.pctEquities) + ' of equities)'; }).join(', ') : '') + '.');
    if(A.costs) s1.push('Total cost runs ' + pfPct(A.costs.totalPct, false, 2) + ' a year (' + money(A.costs.total) + '): expense ratios ' + pfPct(A.costs.expense, false, 2) + ', tax drag ' + pfPct(A.costs.taxDrag, false, 2) + (A.costs.advisory != null ? ', advisory fees ' + pfPct(A.costs.advisory, false, 2) : '') + (A.dividend != null ? '; the annual dividend yield is ' + pfPct(A.dividend, false, 2) : '') + '.');
    if(A.clientRiskNumber != null) s2.push('The household’s Risk Number is ' + A.clientRiskNumber + (A.clientRange ? ': comfortable risking ' + pfPct(A.clientRange.down, false, 2) + ' (' + pfMoneyS(A.clientRange.downDollars) + ') over six months for the chance of ' + pfPct(A.clientRange.up, true, 2) + ' (' + pfMoneyS(A.clientRange.upDollars) + ')' : '') + '.');
    if(A.riskNumber != null){
      var d = A.clientRiskNumber != null ? A.riskNumber - A.clientRiskNumber : null;
      s2.push('The portfolio as held is a ' + A.riskNumber + (d == null ? '' : d === 0 ? ' — in line with the household' : ' — ' + Math.abs(d) + ' point' + (Math.abs(d) === 1 ? '' : 's') + (d > 0 ? ' more' : ' less') + ' risk than the household is comfortable with' + (Math.abs(d) <= 5 ? ', close to aligned' : Math.abs(d) <= 15 ? ', a gap worth discussing' : ', well outside the comfort zone')) + (A.range ? '; its six-month 95% range is ' + pfPct(A.range.down, false, 2) + ' to ' + pfPct(A.range.up, true, 2) + ' (' + pfMoneyS(A.range.downDollars) + ' to ' + pfMoneyS(A.range.upDollars) + ')' : '') + '.');
    }
    if(D.aggressive > 0.5 || D.conservative > 0.5) s2.push('By holding, ' + pfPct(D.aggressive) + ' of the money carries a Risk Number above 60 and ' + pfPct(D.conservative) + ' sits at 20 or below.');
    if(A.gpa != null) s2.push('GPA ' + A.gpa.toFixed(1) + (A.benchGpa != null && A.benchmark ? ' against ' + A.benchGpa.toFixed(1) + ' for the ' + A.benchmark.name + ' benchmark' : '') + (A.perf.sharpe ? '; Sharpe ratio ' + A.perf.sharpe.p + (A.perf.sharpe.b != null ? ' vs ' + A.perf.sharpe.b : '') : '') + (A.perf.stdev ? ', standard deviation ' + pfPct(A.perf.stdev.p, false, 2) + (A.perf.stdev.b != null ? ' vs ' + pfPct(A.perf.stdev.b, false, 2) : '') : '') + '.');
    if(A.stress.length){
      var worst = A.stress.slice().sort(function(a, b){ return a.pct - b.pct; })[0];
      s2.push('Stress tests: ' + A.stress.map(function(t){ return t.name + ' ' + pfPct(t.pct, true) + (t.benchPct != null ? ' (' + (t.benchmark || 'benchmark') + ' ' + pfPct(t.benchPct, true) + ')' : ''); }).join('; ') + '. The worst case is ' + worst.name + ' at ' + pfMoneyS(worst.dollars) + '.');
    }
    if(A.diversification) s2.push('Diversification takes ' + A.diversification.points + ' points off the Risk Number (' + A.diversification.from + ' to ' + A.diversification.to + ')' + (A.capture ? '; the portfolio captures ' + pfPct(A.capture.up, false, 2) + ' of the benchmark’s upside and ' + pfPct(A.capture.down, false, 2) + ' of its downside' : '') + '.');
    return {holdings:s1.join(' '), risk:s2.join(' ')};
  }
  function propPrompt(A, D){
    var slim = JSON.parse(JSON.stringify(A)); slim.accounts = A.accounts.map(function(a){ return {name:a.name, riskNumber:a.riskNumber, total:a.total, gpa:a.gpa, holdings:a.holdings.map(function(h){ return {n:(h.ticker ? h.ticker + ' ' : '') + h.name, type:h.type, amt:Math.round(h.amount), pct:h.pctPortfolio, risk:h.riskNumber, yield:h.yield, range:h.range}; })}; });
    return 'You are reading the figures a financial advisor’s software parsed from a Nitrogen Investment Portfolio Proposal (the client’s CURRENT portfolio). '
      + 'Return ONLY a JSON object {"holdings": string, "risk": string}. "holdings": three to five plain sentences an advisor could read aloud summarising what the money is invested in — the accounts and their size, the asset classification, how much sits in cash, annuities and single stocks, the largest positions and concentration, and what it costs. '
      + '"risk": three to five plain sentences assessing the risk — the household’s Risk Number and comfort zone against the portfolio’s Risk Number and its 95% six-month range, what the holdings’ own Risk Numbers show, the stress tests against the benchmark, GPA and the performance statistics, and diversification. '
      + 'Use only the figures given; do not invent any. Say "annuity" for annuity contracts. No vendor name other than Nitrogen. No recommendations.\n\nFIGURES:\n' + JSON.stringify(slim) + '\nDERIVED:\n' + JSON.stringify(D);
  }
  function propAnalyze(pages, text, name){
    var msg = $('pfMsg'), A = propParse(pages), D = propDerived(A);
    var finish = function(S, src){
      A.summary = S; portfolio = {name:name || (portfolio && portfolio.name) || 'Nitrogen portfolio proposal', text:text.slice(0, 200000), analysis:A, src:src, at:new Date().toISOString()};
      renderPortfolio(); $('caseJson').value = caseData();
    };
    var found = A.accounts.length ? A.accounts.length + ' account' + (A.accounts.length === 1 ? '' : 's') + ', ' + D.holdings + ' holdings' : 'no holdings table';
    if(!A.accounts.length && A.riskNumber == null && !A.stress.length){ finish(propSummaries(A, D), 'text'); msg.textContent = 'Nothing recognisable was found — is this the Investment Portfolio Proposal from Nitrogen? Check the text below.'; return; }
    if(!sampleFn){ finish(propSummaries(A, D), 'text'); msg.textContent = 'Read from the report: ' + found + '.'; return; }
    msg.textContent = 'Read from the report: ' + found + '. Asking Claude for the summary…';
    finish(propSummaries(A, D), 'text');
    $('pfAnalyze').disabled = true;
    sampleFn.json(propPrompt(A, D), {cache:false})
      .then(function(J){
        if(!J || typeof J !== 'object' || typeof J.holdings !== 'string' || typeof J.risk !== 'string') throw {code:'invalid_json'};
        finish({holdings:J.holdings, risk:J.risk}, 'claude'); msg.textContent = 'Read from the report: ' + found + '. Summaries written by Claude from the figures — check them against the PDF.';
      })
      .catch(function(e){
        var code = (e && e.code) || 'upstream_error';
        if(code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') sampleFn = null;
        msg.textContent = 'Read from the report: ' + found + '.' + (code === 'rate_limited' ? ' Claude is busy — the page’s own summary is shown; press Read the text below to try again.' : '');
      })
      .then(function(){ $('pfAnalyze').disabled = false; });
  }
  function propFile(file){
    var msg = $('pfMsg'); if(!file) return;
    msg.textContent = 'Reading ' + file.name + '…';
    var isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    if(isPdf){
      file.arrayBuffer().then(function(buf){ return pdfLayoutText(new Uint8Array(buf)); })
        .then(function(R){
          if(!R.text || R.text.replace(/[-\s]|page \d+/g, '').length < 40){ msg.textContent = 'No readable text was found in ' + file.name + ' — the PDF may be scanned or image-only. Paste the report text below instead.'; return; }
          var text = R.text.split('\n').filter(function(ln){ return !/^Page \d+ \/ \d+|^Prepared for .+ on [A-Z]|^\u00a9 \d{4} Nitrogen|^provided by your financial|^constitute an offer|^from the use of this|^required by SEC Rule/.test(ln); }).join('\n');   // the running footers and the Nitrogen disclaimer, repeated on every page, are left out of the text kept
          $('pfText').value = text; propAnalyze(R.pages, text, file.name);
        })
        .catch(function(e){ msg.textContent = 'The PDF could not be read here (' + (e && e.message ? e.message : 'unknown error') + '). Paste the report text below instead.'; });
    } else {
      file.text().then(function(t){ $('pfText').value = t; propAnalyze(propPagesFromText(t), t, file.name); });
    }
  }
  function renderPortfolio(){
    var box = $('pfOut'); if(!box) return;
    if(!portfolio){ box.innerHTML = ''; $('pfClear').hidden = true; return; }
    $('pfClear').hidden = false;
    var A = portfolio.analysis, D = propDerived(A), S = A.summary || propSummaries(A, D);
    var d = A.clientRiskNumber != null && A.riskNumber != null ? A.riskNumber - A.clientRiskNumber : null;
    var alignCls = d == null ? '' : Math.abs(d) <= 5 ? 'var(--st-ok)' : Math.abs(d) <= 15 ? 'var(--st-caution)' : 'var(--st-alert)';
    var tiles = '<div class="tax-tiles">'
      + '<div><dt>Household Risk Number</dt><dd>' + (A.clientRiskNumber != null ? A.clientRiskNumber : '—') + '</dd><small>' + (A.clientRange ? pfPct(A.clientRange.down, false, 2) + ' to ' + pfPct(A.clientRange.up, true, 2) + ' over six months' : A.questionnaireDate ? 'questionnaire ' + esc(A.questionnaireDate) : 'from the questionnaire') + '</small></div>'
      + '<div><dt>Portfolio Risk Number</dt><dd' + (alignCls ? ' style="color:' + alignCls + '"' : '') + '>' + (A.riskNumber != null ? A.riskNumber : '—') + '</dd><small>' + (d == null ? 'the portfolio as held' : d === 0 ? 'matches the household' : (d > 0 ? '+' : '−') + Math.abs(d) + ' point' + (Math.abs(d) === 1 ? '' : 's') + ' against the household') + (A.range ? ' · ' + pfPct(A.range.down, false, 2) + ' to ' + pfPct(A.range.up, true, 2) : '') + '</small></div>'
      + '<div><dt>Portfolio value</dt><dd>' + (A.value ? money(A.value) : D.total ? money(D.total) : '—') + '</dd><small>' + (A.accountCount || D.accounts) + ' accounts · ' + D.holdings + ' holdings' + (A.date ? ' · ' + esc(A.date) : '') + '</small></div>'
      + '<div><dt>GPA</dt><dd>' + (A.gpa != null ? A.gpa.toFixed(1) : '—') + '</dd><small>' + (A.benchGpa != null && A.benchmark ? esc(A.benchmark.name) + ' benchmark ' + A.benchGpa.toFixed(1) : 'risk-adjusted return, 0 to 4.3') + '</small></div>'
      + '<div><dt>Cost</dt><dd>' + (A.costs ? pfPct(A.costs.totalPct, false, 2) : '—') + '</dd><small>' + (A.costs ? money(A.costs.total) + ' a year · expenses ' + pfPct(A.costs.expense, false, 2) + ', tax drag ' + pfPct(A.costs.taxDrag, false, 2) : 'total annual cost') + (A.dividend != null ? ' · dividend ' + pfPct(A.dividend, false, 2) : '') + '</small></div>'
      + '</div>';
    var reading = '<div class="pf-read"><div><h4>The holdings</h4><p>' + esc(S.holdings || '—') + '</p></div><div><h4>The risk assessment</h4><p>' + esc(S.risk || '—') + '</p></div></div>';
    var bar = A.allocation && A.allocation.length ? '<div class="inc-title gap">Asset classification<small>' + (A.benchAllocation ? 'the portfolio, with the ' + esc(A.benchmark ? A.benchmark.name : 'benchmark') + ' benchmark beneath' : 'as Nitrogen classifies the holdings') + '</small></div>'
      + '<div class="pf-bar">' + A.allocation.map(function(a){ return '<i class="c-' + a.cls.toLowerCase() + '" style="width:' + Math.max(0, a.pct) + '%" title="' + esc(a.cls) + ' ' + pfPct(a.pct) + '"></i>'; }).join('') + '</div>'
      + '<div class="pf-key">' + A.allocation.map(function(a){ var b = (A.benchAllocation || []).filter(function(x){ return x.cls === a.cls; })[0]; return '<span><i class="c-' + a.cls.toLowerCase() + '"></i>' + esc(a.cls) + ' <b>' + pfPct(a.pct) + '</b>' + (b ? ' <small>vs ' + pfPct(b.pct) + '</small>' : '') + '</span>'; }).join('') + '</div>' : '';
    var mix = D.byType.length ? '<div class="pf-two"><div><div class="inc-title gap">By holding type</div><table class="pj-table" style="min-width:300px"><thead><tr><th>Type</th><th class="num">Amount</th><th class="num">Share</th></tr></thead><tbody>'
      + D.byType.map(function(t){ return '<tr><td>' + esc(t.name) + '</td><td class="num">' + money(t.amount) + '</td><td class="num">' + pfPct(t.pct) + '</td></tr>'; }).join('') + '</tbody></table></div>'
      + '<div><div class="inc-title gap">By Risk Number<small>of each holding</small></div><table class="pj-table" style="min-width:300px"><thead><tr><th>Risk Number</th><th class="num">Amount</th><th class="num">Share</th></tr></thead><tbody>'
      + D.byRisk.map(function(t){ return '<tr><td>' + esc(t.band) + '</td><td class="num">' + money(t.amount) + '</td><td class="num">' + pfPct(t.pct) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' : '';
    var largest = D.largest.length ? '<div class="inc-title gap">Largest positions<small>combined across accounts, cash aside</small></div><div class="tbl-wrap" style="margin-top:8px"><table class="pj-table" style="min-width:560px"><thead><tr><th>Holding</th><th class="num">Amount</th><th class="num">Of portfolio</th><th class="num">Risk Number</th><th class="num">Accounts</th></tr></thead><tbody>'
      + D.largest.map(function(p){ return '<tr><td>' + esc(p.name) + (p.acct ? ' <small style="color:var(--muted)">' + esc(p.acct) + '</small>' : '') + '</td><td class="num">' + money(p.amount) + '</td><td class="num">' + pfPct(p.pct) + '</td><td class="num">' + (p.riskNumber != null ? p.riskNumber : '—') + '</td><td class="num">' + p.accounts + '</td></tr>'; }).join('') + '</tbody></table></div>' : '';
    var inter = A.intersection.length ? '<div class="inc-title gap">Single-stock exposure<small>Nitrogen’s stock intersection: held directly and through funds</small></div><div class="tbl-wrap" style="margin-top:8px"><table class="pj-table" style="min-width:520px"><thead><tr><th>Stock</th><th class="num">Risk Number</th><th class="num">Of equities</th><th class="num">Market value</th></tr></thead><tbody>'
      + A.intersection.map(function(x){ return '<tr><td>' + esc(x.ticker + ' · ' + x.name) + '</td><td class="num">' + x.riskNumber + '</td><td class="num">' + pfPct(x.pctEquities) + '</td><td class="num">' + money(x.value) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '';
    var accts = A.accounts.length ? '<div class="inc-title gap">Holdings by account<small>every account in the proposal, with its holdings</small></div><div class="tbl-scroll" style="margin-top:8px"><table class="pj-table pf-hold"><thead><tr><th>Account / holding</th><th>Type</th><th class="num">Amount</th><th class="num">Of account</th><th class="num">Of portfolio</th><th class="num">SEC yield</th><th class="num">Risk</th><th class="num">GPA</th><th class="num">95% range, 6 months</th></tr></thead><tbody>'
      + A.accounts.map(function(a){
          return '<tr class="grp"><td><b>' + esc(a.name) + '</b></td><td></td><td class="num"><b>' + money(a.total) + '</b></td><td></td><td class="num">' + (A.value ? pfPct(a.total / A.value * 100) : '') + '</td><td></td><td class="num"><b>' + a.riskNumber + '</b></td><td class="num">' + (a.gpa != null ? a.gpa.toFixed(1) : '') + '</td><td></td></tr>'
            + a.holdings.map(function(h){ return '<tr><td class="pf-h">' + (h.ticker ? '<b>' + esc(h.ticker) + '</b> · ' : '') + esc(h.name) + (h.proxy ? ' <small>proxy ' + esc(h.proxy) + '</small>' : '') + '</td><td>' + esc(h.type || '') + '</td><td class="num">' + money(h.amount) + '</td><td class="num">' + pfPct(h.pctAccount) + '</td><td class="num">' + pfPct(h.pctPortfolio, false, 2) + '</td><td class="num">' + (h.yield != null ? pfPct(h.yield, false, 2) : '—') + '</td><td class="num">' + (h.riskNumber != null ? h.riskNumber : '—') + '</td><td class="num">' + (h.gpa != null ? h.gpa.toFixed(1) : '—') + '</td><td class="num">' + pfPct(h.range.down, true, 2) + ' | ' + pfPct(h.range.up, true, 2) + '</td></tr>'; }).join('');
        }).join('') + '</tbody></table></div>' : '';
    var stress = A.stress.length ? '<div class="inc-title gap">Stress tests<small>how the portfolio as held would have fared, against the index Nitrogen pairs with each event</small></div><div class="tbl-wrap" style="margin-top:8px"><table class="pj-table" style="min-width:620px"><thead><tr><th>If it happened again</th><th>Period</th><th class="num">Portfolio</th><th class="num">Dollars</th><th>Benchmark</th><th class="num">Benchmark</th></tr></thead><tbody>'
      + A.stress.map(function(t){ return '<tr><td>' + esc(t.name) + '</td><td>' + esc(t.period || '') + '</td><td class="num"' + (t.pct < 0 ? ' style="color:var(--st-alert)"' : '') + '>' + pfPct(t.pct, true, 2) + '</td><td class="num">' + pfMoneyS(t.dollars) + '</td><td>' + esc(t.benchmark || '') + (t.extra ? ' / ' + esc(t.extra.name) : '') + '</td><td class="num">' + pfPct(t.benchPct, true, 2) + (t.extra && t.extra.pct != null ? ' / ' + pfPct(t.extra.pct, true, 2) : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '';
    var PERF = [['beta', 'Beta'], ['r2', 'R²'], ['sharpe', 'Sharpe ratio'], ['sortino', 'Sortino ratio'], ['stdev', 'Standard deviation', '%'], ['drawdown', 'Drawdown', '%'], ['totalReturn', 'Total return', '%'], ['modeled', 'Modeled performance', '%'], ['midpoint', 'Annual range midpoint', '%'], ['romad', 'Return over max drawdown'], ['gainToPain', 'Gain to pain'], ['illustrated', 'Illustrated', '%']];
    var perfRows = PERF.filter(function(k){ return A.perf[k[0]]; });
    var perf = perfRows.length || A.trailing ? '<div class="pf-two"><div><div class="inc-title gap">Performance statistics<small>' + esc(A.perfPeriod || 'three years') + (A.benchmark ? ' · benchmark ' + esc(A.benchmark.name) : '') + '</small></div><table class="pj-table" style="min-width:320px"><thead><tr><th>Statistic</th><th class="num">Portfolio</th><th class="num">Benchmark</th></tr></thead><tbody>'
      + perfRows.map(function(k){ var v = A.perf[k[0]], f = function(x){ return x == null ? '—' : k[2] ? pfPct(x, false, 2) : String(x); }; return '<tr><td>' + k[1] + '</td><td class="num">' + f(v.p) + '</td><td class="num">' + f(v.b) + '</td></tr>'; }).join('') + '</tbody></table></div>'
      + (A.trailing ? '<div><div class="inc-title gap">Trailing returns<small>portfolio ' + pfPct(A.trailing.portfolio.illustrated, false, 1) + ' illustrated</small></div><table class="pj-table" style="min-width:320px"><thead><tr><th>Period</th><th class="num">Portfolio</th><th class="num">Benchmark</th></tr></thead><tbody>'
        + A.trailing.periods.map(function(p, k){ return '<tr><td>' + esc(p.replace(/\s+/g, ' ').toLowerCase()) + '</td><td class="num">' + pfPct(A.trailing.portfolio.values[k], true, 2) + '</td><td class="num">' + (A.trailing.benchmark ? pfPct(A.trailing.benchmark.values[k], true, 2) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div></div>') + '</div>' : '';
    var threeCol = function(title, sub, rows, nameHead){ return rows.length ? '<div><div class="inc-title gap">' + title + (sub ? '<small>' + sub + '</small>' : '') + '</div><table class="pj-table" style="min-width:260px"><thead><tr><th>' + nameHead + '</th><th class="num">Portfolio</th><th class="num">Benchmark</th></tr></thead><tbody>' + rows.map(function(r){ return '<tr><td' + (r.sub ? ' style="padding-left:22px;color:var(--muted)"' : '') + '>' + esc(r.name) + '</td><td class="num">' + pfPct(r.pct, false, 2) + '</td><td class="num">' + pfPct(r.bench, false, 2) + '</td></tr>'; }).join('') + '</tbody></table></div>' : ''; };
    var sect = (A.sectors.length || A.regions.length || A.cap.length) ? '<div class="pf-three">' + threeCol('Equity sectors', A.equityPct != null ? pfPct(A.equityPct) + ' of the portfolio in equities' : '', A.sectors, 'Sector') + threeCol('Regions', '', A.regions, 'Region') + threeCol('Size and style', A.duration ? 'bonds: duration ' + esc(A.duration) + ', maturity ' + esc(A.maturity || '') : '', A.cap.concat(A.style), 'Equities') + '</div>' : '';
    var div = A.diversification || A.capture ? '<p class="hint" style="margin-top:12px">' + (A.diversification ? 'Diversification: the relationships between the holdings take <b>' + A.diversification.points + ' points</b> off the Risk Number, from ' + A.diversification.from + ' to ' + A.diversification.to + '. ' : '') + (A.capture ? 'Against the ' + esc(A.benchmark ? A.benchmark.name : 'benchmark') + ', the portfolio captures <b>' + pfPct(A.capture.up, false, 2) + '</b> of the upside and <b>' + pfPct(A.capture.down, false, 2) + '</b> of the downside.' : '') + '</p>' : '';
    var head = '<p class="hint" style="margin:0 0 6px"><b>' + esc(portfolio.name) + '</b>' + (A.preparedFor ? ' · prepared for ' + esc(A.preparedFor) : '') + (A.date ? ' on ' + esc(A.date) : '') + ' · ' + (portfolio.src === 'claude' ? 'figures read from the report, summaries written by Claude' : 'read from the report by its labels') + '</p>';
    box.innerHTML = head + tiles + reading + bar + mix + largest + inter + accts + stress + perf + sect + div;
  }
