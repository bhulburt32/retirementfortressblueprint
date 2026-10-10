
  /* ============================================================
     A long term care event in the projections. Three scenarios are run
     through the same engine as the charts above: one person needs care,
     the other person needs care, both need care. Costs follow the section
     12 estimate — the state medians (or the costs typed there), the
     average durations for a man and a woman, the care start age and the
     cost inflation — at 70% of the projected cost for one person and 49%
     of the combined cost when both need care, net of any benefits already
     in force. In section 17 the insured's Moat benefit pays first and the
     rest comes out of the accounts in the withdrawal order; in section 06
     there is no Moat, so the whole cost falls on the accounts.
     ============================================================ */
  var LTC_SCN_ONE = 0.70, LTC_SCN_BOTH = 0.49;
  function ltcCostSchedule(p, frac, N){
    var out = [], t; for(t = 0; t <= N; t++) out.push(0);
    if(!p || p.noAge || !(frac > 0)) return out;
    var g = 1 + (p.infl || 0), t0 = p.yrs, tp = 0, covY = p.covM * 12;
    p.rows.forEach(function(R){
      var k = R.key, rem = R.years, yr = 0;
      while(rem > 1e-6){
        var f = Math.min(1, rem), rate = p.base[k] * Math.pow(g, t0 + tp + yr);
        var net = Math.max(0, rate * frac - covY);          // yearly rate net of the benefits already in force
        var a = t0 + tp + yr, b = a + f;                     // this slice of care, in plan years from today
        while(b - a > 1e-6){
          var n = Math.floor(a + 1e-9), e = Math.min(b, n + 1), share = e - a;
          if(n <= N) out[n] += net * share;
          a = e;
        }
        rem -= f; yr++;
      }
      tp += R.years;
    });
    return out;
  }
  function ltcPools(r){
    var pool = {client:0, spouse:0};
    if(r.funded && r.funded.moat > 0.5) moatContracts(r).forEach(function(c){ pool[c.owner] = (pool[c.owner] || 0) + (c.benefit || 0); });
    return pool;
  }
  function ltcScenarios(r){
    var est = ltcEstimate(), i = r.inputs;
    var ppl = est.people.filter(function(p){ return p && !p.noAge && p.totalYears > 0; });
    var sexOf = function(p){ return p.who === 'client' ? (i.clientSex || 'male') : (i.spouseSex || 'female'); };
    var sexWord = function(p){ return sexOf(p) === 'female' ? 'female' : 'male'; };
    var one = ppl.map(function(p){
      return {key:p.who, people:[p], frac:LTC_SCN_ONE, sex:sexOf(p),
              title:p.name + ' needs care', sub:sexWord(p) + ' · ' + p.totalYears.toFixed(1) + ' years of care from age ' + p.start + ' (' + (p.yrs > 0 ? 'in ' + p.yrs + ' years' : 'now') + ') · ' + Math.round(LTC_SCN_ONE * 100) + '% of the projected cost'};
    });
    one.sort(function(a, b){ return (a.sex === 'male' ? 0 : 1) - (b.sex === 'male' ? 0 : 1); });
    var scn = one.slice();
    if(ppl.length > 1){
      scn.push({key:'both', people:ppl, frac:LTC_SCN_BOTH, sex:'both', title:'Both need care',
                sub:ppl.map(function(p){ return p.name + ' ' + p.totalYears.toFixed(1) + ' years from age ' + p.start; }).join(', ') + ' · ' + Math.round(LTC_SCN_BOTH * 100) + '% of the combined projected cost'});
    }
    return {est:est, people:ppl, scenarios:scn};
  }
  function ltcScenarioOpts(sc, N, pool){
    var cost = {client:null, spouse:null};
    sc.people.forEach(function(p){ cost[p.who] = ltcCostSchedule(p, sc.frac, N); });
    var gross = sc.people.reduce(function(a, p){ return a + p.total * sc.frac; }, 0);
    return {ltc:{cost:cost, pool:pool}, gross:gross};
  }
  /* a stacked-bar asset chart, shared by the care-event charts: same frame as the charts above,
     with the projection without a care event drawn as a dashed line for comparison */
  function assetBarsChart(cfg){
    var rows = cfg.rows, N = cfg.N, X = cfg.X, parts = cfg.parts, LY = cfg.layers;
    var W = 1000, H = 360, L = 80, R = 24, Tp = 26, B = 56, pw = W - L - R, ph = H - Tp - B;
    var slot = pw / (N + 1), bw = Math.max(4, slot * 0.78);
    var Xc = function(t){ return L + slot * (t + 0.5); };
    var ymax = 0; rows.forEach(function(x, n){ ymax = Math.max(ymax, parts(x).total, cfg.compare ? (cfg.compare[n] || 0) : 0); }); ymax = ymax > 0 ? ymax * 1.12 : 100000;
    var step = Math.pow(10, Math.floor(Math.log(ymax) / Math.LN10)); if(ymax / step < 3) step /= 2; if(ymax / step > 7) step *= 2;
    var Yf = function(v){ return Tp + ph - ph * Math.min(v, ymax) / ymax; };
    var fmtM = function(v){ return v >= 1e6 ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : (v >= 1000 ? '$' + Math.round(v / 1000) + 'k' : '$' + Math.round(v)); };
    var svg = '';
    if(X.lastRet > 0){
      var xr = Xc(X.lastRet) - slot / 2;
      svg += '<rect x="' + xr + '" y="' + Tp + '" width="' + (L + pw - xr) + '" height="' + ph + '" fill="var(--surface-2)"/>'
        + '<text x="' + (xr + 5) + '" y="' + (Tp + 13) + '" class="pj-band">retired</text>';
    }
    if(cfg.careStart != null && cfg.careStart >= 0 && cfg.careStart <= N){
      var xc = Xc(cfg.careStart) - slot / 2;
      svg += '<line x1="' + xc.toFixed(1) + '" x2="' + xc.toFixed(1) + '" y1="' + Tp + '" y2="' + (Tp + ph) + '" stroke="var(--c-moat)" stroke-width="1.5" stroke-dasharray="4 3"/>'
        + '<text x="' + (xc + 6).toFixed(1) + '" y="' + (Tp + 13) + '" class="pj-band" style="fill:var(--c-moat)">care begins ' + rows[Math.round(cfg.careStart)].year + '</text>';
    }
    for(var v = 0; v <= ymax; v += step){
      svg += '<line x1="' + L + '" x2="' + (L + pw) + '" y1="' + Yf(v) + '" y2="' + Yf(v) + '" stroke="var(--line)"/>'
        + '<text x="' + (L - 8) + '" y="' + (Yf(v) + 4) + '" text-anchor="end" class="pj-tick">' + fmtM(v) + '</text>';
    }
    for(var t = 0; t <= N; t += 5){
      var xx = rows[t];
      svg += '<text x="' + Xc(t) + '" y="' + (Tp + ph + 18) + '" text-anchor="middle" class="pj-tick">' + xx.year + '</text>'
        + '<text x="' + Xc(t) + '" y="' + (Tp + ph + 33) + '" text-anchor="middle" class="pj-tick muted">age ' + xx.ages.join(' / ') + '</text>';
    }
    rows.forEach(function(x, n){
      var pr = parts(x), base = 0, x0 = Xc(n) - bw / 2;
      LY.forEach(function(Ly){
        var val = pr[Ly.k]; if(!(val > 0.5)) return;
        var y1 = Yf(base + val), y2 = Yf(base);
        svg += '<rect x="' + x0.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0.5, y2 - y1 - 1).toFixed(1) + '" fill="' + Ly.color + '" opacity="' + Ly.op + '" rx="1"/>';
        base += val;
      });
      if((n % 5 === 0 || n === N) && pr.total > 0.5){
        svg += '<text x="' + Xc(n).toFixed(1) + '" y="' + (Yf(pr.total) - 5).toFixed(1) + '" text-anchor="middle" class="pj-tick" style="font-weight:600;fill:var(--ink)">' + fmtM(pr.total) + '</text>';
      }
    });
    if(cfg.compare){
      svg += '<polyline fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="6 4" opacity=".75" points="'
        + rows.map(function(x, n){ return Xc(n).toFixed(1) + ',' + Yf(cfg.compare[n] || 0).toFixed(1); }).join(' ') + '"/>';
    }
    rows.forEach(function(x, n){ svg += '<rect x="' + (Xc(n) - slot / 2).toFixed(1) + '" y="' + Tp + '" width="' + slot.toFixed(1) + '" height="' + ph + '" fill="transparent"/>'; });
    cfg.svg.innerHTML = svg;
    if(cfg.legend){
      cfg.legend.innerHTML = LY.filter(function(Ly){ return rows.some(function(x){ return parts(x)[Ly.k] > 0.5; }); })
        .map(function(Ly){ return '<span class="pj-key"><i class="sw" style="background:' + Ly.color + ';opacity:' + Ly.op + '"></i>' + Ly.name + '</span>'; }).join('')
        + (cfg.compare ? '<span class="pj-key"><i style="border-top-style:dashed;border-color:var(--ink)"></i>Without a care event</span>' : '')
        + '<span class="pj-key"><small>labels every fifth year: total assets</small></span>';
    }
    var svgEl = cfg.svg, tip = cfg.tip;
    if(tip){
      svgEl.onmousemove = function(ev){
        var rect = svgEl.getBoundingClientRect(), fx = (ev.clientX - rect.left) / rect.width * W;
        var n = Math.max(0, Math.min(N, Math.floor((fx - L) / pw * (N + 1)))), x = rows[n]; if(!x) return;
        var pr = parts(x);
        tip.hidden = false;
        tip.innerHTML = '<b>' + x.year + ' · age ' + x.ages.join(' / ') + '</b>'
          + LY.filter(function(Ly){ return pr[Ly.k] > 0.5; }).map(function(Ly){ return '<div><span>' + Ly.name + '</span><span>' + money(pr[Ly.k]) + '</span></div>'; }).join('')
          + '<div><span>Total</span><span>' + money(pr.total) + '</span></div>'
          + (cfg.compare ? '<div><span>Without care event</span><span>' + money(cfg.compare[n] || 0) + '</span></div>' : '')
          + (cfg.tipRows ? cfg.tipRows(x, n) : '');
        var px = (ev.clientX - rect.left), left = px + 14; if(left + 250 > rect.width) left = px - 264;
        tip.style.left = left + 'px'; tip.style.top = Math.max(0, (ev.clientY - rect.top) - 30) + 'px';
      };
      svgEl.onmouseleave = function(){ tip.hidden = true; };
    }
  }
  /* the three care-event charts under a projection: mode 'sq' (section 06) or 'plan' (section 17) */
  function renderLtcScenarios(r, mode, baseX){
    var box = $(mode === 'sq' ? 'sqLtc' : 'assetLtc'), lead = $(mode === 'sq' ? 'sqLtcLead' : 'assetLtcLead');
    if(!box) return;
    if(!accounts.length || !baseX || !baseX.rows){ box.innerHTML = ''; lead.textContent = ''; return; }
    var S = ltcScenarios(r), N = baseX.N, i = r.inputs;
    if(!S.scenarios.length){
      box.innerHTML = ''; lead.textContent = 'Enter the client’s current age in section 02 (and the spouse’s, if any) and the care-event projections appear here, using the section 12 long term care estimate.';
      return;
    }
    var pool = mode === 'plan' ? ltcPools(r) : {client:0, spouse:0};
    var poolTot = pool.client + pool.spouse;
    var pfx = mode === 'sq' ? 'sqLtc' : 'assetLtc';
    var LY = mode === 'sq' ? SQ_LAYERS : ASSET_LAYERS;
    var parts = mode === 'sq' ? sqParts : function(x){ var o = {}; ASSET_LAYERS.forEach(function(Ly){ o[Ly.k] = x.layers[Ly.k]; }); o.total = x.layers.total; return o; };
    var compare = baseX.rows.map(function(x){ return x.layers.total; });
    var baseLast = baseX.rows[baseX.rows.length - 1], baseDep = baseX.rows.filter(function(x){ return x.unfunded > 0.5; })[0];
    lead.innerHTML = 'The same projection as above, with a long term care event added. Costs follow the section 12 estimate — ' + esc(S.est.state === 'USA National' ? 'national' : S.est.state) + ' median costs, the average durations for a man and a woman, the care start age' + (S.est.infl ? ' and ' + (S.est.infl * 100).toFixed(1) + '% cost inflation' : '') + ' — at <b>' + Math.round(LTC_SCN_ONE * 100) + '%</b> of the projected cost when one person needs care and <b>' + Math.round(LTC_SCN_BOTH * 100) + '%</b> of the combined cost when both do, net of benefits already in force. '
      + (mode === 'plan' ? (poolTot > 0.5 ? 'The Moat pays first (' + ['client','spouse'].filter(function(w){ return pool[w] > 0.5; }).map(function(w){ return esc(ownerLabel(w)) + ' ' + money(pool[w]); }).join(', ') + ' of benefit); anything above the benefit comes out of the accounts in the section 16 order, with the tax on the draw.' : 'No Moat is funded in the plan as adjusted, so the whole cost comes out of the accounts in the section 16 order, with the tax on the draw.')
                         : 'With no Fortress in place the whole cost comes out of the accounts in the section 16 order, with the tax on the draw.')
      + ' The dashed line is the projection above, without a care event.';
    var html = '';
    S.scenarios.forEach(function(sc){
      var id = pfx + sc.key;
      html += '<div class="ltc-scn" id="' + id + 'Box"><h4>' + esc(sc.title) + '</h4><p class="scn-sub">' + esc(sc.sub) + '</p>'
        + '<div class="tax-tiles" id="' + id + 'Tiles"></div><div class="pj-legend" id="' + id + 'Legend"></div>'
        + '<div class="pj-wrap"><svg id="' + id + 'Svg" class="pj" viewBox="0 0 1000 360" role="img" aria-label="Projected assets if ' + esc(sc.title.toLowerCase()) + '"></svg><div id="' + id + 'Tip" class="pj-tip" hidden></div></div>'
        + '<p class="hint" id="' + id + 'Note" style="margin-top:10px"></p></div>';
    });
    box.innerHTML = html;
    S.scenarios.forEach(function(sc){
      var id = pfx + sc.key, O = ltcScenarioOpts(sc, N, pool);
      var X = mode === 'sq' ? statusQuoRun(r, {ltc:O.ltc}) : projectTax(r, {convert:baseX.convert || null, ltc:O.ltc});
      sc.run = X;
      var rows = X.rows, last = rows[rows.length - 1], dep = rows.filter(function(x){ return x.unfunded > 0.5; })[0];
      var T = X.ltc || {cost:0, moat:0, oop:0};
      var careStart = Math.min.apply(null, sc.people.map(function(p){ return p.yrs; }));
      var careEnd = Math.max.apply(null, sc.people.map(function(p){ return p.yrs + p.totalYears; }));
      var beyond = careStart > N;
      var diff = last.layers.total - baseLast.layers.total;
      var tiles = '<div><dt>Cost of care</dt><dd>' + money(T.cost) + '</dd><small>' + (beyond ? 'care begins after the end of plan' : 'future dollars, ' + rows[Math.min(N, Math.floor(careStart))].year + '–' + rows[Math.min(N, Math.max(0, Math.ceil(careEnd) - 1))].year + (T.cost < O.gross - 1 ? ', after benefits in force' : '')) + '</small></div>';
      if(mode === 'plan') tiles += '<div><dt>Paid by the Moat</dt><dd>' + money(T.moat) + '</dd><small>' + (poolTot > 0.5 ? 'of ' + money(sc.people.reduce(function(a, p){ return a + (pool[p.who] || 0); }, 0)) + ' of benefit for ' + (sc.people.length > 1 ? 'both' : esc(sc.people[0].name)) : 'no Moat funded') + '</small></div>';
      tiles += '<div><dt>From the accounts</dt><dd>' + money(T.oop) + '</dd><small>' + (T.oop > 0.5 ? 'withdrawn to pay for care, plus the tax on the draw' : 'nothing — the benefit covers the cost') + '</small></div>'
        + '<div><dt>' + (dep ? 'Accounts run out' : 'At end of plan') + '</dt><dd>' + (dep ? dep.year : money(last.layers.total)) + '</dd><small>' + (dep ? 'age ' + dep.ages.join(' / ') + (baseDep ? ' (vs ' + baseDep.year + ' without a care event)' : ' — the accounts last to ' + baseLast.year + ' without a care event') : (diff >= 0 ? '+' : '−') + money(Math.abs(diff)) + ' vs ' + money(baseLast.layers.total) + ' without a care event') + '</small></div>';
      $(id + 'Tiles').innerHTML = tiles;
      assetBarsChart({rows:rows, N:N, X:X, layers:LY, parts:parts, compare:compare, careStart:beyond ? null : careStart,
        svg:$(id + 'Svg'), tip:$(id + 'Tip'), legend:$(id + 'Legend'),
        tipRows:function(x){ var l = x.ltc || {cost:0, moat:0, oop:0}; return (l.cost > 0.5 ? '<div><span>Care this year</span><span>' + money(l.cost) + '</span></div>' + (l.moat > 0.5 ? '<div><span>Paid by Moat</span><span>' + money(l.moat) + '</span></div>' : '') : '') + '<div><span>Withdrawn</span><span>' + money(x.withdrawn) + '</span></div>' + (x.unfunded > 0.5 ? '<div><span>Unfunded</span><span>' + money(x.unfunded) + '</span></div>' : ''); }});
      var who = sc.people.length > 1 ? 'both ' + sc.people.map(function(p){ return esc(p.name); }).join(' and ') + ' need' : esc(sc.people[0].name) + ' needs';
      $(id + 'Note').innerHTML = beyond ? 'Care would begin after the end of plan, so the projection is unchanged.'
        : 'If ' + who + ' care, the cost comes to <b>' + money(T.cost) + '</b> over the care years' + (T.moat > 0.5 ? ', of which the Moat pays <b>' + money(T.moat) + '</b>' : '') + (T.oop > 0.5 ? ' and <b>' + money(T.oop) + '</b> is drawn from the accounts' : '') + '. '
          + (dep ? '<b>The accounts are exhausted in ' + dep.year + '</b>' + (baseDep ? ' (vs ' + baseDep.year + ' without a care event)' : ', where without a care event they last to the end of plan') + ', and Needs and Wants are unfunded from there.'
                 : 'The plan ends ' + last.year + ' with <b>' + money(last.layers.total) + '</b>, ' + (diff >= 0 ? '+' : '−') + money(Math.abs(diff)) + ' against the projection without a care event' + (T.oop > 0.5 ? ' — the withdrawals and the lost growth on them' : '') + '.');
    });
    return S;
  }
