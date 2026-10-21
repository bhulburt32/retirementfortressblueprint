/* Section 23: load a case from an uploaded .txt or Word .docx file holding the Copy case data block.
   Word turns straight quotes curly; the loader straightens them when the block won't parse as is. */
const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path'), fs = require('fs'), os = require('os');
const zlib = require('zlib');
function crc32(b){ let c, t = []; for(let n = 0; n < 256; n++){ c = n; for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  c = 0xFFFFFFFF; for(const x of b) c = t[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files){   // deflated entries, like Word writes them
  const parts = [], cd = []; let off = 0;
  for(const [name, text] of Object.entries(files)){
    const data = Buffer.from(text, 'utf8'), comp = zlib.deflateRawSync(data), nm = Buffer.from(name), h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(crc32(data), 14);
    h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nm.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc32(data), 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    parts.push(h, nm, comp); cd.push(c, nm); off += 30 + nm.length + comp.length;
  }
  const cdb = Buffer.concat(cd), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(cd.length / 2, 8); e.writeUInt16LE(cd.length / 2, 10); e.writeUInt32LE(cdb.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat(parts.concat([cdb, e]));
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{ if(m.type()==='error' && !/fonts.googleapis|ERR_TUNNEL/.test(m.text())) errs.push('console:'+m.text()); });
  await p.goto('file://'+path.resolve(__dirname,'../dist/preview-smith.html'),{waitUntil:'load'}); await p.waitForTimeout(1200);
  await p.click('#expandAll'); await p.waitForTimeout(300);
  const v=id=>p.$eval('#'+id,e=>e.value);
  const msg=()=>p.$eval('#caseMsg',e=>e.textContent);
  const accts=()=>p.$$eval('#acctBody tr',rs=>rs.length);
  const base = JSON.parse(await v('caseJson'));
  const n0 = await accts();
  console.log('default:', await v('clientFirst'), await v('clientLast'), '| accounts', n0);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'casefile-'));
  const upload = async (file) => { await p.setInputFiles('#caseFile', file); await p.waitForTimeout(1500); };

  // 1. plain text file with a heading line around the block
  const c1 = JSON.parse(JSON.stringify(base)); c1.household.clientFirst = 'Textfile'; c1.household.clientLast = 'Jones';
  const f1 = path.join(dir, 'jones.txt'); fs.writeFileSync(f1, 'Case data for the Jones household\n' + JSON.stringify(c1, null, 2) + '\nend\n');
  await upload(f1);
  console.log('txt:', await v('clientFirst'), await v('clientLast'), '|', await msg(), '| accounts', await accts());
  if(await v('clientFirst') !== 'Textfile') errs.push('txt case did not load');

  // 2. Word .docx: block split over paragraphs and runs, quotes curled the way Word autoformats them
  const c2 = JSON.parse(JSON.stringify(base)); c2.household.clientFirst = 'Wordfile'; c2.household.clientLast = 'O’Brien & Co';
  let curled = JSON.stringify(c2, null, 1).replace(/"/g, (m, i, s) => /[\s\[{:,]/.test(s[i-1] || ' ') ? '“' : '”');
  const paras = curled.split('\n').map(l => '<w:p><w:r><w:t xml:space="preserve">' + esc(l.slice(0, 10)) + '</w:t></w:r><w:r><w:t xml:space="preserve">' + esc(l.slice(10)) + '</w:t></w:r></w:p>').join('');
  const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Smith case — saved 10/16</w:t></w:r></w:p>' + paras + '</w:body></w:document>';
  const f2 = path.join(dir, 'obrien.docx'); fs.writeFileSync(f2, zip({'[Content_Types].xml':'<Types/>', 'word/document.xml':doc}));
  await upload(f2);
  console.log('docx:', await v('clientFirst'), await v('clientLast'), '|', await msg(), '| accounts', await accts());
  // the fallback straightens every curly quote, the apostrophe in the name included
  if(await v('clientFirst') !== 'Wordfile' || await v('clientLast') !== "O'Brien & Co") errs.push('docx case did not load');
  if(await accts() !== n0) errs.push('docx account count changed: ' + (await accts()));

  // 3. a file without case data leaves the open case alone
  const f3 = path.join(dir, 'memo.txt'); fs.writeFileSync(f3, 'Meeting memo, no data here.');
  await upload(f3);
  console.log('junk:', await v('clientFirst'), '|', await msg());
  if(await v('clientFirst') !== 'Wordfile' || !/doesn't hold/.test(await msg())) errs.push('junk file handled wrongly');

  // 4. legacy .doc is refused with a hint
  const f4 = path.join(dir, 'old.doc'); fs.writeFileSync(f4, 'x');
  await upload(f4);
  console.log('doc:', await msg());
  if(!/\.docx/.test(await msg())) errs.push('.doc not refused');

  // report still builds after a file load
  const [pop]=await Promise.all([p.context().waitForEvent('page',{timeout:20000}),p.click('#makeDeck')]); await pop.waitForLoadState(); await pop.waitForTimeout(1500);
  console.log('deck title:', await pop.title());
  console.log('ERRORS:', errs.length?errs:'none'); await b.close();
})();
