/* Minimal stand-in for the Static Web App + Functions API: serves dist/azure and fakes /.auth/me,
   /api/cases and /api/summary in memory. For the local check only. */
const http = require('http'), fs = require('fs'), path = require('path');
const site = process.argv[2]; const port = +process.argv[3] || 8787;
const docs = {}; const log = [];
function send(res, code, body, type){ res.writeHead(code, {'Content-Type': type || 'application/json'}); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); }
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let buf = '';
  req.on('data', d => buf += d); req.on('end', () => {
    log.push(req.method + ' ' + u.pathname + u.search);
    if (u.pathname === '/.auth/me') return send(res, 200, {clientPrincipal: {identityProvider: 'aad', userId: 'u-ben', userDetails: 'ben@example.test', userRoles: ['anonymous', 'authenticated'], claims: [{typ: 'name', val: 'Ben Hulburt'}]}});
    if (u.pathname === '/api/summary' && req.method === 'POST') return send(res, 200, {json: {holdings: 'stub', risk: 'stub'}});
    if (u.pathname === '/api/cases/export') return send(res, 200, Object.values(docs));
    if (u.pathname === '/api/cases' && req.method === 'GET') return send(res, 200, Object.values(docs).filter(d => !d.deletedAt).map(d => ({id: d.id, advisorId: d.advisorId, clientLabel: d.clientLabel, advisorName: d.advisorName, updatedAt: d.updatedAt, planStatus: d.case && d.case.planStatus})));
    const mm = /^\/api\/cases\/([A-Za-z0-9_-]+)$/.exec(u.pathname);
    if (mm) {
      const id = mm[1];
      if (req.method === 'GET') return docs[id] && !docs[id].deletedAt ? send(res, 200, docs[id]) : send(res, 404, {error: 'not found'});
      if (req.method === 'PUT') { const b = JSON.parse(buf || '{}'); docs[id] = {id, advisorId: 'u-ben', advisorName: 'Ben Hulburt', clientLabel: b.clientLabel, case: b.case, updatedAt: new Date().toISOString()}; return send(res, 200, {id, updatedAt: docs[id].updatedAt}); }
      if (req.method === 'DELETE') { if (docs[id]) docs[id].deletedAt = new Date().toISOString(); return send(res, 200, {ok: true}); }
    }
    if (u.pathname === '/__log') return send(res, 200, log);
    let f = path.join(site, u.pathname === '/' ? 'index.html' : u.pathname);
    if (!fs.existsSync(f)) f = path.join(site, 'index.html');
    fs.readFile(f, (e, d) => e ? send(res, 404, 'nope', 'text/plain') : send(res, 200, d, f.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8'));
  });
}).listen(port, () => console.log('stub on', port));
