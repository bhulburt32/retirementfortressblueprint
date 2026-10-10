const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const txt=async sel=>(await p.$eval(sel,e=>e.textContent)).replace(/\s+/g,' ').trim();
  console.log('EMPTY tiles:', await txt('#qcdTiles'));
  console.log('spouse wrap hidden?', await p.$eval('#qcdSWrap',e=>e.hidden), '| labels:', await txt('#qcdCLbl'), '|', await txt('#qcdSLbl'));
  await p.fill('#qcdC','10000'); await p.dispatchEvent('#qcdC','input'); await p.waitForTimeout(900);
  console.log('TILES:', await txt('#qcdTiles'));
  console.log('MSG:', await txt('#qcdMsg'));
  console.log('NOTE:', (await txt('#qcdNote')).slice(0,700));
  console.log('rects:', await p.$$eval('#qcdSvg rect', r=>r.length), 'path:', await p.$$eval('#qcdSvg path', r=>r.length));
  // RMD compare tiles should now reflect QCD in the plan
  console.log('RMD tiles:', (await txt('#rmdTiles')).slice(0,160));
  console.log('tax tiles:', (await txt('#taxTiles')).slice(0,120));
  await p.$eval('#qcdSvg', e=>e.scrollIntoView({block:'center'})); await p.waitForTimeout(300);
  const el=await p.$('#qcdSvg'); const box=await el.boundingBox();
  await p.screenshot({path:'qcd-app.png', clip:{x:box.x-20,y:box.y-330,width:box.width+40,height:box.height+420}});
  // extra mode
  await p.selectOption('#qcdMode','extra'); await p.waitForTimeout(800);
  console.log('EXTRA tiles:', (await txt('#qcdTiles')).slice(0,400));
  await p.selectOption('#qcdMode','budget'); await p.waitForTimeout(500);
  // apply off
  await p.click('#qcdApply'); await p.waitForTimeout(800);
  console.log('OFF msg:', await txt('#qcdMsg'), '| tiles:', (await txt('#qcdTiles')).slice(0,120));
  await p.click('#qcdApply'); await p.waitForTimeout(500);
  // save / reload
  const json=await p.$eval('#caseJson',e=>e.value); console.log('saved qcd:', JSON.stringify(JSON.parse(json).tax.qcd), '| scnA qcd:', JSON.stringify(JSON.parse(json).scenarios[0].qcd));
  await p.fill('#caseJson', json); await p.click('#loadCase'); await p.waitForTimeout(1000);
  console.log('RELOADED input:', await p.$eval('#qcdC',e=>e.value), '| tiles:', (await txt('#qcdTiles')).slice(0,80));
  // scenario B should have no QCD
  await p.click('#scnTabs button:nth-child(2)'); await p.waitForTimeout(800);
  console.log('Scn B input:', JSON.stringify(await p.$eval('#qcdC',e=>e.value)), '| tiles:', (await txt('#qcdTiles')).slice(0,60));
  await p.click('#scnTabs button:nth-child(1)'); await p.waitForTimeout(600);
  console.log('Scn A input:', await p.$eval('#qcdC',e=>e.value));
  // deck
  const [pop]=await Promise.all([p.waitForEvent('popup'),p.click('#makeDeck')]); await pop.waitForLoadState(); await pop.waitForTimeout(1500);
  const n=await pop.$$eval('.slide, section.sl, .dk-slide', s=>s.length); console.log('slides', n);
  const titles=await pop.evaluate(()=>[...document.querySelectorAll('.slide, section.sl, .dk-slide')].map((s,i)=>(i+1)+': '+s.innerText.replace(/\s+/g,' ').slice(0,60)));
  console.log(titles.slice(24,29).join('\n'));
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
