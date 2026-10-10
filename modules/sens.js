
  /* ============================================================
     Sensitivity analysis (section 18). The section 17 projection run again
     under three stresses, each on the scenario as adjusted:
       1. Sequence of returns — the Walls earn −4% and the Roof −15% a year
          in the first three years of retirement, then the assumed rates.
       2. Social Security — benefits cut 22% from 2032.
       3. Inflation — long-term inflation 30% above the plan assumption.
     A stress rides on the run object as r.stress and is read by
     projectIncome (Walls balance, Social Security) and projectTax (growth).
     ============================================================ */
  var SENS_SEQ = {walls:-0.04, roof:-0.15, years:3}, SENS_SS = {pct:0.22, year:2032}, SENS_INFL = 1.30;
  function sensRetireRow(P){ return Math.min(P.N, Math.ceil(P.lastRet || 0)); }
  function sensDefs(r, P){
    var i = r.inputs, R = sensRetireRow(P), y0 = P.year0;
    return [
      {key:'seq', title:'Sequence of returns risk',
       sub:'Walls ' + (SENS_SEQ.walls * 100).toFixed(0) + '% and Roof ' + (SENS_SEQ.roof * 100).toFixed(0) + '% a year for the first three years of retirement (' + (y0 + R) + '–' + (y0 + R + SENS_SEQ.years - 1) + '), then the assumed rates',
       range:(y0 + R) + '\u2013' + (y0 + R + SENS_SEQ.years - 1), stress:{seq:{from:R, years:SENS_SEQ.years, walls:SENS_SEQ.walls, roof:SENS_SEQ.roof}}, marker:{t:R, label:'bad years begin ' + (y0 + R)}},
      {key:'ss', title:'Social Security cut',
       sub:'Benefits ' + Math.round(SENS_SS.pct * 100) + '% lower from ' + SENS_SS.year + ', the year the trust fund is projected to be depleted',
       stress:{ssCut:{pct:SENS_SS.pct, year:SENS_SS.year}}, marker:{t:SENS_SS.year - y0, label:'benefits cut ' + SENS_SS.year}},
      {key:'infl', title:'Higher inflation',
       sub:'Long-term inflation ' + Math.round((SENS_INFL - 1) * 100) + '% above the plan assumption — ' + ((i.inflation || 0) * SENS_INFL * 100).toFixed(2) + '% instead of ' + ((i.inflation || 0) * 100).toFixed(1) + '% — on expenses and the tax brackets alike',
       stress:{inflMult:SENS_INFL}, marker:null}
    ];
  }
  function sensRun(r, def, baseX){
    var rS = {}; Object.keys(r).forEach(function(k){ rS[k] = r[k]; });
    rS.stress = def.stress;
    if(def.stress.inflMult){ rS.inputs = {}; Object.keys(r.inputs).forEach(function(k){ rS.inputs[k] = r.inputs[k]; }); rS.inputs.inflation = (r.inputs.inflation || 0) * def.stress.inflMult; }
    var X = projectTax(rS, {convert:baseX.convert || null});
    X.income = projectIncome(rS);
    var rows = X.rows, last = rows[rows.length - 1], dep = rows.filter(function(x){ return x.unfunded > 0.5; })[0];
    var low = rows.reduce(function(a, x){ return x.layers.total < a.layers.total ? x : a; }, rows[0]);
    var baseLast = baseX.rows[baseX.rows.length - 1], baseDep = baseX.rows.filter(function(x){ return x.unfunded > 0.5; })[0];
    var baseInc = baseX.income || projectIncome(r);
    var ssLost = 0, extraSpend = 0;
    X.income.rows.forEach(function(row, t){ var b = baseInc.rows[t]; if(!b) return; ssLost += Math.max(0, b.ss - row.ss); extraSpend += Math.max(0, (row.needs + row.wants) - (b.needs + b.wants)); });
    return {X:X, rows:rows, last:last, dep:dep, low:low, baseLast:baseLast, baseDep:baseDep, diff:last.layers.total - baseLast.layers.total,
            ssLost:ssLost, extraSpend:extraSpend, tax:X.lifetime + X.lifetimeState, baseTax:baseX.lifetime + baseX.lifetimeState,
            wd:rows.reduce(function(a, x){ return a + x.withdrawn; }, 0), baseWd:baseX.rows.reduce(function(a, x){ return a + x.withdrawn; }, 0)};
  }
  function sensTiles(def, RUN, mode){
    var nb = function(t){ return '<span style="white-space:nowrap">' + t + '</span>'; };
    var dep = RUN.dep, diff = RUN.diff, tiles = '';
    if(def.key === 'seq') tiles += '<div><dt>Three bad years</dt><dd>' + (SENS_SEQ.walls * 100).toFixed(0) + '% / ' + (SENS_SEQ.roof * 100).toFixed(0) + '%</dd><small>Walls / Roof returns, ' + esc(def.range || '') + '</small></div>';
    if(def.key === 'ss') tiles += '<div><dt>Social Security lost</dt><dd>' + money(RUN.ssLost) + '</dd><small>over the plan, from ' + SENS_SS.year + '</small></div>';
    if(def.key === 'infl') tiles += '<div><dt>Extra spending</dt><dd>' + money(RUN.extraSpend) + '</dd><small>Needs and Wants above the base case, over the plan</small></div>';
    tiles += '<div><dt>Withdrawn</dt><dd>' + money(RUN.wd) + '</dd><small>' + nb((RUN.wd >= RUN.baseWd ? '+' : '−') + money(Math.abs(RUN.wd - RUN.baseWd))) + ' vs the base case</small></div>'
      + '<div><dt>Lowest point</dt><dd>' + money(RUN.low.layers.total) + '</dd><small>in ' + RUN.low.year + '</small></div>'
      + '<div><dt>' + (dep ? 'Accounts run out' : 'At end of plan') + '</dt><dd>' + (dep ? dep.year : money(RUN.last.layers.total)) + '</dd><small>' + (dep ? 'age ' + dep.ages.join(' / ') + (RUN.baseDep ? ' (vs ' + RUN.baseDep.year + ' in the base case)' : ' — the base case lasts to ' + RUN.baseLast.year) : nb((diff >= 0 ? '+' : '−') + money(Math.abs(diff))) + ' vs ' + money(RUN.baseLast.layers.total) + ' in the base case') + '</small></div>';
    return tiles;
  }
  function renderSensitivity(r, baseX){
    var box = $('sens'), lead = $('sensLead'); if(!box) return;
    if(!accounts.length || !baseX || !baseX.rows){ box.innerHTML = ''; lead.textContent = 'Add the client’s accounts in section 06 and the stress tests appear here.'; return; }
    var P = baseX.income || projectIncome(r), defs = sensDefs(r, P), N = baseX.N;
    var compare = baseX.rows.map(function(x){ return x.layers.total; });
    var parts = function(x){ var o = {}; ASSET_LAYERS.forEach(function(Ly){ o[Ly.k] = x.layers[Ly.k]; }); o.total = x.layers.total; return o; };
    lead.innerHTML = 'The section 17 projection for <b>' + esc(scnNames[activeScn]) + '</b> run again under three stresses, one at a time, everything else unchanged. The dashed line in each chart is the base case above.';
    box.innerHTML = defs.map(function(d){
      var id = 'sens' + d.key;
      return '<div class="ltc-scn" id="' + id + 'Box"><h4>' + esc(d.title) + '</h4><p class="scn-sub">' + esc(d.sub) + '</p>'
        + '<div class="tax-tiles" id="' + id + 'Tiles"></div><div class="pj-legend" id="' + id + 'Legend"></div>'
        + '<div class="pj-wrap"><svg id="' + id + 'Svg" class="pj" viewBox="0 0 1000 360" role="img" aria-label="Projected assets under the ' + esc(d.title.toLowerCase()) + ' stress"></svg><div id="' + id + 'Tip" class="pj-tip" hidden></div></div>'
        + '<p class="hint" id="' + id + 'Note" style="margin-top:10px"></p></div>';
    }).join('');
    defs.forEach(function(d){
      var id = 'sens' + d.key, RUN = sensRun(r, d, baseX); d.run = RUN;
      $(id + 'Tiles').innerHTML = sensTiles(d, RUN);
      assetBarsChart({rows:RUN.rows, N:N, X:RUN.X, layers:ASSET_LAYERS, parts:parts, compare:compare, marker:(d.marker && d.marker.t >= 0 && d.marker.t <= N) ? d.marker : null,
        svg:$(id + 'Svg'), tip:$(id + 'Tip'), legend:$(id + 'Legend'), compareLabel:'Base case',
        tipRows:function(x, n){ var ir = RUN.X.income.rows[n] || {}; return '<div><span>Withdrawn</span><span>' + money(x.withdrawn) + '</span></div>' + (d.key === 'ss' ? '<div><span>Social Security</span><span>' + money(ir.ss || 0) + '</span></div>' : '') + (d.key === 'infl' ? '<div><span>Expenses</span><span>' + money((ir.needs || 0) + (ir.wants || 0)) + '</span></div>' : '') + (x.unfunded > 0.5 ? '<div><span>Unfunded</span><span>' + money(x.unfunded) + '</span></div>' : ''); }});
      var dep = RUN.dep, diff = RUN.diff;
      $(id + 'Note').innerHTML = (d.key === 'seq' ? 'With the Walls and Roof losing value in the first three years of retirement while withdrawals continue, '
                                 : d.key === 'ss' ? 'With <b>' + money(RUN.ssLost) + '</b> less Social Security over the plan, '
                                 : 'With <b>' + money(RUN.extraSpend) + '</b> more spending over the plan as prices rise faster, ')
        + (dep ? '<b>the accounts are exhausted in ' + dep.year + '</b>' + (RUN.baseDep ? ' (vs ' + RUN.baseDep.year + ' in the base case)' : ', where the base case lasts to the end of plan') + ', and Needs and Wants are unfunded from there.'
               : 'the plan ends ' + RUN.last.year + ' with <b>' + money(RUN.last.layers.total) + '</b>, ' + (diff >= 0 ? '+' : '−') + money(Math.abs(diff)) + ' against the base case' + (RUN.tax !== RUN.baseTax ? '; lifetime income tax ' + money(RUN.tax) + ' vs ' + money(RUN.baseTax) : '') + '.');
    });
  }
  /* report page: the three stress tests side by side */
  function sensDeckPage(s, frame, r, TX){
    frame(s, '', 'Stress Tests: Three Things That Could Go Wrong');
    var P = TX.income || projectIncome(r), defs = sensDefs(r, P);
    dkBody(s, 0.9, 1.95, 18.2, 1.0, 'The projection on the previous page run again under three stresses, one at a time, everything else unchanged: three bad market years at the start of retirement, a ' + Math.round(SENS_SS.pct * 100) + '% Social Security cut from ' + SENS_SS.year + ', and inflation ' + Math.round((SENS_INFL - 1) * 100) + '% above the plan assumption. The dashed line is the base case.', {sz:16});
    var legEl = $('sensseqLegend');
    if(legEl) s.html(1.0, 2.95, 18, 0.95, '<div class="pj-legend">' + legEl.innerHTML.replace(/<span class="pj-key"><small>[^<]*<\/small><\/span>/, '') + '</div>');
    var colW = 5.9, gap = (18.2 - colW * 3) / 2;
    defs.forEach(function(d, k){
      var x = 0.9 + k * (colW + gap), RUN = sensRun(r, d, TX);
      s.text(x, 3.6, colW, 0.4, [{runs:[{t:d.title, sz:18, b:true, color:DECK_C.navy}]}], {valign:'middle'});
      s.text(x, 4.0, colW, 0.9, [{runs:[{t:d.sub, sz:16, color:DECK_C.muted}]}]);
      var cy = 4.95, chH = colW * 0.36 + 0.05;
      if(!dkSvg(s, x, cy, colW, chH, 'sens' + d.key + 'Svg', 'tight')) dkBody(s, x, cy, colW, 1, 'Chart not available.', {sz:16, i:true});
      var ty = cy + chH + 0.2, tw = (colW - 0.2) / 2, th = 1.1, dep = RUN.dep;
      var first = d.key === 'seq' ? ['Three bad years', (SENS_SEQ.walls * 100).toFixed(0) + '% / ' + (SENS_SEQ.roof * 100).toFixed(0) + '%'] : d.key === 'ss' ? ['Social Security lost', money(RUN.ssLost)] : ['Extra spending', money(RUN.extraSpend)];
      dkTile(s, x, ty, tw, th, first[0], first[1], null, {big:22});
      dkTile(s, x + tw + 0.2, ty, tw, th, 'Lowest point', money(RUN.low.layers.total), null, {big:22});
      dkTile(s, x, ty + th + 0.15, colW, th, dep ? 'Accounts run out' : 'At end of plan', dep ? String(dep.year) : money(RUN.last.layers.total), null, {big:22, valueColor:dep ? DECK_C.red : DECK_C.navy});
      var line = dep ? 'vs ' + (RUN.baseDep ? 'running out in ' + RUN.baseDep.year : 'lasting to ' + RUN.baseLast.year) + ' in the base case.' : (RUN.diff >= 0 ? '+' : '−') + money(Math.abs(RUN.diff)) + ' vs ' + money(RUN.baseLast.layers.total) + ' in the base case.';
      s.text(x, ty + 2 * th + 0.23, colW, 0.4, [{runs:[{t:line, sz:16, color:DECK_C.ink}]}]);
    });
  }
