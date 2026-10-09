  /* The Social Security Planning Analysis: a separate client report built from the optimizer —
     cover, introduction and key terms, the inputs, the five strategies with their claiming events,
     the comparison charts and break-even ages, a year-by-year schedule per strategy, how to file,
     and what the analysis leaves out. Letter pages, printable from the browser. */
  function buildSsReport(){
    var i = readInputs(), S = ssoRun(i);
    if(!S) throw new Error('Enter a Primary Insurance Amount in section 04 first.');
    var people = S.people, R = S.results, couple = people.length === 2, cut = S.cut, today = S.today, p0 = people[0];
    var logo = 'data:image/png;base64,' + LOGO_PNG_B64;
    var client = (function(){ var c = (i.clientFirst || 'Client').trim(), s = couple ? (i.spouseFirst || 'Spouse').trim() : ''; return couple ? c + ' and ' + s + (i.clientLast ? ' ' + i.clientLast : '') : c + (i.clientLast ? ' ' + i.clientLast : ''); })();
    var advisor = (i.advisor || '').trim();
    var dateTxt = longDate(i.prepDate || todayISO());
    var E = esc, M = function(v){ return money(v); }, N = function(v){ return fmtN.format(Math.round(v)); };
    var pc = function(v){ return (v * 100).toFixed(1).replace(/\.0$/, '') + '%'; };
    var addM = function(m){ return new Date(today.getFullYear(), today.getMonth() + m, 1); };
    var ageAtJan1 = function(p, y){ if(p.dob){ var m = (y - p.dob.getFullYear()) * 12 - p.dob.getMonth(); if(1 < p.dob.getDate()) m--; return Math.floor(m / 12); } return Math.floor((p.ageNow + (y - today.getFullYear()) * 12 - today.getMonth()) / 12); };
    var title = function(r){ return ssoTitle(S, r); }, shortL = function(r, k){ return (k + 1) + '. ' + ssoShort(S, r); };
    /* yearly schedule for one strategy */
    function yearly(r){
      var rows = {};
      r.parts.forEach(function(row, t){
        var y = addM(t).getFullYear();
        if(!rows[y]) rows[y] = {y:y, per:people.map(function(){ return {own:0, sp:0, surv:0, last:0, first:null}; }), tot:0};
        row.forEach(function(c, k){ var q = rows[y].per[k]; q.own += c.own; q.sp += c.sp; q.surv += c.surv; var m = c.own + c.sp + c.surv; if(q.first === null) q.first = m; q.last = m; });
        rows[y].tot += row.reduce(function(a, c){ return a + c.own + c.sp + c.surv; }, 0);
      });
      var run = 0;
      return Object.keys(rows).map(function(k){ return rows[k]; }).sort(function(a, b){ return a.y - b.y; }).map(function(o){ run += o.tot; o.run = run; return o; });
    }
    function tableHTML(r){
      var ys = yearly(r), k0 = -1; ys.forEach(function(o, k){ if(k0 < 0 && o.tot > 0) k0 = k; }); if(k0 > 0) ys = ys.slice(k0);
      var hasSp = couple && people.some(function(p, k){ return r.excess[k].amt > 0; });
      var h = '<table class="yr"><thead><tr><th>Year</th>';
      people.forEach(function(p){ h += '<th class="grp" colspan="' + ((couple ? 2 : 1) + (hasSp ? 1 : 0) + 1) + '">' + E(p.name) + '</th>'; });
      h += '<th class="grp" colspan="2">Household</th></tr><tr><th></th>';
      people.forEach(function(){ h += '<th>Age</th><th>Own</th>' + (hasSp ? '<th>Spousal</th>' : '') + (couple ? '<th>Survivor</th>' : '') + '<th>Monthly</th>'; });
      h += '<th>Annual total</th><th>Cumulative</th></tr></thead><tbody>';
      ys.forEach(function(o){
        h += '<tr><td>' + o.y + '</td>';
        people.forEach(function(p, k){
          var q = o.per[k], age = ageAtJan1(p, o.y), alive = age * 12 < p.deathAge;
          var mo = (q.first !== null && Math.abs(q.first - q.last) > 0.5) ? N(q.first) + ' / ' + N(q.last) : N(q.last);
          h += '<td>' + (alive ? age : '—') + '</td><td>' + N(q.own) + '</td>' + (hasSp ? '<td>' + N(q.sp) + '</td>' : '') + (couple ? '<td>' + N(q.surv) + '</td>' : '') + '<td>' + mo + '</td>';
        });
        h += '<td>' + N(o.tot) + '</td><td>' + N(o.run) + '</td></tr>';
      });
      return h + '</tbody></table>';
    }
    function bars(labels, values, fmtv){
      var W = 680, H = 230, L = 60, Rr = 10, T = 20, B = 48, max = Math.max.apply(null, values) * 1.15 || 1, bw = (W - L - Rr) / values.length, g = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="bar">';
      for(var k = 0; k <= 4; k++){ var v = max * k / 4, y = T + (H - T - B) * (1 - v / max); g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y + '" y2="' + y + '" stroke="#E4E8EC"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" font-size="10" text-anchor="end" fill="#4B5B70">' + fmtv(v) + '</text>'; }
      values.forEach(function(v, k){ var x = L + bw * k + bw * 0.15, w = bw * 0.7, y = T + (H - T - B) * (1 - v / max); g += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (H - B - y) + '" fill="' + SSO_COLORS[k] + '" rx="2"/><text x="' + (x + w / 2) + '" y="' + (y - 5) + '" font-size="11" text-anchor="middle" font-weight="600" fill="#1E3062">' + fmtv(v) + '</text><text x="' + (x + w / 2) + '" y="' + (H - B + 14) + '" font-size="10" text-anchor="middle" fill="#4B5B70">' + E(labels[k]) + '</text>'; });
      return g + '</svg>';
    }
    function cumulative(){
      var W = 720, H = 300, L = 64, Rr = 16, T = 16, B = 36, len = Math.max.apply(null, R.map(function(r){ return r.series.length; })), maxY = Math.max.apply(null, R.map(function(r){ return r.cum; })) * 1.05;
      var x = function(t){ return L + (W - L - Rr) * t / (len - 1); }, y = function(v){ return T + (H - T - B) * (1 - v / maxY); }, svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';
      for(var g = 0; g <= 4; g++){ var v = maxY * g / 4; svg += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#E4E8EC"/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" font-size="11" fill="#4B5B70" text-anchor="end">' + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : '$' + Math.round(v / 1000) + 'k') + '</text>'; }
      for(var a = Math.ceil(p0.ageNow / 60) * 5; a * 12 <= p0.ageNow + len; a += 5){ var t = a * 12 - p0.ageNow; if(t < 0) continue; svg += '<text x="' + x(t) + '" y="' + (H - 12) + '" font-size="11" fill="#4B5B70" text-anchor="middle">' + a + '</text>'; }
      svg += '<text x="' + ((L + W - Rr) / 2) + '" y="' + (H - 1) + '" font-size="11" fill="#4B5B70" text-anchor="middle">' + E(p0.name) + '’s age</text>';
      R.forEach(function(r, k){ svg += '<polyline points="' + r.series.map(function(v, t){ return x(t).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ') + '" fill="none" stroke="' + SSO_COLORS[k] + '" stroke-width="' + (k === 0 ? 2.5 : 1.6) + '" stroke-opacity="' + (k === 0 ? 1 : 0.8) + '"/>'; });
      return svg + '</svg>';
    }
    var survChart = '';
    if(couple){
      var dIdx = (people[0].deathAge - people[0].ageNow) <= (people[1].deathAge - people[1].ageNow) ? 0 : 1, td = people[dIdx].deathAge - people[dIdx].ageNow, yFirst = addM(td).getFullYear() + 1;
      var vals = R.map(function(r){ var o = yearly(r).filter(function(x){ return x.y === yFirst; })[0]; return o ? o.tot : 0; });
      if(vals.some(function(v){ return v > 0; })) survChart = '<h3>First full-year income for the surviving spouse (' + yFirst + ')</h3><p class="cap">Annual income ' + E(people[1 - dIdx].name) + ' would receive in the first full calendar year after ' + E(people[dIdx].name) + ' passes, under each strategy.</p>' + bars(R.map(shortL), vals, function(v){ return '$' + N(v); });
    }
    var scen = R.map(function(r, k){ return '<div class="scen"><h4>' + (k + 1) + '. ' + E(title(r)) + '</h4><ul>' + ssoEvents(S, r).map(function(e){ return '<li>' + E(e.text) + '</li>'; }).join('') + '</ul><p class="lt"><b>Lifetime benefit: ' + M(r.cum) + '</b>' + (cut ? ' with ' + Math.round(cut.pct * 100) + '% reduction from ' + cut.year + ' &nbsp;·&nbsp; ' + M(r.alt.r.cum) + ' with no reduction' : '') + (S.rate > 0 ? ' &nbsp;·&nbsp; present value ' + M(r.pv) : '') + '</p></div>'; }).join('');
    var planRow = S.plan.rank > 1 ? '<div class="scen plan"><h4>The claiming ages currently in your Retirement Fortress plan: ' + E(title(S.plan.run)) + '</h4><p class="lt">Lifetime benefit ' + M(S.plan.run.cum) + (cut ? ' with the reduction' : '') + ' — ranks #' + S.plan.rank + ' of the ' + S.all.length + ' strategies tested, ' + M(R[0].cum - S.plan.run.cum) + ' less than strategy 1.' + (S.plan.tested ? '' : ' One of these ages is already past, so it is shown for reference rather than ranked.') + '</p></div>' : '<p class="cap">The claiming ages in your Retirement Fortress plan are strategy 1.</p>';
    var lbl = function(r){ return ssoShort(S, r); }, same = function(r){ return r.claims.every(function(c, k){ return c === S.baseline.claims[k]; }); };
    var be = '<table class="be"><tr><th>Strategy</th><th>Catches up to filing earliest (' + E(lbl(S.baseline)) + ')' + (cut ? ' — with reduction' : '') + '</th>' + (cut ? '<th>— no reduction</th>' : '') + R.map(function(_, k){ return '<th>vs. #' + (k + 1) + '</th>'; }).join('') + '</tr>';
    R.forEach(function(r, k){
      var cell = function(c){ return '<td class="' + (c.always ? '' : (c.ok ? 'ok' : 'miss')) + '">' + E(c.text) + '</td>'; };
      be += '<tr><td>#' + (k + 1) + ' — ' + E(lbl(r)) + '</td>' + (same(r) ? '<td>—</td>' : cell(ssoCrossover(r, S.baseline, p0)));
      if(cut) be += same(r) ? '<td>—</td>' : cell(ssoCrossover(r.alt.r, S.baselineNoCut, p0));
      R.forEach(function(o, j){ be += k === j ? '<td>—</td>' : cell(ssoCrossover(r, o, p0)); });
      be += '</tr>';
    });
    be += '</table>';
    var detail = R.map(function(r, k){ return '<section class="page"><h2>' + (k + 1) + '. ' + E(title(r)) + '</h2><ul class="ev">' + ssoEvents(S, r).map(function(e){ return '<li>' + E(e.text) + '</li>'; }).join('') + '</ul><p class="lt"><b>Lifetime benefit: ' + M(r.cum) + '</b></p>' + tableHTML(r) + '<p class="cap">Amounts include the ' + pc(S.cola) + ' COLA assumption' + (cut ? ' and the ' + Math.round(cut.pct * 100) + '% reduction beginning January ' + cut.year : '') + '. The Monthly column shows the first and last monthly amount of the year when they differ. Figures are estimates in future dollars.</p></section>'; }).join('');
    var info = '<table class="kv">'
      + '<tr><th>Prepared for</th><td>' + E(client) + '</td></tr>'
      + (advisor ? '<tr><th>Prepared by</th><td>' + E(advisor) + ', Alto Financial Group</td></tr>' : '')
      + '<tr><th>Marital status</th><td>' + (couple ? 'Married' : 'Single') + '</td></tr>'
      + '<tr><th>Current age' + (couple ? 's' : '') + '</th><td>' + people.map(function(p){ return E(p.name) + ' ' + ssoAgeStr(p.ageNow) + (p.dob ? ' (born ' + p.dob.toLocaleDateString('en-US') + ')' : ''); }).join(', ') + '</td></tr>'
      + '<tr><th>Full retirement age</th><td>' + people.map(function(p){ return E(p.name) + ' ' + ssoAgeStr(p.fra); }).join(', ') + '</td></tr>'
      + '<tr><th>Life expectancy</th><td>' + people.map(function(p){ return E(p.name) + ' ' + ssoAgeStr(p.deathAge); }).join(', ') + '</td></tr>'
      + '<tr><th>PIA at FRA</th><td>' + people.map(function(p){ return E(p.name) + ' ' + M(p.pia); }).join(', ') + '</td></tr>'
      + '<tr><th>COLA assumption</th><td>' + pc(S.cola) + ' per year</td></tr>'
      + (S.rate > 0 ? '<tr><th>Discount rate</th><td>' + pc(S.rate) + ' per year</td></tr>' : '')
      + '<tr><th>Benefit reduction stress test</th><td>' + (cut ? Math.round(cut.pct * 100) + '% reduction beginning ' + cut.year + '; results shown with and without' : 'Not applied') + '</td></tr>'
      + '</table>';
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Social Security Planning Analysis — ' + E(client) + '</title>'
      + '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">'
      + '<style>'
      + ':root{--ink:#1E3062;--red:#ED1C24;--slate:#4B5B70;--line:#D9DEE3;--soft:#E4ECF5}'
      + '*{box-sizing:border-box}body{margin:0;font-family:"IBM Plex Sans",-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1a2233;font-size:12.5px;line-height:1.55;background:#eef0f3}'
      + '.sheet{background:#fff;max-width:8.5in;margin:24px auto;padding:.7in .75in;box-shadow:0 2px 12px rgba(0,0,0,.08)}'
      + '.page{page-break-before:always;padding-top:.2in}'
      + 'h1,h2,h3,h4{font-family:"Fraunces",Georgia,serif;color:var(--ink);font-weight:600;margin:0}'
      + 'h2{font-size:22px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid var(--ink)}h2::after{content:"";display:block;width:48px;height:2px;background:var(--red);margin-top:6px}'
      + 'h3{font-size:15px;margin:18px 0 6px}h4{font-size:14.5px;margin:0 0 4px}p{margin:0 0 9px}.cap{font-size:11px;color:var(--slate)}'
      + '.cover{min-height:9.5in;display:flex;flex-direction:column}.band{background:var(--ink);color:#fff;padding:36px 32px;margin:-.7in -.75in 40px;border-bottom:6px solid var(--red)}.band h1{color:#fff;font-size:38px;line-height:1.1}.band small{display:block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.8;margin-bottom:12px}'
      + '.cover .who{font-size:13px;color:var(--slate)}.cover .name{font-family:"Fraunces",Georgia,serif;font-size:26px;color:var(--ink);font-weight:600;margin:4px 0 12px}.cover .firm{margin-top:36px;font-size:13px}.cover .firm b{color:var(--ink)}.cover .logo{margin-top:auto;padding-top:60px}.cover .logo img{height:90px}'
      + '.kv{border-collapse:collapse;width:100%;margin:8px 0 14px}.kv th{text-align:left;width:32%;color:var(--slate);font-weight:500;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}.kv td{padding:6px 8px;border-bottom:1px solid var(--line)}'
      + '.scen{border:1px solid var(--line);border-left:4px solid var(--ink);border-radius:4px;padding:10px 14px;margin:10px 0;page-break-inside:avoid}.scen.plan{border-left-color:var(--red);background:#FBF7F7}.scen ul,.ev{margin:4px 0 6px;padding-left:18px}.scen li,.ev li{margin:2px 0}.lt{color:var(--ink)}'
      + '.yr{border-collapse:collapse;width:100%;font-size:10px;margin-top:8px}.yr th,.yr td{border-bottom:1px solid var(--line);padding:3px 4px;text-align:right}.yr th{color:var(--slate);font-weight:500;background:#F5F7FA}.yr th.grp{text-align:center;color:var(--ink);font-weight:600;border-bottom:2px solid var(--ink)}.yr td:first-child,.yr th:first-child{text-align:left}'
      + '.be{border-collapse:collapse;width:100%;font-size:11px;margin:8px 0}.be th,.be td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:right}.be th{color:var(--slate);font-weight:500}.be th:first-child,.be td:first-child{text-align:left}.be .ok{color:#2A7A5B;font-weight:600}.be .miss{color:#9B2C2C;font-weight:600}'
      + 'svg{width:100%;height:auto;display:block;margin:6px 0 14px}.term b{color:var(--ink)}.two{display:grid;grid-template-columns:1fr 1fr;gap:20px}'
      + 'table.ref{border-collapse:collapse;font-size:11px;margin:6px 0 10px;width:100%}table.ref th,table.ref td{border-bottom:1px solid var(--line);padding:3px 6px;text-align:left}table.ref th{color:var(--slate);font-weight:500}'
      + '.foot{margin-top:24px;padding-top:10px;border-top:1px solid var(--line);font-size:10.5px;color:var(--slate)}'
      + '.legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:11px;color:var(--slate);margin-top:-8px;margin-bottom:12px}.legend span::before{content:"";display:inline-block;width:14px;height:3px;background:var(--c);margin-right:6px;vertical-align:middle}'
      + '.toolbar{position:sticky;top:0;background:var(--ink);color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;font-size:13px;z-index:5}.toolbar button{background:#fff;color:var(--ink);border:0;border-radius:6px;padding:7px 14px;font:inherit;font-weight:600;cursor:pointer}'
      + '@media print{body{background:#fff}.sheet{box-shadow:none;margin:0;max-width:none;padding:0}.toolbar{display:none}@page{size:letter;margin:.6in .65in}.band{margin:0 0 30px}}'
      + '</style></head><body>'
      + '<div class="toolbar"><span>Social Security Planning Analysis — ' + E(client) + '</span><button onclick="window.print()">Print / Save as PDF</button></div>'
      + '<div class="sheet">'
      + '<section class="cover"><div class="band"><small>Alto Financial Group</small><h1>Social Security<br>Planning Analysis</h1></div>'
      + '<div class="who">Prepared for</div><div class="name">' + E(client) + '</div><div class="who">' + E(dateTxt) + '</div>'
      + '<div class="firm"><b>Prepared by ' + (advisor ? E(advisor) + ', ' : '') + 'Alto Financial Group</b><br>4099 William Penn Hwy, Fourth Floor<br>Monroeville, PA 15146<br>(800) 491-7005<br>altofinancialgrp.com</div>'
      + '<div class="logo"><img src="' + logo + '" alt="Alto Financial Group"></div></section>'
      + '<section class="page"><h2>Introduction</h2>'
      + '<p>This analysis projects the Social Security income you can expect under different claiming strategies. It starts from the primary insurance amount (PIA) shown on your Social Security statement and layers on assumptions about how long you will live and how benefits will be adjusted for inflation. The goal is not to predict a single number but to show how the timing of your filing decision changes the income you receive over your lifetime, so the decision can be made deliberately and in step with the rest of your Retirement Fortress plan.</p>'
      + (couple ? '<p>For a married couple, the decision has several moving parts: when each spouse files on his or her own record, whether either spouse qualifies for a spousal benefit on the other’s record, and what happens when the first spouse passes away. Because the surviving spouse keeps the larger of the two checks, the higher earner’s filing age effectively sets the household’s income for the rest of the survivor’s life.</p>' : '')
      + '<p>Each strategy is ranked by the total benefits received through the life expectancy assumed. A year-by-year schedule for each strategy follows the comparison so you can see the income stream in detail.</p>'
      + '<h2 style="margin-top:22px">Key terms</h2><div class="term">'
      + '<p><b>Primary insurance amount (PIA).</b> The monthly benefit you would receive if you file exactly at full retirement age. The Social Security Administration calculates it from your highest 35 years of indexed earnings. The figure in this report comes from your statement and may change with additional earnings or future COLAs.</p>'
      + '<p><b>Full retirement age (FRA).</b> The age at which you can collect 100% of your PIA. Filing earlier permanently reduces the benefit; filing later earns delayed retirement credits of 8% per year until age 70.</p>'
      + '<div class="two"><div><table class="ref"><tr><th>Year of birth</th><th>Full retirement age</th></tr><tr><td>1943–1954</td><td>66</td></tr><tr><td>1955</td><td>66 and 2 months</td></tr><tr><td>1956</td><td>66 and 4 months</td></tr><tr><td>1957</td><td>66 and 6 months</td></tr><tr><td>1958</td><td>66 and 8 months</td></tr><tr><td>1959</td><td>66 and 10 months</td></tr><tr><td>1960 and later</td><td>67</td></tr></table></div>'
      + '<div><table class="ref"><tr><th>Filing age</th><th>% of PIA (FRA 66)</th><th>% of PIA (FRA 67)</th></tr><tr><td>62</td><td>75.0</td><td>70.0</td></tr><tr><td>63</td><td>80.0</td><td>75.0</td></tr><tr><td>64</td><td>86.7</td><td>80.0</td></tr><tr><td>65</td><td>93.3</td><td>86.7</td></tr><tr><td>66</td><td>100.0</td><td>93.3</td></tr><tr><td>67</td><td>108.0</td><td>100.0</td></tr><tr><td>68</td><td>116.0</td><td>108.0</td></tr><tr><td>69</td><td>124.0</td><td>116.0</td></tr><tr><td>70</td><td>132.0</td><td>124.0</td></tr></table></div></div>'
      + '<p><b>Cost-of-living adjustments (COLA).</b> Benefits rise each year with inflation as measured by CPI-W. Future COLAs are unknown, so this report applies a fixed ' + pc(S.cola) + ' annual increase. Amounts shown are therefore nominal, future-dollar figures; actual results will differ if inflation differs.</p>'
      + '<p><b>Life expectancy.</b> Social Security is paid for life, so the assumed lifespan drives the lifetime totals and break-even ages. A healthy 65-year-old today has roughly a 50% chance of living past the mid-80s, and married couples should plan for the likelihood that at least one spouse reaches 90.</p>'
      + (couple ? '<p><b>Spousal benefit.</b> A spouse may receive up to 50% of the other spouse’s PIA, reduced if taken before FRA. If you also have your own benefit, Social Security pays your own first and adds only the difference. The higher earner must have filed before the spousal amount can begin, and under current deemed-filing rules an application for one benefit is an application for both.</p><p><b>Survivor benefit.</b> When one spouse dies, the household keeps the larger of the two benefits. Because delayed credits carry into the survivor benefit, a higher earner who waits until 70 is also raising the income the surviving spouse will receive for life.</p>' : '')
      + '</div></section>'
      + '<section class="page"><h2>Client information and assumptions</h2>' + info
      + '<h2 style="margin-top:22px">Strategies compared</h2><p class="cap">The five highest-value strategies from every claiming age 62 through 70' + (couple ? ' for each spouse' : '') + '. Strategy 1 produces the most lifetime benefit under the assumptions above.</p>' + scen + planRow + '</section>'
      + '<section class="page"><h2>Comparison of strategies</h2><h3>Lifetime benefits' + (cut ? ' (with ' + Math.round(cut.pct * 100) + '% reduction from ' + cut.year + ')' : '') + '</h3>'
      + bars(R.map(shortL), R.map(function(r){ return r.cum; }), function(v){ return '$' + N(v / 1000) + 'k'; })
      + (cut ? '<h3>Lifetime benefits with no reduction</h3>' + bars(R.map(shortL), R.map(function(r){ return r.alt.r.cum; }), function(v){ return '$' + N(v / 1000) + 'k'; }) : '')
      + survChart
      + '<h3>Cumulative benefits over time</h3><p class="cap">Where lines cross is the break-even age between two strategies.</p>' + cumulative()
      + '<div class="legend">' + R.map(function(r, k){ return '<span style="--c:' + SSO_COLORS[k] + '">' + E(shortL(r, k)) + '</span>'; }).join('') + '</div>'
      + '<h3>Break-even ages (' + E(p0.name) + '’s age)</h3><p class="cap">The age at which each strategy’s cumulative benefits catch up to the alternative. Green: reached before the assumed life expectancy of ' + ssoAgeStr(p0.deathAge) + '. Red: the earlier filing would still be ahead.</p>' + be + '</section>'
      + detail
      + '<section class="page"><h2>How to claim your benefits</h2>'
      + (couple ? '<p>The strategies above indicate when each spouse should file. A spousal benefit cannot start until the other spouse’s own application has been processed, so if both are filing in the same window, the higher earner should file first and the lower earner should wait for confirmation before applying. If the lower earner files on his or her own record years before the higher earner, remember that the spousal top-up is added automatically once the higher earner files.</p>' : '')
      + '<ol><li><b>Review the plan with your Alto advisor</b> so the filing dates fit with your other income sources, Roth conversions, Medicare enrollment and tax picture.</li>'
      + '<li><b>Open a my Social Security account</b> at ssa.gov/myaccount and confirm that your earnings record is complete and the PIA matches the figure used here.</li>'
      + '<li><b>Apply up to four months before</b> the month you want benefits to begin. Benefits are paid the month after they are due.</li>'
      + '<li><b>File online</b> at ssa.gov/apply, <b>by phone</b> at 800-772-1213 (TTY 800-325-0778), or <b>in person</b> by appointment at a local office. Survivor benefits cannot be filed online; call or visit an office with the marriage and death certificates.</li>'
      + '<li><b>Have on hand:</b> Social Security number, proof of birth or citizenship, marriage certificate for spousal or survivor claims, your most recent W-2 or tax return, and bank details for direct deposit.</li>'
      + '<li><b>Enroll in Medicare separately at 65</b> if you are delaying Social Security; enrollment is not automatic unless you are already receiving benefits.</li>'
      + '<li><b>Check the award letter.</b> When the application is processed you will receive a benefit verification letter showing the amount and start date. Confirm it matches the strategy you chose.</li>'
      + '<li><b>Changing course:</b> an application may be withdrawn once within 12 months by repaying benefits received (Form SSA-521), and benefits can be voluntarily suspended after FRA to earn delayed credits.</li></ol></section>'
      + '<section class="page"><h2>What this report does not include</h2>'
      + '<p><b>The figures are estimates, not guarantees.</b> Your exact benefit is not known until Social Security processes your application. The purpose of this report is to show how the timing of your decision changes lifetime income, not to predict the precise amount of any check.</p>'
      + '<p><b>Results depend on assumptions</b> you supplied: the PIA from your statement, life expectancy, and the ' + pc(S.cola) + ' COLA. If any of these turn out differently, so will your actual benefit stream. We are glad to re-run the analysis with different assumptions.</p>'
      + '<p><b>Taxes are not included.</b> Depending on your other income, up to 85% of benefits may be taxable at the federal level. Please consult your tax professional.</p>'
      + '<p><b>The earnings test is not included.</b> If you file before FRA and continue working, some or all of your benefits may be temporarily withheld.</p>'
      + '<p><b>Not modeled:</b> the Windfall Elimination Provision and Government Pension Offset, disability or dependent-child benefits, restricted applications, and Medicare premium deductions.</p>'
      + '<p><b>Laws can change.</b> Congress may alter the benefit formula, full retirement age, COLA method or trust-fund outlook at any time. The benefit-reduction scenario shown ' + (cut ? 'is a hypothetical stress test based on the projected trust-fund depletion date' : 'was not applied to this analysis') + ' and is not a prediction.</p>'
      + '<p><b>This report is one piece of a larger plan.</b> Social Security should be evaluated alongside your pensions, retirement accounts, withdrawal sequencing and legacy goals as part of your overall Retirement Fortress plan. <b>Always consult your Alto Financial Group advisor before making any filing decision.</b></p>'
      + '<div class="foot"><p>Investment advisory products and services made available through AE Wealth Management, LLC (AEWM), a Registered Investment Adviser. AEWM only transacts business in states where it is properly registered or is excluded or exempted from registration requirements. Alto Financial Group and AEWM are not affiliated with or endorsed by the U.S. government or any governmental agency, including the Social Security Administration.</p>'
      + '<p>This report is for informational and educational purposes only and does not constitute tax, legal or individualized investment advice. Neither Alto Financial Group, AEWM nor their representatives assume liability for any loss arising from reliance on the information in this report.</p>'
      + '<p>© ' + today.getFullYear() + ' Alto Financial Group. All rights reserved.</p></div></section>'
      + '</div></body></html>';
    return html;
  }
