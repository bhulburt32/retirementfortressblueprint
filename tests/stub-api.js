/* Minimal stand-in for the Static Web App + Functions API: serves dist/azure and fakes /.auth/me,
   /api/cases and /api/summary in memory. For the local check only. */
const http = require('http'), fs = require('fs'), path = require('path');
const site = process.argv[2]; const port = +process.argv[3] || 8787;
const docs = {}; const log = [];
/* the signed-in user: Ben by default; a check switches identity with POST /__as {userId, userDetails, name} */
let who = {userId: 'u-ben', userDetails: 'ben@example.test', name: 'Ben Hulburt'};
const email = () => (who.userDetails || '').toLowerCase();
const visible = d => !d.deletedAt && (d.advisorId === who.userId || (d.sharedWith || []).includes(who.userId) || (d.sharedWith || []).includes(email()));
const row = d => ({id: d.id, advisorId: d.advisorId, advisorName: d.advisorName, advisorEmail: d.advisorEmail, clientLabel: d.clientLabel, updatedAt: d.updatedAt, sharedWith: d.sharedWith || [], planStatus: d.case && d.case.planStatus});
function send(res, code, body, type){ res.writeHead(code, {'Content-Type': type || 'application/json'}); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); }
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let buf = '';
  req.on('data', d => buf += d); req.on('end', () => {
    log.push(req.method + ' ' + u.pathname + u.search);
    if (u.pathname === '/__as' && req.method === 'POST') { who = Object.assign({}, who, JSON.parse(buf || '{}')); return send(res, 200, who); }
    if (u.pathname === '/.auth/me') return send(res, 200, {clientPrincipal: {identityProvider: 'aad', userId: who.userId, userDetails: who.userDetails, userRoles: ['anonymous', 'authenticated'], claims: [{typ: 'name', val: who.name}]}});
    if (u.pathname === '/api/cases/advisors') { const seen = {}; return send(res, 200, Object.values(docs).filter(d => !d.deletedAt && d.advisorEmail && !seen[d.advisorEmail] && (seen[d.advisorEmail] = 1)).map(d => ({name: d.advisorName, email: d.advisorEmail}))); }
    const sm = /^\/api\/cases\/([A-Za-z0-9_-]+)\/share$/.exec(u.pathname);
    if (sm && req.method === 'PUT') { const d = docs[sm[1]]; if (!d || !visible(d)) return send(res, 404, {error: 'not found'}); if (d.advisorId !== who.userId) return send(res, 403, 'Only the advisor who saved a case, or an administrator, can share it.', 'text/plain'); const b = JSON.parse(buf || '{}'); d.sharedWith = (b.sharedWith || []).map(e => String(e).trim().toLowerCase()).filter((e, i, a) => e && e !== email() && a.indexOf(e) === i); return send(res, 200, {id: d.id, sharedWith: d.sharedWith}); }
    if (u.pathname === '/api/summary' && req.method === 'POST') return send(res, 200, {json: {holdings: 'stub', risk: 'stub'}});
    if (u.pathname === '/api/cases/export') return send(res, 200, Object.values(docs));
    if (u.pathname === '/api/cases' && req.method === 'GET') return send(res, 200, Object.values(docs).filter(visible).map(row));
    const mm = /^\/api\/cases\/([A-Za-z0-9_-]+)$/.exec(u.pathname);
    if (mm) {
      const id = mm[1];
      if (req.method === 'GET') return docs[id] && visible(docs[id]) ? send(res, 200, docs[id]) : send(res, 404, {error: 'not found'});
      if (req.method === 'PUT') { const b = JSON.parse(buf || '{}'); const ex = docs[id]; if (ex && ex.advisorId !== who.userId) return send(res, 403, 'Not your case.', 'text/plain'); docs[id] = {id, advisorId: ex ? ex.advisorId : who.userId, advisorName: ex ? ex.advisorName : who.name, advisorEmail: ex ? ex.advisorEmail : email(), clientLabel: b.clientLabel, case: b.case, sharedWith: ex ? ex.sharedWith || [] : [], updatedAt: new Date().toISOString()}; return send(res, 200, {id, updatedAt: docs[id].updatedAt}); }
      if (req.method === 'DELETE') { const d = docs[id]; if (d && d.advisorId !== who.userId) return send(res, 403, 'Not your case.', 'text/plain'); if (d) d.deletedAt = new Date().toISOString(); return send(res, 200, {ok: true}); }
    }
    if (u.pathname === '/__log') return send(res, 200, log);
    let f = path.join(site, u.pathname === '/' ? 'index.html' : u.pathname);
    if (!fs.existsSync(f)) f = path.join(site, 'index.html');
    fs.readFile(f, (e, d) => e ? send(res, 404, 'nope', 'text/plain') : send(res, 200, d, f.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8'));
  });
}).listen(port, () => console.log('stub on', port));
