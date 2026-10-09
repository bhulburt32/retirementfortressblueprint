  /* ============================================================
     Social Security claiming optimizer. Every claiming age from 62 to 70
     (plus full retirement age) for each person, simulated month by month
     to the assumed lifespan with SSA's own reductions and credits, spousal
     top-ups, deemed filing and survivor benefits, then ranked by lifetime
     value — with and without the trust-fund stress test from section 18.
     The PIAs, ages, names and COLA come from the rest of the page; the
     optimizer adds only life expectancy, an optional discount rate and
     optional dates of birth for month-level precision.
     ============================================================ */
  var ssoCfg = {lifeC:'', lifeS:'', rate:'', cutOn:true, dobC:'', dobS:''};
  var SSO_LIFE = {male:85, female:88}, SSO_COLORS = ['#1E3062', '#ED1C24', '#2A7A5B', '#B7791F', '#7A8496'];
  function ssoDefault(){ return {lifeC:'', lifeS:'', rate:'', cutOn:true, dobC:'', dobS:''}; }
  function ssoFrom(o){ o = o || {}; return {lifeC:o.lifeC == null ? '' : String(o.lifeC), lifeS:o.lifeS == null ? '' : String(o.lifeS), rate:o.rate == null ? '' : String(o.rate), cutOn:o.cutOn !== false, dobC:String(o.dobC || ''), dobS:String(o.dobS || '')}; }
  /* SSA rules beyond fraMonths() above */
  function ssoSurvFra(y){ if(y <= 1939) return 65 * 12; if(y <= 1944) return 65 * 12 + (y - 1939) * 2; if(y <= 1956) return 66 * 12; if(y <= 1961) return 66 * 12 + (y - 1956) * 2; return 67 * 12; }
  function ssoOwnFactor(claim, fra){ if(claim < fra){ var d = fra - claim; return 1 - (Math.min(d, 36) * 5 / 900 + Math.max(d - 36, 0) * 5 / 1200); } return 1 + (Math.min(claim, 840) - fra) * (0.08 / 12); }
  function ssoSpousalFactor(start, fra){ if(start >= fra) return 1; var d = fra - start; return 1 - (Math.min(d, 36) * 25 / 3600 + Math.max(d - 36, 0) * 5 / 1200); }
  function ssoSurvivorFactor(age, sfra){ if(age >= sfra) return 1; var a = Math.max(age, 720); return 1 - 0.285 * (sfra - a) / (sfra - 720); }
  function ssoAgeStr(m){ var y = Math.floor(m / 12), r = m % 12; return r ? y + 'y ' + r + 'm' : String(y); }
  /* the people, from the page: name, PIA, age (whole years, or a date of birth when given), lifespan */
  function ssoPeople(i){
    var today = new Date(), spouse = hasSpouse(i), out = [];
    ['client','spouse'].forEach(function(w){
      if(w === 'spouse' && !spouse) return;
      var pia = (i.benefits && i.benefits.ss && i.benefits.ss[w]) ? i.benefits.ss[w].pia : 0;
      if(!(pia > 0.5)) return;
      var age = w === 'client' ? i.clientAge : (i.spouseAge != null ? i.spouseAge : i.clientAge);
      var dobTxt = w === 'client' ? ssoCfg.dobC : ssoCfg.dobS, dob = dobTxt ? new Date(dobTxt + 'T00:00:00') : null;
      if(dob && isNaN(dob.getTime())) dob = null;
      var ageNow, birthYear;
      if(dob){
        ageNow = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth()); if(today.getDate() < dob.getDate()) ageNow--;
        birthYear = (dob.getMonth() === 0 && dob.getDate() === 1) ? dob.getFullYear() - 1 : dob.getFullYear();
      } else { ageNow = Math.round(age || 0) * 12; birthYear = today.getFullYear() - Math.round(age || 0); }
      var sex = w === 'client' ? i.clientSex : i.spouseSex, lifeTxt = w === 'client' ? ssoCfg.lifeC : ssoCfg.lifeS;
      var life = num(lifeTxt) > 0 ? num(lifeTxt) : (SSO_LIFE[sex] || 85);
      var p = {who:w, name:ownerLabel(w), pia:pia, dob:dob, birthYear:birthYear, ageNow:Math.max(0, ageNow), deathAge:Math.round(life * 12), fra:fraMonths(birthYear), sfra:ssoSurvFra(birthYear), lifeDefault:!(num(lifeTxt) > 0), life:life,
               planClaim:Math.round(((i.benefits.ss[w].age) || 67) * 12)};
      var minClaim = Math.max(744, p.ageNow + 1), set = {}, cands = [];
      if(minClaim >= 840) cands = [840];
      else {
        for(var a = 62; a <= 70; a++) set[a * 12] = 1; set[p.fra] = 1;
        cands = Object.keys(set).map(Number).filter(function(c){ return c >= minClaim; }).sort(function(a, b){ return a - b; });
        if(cands.indexOf(minClaim) < 0) cands.unshift(minClaim);
      }
      p.candidates = cands;
      out.push(p);
    });
    return out;
  }
  function ssoSurvivorBase(dec, claim){
    if(claim <= dec.deathAge){ var amt = dec.pia * ssoOwnFactor(claim, dec.fra); if(claim < dec.fra) amt = Math.max(amt, 0.825 * dec.pia); return amt; }
    return dec.deathAge <= dec.fra ? dec.pia : dec.pia * ssoOwnFactor(dec.deathAge, dec.fra);
  }
  /* one strategy: claims[] in months of age; returns lifetime totals, the running series and monthly parts */
  function ssoSimulate(people, claims, mrate, colaA, cut, m0){
    var n = people.length, horizon = Math.max.apply(null, people.map(function(p){ return p.deathAge - p.ageNow; }));
    var series = [], parts = [], pv = 0, cum = 0;
    var own = people.map(function(p, k){ return p.pia * ssoOwnFactor(claims[k], p.fra); });
    var excess = people.map(function(p, k){
      if(n < 2) return {amt:0, start:Infinity};
      var q = people[1 - k], half = 0.5 * q.pia;
      if(half <= p.pia) return {amt:0, start:Infinity};
      if(claims[1 - k] > q.deathAge) return {amt:0, start:Infinity};
      var start = Math.max(claims[k], p.ageNow + (claims[1 - k] - q.ageNow));
      if(start > p.deathAge) return {amt:0, start:Infinity};
      return {amt:(half - p.pia) * ssoSpousalFactor(start, p.fra), start:start};
    });
    var survAmt = people.map(function(p, k){
      if(n < 2) return 0;
      var q = people[1 - k], ageAtQDeath = p.ageNow + (q.deathAge - q.ageNow);
      return ssoSurvivorBase(q, claims[1 - k]) * ssoSurvivorFactor(ageAtQDeath, p.sfra);
    });
    var firstMonthly = null;
    for(var t = 0; t < horizon; t++){
      var month = 0, row = [], f = Math.pow(1 + colaA, Math.floor((m0 + t) / 12)) * ((cut && t >= cut.startT) ? (1 - cut.pct) : 1);
      for(var k = 0; k < n; k++){
        var p = people[k], age = p.ageNow + t, o = 0, sp = 0, sv = 0;
        if(age < p.deathAge){
          var partnerAlive = n < 2 ? false : (people[1 - k].ageNow + t < people[1 - k].deathAge), ownNow = age >= claims[k] ? own[k] : 0;
          if(n < 2 || partnerAlive){ o = ownNow; sp = age >= excess[k].start ? excess[k].amt : 0; }
          else if(survAmt[k] > ownNow){ sv = survAmt[k]; }
          else { o = ownNow; }
        }
        row.push({own:o * f, sp:sp * f, surv:sv * f});
        month += o + sp + sv;
      }
      if(firstMonthly === null && month > 0) firstMonthly = month;
      month *= f; cum += month; pv += month / Math.pow(1 + mrate, t);
      series.push(cum); parts.push(row);
    }
    return {claims:claims, pv:pv, cum:cum, series:series, parts:parts, own:own, excess:excess, survAmt:survAmt, firstMonthly:firstMonthly || 0};
  }
  /* break-even of strategy a over b, in person 0's age */
  function ssoCrossover(a, b, p0){
    var n = Math.max(a.series.length, b.series.length), get = function(r, t){ return r.series[Math.min(t, r.series.length - 1)]; };
    var wasNeg = false, wasPos = false, cross = -1, drop = -1;
    for(var t = 0; t < n; t++){
      var d = get(a, t) - get(b, t);
      if(d < -0.5){ if(!wasNeg && wasPos && drop < 0 && cross < 0) drop = t; wasNeg = true; }
      else { if(d > 0.5) wasPos = true; if(wasNeg && cross < 0) cross = t; }
    }
    var age = function(t){ return ssoAgeStr(p0.ageNow + t); };
    if(!wasNeg) return {text:'always ahead', ok:true, always:true};
    if(cross >= 0) return {text:age(cross), ok:cross <= p0.deathAge - p0.ageNow};
    if(drop > 0) return {text:'ahead until ' + age(drop), ok:drop > p0.deathAge - p0.ageNow};
    return {text:'never (within horizon)', ok:false};
  }
  /* the whole analysis for the page's inputs; null when no PIA is entered */
  function ssoRun(i){
    var people = ssoPeople(i); if(!people.length) return null;
    var today = new Date(), m0 = today.getMonth(), year0 = today.getFullYear();
    var cola = (i.benefits && i.benefits.ss && i.benefits.ss.cola != null) ? i.benefits.ss.cola : 0.025;
    var rate = Math.max(0, pctIn(ssoCfg.rate || '0')), mrate = Math.pow(1 + rate, 1 / 12) - 1;
    var cut = ssoCfg.cutOn ? {year:SENS_SS.year, pct:SENS_SS.pct, startT:Math.max(0, (SENS_SS.year - year0) * 12 - m0)} : null;
    var combos = [];
    if(people.length === 1) people[0].candidates.forEach(function(c){ combos.push([c]); });
    else people[0].candidates.forEach(function(a){ people[1].candidates.forEach(function(b){ combos.push([a, b]); }); });
    var key = function(cl){ return cl.join(','); };
    var noCutAll = combos.map(function(cl){ return ssoSimulate(people, cl, mrate, cola, null, m0); }).sort(function(a, b){ return b.pv - a.pv; });
    var noCutRank = {}; noCutAll.forEach(function(r, k){ noCutRank[key(r.claims)] = {rank:k + 1, r:r}; });
    var all, results;
    if(cut){
      all = combos.map(function(cl){ return ssoSimulate(people, cl, mrate, cola, cut, m0); }).sort(function(a, b){ return b.pv - a.pv; });
      all.forEach(function(r){ r.alt = noCutRank[key(r.claims)]; });
    } else all = noCutAll;
    results = all.slice(0, 5);
    var earliest = people.map(function(p){ return p.candidates[0]; });
    var baseline = ssoSimulate(people, earliest, mrate, cola, cut, m0), baselineNoCut = cut ? ssoSimulate(people, earliest, mrate, cola, null, m0) : null;
    /* the plan's own claiming ages from the Social Security table, ranked against every tested strategy */
    var planClaims = people.map(function(p){ return p.planClaim; });
    var planRun = ssoSimulate(people, planClaims, mrate, cola, cut, m0), planRank = 1;
    all.forEach(function(r){ if(r.pv > planRun.pv + 0.5) planRank++; });
    var planIdx = -1; all.forEach(function(r, k){ if(key(r.claims) === key(planClaims)) planIdx = k; });
    return {people:people, results:results, all:all, baseline:baseline, baselineNoCut:baselineNoCut, cut:cut, cola:cola, rate:rate, today:today, m0:m0,
            plan:{claims:planClaims, run:planRun, rank:planRank, tested:planIdx >= 0, alt:cut ? ssoSimulate(people, planClaims, mrate, cola, null, m0) : null}};
  }
  function ssoTitle(S, r){ return S.people.map(function(p, k){ return p.name + ' at ' + ssoAgeStr(r.claims[k]) + (r.claims[k] === p.fra ? ' (FRA)' : ''); }).join(', '); }
  function ssoShort(S, r){ return S.people.map(function(p, k){ return ssoAgeStr(r.claims[k]); }).join(' / '); }
  function ssoEvents(S, r){
    var ev = [], people = S.people, couple = people.length === 2, today = S.today;
    var addM = function(m){ var d = new Date(today.getFullYear(), today.getMonth() + m, 1); return longDate(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01').replace(/ \d+,/, ''); };
    people.forEach(function(p, k){
      var t = r.claims[k] - p.ageNow;
      if(r.claims[k] >= p.deathAge) return;
      var amt = r.parts[Math.max(t, 0)] ? r.parts[Math.max(t, 0)][k].own : r.own[k];
      ev.push({t:t, text:p.name + ' claims ' + (p.who === 'client' ? 'his or her' : 'his or her') + ' own benefit at age ' + ssoAgeStr(r.claims[k]) + (r.claims[k] === p.fra ? ' (FRA)' : '') + (t > 0 ? ' in ' + addM(t) : ' (already claimed)') + ', ' + money(amt) + ' a month.'});
      if(r.excess[k].amt > 0 && r.excess[k].start < Infinity){
        var ts = r.excess[k].start - p.ageNow;
        if(ts < r.parts.length && ts >= 0) ev.push({t:ts, text:p.name + ' adds the spousal benefit at age ' + ssoAgeStr(r.excess[k].start) + ' in ' + addM(ts) + ', adding ' + money(r.parts[ts][k].sp) + ' a month.'});
      }
    });
    if(couple){
      var dIdx = (people[0].deathAge - people[0].ageNow) <= (people[1].deathAge - people[1].ageNow) ? 0 : 1, sIdx = 1 - dIdx, td = people[dIdx].deathAge - people[dIdx].ageNow;
      if(td < r.parts.length && r.parts[td][sIdx].surv > 0) ev.push({t:td, text:people[sIdx].name + ' switches to the survivor benefit at age ' + ssoAgeStr(people[sIdx].ageNow + td) + ' in ' + addM(td) + ', ' + money(r.parts[td][sIdx].surv) + ' a month.'});
    }
    return ev.sort(function(a, b){ return a.t - b.t; });
  }
  /* the page: tiles, the top five, the cumulative chart, break-even ages */
  var ssoLast = null;
  function renderSso(i){
    if(!$('ssoTiles')) return;
    var spouse = hasSpouse(i);
    $('ssoLifeCLbl').firstChild.textContent = ownerLabel('client') + '’s life expectancy';
    $('ssoLifeSWrap').hidden = !spouse; if(spouse) $('ssoLifeSLbl').firstChild.textContent = ownerLabel('spouse') + '’s life expectancy';
    $('ssoDobCLbl').firstChild.textContent = ownerLabel('client') + '’s date of birth';
    $('ssoDobSWrap').hidden = !spouse; if(spouse) $('ssoDobSLbl').firstChild.textContent = ownerLabel('spouse') + '’s date of birth';
    if(document.activeElement !== $('ssoLifeC')) $('ssoLifeC').value = ssoCfg.lifeC || '';
    if(document.activeElement !== $('ssoLifeS')) $('ssoLifeS').value = ssoCfg.lifeS || '';
    if(document.activeElement !== $('ssoRate')) $('ssoRate').value = ssoCfg.rate || '';
    $('ssoDobC').value = ssoCfg.dobC || ''; $('ssoDobS').value = ssoCfg.dobS || ''; $('ssoCut').checked = ssoCfg.cutOn !== false;
    $('ssoLifeC').placeholder = String(SSO_LIFE[i.clientSex] || 85); $('ssoLifeS').placeholder = String(SSO_LIFE[i.spouseSex] || 88);
    $('ssoCutLbl').textContent = 'Rank with the trust-fund stress test (' + Math.round(SENS_SS.pct * 100) + '% cut from ' + SENS_SS.year + ', as in section 18)';
    var S = ssoRun(i); ssoLast = S;
    var svgEl = $('ssoSvg');
    if(!S){
      $('ssoTiles').innerHTML = '<div><dt>Claiming optimizer</dt><dd>—</dd><small>enter a Primary Insurance Amount above and the strategies rank here</small></div>';
      $('ssoTable').innerHTML = ''; $('ssoLegend').innerHTML = ''; svgEl.innerHTML = ''; svgEl.onmousemove = null; $('ssoBeTable').innerHTML = ''; $('ssoBeSub').textContent = '';
      $('ssoNote').textContent = ''; $('ssoAssume').innerHTML = ''; $('ssoMsg').textContent = ''; $('ssoUse').disabled = true;
      return;
    }
    var people = S.people, R = S.results, best = R[0], couple = people.length === 2, cut = S.cut, P = S.plan;
    var pc1 = function(v){ return (v * 100).toFixed(1) + '%'; };
    var planSame = P.claims.every(function(c, k){ return c === best.claims[k]; });
    $('ssoUse').disabled = planSame;
    $('ssoMsg').textContent = planSame ? 'The plan already uses the top strategy.' : 'Sets the benefit starting ages above to strategy #1' + (best.claims.some(function(c){ return c % 12; }) ? ' (rounded to whole years — the table takes whole ages)' : '') + '.';
    var survLine = '';
    if(couple){
      var sIdx = (people[0].deathAge - people[0].ageNow) > (people[1].deathAge - people[1].ageNow) ? 0 : 1;
      survLine = '<div><dt>Survivor income, strategy #1</dt><dd>' + money(Math.max(best.own[sIdx], best.survAmt[sIdx])) + '</dd><small>a month to ' + people[sIdx].name + ' after ' + people[1 - sIdx].name + ' passes, in today’s dollars</small></div>';
    }
    $('ssoTiles').innerHTML =
        '<div><dt>Top strategy</dt><dd style="font-size:1.05em">' + esc(ssoShort(S, best)) + '</dd><small>' + esc(people.map(function(p, k){ return p.name + ' at ' + ssoAgeStr(best.claims[k]) + (best.claims[k] === p.fra ? ' (FRA)' : ''); }).join(', ')) + ' · ' + (couple ? 'household ' : '') + money(best.firstMonthly) + ' a month when both are paying, today’s dollars</small></div>'
      + '<div><dt>Lifetime benefit</dt><dd>' + money(best.pv) + '</dd><small>' + (cut ? 'with the ' + Math.round(cut.pct * 100) + '% cut from ' + cut.year + ' · ' + money(best.alt.r.pv) + ' with no cut' : 'to the assumed lifespans') + (S.rate > 0 ? ' · present value at ' + pc1(S.rate) : '') + '</small></div>'
      + '<div><dt>The plan’s ages</dt><dd>' + esc(ssoShort(S, P.run)) + '</dd><small>' + (planSame ? 'the top strategy' : 'ranks #' + P.rank + ' of ' + S.all.length + ' · ' + money(best.pv - P.run.pv) + ' less than #1 over a lifetime') + (P.tested ? '' : ' · includes an age already past') + '</small></div>'
      + survLine;
    /* the top five */
    var p0 = people[0];
    var rows = R.map(function(r, k){
      var detail;
      if(!couple) detail = money(r.own[0]) + ' a month (' + Math.round(ssoOwnFactor(r.claims[0], p0.fra) * 100) + '% of PIA) for ' + Math.round((p0.deathAge - r.claims[0]) / 12) + ' years';
      else {
        var lines = people.map(function(p, j){ var s = p.name + ' ' + money(r.own[j]); if(r.excess[j].amt > 0) s += ' + ' + money(r.excess[j].amt) + ' spousal from ' + ssoAgeStr(r.excess[j].start); return s; });
        var si = (people[0].deathAge - people[0].ageNow) > (people[1].deathAge - people[1].ageNow) ? 0 : 1;
        lines.push('survivor ' + money(Math.max(r.own[si], r.survAmt[si])) + ' to ' + people[si].name);
        detail = lines.join(' · ');
      }
      var be = ssoCrossover(r, S.baseline, p0), same = r.claims.every(function(c, j){ return c === S.baseline.claims[j]; });
      return '<tr' + (k === 0 ? ' style="font-weight:600"' : '') + '><td>' + (k + 1) + '</td><td><b>' + esc(ssoShort(S, r)) + '</b><small style="display:block;color:var(--muted);font-weight:400">' + esc(detail) + '</small></td>'
        + '<td class="num"><b>' + money(r.pv) + '</b>' + (k > 0 ? '<small style="display:block;color:var(--muted);font-weight:400">−' + money(best.pv - r.pv) + ' vs #1</small>' : '') + '</td>'
        + (cut ? '<td class="num">' + money(r.alt.r.pv) + '<small style="display:block;color:var(--muted);font-weight:400">ranks #' + r.alt.rank + ' with no cut</small></td>' : '')
        + '<td class="num">' + (same ? '—' : '<span style="color:' + (be.ok ? 'var(--c-moat)' : 'var(--st-alert)') + '">' + esc(be.text) + '</span>') + '</td></tr>';
    });
    $('ssoTable').innerHTML = '<thead><tr><th>#</th><th>Strategy<small style="display:block;font-weight:400">' + esc(people.map(function(p){ return p.name; }).join(' / ')) + ' claiming ages · monthly amounts in today’s dollars</small></th><th class="num">Lifetime' + (cut ? ' <small>with cut</small>' : '') + '</th>' + (cut ? '<th class="num">No cut</th>' : '') + '<th class="num">Catches up to filing earliest<small style="display:block;font-weight:400">' + esc(ssoShort(S, S.baseline)) + ' · ' + esc(p0.name) + '’s age</small></th></tr></thead><tbody>' + rows.join('') + '</tbody>';
    /* cumulative chart */
    var W = 1000, H = 300, L = 74, Rm = 24, Tp = 26, B = 56, pw = W - L - Rm, ph = H - Tp - B;
    var len = Math.max.apply(null, R.map(function(r){ return r.series.length; })), maxY = Math.max.apply(null, R.map(function(r){ return r.cum; })) * 1.05;
    var X = function(t){ return L + pw * t / Math.max(1, len - 1); }, Y = function(v){ return Tp + ph - ph * v / maxY; };
    var fmtK = function(v){ return v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : '$' + Math.round(v / 1000) + 'k'; };
    var svg = '';
    for(var g = 0; g <= 4; g++){ var v = maxY * g / 4; svg += '<line x1="' + L + '" x2="' + (L + pw) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="var(--line)"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end" class="pj-tick">' + fmtK(v) + '</text>'; }
    for(var a = Math.ceil(p0.ageNow / 60) * 5; a * 12 <= p0.ageNow + len; a += 5){ var t0 = a * 12 - p0.ageNow; if(t0 < 0) continue; svg += '<text x="' + X(t0).toFixed(1) + '" y="' + (Tp + ph + 18) + '" text-anchor="middle" class="pj-tick">' + a + '</text>'; }
    svg += '<text x="' + (L + pw / 2).toFixed(1) + '" y="' + (Tp + ph + 36) + '" text-anchor="middle" class="pj-tick muted">' + esc(p0.name) + '’s age</text>';
    if(cut){ var tc = cut.startT; if(tc > 0 && tc < len) svg += '<line x1="' + X(tc).toFixed(1) + '" x2="' + X(tc).toFixed(1) + '" y1="' + Tp + '" y2="' + (Tp + ph) + '" stroke="var(--c-walls)" stroke-width="1.5" stroke-dasharray="4 3"/><text x="' + (X(tc) + 6).toFixed(1) + '" y="' + (Tp + 13) + '" class="pj-band" style="fill:var(--c-walls)">cut begins ' + cut.year + '</text>'; }
    R.forEach(function(r, k){
      var pts = r.series.map(function(v, t){ return X(t).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ');
      svg += '<polyline points="' + pts + '" fill="none" stroke="' + SSO_COLORS[k] + '" stroke-width="' + (k === 0 ? 2.5 : 1.6) + '" stroke-opacity="' + (k === 0 ? 1 : 0.8) + '"/>';
    });
    if(!P.tested || P.rank > 5){
      var ptsP = P.run.series.map(function(v, t){ return X(t).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ');
      svg += '<polyline points="' + ptsP + '" fill="none" stroke="var(--ink)" stroke-width="1.4" stroke-dasharray="6 4" stroke-opacity=".7"/>';
    }
    svg += '<rect x="' + L + '" y="' + Tp + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>';
    svgEl.innerHTML = svg;
    $('ssoLegend').innerHTML = R.map(function(r, k){ return '<span class="pj-key"><i class="sw" style="background:' + SSO_COLORS[k] + ';height:3px;margin-top:6px"></i>' + (k + 1) + '. ' + esc(ssoShort(S, r)) + '</span>'; }).join('')
      + ((!P.tested || P.rank > 5) ? '<span class="pj-key"><i class="sw" style="background:none;border-top:2px dashed var(--ink);height:0;margin-top:6px"></i>The plan’s ages (' + esc(ssoShort(S, P.run)) + ')</span>' : '')
      + '<span class="pj-key"><small>running total of benefits received, with COLA' + (cut ? ' and the cut' : '') + ' · where lines cross is the break-even age</small></span>';
    var tip = $('ssoTip');
    svgEl.onmousemove = function(ev){
      var rect = svgEl.getBoundingClientRect(), fx = (ev.clientX - rect.left) / rect.width * W;
      var t = Math.max(0, Math.min(len - 1, Math.round((fx - L) / pw * (len - 1))));
      tip.hidden = false;
      tip.innerHTML = '<b>' + esc(p0.name) + ' age ' + ssoAgeStr(p0.ageNow + t) + '</b>' + R.map(function(r, k){ return '<div><span>' + (k + 1) + '. ' + esc(ssoShort(S, r)) + '</span><span>' + money(r.series[Math.min(t, r.series.length - 1)]) + '</span></div>'; }).join('')
        + ((!P.tested || P.rank > 5) ? '<div><span>Plan ' + esc(ssoShort(S, P.run)) + '</span><span>' + money(P.run.series[Math.min(t, P.run.series.length - 1)]) + '</span></div>' : '');
      var px = (ev.clientX - rect.left), left = px + 14; if(left + 260 > rect.width) left = px - 274;
      tip.style.left = left + 'px'; tip.style.top = Math.max(0, (ev.clientY - rect.top) - 30) + 'px';
    };
    svgEl.onmouseleave = function(){ tip.hidden = true; };
    /* break-even table */
    var lbl = function(r){ return ssoShort(S, r); }, sameB = function(r){ return r.claims.every(function(c, j){ return c === S.baseline.claims[j]; }); };
    var cell = function(c){ return '<td class="num"' + (c.always ? '' : ' style="color:' + (c.ok ? 'var(--c-moat)' : 'var(--st-alert)') + ';font-weight:600"') + '>' + esc(c.text) + '</td>'; };
    var h = '<thead><tr><th>Strategy</th><th class="num">vs filing earliest (' + esc(lbl(S.baseline)) + ')' + (cut ? ' — with cut' : '') + '</th>' + (cut ? '<th class="num">— no cut</th>' : '') + R.map(function(_, k){ return '<th class="num">vs #' + (k + 1) + '</th>'; }).join('') + '</tr></thead><tbody>';
    R.forEach(function(r, k){
      h += '<tr><td>#' + (k + 1) + ' — ' + esc(lbl(r)) + '</td>' + (sameB(r) ? '<td class="num">—</td>' : cell(ssoCrossover(r, S.baseline, p0)));
      if(cut) h += sameB(r) ? '<td class="num">—</td>' : cell(ssoCrossover(r.alt.r, S.baselineNoCut, p0));
      R.forEach(function(o, j){ h += k === j ? '<td class="num">—</td>' : cell(ssoCrossover(r, o, p0)); });
      h += '</tr>';
    });
    $('ssoBeTable').innerHTML = h + '</tbody>';
    $('ssoBeSub').textContent = p0.name + '’s age at which each strategy’s cumulative benefits catch up to the alternative' + (cut ? ' (strategy-versus-strategy columns assume the cut)' : '') + '. Green: before the assumed lifespan of ' + ssoAgeStr(p0.deathAge) + '; red: the earlier filing would still be ahead.';
    /* words */
    $('ssoNote').innerHTML = people.map(function(p){ return '<b>' + esc(p.name) + '</b>: FRA ' + ssoAgeStr(p.fra) + ', now ' + ssoAgeStr(p.ageNow) + (p.dob ? '' : ' (whole years from section 02)') + ', PIA ' + money(p.pia) + ', to age ' + ssoAgeStr(p.deathAge) + (p.lifeDefault ? ' (default)' : ''); }).join(' · ')
      + ' · COLA ' + pc1(S.cola) + (S.rate > 0 ? ' · discounted at ' + pc1(S.rate) : '') + (cut ? ' · ranked with the ' + Math.round(cut.pct * 100) + '% cut from ' + cut.year + '; the no-cut total sits alongside' : '') + '. '
      + (planSame ? 'The claiming ages in the table above are the top strategy.' : 'Against the plan’s ages (' + esc(ssoShort(S, P.run)) + ', ' + money(P.run.pv) + '), strategy #1 adds <b>' + money(best.pv - P.run.pv) + '</b> over the assumed lifespans' + (cut && P.alt ? ' (' + money(best.alt.r.pv - P.alt.pv) + ' with no cut)' : '') + '. Press <b>Use the top strategy in the plan</b> to adopt it; the income projections, the Foundation sizing and every report follow.');
    $('ssoAssume').innerHTML = '<b>How it works.</b> Every claiming age from 62 to 70 and full retirement age is tested for each person (ages already past are skipped), paid month by month to the assumed lifespan: SSA’s early-claiming reductions (5/9% a month for 36 months, 5/12% after) and delayed credits (8% a year to 70); for a couple the spousal top-up to 50% of the higher PIA (reduced before FRA, payable once the other spouse has filed, with deemed filing) and the survivor benefit — the larger of the two, with the 82.5% floor. COLA is applied each January to every benefit, whether or not it has started. Ages are whole years from section 02 unless a date of birth is given here. Not modelled: the earnings test, income tax on benefits, WEP/GPO, restricted applications, disability or dependent benefits. Illustrative only — verify with SSA figures before advising.';
  }
