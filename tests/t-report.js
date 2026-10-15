const { chromium } = require('playwright-core');
const fs=require('fs');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx=await b.newContext({acceptDownloads:true}); const p=await ctx.newPage({viewport:{width:1500,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+process.cwd()+'/preview-smith.html',{waitUntil:'load'}); await p.waitForTimeout(500);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:20000}), p.click('#makeDeck')]);
  await pop.waitForLoadState('load'); await pop.waitForTimeout(800);
  console.log('msg:', await p.$eval('#pdfMsg',e=>e.textContent));
  console.log('popup title:', await pop.title(), 'slides:', await pop.$$eval('.sl',s=>s.length));
  const html=await pop.content(); fs.writeFileSync('report-out.html', html); console.log('html bytes', html.length);
  await pop.pdf({path:'report-out.pdf', preferCSSPageSize:true, printBackground:true});
  // overflow check: any .tx whose scrollHeight exceeds box by > 6px
  const over=await pop.$$eval('.tx',els=>els.map((e,k)=>({k,sl:e.closest('.sl').dataset.n,over:e.scrollHeight-e.clientHeight,txt:e.textContent.slice(0,50)})).filter(o=>o.over>6));
  console.log('overflowing text boxes:', over.length); over.slice(0,25).forEach(o=>console.log('  slide',o.sl,'over',o.over,'px:',o.txt));
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
