  /* ---- positional text: every string with where it sits on the page, so a table can be read row by row ----
     The same tokenizer and font decoding as pdfContentText, but tracking the graphics state (q/Q/cm) and the
     text matrix (BT, Tm, Td, TD, T-star, TL), so each string gets a device position. Widths are estimated (0.52 em
     per character), which is enough to tell "the next word" from "the next column". */
  function pdfContentItems(content, fonts){
    var font = null, size = 0, TL = 0, Tc = 0, Th = 1, ctm = [1, 0, 0, 1, 0, 0], gs = [], tm = null, tlm = null, items = [];
    var mul = function(a, b){ return [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]]; };
    var decodeLit = function(lit){
      var r = '', k;
      for(k = 0; k < lit.length; k++){
        var c = lit[k];
        if(c === '\\'){ k++; var n = lit[k]; if(n === 'n') r += '\n'; else if(n === 'r') r += ''; else if(n === 't') r += ' '; else if(/[0-7]/.test(n)){ var oct = n; while(oct.length < 3 && /[0-7]/.test(lit[k + 1] || '')) oct += lit[++k]; r += String.fromCharCode(parseInt(oct, 8)); } else r += n; }
        else r += c;
      }
      var codes = [];
      if(font && font.twoByte){ for(k = 0; k + 1 < r.length; k += 2) codes.push(r.charCodeAt(k) * 256 + r.charCodeAt(k + 1)); }
      else for(k = 0; k < r.length; k++) codes.push(r.charCodeAt(k));
      lastCodes = codes;
      if(font && font.map && !font.twoByte){ var o2 = ''; for(k = 0; k < r.length; k++){ var h = r.charCodeAt(k).toString(16).padStart(2, '0'); o2 += font.map[h] != null ? font.map[h] : r[k]; } return o2; }
      if(font && font.map && font.twoByte){ var o3 = ''; for(k = 0; k + 1 < r.length; k += 2){ var h2 = (r.charCodeAt(k) * 256 + r.charCodeAt(k + 1)).toString(16).padStart(4, '0'); o3 += font.map[h2] != null ? font.map[h2] : ''; } return o3; }
      return r;
    };
    var decodeHex = function(hex){
      hex = hex.replace(/\s+/g, '').toLowerCase(); if(hex.length % 2) hex += '0';
      var r = '', w = (font && font.twoByte) ? 4 : 2, codes = [];
      for(var k = 0; k + w <= hex.length; k += w){ var code = hex.slice(k, k + w); codes.push(parseInt(code, 16)); if(font && font.map && font.map[code] != null) r += font.map[code]; else if(w === 2) r += String.fromCharCode(parseInt(code, 16)); else { var cp = parseInt(code, 16); r += cp > 31 ? String.fromCharCode(cp) : ''; } }
      lastCodes = codes;
      return r;
    };
    var lastCodes = null;   // the codes behind the last decoded string, for their widths
    var emit = function(str){
      if(!str || !tm) return;
      var m = mul(tm, ctm), scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
      var adv = 0, n = lastCodes ? lastCodes.length : str.length;
      if(font && font.widths && lastCodes){ lastCodes.forEach(function(c){ var w = font.widths[c]; adv += (w != null ? w : font.dw) / 1000; }); adv = adv * size * Th; }
      else adv = n * 0.52 * size * Th;
      adv += Math.max(0, n - 1) * Tc * Th;
      if(str.replace(/\s/g, '').length) items.push({x:m[4], y:m[5], w:adv * scale, h:size * scale, str:str});
      tm = mul([1, 0, 0, 1, adv, 0], tm);
      lastCodes = null;
    };
    var toks = [], re = /\((?:\\.|[^\\)])*\)|<[0-9a-fA-F\s]*>|\[|\]|\/[^\s\/\[\]<>()]+|-?\d*\.?\d+|[A-Za-z'"*]+/g, m, tok, i;
    while((m = re.exec(content))) toks.push(m[0]);
    var stack = [], inArr = false, arr = [];
    for(i = 0; i < toks.length; i++){
      tok = toks[i];
      if(tok === '['){ inArr = true; arr = []; continue; }
      if(tok === ']'){ inArr = false; stack.push(arr); continue; }
      if(tok[0] === '(' || tok[0] === '<'){ if(inArr) arr.push(tok); else stack.push(tok); continue; }
      if(/^-?\d*\.?\d+$/.test(tok)){ if(inArr) arr.push(+tok); else stack.push(+tok); continue; }
      if(tok[0] === '/'){ stack.push(tok); continue; }
      var n = stack.length, s6 = function(){ return stack.slice(n - 6).map(Number); };
      if(tok === 'q') gs.push(ctm.slice());
      else if(tok === 'Q') ctm = gs.pop() || ctm;
      else if(tok === 'cm' && n >= 6) ctm = mul(s6(), ctm);
      else if(tok === 'BT'){ tm = [1, 0, 0, 1, 0, 0]; tlm = tm.slice(); }
      else if(tok === 'Tf'){ var fn = stack[n - 2]; font = (typeof fn === 'string' && fonts[fn.slice(1)]) || null; size = typeof stack[n - 1] === 'number' ? stack[n - 1] : size; }
      else if(tok === 'Td' || tok === 'TD'){ var tx = +stack[n - 2] || 0, ty = +stack[n - 1] || 0; if(tok === 'TD') TL = -ty; tlm = mul([1, 0, 0, 1, tx, ty], tlm || [1, 0, 0, 1, 0, 0]); tm = tlm.slice(); }
      else if(tok === 'Tm' && n >= 6){ tlm = s6(); tm = tlm.slice(); }
      else if(tok === 'T*'){ tlm = mul([1, 0, 0, 1, 0, -TL], tlm || [1, 0, 0, 1, 0, 0]); tm = tlm.slice(); }
      else if(tok === 'TL') TL = +stack[n - 1] || 0;
      else if(tok === 'Tc') Tc = +stack[n - 1] || 0;
      else if(tok === 'Tz') Th = (+stack[n - 1] || 100) / 100;
      else if(tok === 'Tj' || tok === "'" || tok === '"'){
        if(tok !== 'Tj'){ if(tok === '"'){ Tc = +stack[n - 3] || Tc; } tlm = mul([1, 0, 0, 1, 0, -TL], tlm || [1, 0, 0, 1, 0, 0]); tm = tlm.slice(); }
        var st = stack[n - 1]; if(typeof st === 'string') emit(st[0] === '(' ? decodeLit(st.slice(1, -1)) : decodeHex(st.slice(1, -1)));
      }
      else if(tok === 'TJ'){ var a = stack[n - 1]; if(Array.isArray(a)) a.forEach(function(el){ if(typeof el === 'string') emit(el[0] === '(' ? decodeLit(el.slice(1, -1)) : decodeHex(el.slice(1, -1))); else if(typeof el === 'number' && tm) tm = mul([1, 0, 0, 1, -el / 1000 * size * Th, 0], tm); }); }
      stack = [];
    }
    return items;
  }
  /* glyph widths (per 1000 em) from a font dictionary: /W of a CID font, or /FirstChar + /Widths of a simple font */
  function pdfFontWidths(fo, ent, objs, resolve){
    var nums = function(txt){ var out = [], re = /\[|\]|-?\d*\.?\d+/g, m; while((m = re.exec(txt))) out.push(m[0]); return out; };
    var arrayOf = function(dict, key){ var v = pdfDictVal(dict, key); if(!v) return null; if(/^\d+\s+\d+\s+R$/.test(v.trim())){ var o = resolve(v); return o ? o.dict : null; } return v; };
    try {
      if(ent.twoByte){
        var dfV = pdfDictVal(fo.dict, 'DescendantFonts'), ref = dfV && /(\d+)\s+\d+\s+R/.exec(dfV), df = ref ? objs[+ref[1]] : null;
        if(!df) return;
        var dwV = pdfDictVal(df.dict, 'DW'); if(dwV && /^\d+(\.\d+)?$/.test(dwV.trim())) ent.dw = +dwV;
        var W = arrayOf(df.dict, 'W'); if(!W) return;
        var t = nums(W.replace(/^\s*\[/, '').replace(/\]\s*$/, '')), i = 0, widths = {};
        while(i < t.length){
          var a = +t[i];
          if(t[i + 1] === '['){ var c = a, j = i + 2; while(j < t.length && t[j] !== ']'){ widths[c++] = +t[j]; j++; } i = j + 1; }
          else if(i + 2 < t.length){ var b = +t[i + 1], w = +t[i + 2]; if(b - a < 70000) for(var c2 = a; c2 <= b; c2++) widths[c2] = w; i += 3; }
          else break;
        }
        ent.widths = widths;
      } else {
        var fc = +pdfDictVal(fo.dict, 'FirstChar') || 0, Ws = arrayOf(fo.dict, 'Widths'); if(!Ws) return;
        var ws = nums(Ws).filter(function(x){ return x !== '[' && x !== ']'; }), widths2 = {};
        ws.forEach(function(w, k){ widths2[fc + k] = +w; });
        ent.widths = widths2; var mw = pdfDictVal(fo.dict, 'MissingWidth'); ent.dw = mw ? +mw : 0;
      }
    } catch(e){ ent.widths = null; }
  }
  /* items -> lines of cells. A line is everything within half a font-height vertically; within a line, strings
     closer than a third of an em join, up to one and a half ems apart are one cell with a space, further apart
     start a new cell (another column). */
  function pdfLayoutLines(items){
    var its = items.slice().sort(function(a, b){ return b.y - a.y || a.x - b.x; }), lines = [], cur = null;
    its.forEach(function(it){
      var tol = Math.max(1.5, 0.45 * Math.max(it.h, cur ? cur.h : 0));
      if(cur && Math.abs(it.y - cur.y) <= tol){ cur.items.push(it); cur.h = Math.max(cur.h, it.h); }
      else { cur = {y:it.y, h:it.h, items:[it]}; lines.push(cur); }
    });
    lines.forEach(function(L){
      L.items.sort(function(a, b){ return a.x - b.x; });
      var cells = [], c = null, prev = null;
      L.items.forEach(function(it){
        var em = Math.max(prev ? prev.h : it.h, 4), gap = prev ? it.x - (prev.x + prev.w) : 0;
        if(!c || gap > 1.6 * em){ c = {x:it.x, t:it.str}; cells.push(c); }
         else if(gap > 0.18 * em) c.t += ' ' + it.str;
        else c.t += it.str;
        prev = it;
      });
      L.cells = cells.map(function(x){ return {x:Math.round(x.x), t:x.t.replace(/\s+/g, ' ').trim()}; }).filter(function(x){ return x.t; });
      L.text = L.cells.map(function(x){ return x.t; }).join('   ');
      delete L.items;
    });
    return lines.filter(function(L){ return L.cells.length; });
  }
  /* the pages of a PDF as positioned lines (see pdfLayoutLines); the plain-text join carries page markers */
  function pdfLayoutText(bytes){
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
            var ent = {map:null, twoByte:/Identity-H|Identity-V|\/Type0/.test(fo.dict), widths:null, dw:1000};
            fontCache[fnum] = ent; out[name] = ent;
            var tu = resolve(pdfDictVal(fo.dict, 'ToUnicode'));
            if(tu) jobs.push(decode(tu).then(function(b){ if(b) ent.map = pdfCMap(pdfLatin(b)); }));
            pdfFontWidths(fo, ent, objs, resolve);
          })(fm[1], +fm[2]);
        }
        return Promise.all(jobs).then(function(){ return out; });
      };
      var pageJobs = pages.map(function(page){
        var cv = pdfDictVal(page.dict, 'Contents'), refs = [];
        if(cv){ var cr = /(\d+)\s+\d+\s+R/g, cm; while((cm = cr.exec(cv))) refs.push(+cm[1]); }
        return fontsFor(page).then(function(fonts){
          return Promise.all(refs.map(function(n){ return objs[n] ? decode(objs[n]) : null; })).then(function(parts){
            var content = parts.filter(Boolean).map(pdfLatin).join('\n');
            return pdfLayoutLines(pdfContentItems(content, fonts));
          });
        });
      });
      return Promise.all(pageJobs).then(function(pp){
        var text = pp.map(function(lines, k){ return '--- page ' + (k + 1) + ' ---\n' + lines.map(function(L){ return L.text; }).join('\n'); }).join('\n');
        return {pages:pp, text:text};
      });
    });
  }
