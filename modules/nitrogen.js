
  /* ============================================================
     Nitrogen Wealth report (section 12). The advisor uploads the PDF of the
     client's current-portfolio analysis. The page reads the PDF's text
     itself (no library: objects, FlateDecode streams via the browser's
     DecompressionStream, ToUnicode maps for the fonts), then summarises the
     portfolio in aggregate, its Risk Number and the stress tests. Where the
     page runs inside Claude the summary is drafted by Claude from the text;
     elsewhere, and as a fallback, a reader picks the figures out of the text
     by their labels. The text and the summary travel with the case.
     ============================================================ */
  var nitro = null;   // {name, text, analysis, src:'claude'|'text', at}

  /* ---- PDF text ---- */
  function pdfInflate(bytes){
    if(typeof DecompressionStream === 'undefined') return Promise.reject(new Error('this browser cannot read compressed PDFs'));
    var tryWith = function(fmt){ var ds = new DecompressionStream(fmt), w = ds.writable.getWriter(); w.write(bytes.slice(0)); w.close(); return new Response(ds.readable).arrayBuffer().then(function(b){ return new Uint8Array(b); }); };
    return tryWith('deflate').catch(function(){ return tryWith('deflate-raw'); });
  }
  function pdfLatin(bytes){ var s = '', CH = 8192; for(var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH)); return s; }
  /* a PDF dictionary's value for a key, as raw text (handles nested << >> and [ ]) */
  function pdfDictVal(dict, key){
    var i = dict.indexOf('/' + key); if(i < 0) return null;
    var j = i + key.length + 1; while(j < dict.length && /\s/.test(dict[j])) j++;
    var c = dict[j];
    if(c === '<' && dict[j + 1] === '<'){ var d = 0, k = j; for(; k < dict.length; k++){ if(dict[k] === '<' && dict[k + 1] === '<'){ d++; k++; } else if(dict[k] === '>' && dict[k + 1] === '>'){ d--; k++; if(d === 0) return dict.slice(j, k + 1); } } return dict.slice(j); }
    if(c === '['){ var d2 = 0, k2 = j; for(; k2 < dict.length; k2++){ if(dict[k2] === '[') d2++; else if(dict[k2] === ']'){ d2--; if(d2 === 0) return dict.slice(j, k2 + 1); } } return dict.slice(j); }
    var m = /^(\d+\s+\d+\s+R|\/?[^\s\/\[\]<>()]+)/.exec(dict.slice(j)); return m ? m[1] : null;
  }
  function pdfRef(v){ var m = /^(\d+)\s+\d+\s+R$/.exec(String(v || '').trim()); return m ? +m[1] : null; }
  /* every object in the file, including those packed in object streams */
  function pdfObjects(bytes){
    var raw = pdfLatin(bytes), objs = {}, re = /(\d+)\s+(\d+)\s+obj\b/g, m, pend = [];
    while((m = re.exec(raw))){
      var num = +m[1], start = m.index + m[0].length, end = raw.indexOf('endobj', start); if(end < 0) end = raw.length;
      var body = raw.slice(start, end), si = body.indexOf('stream');
      var o = {num:num, dict:si >= 0 ? body.slice(0, si) : body, stream:null};
      if(si >= 0){
        var ds = start + si + 6; if(raw[ds] === '\r') ds++; if(raw[ds] === '\n') ds++;
        var lenV = pdfDictVal(o.dict, 'Length'), len = /^\d+$/.test(String(lenV || '').trim()) ? +lenV : null;
        var de = len != null ? ds + len : raw.indexOf('endstream', ds);
        if(len != null && raw.slice(de, de + 12).indexOf('endstream') < 0){ de = raw.indexOf('endstream', ds); }
        o.stream = bytes.subarray(ds, de); o.lenRef = len == null ? pdfRef(lenV) : null;
      }
      objs[num] = o; re.lastIndex = end;
    }
    Object.keys(objs).forEach(function(k){ var o = objs[k]; if(o.lenRef && objs[o.lenRef]){ var L = +String(objs[o.lenRef].dict).trim(); if(L > 0) o.stream = o.stream.subarray(0, L); } });
    var decode = function(o){
      if(!o.stream) return Promise.resolve(null);
      var f = pdfDictVal(o.dict, 'Filter') || '';
      if(/FlateDecode/.test(f)) return pdfInflate(o.stream).catch(function(){ return null; });
      if(!f || /^\/?$/.test(f.trim())) return Promise.resolve(o.stream);
      return Promise.resolve(null);   // DCT, LZW etc.: not text
    };
    /* unpack object streams */
    var stms = Object.keys(objs).map(function(k){ return objs[k]; }).filter(function(o){ return /\/Type\s*\/ObjStm/.test(o.dict); });
    return Promise.all(stms.map(function(o){
      return decode(o).then(function(b){
        if(!b) return;
        var txt = pdfLatin(b), n = +pdfDictVal(o.dict, 'N'), first = +pdfDictVal(o.dict, 'First');
        var hdr = txt.slice(0, first).trim().split(/\s+/);
        for(var i = 0; i < n; i++){
          var num = +hdr[2 * i], off = +hdr[2 * i + 1], nxt = i + 1 < n ? +hdr[2 * i + 3] : txt.length - first;
          if(!objs[num]) objs[num] = {num:num, dict:txt.slice(first + off, first + nxt), stream:null, pend:[]};
        }
      });
    })).then(function(){ return {objs:objs, decode:decode}; });
  }
  /* ToUnicode CMap -> {code(hex string, 2 or 4 digits): text} */
  function pdfCMap(txt){
    var map = {}, m, re1 = /beginbfchar([\s\S]*?)endbfchar/g, re2 = /beginbfrange([\s\S]*?)endbfrange/g;
    var u = function(hex){ var s = ''; for(var i = 0; i + 4 <= hex.length; i += 4){ var c = parseInt(hex.slice(i, i + 4), 16); if(c >= 0xD800 && c <= 0xDBFF && i + 8 <= hex.length){ var lo = parseInt(hex.slice(i + 4, i + 8), 16); s += String.fromCharCode(c, lo); i += 4; } else s += String.fromCharCode(c); } return s; };
    while((m = re1.exec(txt))){ var pr = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g, p; while((p = pr.exec(m[1]))) map[p[1].toLowerCase()] = u(p[2]); }
    while((m = re2.exec(txt))){
      var rr = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]*)>|\[([^\]]*)\])/g, q;
      while((q = rr.exec(m[1]))){
        var lo = parseInt(q[1], 16), hi = parseInt(q[2], 16), w = q[1].length;
        if(hi - lo > 65535) continue;
        if(q[5] != null){ var arr = q[5].match(/<([0-9a-fA-F]*)>/g) || []; for(var i = 0; i <= hi - lo && i < arr.length; i++) map[(lo + i).toString(16).padStart(w, '0')] = u(arr[i].slice(1, -1)); }
        else { var base = parseInt(q[4], 16); for(var j = 0; j <= hi - lo; j++){ var cp = base + j; map[(lo + j).toString(16).padStart(w, '0')] = cp > 0xFFFF ? String.fromCodePoint(cp) : String.fromCharCode(cp); } }
      }
    }
    return map;
  }
  /* the text of one content stream, with the page's fonts */
  function pdfContentText(content, fonts){
    var s = content, i = 0, out = '', font = null, lastY = null;
    var emitStr = function(str){ out += str; };
    var decodeLit = function(lit){
      var r = '', k;
      for(k = 0; k < lit.length; k++){
        var c = lit[k];
        if(c === '\\'){ k++; var n = lit[k]; if(n === 'n') r += '\n'; else if(n === 'r') r += ''; else if(n === 't') r += ' '; else if(/[0-7]/.test(n)){ var oct = n; while(oct.length < 3 && /[0-7]/.test(lit[k + 1] || '')) oct += lit[++k]; r += String.fromCharCode(parseInt(oct, 8)); } else if(n === '\n'){ } else r += n; }
        else r += c;
      }
      if(font && font.map && !font.twoByte){ var o2 = ''; for(k = 0; k < r.length; k++){ var h = r.charCodeAt(k).toString(16).padStart(2, '0'); o2 += font.map[h] != null ? font.map[h] : r[k]; } return o2; }
      if(font && font.map && font.twoByte){ var o3 = ''; for(k = 0; k + 1 < r.length; k += 2){ var h2 = (r.charCodeAt(k) * 256 + r.charCodeAt(k + 1)).toString(16).padStart(4, '0'); o3 += font.map[h2] != null ? font.map[h2] : ''; } return o3; }
      return r;
    };
    var decodeHex = function(hex){
      hex = hex.replace(/\s+/g, '').toLowerCase(); if(hex.length % 2) hex += '0';
      var r = '', w = (font && font.twoByte) ? 4 : 2;
      for(var k = 0; k + w <= hex.length; k += w){ var code = hex.slice(k, k + w); if(font && font.map && font.map[code] != null) r += font.map[code]; else if(w === 2) r += String.fromCharCode(parseInt(code, 16)); else { var cp = parseInt(code, 16); r += cp >= 32 ? String.fromCharCode(cp) : ''; } }
      return r;
    };
    var toks = [], re = /\((?:\\.|[^\\)])*\)|<[0-9a-fA-F\s]*>|\[|\]|\/[^\s\/\[\]<>()]+|-?\d*\.?\d+|[A-Za-z'"*]+/g, m, tok;
    while((m = re.exec(s))) toks.push(m[0]);
    var stack = [], inArr = false, arr = [];
    for(i = 0; i < toks.length; i++){
      tok = toks[i];
      if(tok === '['){ inArr = true; arr = []; continue; }
      if(tok === ']'){ inArr = false; stack.push(arr); continue; }
      if(tok[0] === '(' || tok[0] === '<'){ if(inArr) arr.push(tok); else stack.push(tok); continue; }
      if(/^-?\d*\.?\d+$/.test(tok)){ if(inArr) arr.push(+tok); else stack.push(+tok); continue; }
      if(tok[0] === '/'){ stack.push(tok); continue; }
      /* operators */
      if(tok === 'Tf'){ var fn = stack[stack.length - 2]; font = (typeof fn === 'string' && fonts[fn.slice(1)]) || null; }
      else if(tok === 'Tj' || tok === "'" || tok === '"'){ var st = stack[stack.length - 1]; if(typeof st === 'string'){ if(tok !== 'Tj') out += '\n'; emitStr(st[0] === '(' ? decodeLit(st.slice(1, -1)) : decodeHex(st.slice(1, -1))); } }
      else if(tok === 'TJ'){ var a = stack[stack.length - 1]; if(Array.isArray(a)){ a.forEach(function(el){ if(typeof el === 'string') emitStr(el[0] === '(' ? decodeLit(el.slice(1, -1)) : decodeHex(el.slice(1, -1))); else if(typeof el === 'number' && el < -180) out += ' '; }); } }
      else if(tok === 'Td' || tok === 'TD'){ var ty = stack[stack.length - 1]; if(typeof ty === 'number' && Math.abs(ty) > 0.01) out += '\n'; else out += ' '; }
      else if(tok === 'Tm'){ var y = stack[stack.length - 1]; if(lastY == null || Math.abs(y - lastY) > 0.5) out += '\n'; else out += ' '; lastY = typeof y === 'number' ? y : lastY; }
      else if(tok === 'T*'){ out += '\n'; }
      else if(tok === 'ET'){ out += '\n'; }
      stack = [];
    }
    return out;
  }
  function pdfText(bytes){
    return pdfObjects(bytes).then(function(R){
      var objs = R.objs, decode = R.decode;
      var pages = Object.keys(objs).map(function(k){ return objs[k]; }).filter(function(o){ return /\/Type\s*\/Page\b/.test(o.dict) && !/\/Type\s*\/Pages\b/.test(o.dict); });
      var resolve = function(v){ var ref = pdfRef(v); return ref != null && objs[ref] ? objs[ref] : null; };
      var fontCache = {};
      var fontsFor = function(page){
        var resV = pdfDictVal(page.dict, 'Resources'), res = resV && /R$/.test(resV.trim()) ? (resolve(resV) || {}).dict : resV;
        var fontsV = res ? pdfDictVal(res, 'Font') : null; if(fontsV && /R$/.test(fontsV.trim())) fontsV = (resolve(fontsV) || {}).dict;
        var out = {}, jobs = [];
        if(!fontsV) return Promise.resolve(out);
        var inner = fontsV.replace(/^<<|>>$/g, ''), fr = /\/([^\s\/\[\]<>()]+)\s+(\d+)\s+\d+\s+R/g, fm;
        while((fm = fr.exec(inner))){
          (function(name, fnum){
            if(fontCache[fnum]){ out[name] = fontCache[fnum]; return; }
            var fo = objs[fnum]; if(!fo){ return; }
            var ent = {map:null, twoByte:/Identity-H|Identity-V|\/Type0/.test(fo.dict)};
            fontCache[fnum] = ent; out[name] = ent;
            var tu = resolve(pdfDictVal(fo.dict, 'ToUnicode'));
            if(tu) jobs.push(decode(tu).then(function(b){ if(b) ent.map = pdfCMap(pdfLatin(b)); }));
          })(fm[1], +fm[2]);
        }
        return Promise.all(jobs).then(function(){ return out; });
      };
      var pageTexts = pages.map(function(page){
        var cv = pdfDictVal(page.dict, 'Contents'), refs = [];
        if(cv){ var cr = /(\d+)\s+\d+\s+R/g, cm; while((cm = cr.exec(cv))) refs.push(+cm[1]); }
        return fontsFor(page).then(function(fonts){
          return Promise.all(refs.map(function(n){ return objs[n] ? decode(objs[n]) : null; })).then(function(parts){
            var content = parts.filter(Boolean).map(pdfLatin).join('\n');
            return pdfContentText(content, fonts);
          });
        });
      });
      return Promise.all(pageTexts).then(function(ts){
        var text = ts.map(function(t, k){ return '--- page ' + (k + 1) + ' ---\n' + t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n'); }).join('\n');
        return {text:text, pages:ts.length};
      });
    });
  }

  /* ---- reading the figures out of the text ---- */
  function nitroNum(s){ var v = parseFloat(String(s).replace(/[^0-9.\-]/g, '')); return isFinite(v) ? v : null; }
  function nitroParse(text){
    var T = text.replace(/ /g, ' '), flat = T.replace(/\s+/g, ' '), A = {};
    var m;
    if((m = /Risk\s*Number[^0-9]{0,40}?(\d{1,2})\b/i.exec(flat)) || (m = /\b(\d{1,2})\s*Risk\s*Number/i.exec(flat))) A.riskNumber = +m[1];
    if((m = /95%\s*(?:Historical\s*)?(?:Probability\s*)?Range[^%\-+]{0,80}?([-−]\s?\d+(?:\.\d+)?)%[^%]{0,60}?(\+?\d+(?:\.\d+)?)%/i.exec(flat))){ A.range = {down:-Math.abs(nitroNum(m[1])), up:nitroNum(m[2])}; }
    else if((m = /([-−]\s?\d+(?:\.\d+)?)%\s*(?:to|–|-)\s*(\+?\d+(?:\.\d+)?)%/.exec(flat))){ A.range = {down:-Math.abs(nitroNum(m[1])), up:nitroNum(m[2])}; }
    if((m = /(?:Portfolio|Total)\s*(?:Value|Balance|Amount)[^$]{0,30}\$\s?([\d,]+(?:\.\d+)?)/i.exec(flat)) || (m = /\$\s?([\d,]{7,})/.exec(flat))) A.value = nitroNum(m[1]);
    if((m = /GPA[^0-9]{0,20}(\d(?:\.\d+)?)/i.exec(flat))) A.gpa = nitroNum(m[1]);
    if((m = /(?:Annual\s*)?Dividend[^0-9]{0,30}(\d+(?:\.\d+)?)%/i.exec(flat))) A.dividend = nitroNum(m[1]);
    if((m = /Expense\s*Ratio[^0-9]{0,30}(\d+(?:\.\d+)?)%/i.exec(flat))) A.expense = nitroNum(m[1]);
    if((m = /(?:Standard\s*Deviation|Volatility)[^0-9]{0,30}(\d+(?:\.\d+)?)%/i.exec(flat))) A.stdev = nitroNum(m[1]);
    /* allocation by asset class */
    var alloc = [];
    [['Stocks|Equities|Equity','Stocks'], ['Bonds|Fixed Income','Bonds'], ['Cash|Money Market','Cash'], ['Alternatives?','Alternatives'], ['Real Estate','Real estate'], ['Commodities','Commodities'], ['Other','Other']].forEach(function(pr){
      var r = new RegExp('\\b(?:' + pr[0] + ')\\b[^%0-9]{0,25}(\\d+(?:\\.\\d+)?)%', 'i'), mm = r.exec(flat);
      if(mm && nitroNum(mm[1]) <= 100) alloc.push({cls:pr[1], pct:nitroNum(mm[1])});
    });
    if(alloc.length) A.allocation = alloc;
    /* stress tests: Nitrogen's scenarios, each followed by a portfolio figure and usually a benchmark */
    var tests = [];
    ['2008 Bear Market', '2013 Bull Market', 'Financial Crisis', 'Interest Rate Spike', 'Return to Normal Rates', 'COVID', 'Dot[- ]?Com', 'Tech Bubble', '2022', 'Inflation'].forEach(function(nm){
      var r = new RegExp('(' + nm + '[^%$]{0,60}?)([-\\u2212+]?\\d+(?:\\.\\d+)?)%(?:[^%$]{0,40}?\\$\\s?([-\\u2212]?[\\d,]+))?(?:[^%$]{0,60}?([-\\u2212+]?\\d+(?:\\.\\d+)?)%)?', 'i'), mm = r.exec(flat);
      if(mm) tests.push({name:mm[1].replace(/[^A-Za-z0-9 ()\-–]+$/, '').trim().slice(0, 48), pct:nitroNum(mm[2]) * (/^[-−]/.test(mm[2]) ? 1 : 1), dollars:mm[3] != null ? nitroNum(mm[3]) * (/^[-−]/.test(mm[3]) ? -1 : 1) : null, benchmark:mm[4] != null ? nitroNum(mm[4]) : null});
    });
    tests.forEach(function(t){ if(/^[-−]/.test(String(t.pct))) t.pct = -Math.abs(t.pct); });
    if(tests.length) A.stress = tests;
    /* holdings: ticker-like tokens with a value */
    var hm = flat.match(/\b[A-Z]{2,5}\b(?=[^$]{0,60}\$\s?[\d,]+)/g) || [];
    var uniq = {}; hm.forEach(function(t){ if(!/^(USD|LLC|INC|ETF|IRA|LTC|GPA|PDF)$/.test(t)) uniq[t] = 1; });
    var nHold = Object.keys(uniq).length; if(nHold >= 2) A.holdings = nHold;
    return A;
  }
  /* Claude's reading of the text, when the page runs inside Claude */
  function nitroPrompt(text){
    var slice = text.length > 48000 ? text.slice(0, 48000) : text;
    return 'You are reading the text extracted from a Nitrogen (Riskalyze) Wealth portfolio analysis PDF for a financial advisor. '
      + 'Return ONLY a JSON object with these keys (use null where the report does not say): '
      + '{"riskNumber": integer 1-99 for the portfolio, "range": {"down": negative percent, "up": positive percent} the 95% historical/probability range, "rangeDollars": {"down": negative dollars, "up": positive dollars} or null, '
      + '"value": total portfolio value in dollars, "holdings": number of positions, "gpa": number or null, "dividend": annual dividend yield percent or null, "expense": expense ratio percent or null, '
      + '"allocation": [{"cls": asset class name, "pct": percent}] or null, '
      + '"stress": [{"name": scenario name, "pct": portfolio return percent (negative for losses), "dollars": portfolio dollar change or null, "benchmark": benchmark return percent or null}] for every stress test or scenario shown, '
      + '"largest": [{"name": holding name or ticker, "pct": percent of portfolio, "riskNumber": the holding’s Risk Number or null}] the five largest positions or null, '
      + '"summary": two or three plain sentences an advisor could read to a client describing the portfolio in aggregate, its Risk Number and what the stress tests show. '
      + 'Percentages as plain numbers (e.g. -22.4), dollars as plain numbers. Do not invent figures that are not in the text.\n\nREPORT TEXT:\n' + slice;
  }
  function nitroAnalyze(text, name){
    var msg = $('nitroMsg');
    var finish = function(A, src){
      nitro = {name:name || (nitro && nitro.name) || 'Nitrogen report', text:text.slice(0, 120000), analysis:A, src:src, at:new Date().toISOString()};
      renderNitro(); $('caseJson').value = caseData();
      var R = A && A.riskNumber;
      if(R && !$('riskScore').value.trim()){ $('riskScore').value = String(R); render(); }
    };
    var fallback = nitroParse(text);
    if(!sampleFn){ finish(fallback, 'text'); msg.textContent = 'Read from the report text by its labels' + (Object.keys(fallback).length ? '.' : ' — nothing recognisable was found; check the extracted text below.'); return; }
    msg.textContent = 'Reading the report with Claude… this takes a moment.';
    $('nitroAnalyze').disabled = true;
    sampleFn.json(nitroPrompt(text), {cache:false})
      .then(function(J){
        if(!J || typeof J !== 'object') throw {code:'invalid_json'};
        var A = {};
        Object.keys(J).forEach(function(k){ if(J[k] != null) A[k] = J[k]; });
        ['riskNumber','value','holdings','gpa','dividend','expense'].forEach(function(k){ if(A[k] == null && fallback[k] != null) A[k] = fallback[k]; });
        if(!A.range && fallback.range) A.range = fallback.range;
        if((!A.stress || !A.stress.length) && fallback.stress) A.stress = fallback.stress;
        if((!A.allocation || !A.allocation.length) && fallback.allocation) A.allocation = fallback.allocation;
        finish(A, 'claude'); msg.textContent = 'Summarised by Claude from the report text — check the figures against the PDF.';
      })
      .catch(function(e){
        var code = (e && e.code) || 'upstream_error';
        if(code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') sampleFn = null;
        finish(fallback, 'text');
        msg.textContent = 'Read from the report text by its labels' + (code === 'rate_limited' ? ' (Claude is busy — try Analyze again later for the fuller summary).' : code === 'not_granted' ? ' (Claude was not allowed for this page).' : '.');
      })
      .then(function(){ $('nitroAnalyze').disabled = false; });
  }
  function nitroFile(file){
    var msg = $('nitroMsg'); if(!file) return;
    msg.textContent = 'Reading ' + file.name + '…';
    var isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    var done = function(text, pages){
      if(!text || text.replace(/[-\s]|page \d+/g, '').length < 40){ msg.textContent = 'No readable text was found in ' + file.name + (isPdf ? ' — the PDF may be scanned or image-only. Paste the report text below instead.' : '.'); $('nitroText').value = text || ''; return; }
      $('nitroText').value = text;
      nitroAnalyze(text, file.name);
    };
    if(isPdf){
      file.arrayBuffer().then(function(buf){ return pdfText(new Uint8Array(buf)); })
        .then(function(R){ done(R.text, R.pages); })
        .catch(function(e){ msg.textContent = 'The PDF could not be read here (' + (e && e.message ? e.message : 'unknown error') + '). Paste the report text below instead.'; });
    } else {
      file.text().then(function(t){ done(t); });
    }
  }
  function nitroPct(v, signed){ if(v == null || !isFinite(v)) return '—'; return (signed && v > 0 ? '+' : '') + (Math.round(v * 10) / 10).toFixed(1) + '%'; }
  function renderNitro(){
    var box = $('nitroOut'), A = nitro && nitro.analysis; if(!box) return;
    $('nitroDetail').hidden = !nitro;
    if(!nitro){ box.innerHTML = ''; $('nitroClear').hidden = true; return; }
    $('nitroClear').hidden = false;
    var tiles = '<div class="tax-tiles">'
      + '<div><dt>Portfolio Risk Number</dt><dd' + (A.riskNumber ? ' style="color:var(--c-moat)"' : '') + '>' + (A.riskNumber || '—') + '</dd><small>Nitrogen, 1–99' + ($('riskTol').value.trim() ? ' · tolerance ' + esc($('riskTol').value.trim()) : '') + '</small></div>'
      + '<div><dt>95% historical range</dt><dd>' + (A.range ? nitroPct(A.range.down) + ' to ' + nitroPct(A.range.up, true) : '—') + '</dd><small>' + (A.rangeDollars ? money(A.rangeDollars.down) + ' to ' + money(A.rangeDollars.up) + ' over six months' : 'six-month range the report shows') + '</small></div>'
      + '<div><dt>Portfolio value</dt><dd>' + (A.value ? money(A.value) : '—') + '</dd><small>' + (A.holdings ? A.holdings + ' positions' : 'as analysed') + '</small></div>'
      + '<div><dt>Yield and cost</dt><dd>' + (A.dividend != null ? nitroPct(A.dividend) : '—') + '</dd><small>' + (A.expense != null ? 'expense ratio ' + nitroPct(A.expense) : 'dividend yield') + (A.gpa != null ? ' · GPA ' + A.gpa : '') + '</small></div>'
      + '</div>';
    var alloc = A.allocation && A.allocation.length ? '<div class="inc-title gap">Allocation in aggregate</div><div class="tbl-wrap" style="margin-top:8px"><table class="pj-table" style="min-width:420px"><thead><tr><th>Asset class</th><th class="num">Share</th></tr></thead><tbody>'
      + A.allocation.map(function(a){ return '<tr><td>' + esc(a.cls) + '</td><td class="num">' + nitroPct(a.pct) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '';
    var largest = A.largest && A.largest.length ? '<div class="inc-title gap">Largest positions</div><div class="tbl-wrap" style="margin-top:8px"><table class="pj-table" style="min-width:520px"><thead><tr><th>Holding</th><th class="num">Share</th><th class="num">Risk Number</th></tr></thead><tbody>'
      + A.largest.map(function(h){ return '<tr><td>' + esc(h.name) + '</td><td class="num">' + nitroPct(h.pct) + '</td><td class="num">' + (h.riskNumber || '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '';
    var stress = A.stress && A.stress.length ? '<div class="inc-title gap">Stress tests<small>How the portfolio as held would have fared</small></div><div class="tbl-wrap" style="margin-top:8px"><table class="pj-table" style="min-width:620px"><thead><tr><th>Scenario</th><th class="num">Portfolio</th><th class="num">In dollars</th><th class="num">Benchmark</th></tr></thead><tbody>'
      + A.stress.map(function(t){ return '<tr><td>' + esc(t.name) + '</td><td class="num"' + (t.pct < 0 ? ' style="color:var(--st-alert)"' : '') + '>' + nitroPct(t.pct, true) + '</td><td class="num">' + (t.dollars != null ? (t.dollars < 0 ? '−' : '+') + money(Math.abs(t.dollars)) : '—') + '</td><td class="num">' + (t.benchmark != null ? nitroPct(t.benchmark, true) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="hint" style="margin-top:10px">No stress tests were found in the report text.</p>';
    var summary = A.summary ? '<p class="hint" style="margin-top:12px;font-size:15px;color:var(--ink)">' + esc(A.summary) + '</p>' : '';
    var tol = num($('riskTol').value), gapNote = (A.riskNumber && tol > 0) ? '<p class="hint" style="margin-top:8px">Against a risk tolerance of ' + tol + ', the current portfolio runs <b>' + (A.riskNumber - tol > 0 ? '+' : '') + (A.riskNumber - tol) + '</b> points' + (A.riskNumber > tol ? ' hotter than the client is comfortable with.' : A.riskNumber < tol ? ' cooler than the client would accept.' : ' — a match.') + '</p>' : '';
    box.innerHTML = '<p class="hint" style="margin:0 0 6px"><b>' + esc(nitro.name) + '</b> · ' + (nitro.src === 'claude' ? 'summarised by Claude from the report text' : 'read from the report text by its labels') + '</p>' + tiles + summary + gapNote + alloc + largest + stress;
  }
