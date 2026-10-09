const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path'); const fs=require('fs');
(async()=>{
  const g=fs.readFileSync(path.resolve(__dirname,'../docs/advisor-guide.html'),'utf8');
  const html='<!doctype html><html><head><meta charset="utf-8"></head><body>\n'+g.replace(/<link[^>]*fonts[^>]*>\n?/g,'')+'\n<style>@page{size:Letter;margin:0.7in 0.7in 0.8in} body{margin:0;font-size:13px;line-height:1.5} .wrap{max-width:none;padding:0} .top{padding-top:0} section{break-inside:auto;padding-block:22px;grid-template-columns:64px minmax(0,1fr)} .body{gap:10px} p,ul,ol,dl.fields,.note{max-width:none} dl.fields{grid-template-columns:minmax(0,1fr);gap:4px 0} dl.fields dt{margin-top:6px} dl.fields dd{margin-bottom:6px;font-size:13px} h2{font-size:21px} .note{break-inside:avoid} .exports{break-inside:avoid} .standfirst{font-size:15px}</style></body></html>';
  const out=path.resolve(__dirname,'../dist'); fs.mkdirSync(out,{recursive:true}); fs.writeFileSync(path.join(out,'guide-print.html'), html);
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage();
  await p.goto('file://'+path.join(out,'guide-print.html'),{waitUntil:'load'}); await p.waitForTimeout(500);
  await p.emulateMedia({media:'print'});
  await p.pdf({path:path.join(out,'Retirement Fortress Blueprint - Advisor Guide.pdf'), format:'Letter', printBackground:true, displayHeaderFooter:true,
    headerTemplate:'<div></div>',
    footerTemplate:'<div style="width:100%;font-size:8px;color:#5B6675;padding:0 0.7in;display:flex;justify-content:space-between;font-family:Arial"><span>Alto Financial Group · Advisor guide · Internal use only</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
    margin:{top:'0.7in',bottom:'0.8in',left:'0.7in',right:'0.7in'}});
  console.log('errors: none'); await b.close();
})();
