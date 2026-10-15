/* Once a day, remove cases that were soft-deleted more than 30 days ago. */
const { app } = require('@azure/functions');
const { cases } = require('../shared');

app.timer('purgeDeleted', {
  schedule: '0 30 3 * * *',
  handler: async (timer, context) => {
    const container = await cases();
    const cutoff = new Date(Date.now() - 30 * 864e5).toISOString();
    const { resources } = await container.items.query({ query: 'SELECT c.id, c.advisorId FROM c WHERE IS_DEFINED(c.deletedAt) AND c.deletedAt < @cutoff', parameters: [{ name: '@cutoff', value: cutoff }] }).fetchAll();
    for (const r of resources) { await container.item(r.id, r.advisorId).delete(); }
    context.log(`purge: ${resources.length} case(s) removed`);
  }
});
