    /* 13b. the investment portfolio from section 16, on one page — when a proposal has been loaded */
    if(portfolio && portfolio.analysis && portfolio.analysis.accounts && portfolio.analysis.accounts.length){
      (function(){
        var A = portfolio.analysis, D = propDerived(A), S = A.summary || propSummaries(A, D), s = doc.slide(); page++;
        frame(s, '', 'Your Investment Portfolio Today');
        var clientWords = function(t){ return String(t || '').replace(/Nitrogen’s|Nitrogen's/g, 'the report’s').replace(/Nitrogen/g, 'the report').replace(/Riskalyze/g, 'the report'); };
        var firstN = function(t, n, max){ var parts = clientWords(t).split(/(?<=\.)\s+/), out = ''; for(var k = 0; k < parts.length && k < n; k++){ if((out + ' ' + parts[k]).length > max) break; out += (out ? ' ' + parts[k] : parts[k]); } return out || clientWords(t).slice(0, max); };
        var p1 = function(v){ return v == null ? dash : v.toFixed(1) + '%'; }, p2s = function(v){ return v == null ? dash : (v > 0 ? '+' : '') + v.toFixed(2) + '%'; };
        var d = (A.clientRiskNumber != null && A.riskNumber != null) ? A.riskNumber - A.clientRiskNumber : null;
        dkTile(s, 0.9, 1.95, 3.45, 1.9, 'Your Risk Number', A.clientRiskNumber != null ? String(A.clientRiskNumber) : dash, A.clientRange ? p2s(A.clientRange.down) + ' to ' + p2s(A.clientRange.up) + ' over six months' : 'Your comfort level, 1–99', {big:24});
        dkTile(s, 4.6, 1.95, 3.45, 1.9, 'Portfolio Risk Number', A.riskNumber != null ? String(A.riskNumber) : dash, d == null ? 'The portfolio as held' : d === 0 ? 'In line with your number' : Math.abs(d) + ' point' + (Math.abs(d) === 1 ? '' : 's') + (d > 0 ? ' more' : ' less') + ' risk than your number', {valueColor:d != null && Math.abs(d) > 5 ? DECK_C.red : DECK_C.navy, big:24});
        dkTile(s, 8.3, 1.95, 3.45, 1.9, 'Portfolio value', A.value ? money(A.value) : money(D.total), (A.accountCount || D.accounts) + ' accounts · ' + D.holdings + ' holdings', {big:22});
        dkTile(s, 12.0, 1.95, 3.45, 1.9, 'Risk-adjusted grade', A.gpa != null ? A.gpa.toFixed(1) : dash, A.benchGpa != null && A.benchmark ? 'Benchmark ' + A.benchmark.name + ': ' + A.benchGpa.toFixed(1) : 'GPA, 0 to 4.3', {big:24});
        dkTile(s, 15.7, 1.95, 3.4, 1.9, 'Annual cost', A.costs ? A.costs.totalPct.toFixed(2) + '%' : dash, A.costs ? money(A.costs.total) + ' a year · expenses ' + A.costs.expense.toFixed(2) + '%' : 'Expenses and tax drag', {big:24});
        dkLabel(s, 0.9, 4.1, 9, 'The holdings');
        dkBody(s, 0.9, 4.5, 8.9, 1.75, firstN(S.holdings, 4, 430));
        dkLabel(s, 10.2, 4.1, 9, 'The risk assessment');
        dkBody(s, 10.2, 4.5, 8.9, 1.75, firstN(S.risk, 4, 430));
        var y = 6.4;
        if(A.allocation && A.allocation.length){
          dkLabel(s, 0.9, y, 8.9, 'Asset classification');
          var CC = {Stocks:'C0632B', Bonds:'1F6FB2', Cash:'1F8A70', Other:'8B5CA6'};
          s.html(0.9, y + 0.45, 8.9, 0.4, '<div style="display:flex;height:100%;border-radius:4px;overflow:hidden;background:#' + DECK_C.panel + '">' + A.allocation.map(function(a){ return '<div style="width:' + Math.max(0, a.pct) + '%;height:100%;background:#' + (CC[a.cls] || DECK_C.muted) + '"></div>'; }).join('') + '</div>');
          s.text(0.9, y + 0.9, 8.9, 0.45, [{runs:A.allocation.reduce(function(acc, a, k){ if(k) acc.push({t:'    ', sz:16}); acc.push({t:'■ ', sz:16, color:CC[a.cls] || DECK_C.muted}); acc.push({t:a.cls + ' ' + p1(a.pct), sz:16, color:DECK_C.ink}); return acc; }, [])}], {valign:'middle'});
          dkHtmlTable(s, 0.9, y + 1.5, 8.9, 0.5 + Math.min(4, D.byType.length) * 0.42, [{t:'By holding type'}, {t:'Amount', align:'r'}, {t:'Share', align:'r'}], D.byType.slice(0, 4).map(function(t){ return [t.name, money(t.amount), p1(t.pct)]; }));
        }
        dkLabel(s, 10.2, y, 8.9, 'Stress tests');
        var srows = A.stress.slice(0, 6).map(function(t){ return [t.name, {t:p2s(t.pct), color:t.pct < 0 ? DECK_C.red : DECK_C.navy}, t.dollars != null ? (t.dollars < 0 ? '−' : '+') + money(Math.abs(t.dollars)) : dash, (t.benchmark || 'Benchmark') + ' ' + p2s(t.benchPct)]; });
        if(!srows.length) srows.push(['No stress tests in the report', dash, dash, dash]);
        dkHtmlTable(s, 10.2, y + 0.45, 8.9, 0.5 + srows.length * 0.42, [{t:'If it happened again'}, {t:'Portfolio', align:'r'}, {t:'In dollars', align:'r'}, {t:'Benchmark', align:'r'}], srows);
      })();
    }
