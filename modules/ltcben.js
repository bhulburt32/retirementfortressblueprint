
  /* ============ LTC benefits: one line per contract in the Moat (section 14) ============
     Each Moat line can carry its own benefit terms: the monthly benefit at a
     given age (80 by default), the benefit period in years, and an inflation
     rider. Blank cells follow the Moat sizing — the person's target benefit
     spread evenly over the section 09 years of care, from age 80, level.
     The terms drive the Moat benefit shown for the contract and the care-
     event projections in sections 06 and 17. */
  var LTC_BEN = {}, ltcBenSig = '';
  function ltcBenKey(acct, who){ return accounts.indexOf(acct) + ':moat:' + who; }
  function ltcContracts(r){
    if(!r || r.statusQuo || !r.funded || !(r.funded.moat > 0.5) || !r.moves) return [];
    var i = r.inputs, out = [], tot = {client:0, spouse:0}, planBen = {client:0, spouse:0};
    var lines = (typeof lineLedger === 'function') ? lineLedger(r).lines : [];
    var mv = r.moves.filter(function(m){ return m.bucket === 'moat' && m.amt > 0.5 && m.acct; });
    var whoOf = function(m){ return m.person === 'spouse' ? 'spouse' : 'client'; };
    mv.forEach(function(m){ tot[whoOf(m)] += m.amt; });
    ((r.moat && r.moat.people) || []).forEach(function(p){ planBen[p.label] = p.benefit || 0; });
    var est = {client:ltcPerson('client'), spouse:ltcPerson('spouse')};
    mv.forEach(function(m){
      var w = whoOf(m), L = lines.filter(function(x){ return x.a && x.a.id === m.acct.id && x.m.bucket === 'moat'; })[0];
      var key = ltcBenKey(m.acct, w), S = LTC_BEN[key] || {};
      var p = est[w], defYears = (p && p.totalYears > 0) ? Math.round(p.totalYears * 10) / 10 : 3;
      var share = tot[w] > 0.5 ? m.amt / tot[w] : 1;
      var defMonthly = Math.round(planBen[w] * share / (12 * defYears) / 10) * 10;
      var has = function(k){ return S[k] != null && String(S[k]).trim() !== ''; };
      var years = has('years') ? Math.max(0, num(S.years)) : defYears;
      var monthly = has('monthly') ? Math.max(0, num(S.monthly)) : defMonthly;
      var ageAt = has('age') ? Math.max(0, Math.round(num(S.age))) : LTC_COST_AGE;
      var infl = has('infl') ? pctIn(S.infl) : 0;
      out.push({key:key, who:w, owner:w, name:(m.acct.name || 'Account'), srcOwner:m.acct.owner, cust:L ? L.cust : (i.ltcCarrier || 'Carrier TBD'), prod:L ? L.prod : 'LTC contract', to:L ? L.to : '',
                amt:m.amt, monthly:monthly, years:years, ageAt:ageAt, infl:infl, total:monthly * 12 * years,
                set:S, defMonthly:defMonthly, defYears:defYears, any:['monthly','age','years','infl'].some(has)});
    });
    return out;
  }
  /* the benefit pools the care-event projections draw on: one contract per Moat line, by insured */
  function ltcPools(r){
    var pool = {client:[], spouse:[]};
    ltcContracts(r).forEach(function(c){ if(c.total > 0.5) pool[c.who].push({cap:c.monthly * 12, ageAt:c.ageAt, years:c.years, infl:c.infl}); });
    return pool;
  }
  function ltcPoolTotal(arr){ return (arr || []).reduce(function(a, k){ return a + (k.total != null ? k.total : k.cap * k.years); }, 0); }
  function ltcBenWords(c){
    return money(c.monthly) + ' a month from age ' + c.ageAt + ' for ' + c.years.toFixed(1) + ' years (' + money(c.total) + ' of benefit' + (c.infl > 0 ? ', rising ' + (c.infl * 100).toFixed(1) + '% a year' : ', level') + ')';
  }
  function renderLtcBenefits(r){
    var body = $('ltcBenBody'); if(!body) return;
    var cs = ltcContracts(r);
    var sig = cs.map(function(c){ return c.key + '|' + c.name + '|' + c.to + '|' + c.cust + '|' + c.prod; }).join(';');
    if(sig !== ltcBenSig){
      ltcBenSig = sig;
      body.innerHTML = !cs.length ? '<tr><td colspan="6"><div class="empty-state">No line in the transfer list above goes to the <b>Moat</b> yet — the LTC contracts appear here once one does.</div></td></tr>' : cs.map(function(c){
        return '<tr data-ltc="' + esc(c.key) + '">'
          + '<td><b>' + esc(ownerLabel(c.who)) + ' LTC Contract</b> · from ' + esc(c.name) + '<small class="sub">' + esc([c.to, c.cust, c.prod].filter(Boolean).join(' · ')) + '</small></td>'
          + '<td class="num" data-lf="amt"></td>'
          + '<td class="num"><input class="num" inputmode="numeric" data-lk="monthly" autocomplete="off" title="Monthly benefit at the age below"></td>'
          + '<td class="num"><input class="num" inputmode="numeric" data-lk="age" placeholder="80" autocomplete="off" title="The age the monthly benefit is quoted at"></td>'
          + '<td class="num"><input class="num" inputmode="decimal" data-lk="years" autocomplete="off" title="Benefit period in years"></td>'
          + '<td class="num"><input class="num" inputmode="decimal" data-lk="infl" placeholder="0.0%" autocomplete="off" title="Annual increase in the monthly benefit after that age"></td></tr>';
      }).join('');
      cs.forEach(function(c){
        var tr = body.querySelector('tr[data-ltc="' + CSS.escape(c.key) + '"]');
        ['monthly','age','years','infl'].forEach(function(k){ var el = tr.querySelector('[data-lk="' + k + '"]'); if(el) el.value = c.set[k] || ''; });
      });
    }
    cs.forEach(function(c){
      var tr = body.querySelector('tr[data-ltc="' + CSS.escape(c.key) + '"]'); if(!tr) return;
      tr.querySelector('[data-lf="amt"]').textContent = money(c.amt);
      tr.querySelector('[data-lk="monthly"]').placeholder = fmtN.format(c.defMonthly);
      tr.querySelector('[data-lk="years"]').placeholder = c.defYears.toFixed(1);
      ['monthly','age','years','infl'].forEach(function(k){ var el = tr.querySelector('[data-lk="' + k + '"]'); el.classList.toggle('auto', el.value.trim() === ''); });
    });
    $('ltcBenHint').textContent = cs.length
      ? cs.map(function(c){ return ownerLabel(c.who) + ' — ' + ltcBenWords(c); }).join('; ') + '. Blank cells follow the Moat sizing: the person’s target benefit spread over the section 09 years of care, from age ' + LTC_COST_AGE + ', level. The benefit pays first in the care-event projections of sections 06 and 17.'
      : 'The Moat’s benefit follows the section 09 sizing until a Moat line is listed above.';
  }
