/* Saved cases: one document per case, partitioned by the advisor who owns it.
     GET    /api/cases            the caller's cases (owners: ?all=1 for every advisor's)
     GET    /api/cases/export     the caller's cases, in full, as one JSON download
     GET    /api/cases/{id}       one case, if the caller owns it or is listed in sharedWith
     PUT    /api/cases/{id}       create or replace; advisorId always comes from the sign-in
     DELETE /api/cases/{id}       soft delete; purged after 30 days by purge.js */
const { app } = require('@azure/functions');
const { principal, cases, json, text, guard } = require('../shared');

const LIST_FIELDS = 'c.id, c.advisorId, c.advisorName, c.clientLabel, c.savedAt, c.updatedAt, c.sharedWith';
const MAX_CASE_BYTES = 1.5 * 1024 * 1024;   // a case with a long Nitrogen text runs about 200 KB

async function readDoc(container, id, me) {
  // the partition key is the owner's id, which the caller may not know: query by id, then check access
  const { resources } = await container.items.query({ query: 'SELECT * FROM c WHERE c.id = @id AND NOT IS_DEFINED(c.deletedAt)', parameters: [{ name: '@id', value: id }] }).fetchAll();
  const doc = resources[0];
  if (!doc) return null;
  const allowed = doc.advisorId === me.id || me.isOwner || (Array.isArray(doc.sharedWith) && doc.sharedWith.includes(me.id));
  return allowed ? doc : null;
}

app.http('casesList', {
  methods: ['GET'], authLevel: 'anonymous', route: 'cases',
  handler: guard(async (request, context) => {
    const me = principal(request); if (!me) return text(401, 'Sign in required.');
    const container = await cases();
    const all = me.isOwner && request.query.get('all') === '1';
    const q = all
      ? { query: `SELECT ${LIST_FIELDS} FROM c WHERE NOT IS_DEFINED(c.deletedAt) ORDER BY c.updatedAt DESC` }
      : { query: `SELECT ${LIST_FIELDS} FROM c WHERE NOT IS_DEFINED(c.deletedAt) AND (c.advisorId = @me OR ARRAY_CONTAINS(c.sharedWith, @me)) ORDER BY c.updatedAt DESC`, parameters: [{ name: '@me', value: me.id }] };
    const { resources } = await container.items.query(q).fetchAll();
    context.log(`cases.list ${me.id} ${all ? 'all' : 'own'} ${resources.length}`);
    return json(200, resources);
  })
});

app.http('casesExport', {
  methods: ['GET'], authLevel: 'anonymous', route: 'cases/export',
  handler: guard(async (request, context) => {
    const me = principal(request); if (!me) return text(401, 'Sign in required.');
    const container = await cases();
    const all = me.isOwner && request.query.get('all') === '1';   // an administrator exports every advisor's cases with ?all=1
    const { resources } = await container.items.query(all
      ? { query: 'SELECT * FROM c WHERE NOT IS_DEFINED(c.deletedAt) ORDER BY c.updatedAt DESC' }
      : { query: 'SELECT * FROM c WHERE c.advisorId = @me AND NOT IS_DEFINED(c.deletedAt) ORDER BY c.updatedAt DESC', parameters: [{ name: '@me', value: me.id }] }).fetchAll();
    const out = resources.map(({ _rid, _self, _etag, _attachments, _ts, ...keep }) => keep);
    context.log(`cases.export ${me.id} ${out.length}`);
    return { status: 200, body: JSON.stringify(out, null, 1), headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="fortress-cases-${new Date().toISOString().slice(0, 10)}.json"` } };
  })
});

app.http('casesGet', {
  methods: ['GET'], authLevel: 'anonymous', route: 'cases/{id}',
  handler: guard(async (request, context) => {
    const me = principal(request); if (!me) return text(401, 'Sign in required.');
    const doc = await readDoc(await cases(), request.params.id, me);
    if (!doc) return text(404, 'No such case.');
    context.log(`cases.get ${me.id} ${doc.id}${doc.advisorId !== me.id ? ' (owner/shared read)' : ''}`);
    const { _rid, _self, _etag, _attachments, _ts, ...keep } = doc;
    return json(200, keep);
  })
});

app.http('casesPut', {
  methods: ['PUT'], authLevel: 'anonymous', route: 'cases/{id}',
  handler: guard(async (request, context) => {
    const me = principal(request); if (!me) return text(401, 'Sign in required.');
    const id = String(request.params.id || '');
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return text(400, 'Bad case id.');
    const raw = await request.text();
    if (raw.length > MAX_CASE_BYTES) return text(413, 'Case too large.');
    let body; try { body = JSON.parse(raw); } catch (e) { return text(400, 'Body must be JSON.'); }
    if (!body || typeof body.case !== 'object' || !body.case) return text(400, 'Body needs a case object.');
    const container = await cases();
    const existing = await readDoc(container, id, me);
    if (existing && existing.advisorId !== me.id && !me.isOwner) return text(403, 'Not your case.');
    const now = new Date().toISOString();
    const doc = {
      id,
      advisorId: existing ? existing.advisorId : me.id,
      advisorName: me.name || me.details,
      clientLabel: String(body.clientLabel || 'Unnamed').slice(0, 120),
      case: body.case,
      sharedWith: existing && Array.isArray(existing.sharedWith) ? existing.sharedWith : [],
      savedAt: existing ? existing.savedAt : now,
      updatedAt: now
    };
    await container.items.upsert(doc);
    context.log(`cases.put ${me.id} ${id} ${existing ? 'update' : 'create'}`);
    return json(200, { id, savedAt: doc.savedAt, updatedAt: doc.updatedAt });
  })
});

app.http('casesDelete', {
  methods: ['DELETE'], authLevel: 'anonymous', route: 'cases/{id}',
  handler: guard(async (request, context) => {
    const me = principal(request); if (!me) return text(401, 'Sign in required.');
    const container = await cases();
    const doc = await readDoc(container, request.params.id, me);
    if (!doc) return text(404, 'No such case.');
    if (doc.advisorId !== me.id && !me.isOwner) return text(403, 'Not your case.');
    doc.deletedAt = new Date().toISOString(); doc.deletedBy = me.id;
    await container.items.upsert(doc);
    context.log(`cases.delete ${me.id} ${doc.id}`);
    return { status: 204 };
  })
});
