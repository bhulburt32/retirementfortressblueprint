
  /* ============================================================
     Scenarios. From section 14 on, the plan branches into three scenarios —
     A (green), B (yellow) and C (purple). Each carries its own adjusted
     transfers, annuity income and LTC benefit terms, Walls assumptions,
     withdrawal order and Roth strategy; sections 14–19 show the scenario
     being viewed, tinted in its colour, and the strip at the top of section
     14 sets the three side by side. The active scenario's state lives in
     the page's working variables; the other two are parked in `scenarios`
     and swapped in when viewed. Section 20 picks which scenario the
     reports are built from.
     ============================================================ */
  var SCN_META = [{key:'a', letter:'A', color:'#2E7D32', bg:'rgba(46,125,50,.10)'},
                  {key:'b', letter:'B', color:'#B07D00', bg:'rgba(201,152,0,.13)'},
                  {key:'c', letter:'C', color:'#6A3FA0', bg:'rgba(106,63,160,.12)'}];
  var SCN_SECTIONS = ['adjSec','adjAllocSec','taxSec','assetSec','seqSec','endSec'];
  var scnNames = ['Scenario A', 'Scenario B', 'Scenario C'];
  var scenarios = [null, null, null], activeScn = 0, reportScn = 0;
  function scnDefault(){
    return {adjMoves:null, INC_ADJ:{yF:'', fStart:'', yW:'', wStart:'', gPre:'', gPost:''}, ANN_INC:{}, LTC_BEN:{},
            wdOrder:WD_DEFAULT.slice(), rothCfg:{apply:true, target:'auto', start:'auto', order:'roof', irmaa:true}};
  }
  function scnClone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }
  /* the working variables, parked */
  function scnSnapshot(){
    return {adjMoves:adjMoves ? adjMoves.map(scnClone) : null, INC_ADJ:scnClone(INC_ADJ), ANN_INC:scnClone(ANN_INC), LTC_BEN:scnClone(LTC_BEN),
            wdOrder:wdOrder.slice(), rothCfg:scnClone(rothCfg)};
  }
  /* a parked state back into the working variables (the engine's view only) */
  function scnRestoreGlobals(S){
    S = S || scnDefault();
    adjMoves = S.adjMoves ? S.adjMoves.map(scnClone).filter(function(m){ return !!acctById(m.acctId); }) : null;
    if(adjMoves && !adjMoves.length) adjMoves = null;
    INC_ADJ = scnClone(S.INC_ADJ) || scnDefault().INC_ADJ;
    ANN_INC = scnClone(S.ANN_INC) || {}; LTC_BEN = scnClone(S.LTC_BEN) || {};
    wdOrder = (S.wdOrder || WD_DEFAULT).slice(); rothCfg = scnClone(S.rothCfg) || scnDefault().rothCfg;
  }
  /* …and the page's controls with it */
  function scnRestore(S){
    scnRestoreGlobals(S);
    annSig = ''; ltcBenSig = ''; autoSig = null; autoDirty = true;
    $('adjYW').value = INC_ADJ.yW || ''; $('adjGPre').value = INC_ADJ.gPre || ''; $('adjGPost').value = INC_ADJ.gPost || '';
    $('adjWStart').value = INC_ADJ.wStart || '';
  }
  function scnFor(k){ return k === activeScn ? scnSnapshot() : (scenarios[k] || scnDefault()); }
  /* run fn with scenario k's state in the working variables, the page untouched */
  function withScnGlobals(k, fn){
    if(k === activeScn) return fn();
    var keep = scnSnapshot();
    scnRestoreGlobals(scenarios[k] || scnDefault());
    try { return fn(); } finally { scnRestoreGlobals(keep); }
  }
  /* run fn with scenario k showing on the page (the reports clone live charts), then switch back */
  function withScnView(k, fn){
    if(k === activeScn) return fn();
    var prev = activeScn;
    switchScenario(k);
    try { return fn(); } finally { switchScenario(prev); }
  }
  function switchScenario(k){
    k = Math.max(0, Math.min(2, k | 0));
    if(k === activeScn){ scnChrome(); return; }
    scenarios[activeScn] = scnSnapshot();
    activeScn = k;
    scnRestore(scenarios[k] || scnDefault());
    scenarios[k] = null;
    renderAdjustTable();
    render();
  }
  function copyScenario(from, to){
    if(from === to) return;
    var S = scnFor(from);
    if(to === activeScn){ scnRestore(S); renderAdjustTable(); render(); }
    else { scenarios[to] = S; render(); }
  }
  /* the tint, the tags on the section headers, the tabs and the report pick */
  function scnChrome(){
    var M = SCN_META[activeScn];
    document.body.classList.remove('scn-a', 'scn-b', 'scn-c');
    document.body.classList.add('scn-' + M.key);
    SCN_SECTIONS.forEach(function(id){
      var sec = $(id); if(!sec) return;
      sec.classList.add('scn');
      var head = sec.querySelector('.sec-head'); if(!head) return;
      var tag = head.querySelector('.scn-tag');
      if(!tag){ tag = document.createElement('span'); tag.className = 'scn-tag'; head.appendChild(tag); }
      tag.textContent = scnNames[activeScn];
      tag.style.background = M.color;
    });
    $('scnTabs').innerHTML = SCN_META.map(function(m, k){
      return '<button type="button" class="scn-tab' + (k === activeScn ? ' on' : '') + '" data-scn="' + k + '" style="--scn:' + m.color + '">'
        + '<i></i>' + esc(scnNames[k]) + (k === reportScn ? '<small>reports</small>' : '') + '</button>';
    }).join('');
    if(document.activeElement !== $('scnName')) $('scnName').value = scnNames[activeScn];
    var cp = $('scnCopyTo'), was = cp.value;
    cp.innerHTML = '<option value="">Copy this scenario into…</option>' + SCN_META.map(function(m, k){ return k === activeScn ? '' : '<option value="' + k + '">' + esc(scnNames[k]) + '</option>'; }).join('');
    cp.value = '';
    var rs = $('reportScn');
    rs.innerHTML = SCN_META.map(function(m, k){ return '<option value="' + k + '">' + esc(scnNames[k]) + (k === activeScn ? ' (viewing)' : '') + '</option>'; }).join('');
    rs.value = String(reportScn);
    $('reportScnMsg').textContent = reportScn === activeScn
      ? 'The reports build from ' + scnNames[reportScn] + ', the scenario showing on this page.'
      : 'The reports build from ' + scnNames[reportScn] + ' — the page switches to it while they build, then back to ' + scnNames[activeScn] + '.';
  }
  /* the strip: the three scenarios' headline figures, side by side */
  function scnMetrics(k){
    return withScnGlobals(k, function(){
      var r = compute();
      var TXb = projectTax(r, {convert:null}), cfg = rothOptions(TXb), TX = cfg.apply ? projectTax(r, {convert:cfg}) : TXb;
      var last = TX.rows[TX.rows.length - 1], dep = TX.rows.filter(function(x){ return x.unfunded > 0.5; })[0];
      var AS = annuitySummary(r), MC = moatContracts(r);
      var S = scnFor(k);
      var n = (S.adjMoves ? S.adjMoves.length : 0);
      return {r:r, funded:r.funded, annuity:AS.total, moatBenefit:MC.reduce(function(a, c){ return a + (c.benefit || 0); }, 0),
              converted:TX.convTotal || 0, rothOn:!!cfg.apply, tax:TX.lifetime + TX.lifetimeState, end:last.layers.total, endYear:last.year, dep:dep,
              adjusted:!!S.adjMoves, lines:n, wd:(S.wdOrder || WD_DEFAULT).map(function(t){ return ({taxable:'Taxable', deferred:'Tax-deferred', roth:'Roth'})[t] || t; }).join(' \u2192 ')};
    });
  }
  function renderScenarioBar(){
    scnChrome();
    var grid = $('scnGrid'); if(!grid) return;
    if(!accounts.length){ grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Add the client’s accounts in section 06 and the three scenarios appear here side by side.</div>'; return; }
    var M = [0, 1, 2].map(scnMetrics);
    var rows = [
      ['Foundation', function(m){ return money(m.funded.foundation); }],
      ['Walls', function(m){ return money(m.funded.walls); }],
      ['Roof', function(m){ return money(m.funded.roof); }],
      ['Moat', function(m){ return money(m.funded.moat); }],
      ['Annuity income at the start', function(m){ return m.annuity > 0.5 ? money(m.annuity) + ' a year' : '—'; }],
      ['LTC benefit', function(m){ return m.moatBenefit > 0.5 ? money(m.moatBenefit) : '—'; }],
      ['Roth conversions', function(m){ return m.rothOn ? (m.converted > 0.5 ? money(m.converted) : 'none fit') : 'off'; }],
      ['Withdrawal order', function(m){ return m.wd; }],
      ['Lifetime income tax', function(m){ return money(m.tax); }],
      ['Assets at end of plan', function(m){ return m.dep ? '<span style="color:var(--st-alert)">run out ' + m.dep.year + '</span>' : money(m.end) + ' <small>' + m.endYear + '</small>'; }]
    ];
    grid.innerHTML = M.map(function(m, k){
      var meta = SCN_META[k], on = k === activeScn;
      return '<div class="scn-card' + (on ? ' on' : '') + '" style="--scn:' + meta.color + ';--scn-bg:' + meta.bg + '">'
        + '<div class="scn-card-head"><b>' + esc(scnNames[k]) + '</b><span>' + (m.adjusted ? m.lines + ' adjusted line' + (m.lines === 1 ? '' : 's') : 'the model’s own proposal') + '</span></div>'
        + '<dl>' + rows.map(function(row){ return '<div><dt>' + row[0] + '</dt><dd>' + row[1](m) + '</dd></div>'; }).join('') + '</dl>'
        + '<div class="scn-card-foot">'
        + (on ? '<span class="scn-viewing">Viewing</span>' : '<button type="button" data-scn-view="' + k + '">View ' + esc(scnNames[k]) + '</button>')
        + '<label><input type="radio" name="scnReport" value="' + k + '"' + (k === reportScn ? ' checked' : '') + '> Use for the reports</label>'
        + '</div></div>';
    }).join('');
  }
  /* the case file: every scenario, and which is showing / reported */
  function scnSerialize(S){
    var ids = accounts.map(function(a){ return a.id; });
    return {adjMoves:S.adjMoves ? S.adjMoves.map(function(m){
              var t = {acct:ids.indexOf(m.acctId), bucket:m.bucket, amt:m.amt};
              OVR_KEYS.forEach(function(k){ if(m[k] != null){ t[k] = m[k]; if(m[k + 'C']) t[k + 'C'] = true; } });
              return t; }).filter(function(t){ return t.acct >= 0; }) : null,
            incomeAdj:S.INC_ADJ, annuityIncome:S.ANN_INC, ltcBenefits:S.LTC_BEN, withdrawalOrder:S.wdOrder, roth:S.rothCfg};
  }
  function scnParse(d){
    var S = scnDefault(); if(!d || typeof d !== 'object') return S;
    if(Array.isArray(d.adjMoves)){
      S.adjMoves = d.adjMoves.map(function(t){
        var a = accounts[t.acct]; if(!a) return null;
        var o = {acctId:a.id, bucket:t.bucket, amt:t.amt};
        OVR_KEYS.forEach(function(k){ if(typeof t[k] === 'string'){ o[k] = t[k]; o[k + 'C'] = !!t[k + 'C']; } });
        return mkAdj(o);
      }).filter(Boolean);
      if(!S.adjMoves.length) S.adjMoves = null;
    }
    if(d.incomeAdj && typeof d.incomeAdj === 'object') Object.keys(S.INC_ADJ).forEach(function(k){ if(d.incomeAdj[k] != null) S.INC_ADJ[k] = String(d.incomeAdj[k]); });
    if(d.annuityIncome && typeof d.annuityIncome === 'object') Object.keys(d.annuityIncome).forEach(function(k){ var v = d.annuityIncome[k] || {}; S.ANN_INC[k] = {gli:String(v.gli || ''), start:String(v.start || ''), monthly:String(v.monthly || ''), cola:String(v.cola || ''), wd:String(v.wd || '')}; });
    if(d.ltcBenefits && typeof d.ltcBenefits === 'object') Object.keys(d.ltcBenefits).forEach(function(k){ var v = d.ltcBenefits[k] || {}; S.LTC_BEN[k] = {monthly:String(v.monthly || ''), age:String(v.age || ''), years:String(v.years || ''), infl:String(v.infl || '')}; });
    if(Array.isArray(d.withdrawalOrder)){
      var seen = d.withdrawalOrder.filter(function(k, i, arr){ return WD_TIERS[k] && arr.indexOf(k) === i; });
      WD_DEFAULT.forEach(function(k){ if(seen.indexOf(k) < 0) seen.push(k); });
      S.wdOrder = seen;
    }
    if(d.roth && typeof d.roth === 'object'){
      var RC = d.roth;
      S.rothCfg = {apply:RC.apply !== false, target:(RC.target === 'auto' || RC.target == null) ? 'auto' : Number(RC.target),
                   start:(RC.start === 'auto' || RC.start == null) ? 'auto' : Number(RC.start), order:RC.order === 'walls' ? 'walls' : 'roof', irmaa:RC.irmaa !== false};
    }
    return S;
  }
  function scnReset(){
    scenarios = [null, null, null]; activeScn = 0; reportScn = 0; scnNames = ['Scenario A', 'Scenario B', 'Scenario C'];
  }
