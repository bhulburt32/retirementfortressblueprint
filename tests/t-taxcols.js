/* Section 17's year-by-year tax table: what makes up All income, how AGI is built, MAGI for IRMAA and provisional
   income for Social Security; the effective rate (tax / (all income + Roth conversion)); the Walls yield as ordinary
   income; the 3.8% net investment income tax; the OBBBA senior deduction's phase-out per person; the Roth
   conversion's IRMAA guard on MAGI (AGI + tax-exempt interest). Smith sample. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(900);
  await p.click('#expandAll'); await p.waitForTimeout(400);
  await p.click('#scnTabs [data-scn="0"]'); await p.waitForTimeout(600);
  const out=[];
  const num=s=>{ const v=String(s).replace(/[^0-9.\-]/g,''); return v===''||v==='-'? NaN : +v; };
  const rowsOf=async()=>p.evaluate(()=>window.__rfb.taxLast().rows.map(x=>({year:x.year, gross:x.gross, agi:x.agi, tax:x.tax, eff:x.effective, inc:x.incParts, ap:x.agiParts,
    exempt:x.exempt, magi:x.magi, prov:x.prov, ss:x.ss, preSS:x.preSS, ssTaxable:x.ssTaxable, conv:x.conv ? x.conv.amt : 0, nii:x.nii, niit:x.niit, gf:x.gainFrac, status:window.__rfb.taxLast().status})));
  const check=(R,label)=>{
    let bad=0;
    R.forEach(x=>{
      const inc=Object.values(x.inc).reduce((a,v)=>a+v,0), agi=x.ap.ord+x.ap.pre+x.ap.conv+x.ap.cg+x.ap.ss;
      const prov=x.agi-x.ssTaxable+x.exempt+0.5*(x.ss+(x.preSS||0));
      if(Math.abs(inc-x.gross)>0.5){ bad++; out.push(label+' '+x.year+': income parts '+Math.round(inc)+' vs All income '+Math.round(x.gross)); }
      if(Math.abs(agi-x.agi)>0.5){ bad++; out.push(label+' '+x.year+': AGI parts '+Math.round(agi)+' vs AGI '+Math.round(x.agi)); }
      if(Math.abs(x.magi-(x.agi+x.exempt))>0.5){ bad++; out.push(label+' '+x.year+': MAGI should be AGI + tax-exempt interest'); }
      if((x.ss+(x.preSS||0))>0.5 && Math.abs(x.prov-prov)>0.5){ bad++; out.push(label+' '+x.year+': provisional '+Math.round(x.prov)+' vs '+Math.round(prov)); }
      const base=x.gross+x.conv; if(base>0.5 && Math.abs(x.eff-x.tax/base)>1e-9){ bad++; out.push(label+' '+x.year+': effective should be tax / (all income + conversion)'); }
      if(Math.abs(x.ap.cg-x.gf*x.inc.wdTaxable)>0.5){ bad++; out.push(label+' '+x.year+': capital gains should be the taxable withdrawals times the gain share only (the Walls yield is ordinary income)'); }
      const niit=0.038*Math.max(0,Math.min(x.nii,x.agi-(x.status==='mfj'?250000:200000))); if(Math.abs(niit-x.niit)>0.5){ bad++; out.push(label+' '+x.year+': NIIT '+Math.round(x.niit)+' should be '+Math.round(niit)); }
    });
    return bad;
  };

  // 1. the Smith plan as it stands (Roth conversions on): every row adds up
  let R=await rowsOf();
  console.log('rows:', R.length, '| identity failures:', check(R,'smith'));
  const show=x=>x.year+': all income '+Math.round(x.gross)+' = '+Object.entries(x.inc).filter(e=>e[1]>0.5).map(e=>e[0]+' '+Math.round(e[1])).join(' + ')
    +' | AGI '+Math.round(x.agi)+' = ord '+Math.round(x.ap.ord)+(x.ap.pre>0.5?' + earlier '+Math.round(x.ap.pre):'')+(x.ap.conv>0.5?' + conv '+Math.round(x.ap.conv):'')+' + gains '+Math.round(x.ap.cg)+' + SS '+Math.round(x.ap.ss)
    +' | MAGI '+Math.round(x.magi)+' | prov '+(x.prov!=null?Math.round(x.prov):'-')+' | NII '+Math.round(x.nii)+' NIIT '+Math.round(x.niit)+' | tax '+Math.round(x.tax)+' | eff '+(x.eff*100).toFixed(2)+'% (tax/AGI '+(x.agi>0.5?(x.tax/x.agi*100).toFixed(2):'-')+'%)';
  R.slice(0,2).concat(R.filter(x=>x.conv>0.5).slice(-1), R.slice(6,7)).forEach(x=>console.log(' ', show(x)));

  // 2. the table: group headings, the new columns, the cells from the run, the footer under its own columns
  const T=await p.evaluate(()=>{ const t=document.getElementById('taxTable'); const hr=t.querySelectorAll('thead tr');
    return {groups:[...hr[0].querySelectorAll('th')].map(h=>h.textContent.trim()), heads:[...hr[1].querySelectorAll('th')].map(h=>h.childNodes[0].textContent.trim()),
      span:[...hr[0].querySelectorAll('th')].reduce((a,h)=>a+(+h.colSpan||1),0), body:[...t.querySelectorAll('tbody tr')].map(r=>[...r.children].map(c=>c.textContent.trim())), foot:[...t.querySelectorAll('tfoot td')].map(c=>c.textContent.trim())}; });
  console.log('groups:', T.groups.filter(Boolean).join(' | '));
  console.log('columns:', T.heads.join(' | '));
  for(const h of ['All income','AGI','MAGI for IRMAA','Provisional income','Roth conversion','Ordinary income','Taxable SS','Withdrawals','Fed. effective']) if(!T.heads.includes(h)) out.push('the table should have a '+h+' column');
  if(T.span!==T.heads.length) out.push('group headings should span every column ('+T.span+' vs '+T.heads.length+')');
  if(T.foot.length!==T.heads.length) out.push('the footer should have one cell per column ('+T.foot.length+' vs '+T.heads.length+')');
  const col=h=>T.heads.indexOf(h), r1=T.body[1], x1=R[1];
  [['All income',x1.gross],['AGI',x1.agi],['MAGI for IRMAA',x1.magi],['Ordinary income',x1.ap.ord]].forEach(([h,v])=>{ if(Math.abs(num(r1[col(h)])-Math.round(v))>1) out.push(h+' cell '+r1[col(h)]+' should be '+Math.round(v)); });
  console.log('footer:', T.heads.map((h,k)=>T.foot[k]?h+' '+T.foot[k]:null).filter(Boolean).join(' | '));
  if(T.foot[col('Federal tax')]==='' || T.foot[col('Fed. effective')]==='' || T.foot[col('All income')]==='') out.push('the footer totals should sit under Federal tax, Fed. effective and All income');

  // 3. the OBBBA senior deduction: each person's $6,000 less 6% of AGI over $150,000 joint / $75,000 single
  const sen=await p.evaluate(()=>[[200000,2,'mfj'],[250000,2,'mfj'],[149000,2,'mfj'],[100000,1,'single'],[175000,1,'single']].map(([agi,n,st])=>[agi,n,st,Math.round(window.__rfb.fedTax(agi,0,0,n,st,1,2027,0).senior)]));
  console.log('senior deduction:', sen.map(s=>s[2]+' '+s[1]+'x65 AGI '+s[0]+': '+s[3]).join(' | '));
  [[200000,6000],[250000,0],[149000,12000],[100000,4500],[175000,0]].forEach(([agi,want],k)=>{ if(sen[k][3]!==want) out.push('senior deduction at AGI '+agi+' should be '+want+' (got '+sen[k][3]+')'); });
  const s2029=await p.evaluate(()=>Math.round(window.__rfb.fedTax(100000,0,0,2,'mfj',1,2029,0).senior));
  if(s2029!==0) out.push('the senior deduction ends after 2028');

  // 4. tax-free Walls money: MAGI = AGI + exempt interest, and the Roth conversion keeps MAGI (not AGI) under the IRMAA cap
  const at=await p.$$eval('#acctBody tr[data-id]',rs=>{ const r=rs.find(x=>x.querySelector('input[data-k=name]').value.trim()==='After Tax'); return r? r.dataset.id : null; });
  const line=await p.$$eval('#adjBody tr[data-adj]',(rs,id)=>{ const r=rs.find(x=>x.querySelector('select[data-ak=acctId]').value===String(id)); return r? r.dataset.adj : null; }, at);
  await p.selectOption(`#adjBody tr[data-adj="${line}"] select[data-ak="bucket"]`,'walls'); await p.waitForTimeout(700);
  await p.selectOption(`#adjBody tr[data-adj="${line}"] select[data-ok="prod"]`,'AUM - Tax Free'); await p.waitForTimeout(900);
  R=await rowsOf();
  const ex=R.filter(x=>x.exempt>0.5);
  console.log('tax-free Walls: years with exempt interest', ex.length, '| identity failures:', check(R,'tax-free'), '| e.g.', ex[0]?show(ex[0]):'-');
  if(!ex.length) out.push('an AUM - Tax Free Walls line should produce tax-exempt interest');
  const RT=await p.evaluate(()=>{ const t=document.getElementById('rothTable'); if(!t) return null; const hs=[...t.querySelectorAll('thead th')].map(h=>h.textContent.trim());
    return {hs, rows:[...t.querySelectorAll('tbody tr')].map(r=>[...r.children].map(c=>c.textContent.trim()))}; });
  if(RT && RT.rows.length){
    const iY=RT.hs.findIndex(h=>/^Year/.test(h)), iM=RT.hs.findIndex(h=>/^MAGI/.test(h)), iC=RT.hs.findIndex(h=>/^IRMAA cap/.test(h));
    let over=0, shown=0;
    RT.rows.forEach(r=>{ const y=+r[iY], x=R.find(z=>z.year===y); if(!x) return; shown++;
      if(Math.abs(num(r[iM])-Math.round(x.magi))>1) out.push('Roth table MAGI '+r[iM]+' should be '+Math.round(x.magi)+' in '+y);
      const cap=num(r[iC]); if(!isNaN(cap) && x.conv>0.5 && x.magi>cap+1) over++; });
    console.log('Roth table: '+shown+' years, MAGI over the IRMAA cap in a conversion year:', over);
    if(over) out.push('a conversion should keep MAGI under the IRMAA cap');
  }

  // 5. the net investment income tax: no IRMAA cap and conversions to the top of the 32% bracket push AGI past $250,000
  const irOpts=await p.$eval('#rothIrmaa',s=>[...s.options].map(o=>o.value)), tgOpts=await p.$eval('#rothTarget',s=>[...s.options].map(o=>o.value));
  await p.selectOption('#rothIrmaa', irOpts.find(v=>v==='0')||irOpts[0]); await p.waitForTimeout(600);
  await p.selectOption('#rothTarget', tgOpts.includes('0.32') ? '0.32' : tgOpts[tgOpts.length-1]); await p.waitForTimeout(900);
  R=await rowsOf();
  const nt=R.filter(x=>x.niit>0.5);
  console.log('NIIT: years owing', nt.length, '| total', Math.round(nt.reduce((a,x)=>a+x.niit,0)), '| identity failures:', check(R,'niit'), '| e.g.', nt[0]?show(nt[0]):'-');
  if(!nt.length) out.push('AGI over $250,000 with net investment income should owe the net investment income tax');
  const hasCol=await p.evaluate(()=>[...document.querySelectorAll('#taxTable thead tr:last-child th')].some(h=>/^Net investment income tax/.test(h.textContent.trim())));
  if(nt.length && !hasCol) out.push('the table should show a Net investment income tax column when any year owes it');

  console.log('ERRORS:', errs.length||out.length ? [...errs, ...out] : 'none');
  await b.close();
})();
