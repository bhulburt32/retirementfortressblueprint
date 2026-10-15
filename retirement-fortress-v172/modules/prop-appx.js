    /* 30b. appendix — the investment portfolio proposal from section 16, in full */
    if(portfolio && portfolio.analysis && portfolio.analysis.accounts && portfolio.analysis.accounts.length){
      (function(){
        var A = portfolio.analysis, D = propDerived(A), EY = 'Appendix · your investment portfolio';
        var p1 = function(v){ return v == null ? dash : v.toFixed(1) + '%'; }, p2 = function(v){ return v == null ? dash : v.toFixed(2) + '%'; }, p2s = function(v){ return v == null ? dash : (v > 0 ? '+' : '') + v.toFixed(2) + '%'; };
        var sm$ = function(v){ return v == null ? dash : (v < 0 ? '−' : v > 0 ? '+' : '') + money(Math.abs(v)); };
        /* accounts and holdings, sixteen rows to a page, an account never split from its first holding */
        var rows = [];
        A.accounts.forEach(function(a){
          rows.push({grp:true, cells:[{t:a.name, b:true}, '', {t:money(a.total), b:true}, '', A.value ? p1(a.total / A.value * 100) : '', '', {t:String(a.riskNumber), b:true}, a.gpa != null ? a.gpa.toFixed(1) : '', '']});
          a.holdings.forEach(function(h){ rows.push({cells:[(h.ticker ? h.ticker + ' · ' : '') + h.name, h.type || '', money(h.amount), p1(h.pctAccount), p2(h.pctPortfolio), h.yield != null ? p2(h.yield) : dash, h.riskNumber != null ? String(h.riskNumber) : dash, h.gpa != null ? h.gpa.toFixed(1) : dash, p2s(h.range.down) + ' | ' + p2s(h.range.up)]}); });
        });
        var PER = 16, pagesR = [], cur = [];
        rows.forEach(function(r, k){
          if(cur.length >= PER || (r.grp && cur.length >= PER - 1)){ pagesR.push(cur); cur = []; }
          cur.push(r);
        });
        if(cur.length) pagesR.push(cur);
        var head = [{t:'Account / holding'}, {t:'Type'}, {t:'Amount', align:'r'}, {t:'Of account', align:'r'}, {t:'Of portfolio', align:'r'}, {t:'SEC yield', align:'r'}, {t:'Risk', align:'r'}, {t:'GPA', align:'r'}, {t:'95% range, six months', align:'r'}];
        pagesR.forEach(function(chunk, pi){
          var s = doc.slide(); page++;
          frame(s, EY, 'Accounts and Holdings' + (pagesR.length > 1 ? ' (' + (pi + 1) + ' of ' + pagesR.length + ')' : ''), false);
          dkHtmlTable(s, 0.9, 1.95, 18.2, 7.45, head, chunk.map(function(r){ return {cls:r.grp ? 'grp' : '', cells:r.cells.map(function(c, ci){ return (c !== null && typeof c === 'object') ? c : {t:c, html:ci === 0 && !r.grp ? '<span style="padding-left:' + hIn(0.25) + '">' + hX(c) + '</span>' : null}; })}; }), {tight:true});
          dkBody(s, 0.9, 9.45, 18.2, 0.65, 'Every account in the proposal with its holdings' + (A.date ? ', as captured on ' + A.date : '') + '. Risk is the 1–99 Risk Number of the account or holding; the six-month range is the 95% historical range.', {sz:16, color:DECK_C.muted});
        });
        /* stress tests and performance */
        (function(){
          var s = doc.slide(); page++;
          frame(s, EY, 'Stress Tests and Performance', false);
          var srows = A.stress.map(function(t){ return [t.name, t.period || '', {t:p2s(t.pct), color:t.pct < 0 ? DECK_C.red : DECK_C.navy}, sm$(t.dollars), (t.benchmark || '') + (t.extra ? ' / ' + t.extra.name : ''), p2s(t.benchPct) + (t.extra && t.extra.pct != null ? ' / ' + p2s(t.extra.pct) : '')]; });
          var y = 1.95;
          if(srows.length){ dkHtmlTable(s, 0.9, y, 18.2, 0.5 + srows.length * 0.42, [{t:'If it happened again'}, {t:'Period'}, {t:'Portfolio', align:'r'}, {t:'In dollars', align:'r'}, {t:'Benchmark'}, {t:'Benchmark', align:'r'}], srows); y += 0.5 + srows.length * 0.42 + 0.35; }
          var PERF = [['beta', 'Beta'], ['r2', 'R²'], ['sharpe', 'Sharpe ratio'], ['sortino', 'Sortino ratio'], ['stdev', 'Standard deviation', '%'], ['drawdown', 'Drawdown', '%'], ['totalReturn', 'Total return', '%'], ['midpoint', 'Annual range midpoint', '%']].filter(function(k){ return A.perf[k[0]]; });
          var prows = PERF.map(function(k){ var v = A.perf[k[0]], f = function(x){ return x == null ? dash : k[2] ? p2(x) : String(x); }; return [k[1], f(v.p), f(v.b)]; });
          var maxRows = Math.max(1, Math.floor((9.9 - y - 0.9) / 0.42));
          dkLabel(s, 0.9, y, 8.9, 'Statistics' + (A.perfPeriod ? ' · ' + A.perfPeriod.toLowerCase().replace(/\b[a-z]/g, function(c){ return c.toUpperCase(); }) : ''));
          if(prows.length) dkHtmlTable(s, 0.9, y + 0.45, 8.9, 0.5 + Math.min(maxRows, prows.length) * 0.42, [{t:'Statistic'}, {t:'Portfolio', align:'r'}, {t:(A.benchmark ? A.benchmark.name : 'Benchmark'), align:'r'}], prows.slice(0, maxRows));
          if(A.trailing){
            dkLabel(s, 10.2, y, 8.9, 'Trailing returns');
            var trows = A.trailing.periods.map(function(p, k){ return [p.replace(/\s+/g, ' ').toLowerCase().replace(/^\w/, function(c){ return c.toUpperCase(); }), p2s(A.trailing.portfolio.values[k]), A.trailing.benchmark ? p2s(A.trailing.benchmark.values[k]) : dash]; });
            dkHtmlTable(s, 10.2, y + 0.45, 8.9, 0.5 + Math.min(maxRows, trows.length) * 0.42, [{t:'Period'}, {t:'Portfolio', align:'r'}, {t:(A.benchmark ? A.benchmark.name : 'Benchmark'), align:'r'}], trows.slice(0, maxRows));
          }
        })();
        /* sectors, regions, size and style */
        if(A.sectors.length || A.regions.length || A.cap.length){
          var s = doc.slide(); page++;
          frame(s, EY, 'Sectors, Regions, Size and Style', false);
          var col = function(x, w, title, rows, nameHead, maxR){
            if(!rows.length) return;
            dkLabel(s, x, 1.95, w, title);
            dkHtmlTable(s, x, 2.4, w, 0.5 + Math.min(maxR, rows.length) * 0.42, [{t:nameHead}, {t:'Portfolio', align:'r'}, {t:'Benchmark', align:'r'}], rows.slice(0, maxR).map(function(r){ return [{t:r.name, html:r.sub ? '<span style="padding-left:' + hIn(0.25) + ';color:#' + DECK_C.muted + '">' + hX(r.name) + '</span>' : null}, p2(r.pct), p2(r.bench)]; }));
          };
          col(0.9, 5.7, 'Equity sectors' + (A.equityPct != null ? ' · ' + p1(A.equityPct) + ' of the portfolio' : ''), A.sectors, 'Sector', 16);
          col(7.15, 5.7, 'Regions', A.regions, 'Region', 16);
          col(13.4, 5.7, 'Size and style', A.cap.concat(A.style), 'Equities', 7);
          if(A.bondSectors.length){ dkLabel(s, 13.4, 5.95, 5.7, 'Bond sectors' + (A.duration ? ' · duration ' + A.duration : '')); dkHtmlTable(s, 13.4, 6.4, 5.7, 0.5 + Math.min(6, A.bondSectors.length) * 0.42, [{t:'Sector'}, {t:'Portfolio', align:'r'}, {t:'Benchmark', align:'r'}], A.bondSectors.slice(0, 6).map(function(r){ return [r.name, p2(r.pct), p2(r.bench)]; })); }
          if(A.diversification || A.capture) dkBody(s, 0.9, 9.3, 18.2, 0.6, (A.diversification ? 'Diversification takes ' + A.diversification.points + ' points off the Risk Number, from ' + A.diversification.from + ' to ' + A.diversification.to + '. ' : '') + (A.capture ? 'Against the ' + (A.benchmark ? A.benchmark.name : 'benchmark') + ', the portfolio captures ' + p2(A.capture.up) + ' of the upside and ' + p2(A.capture.down) + ' of the downside.' : ''), {sz:16, color:DECK_C.muted});
        }
        /* largest positions and single stocks */
        if(D.largest.length || A.intersection.length){
          var s2 = doc.slide(); page++;
          frame(s2, EY, 'Largest Positions and Single-Stock Exposure', false);
          if(D.largest.length){
            dkLabel(s2, 0.9, 1.95, 8.9, 'Largest positions · combined across accounts, cash aside');
            dkHtmlTable(s2, 0.9, 2.4, 8.9, 0.5 + Math.min(10, D.largest.length) * 0.5, [{t:'Holding'}, {t:'Amount', align:'r'}, {t:'Of portfolio', align:'r'}, {t:'Risk', align:'r'}], D.largest.slice(0, 10).map(function(p){ return [{t:p.name, html:hX(p.name) + (p.acct ? '<br><span style="color:#' + DECK_C.muted + '">' + hX(p.acct) + '</span>' : '')}, money(p.amount), p1(p.pct), p.riskNumber != null ? String(p.riskNumber) : dash]; }));
          }
          if(A.intersection.length){
            dkLabel(s2, 10.2, 1.95, 8.9, 'Single stocks · held directly and through funds');
            dkHtmlTable(s2, 10.2, 2.4, 8.9, 0.5 + Math.min(10, A.intersection.length) * 0.42, [{t:'Stock'}, {t:'Risk', align:'r'}, {t:'Of equities', align:'r'}, {t:'Market value', align:'r'}], A.intersection.slice(0, 10).map(function(x){ return [x.ticker + ' · ' + x.name, String(x.riskNumber), p1(x.pctEquities), money(x.value)]; }));
          }
        }
      })();
    }
