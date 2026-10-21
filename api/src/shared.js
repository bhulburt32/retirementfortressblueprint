/* Shared by every function: who is calling, the Cosmos container, the Anthropic key.
   Identity comes from the Static Web App, which checks the Entra sign-in and adds the
   x-ms-client-principal header to every request it forwards; nothing here trusts the body. */
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

/* Static Web Apps *managed* functions have no managed identity, so Cosmos is reached with the account's
   connection string (COSMOS_CONNECTION_STRING, from Cosmos → Settings → Keys). The Entra credential path
   below stays for a "bring your own" Functions app or local development with az login. */
let credential = null;
function cred() { if (!credential) credential = new DefaultAzureCredential(); return credential; }
const OWNER_IDS = (process.env.OWNER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);   // Entra object ids allowed to list every case

function principal(request) {
  const h = request.headers.get('x-ms-client-principal');
  if (!h) return null;
  try {
    const p = JSON.parse(Buffer.from(h, 'base64').toString('utf8'));
    if (!p || !p.userId) return null;
    const claims = Array.isArray(p.claims) ? p.claims : [];
    const name = (claims.find(c => c.typ === 'name') || {}).val || p.userDetails || '';
    return { id: p.userId, name, details: p.userDetails || '', roles: p.userRoles || [], isOwner: OWNER_IDS.includes(p.userId) };
  } catch (e) { return null; }
}

let containerPromise = null;
function cases() {
  if (!containerPromise) {
    const conn = process.env.COSMOS_CONNECTION_STRING, endpoint = process.env.COSMOS_ENDPOINT;
    let client;
    if (conn) client = new CosmosClient(conn);
    else if (endpoint) client = new CosmosClient({ endpoint, aadCredentials: cred() });
    else throw new Error('Neither COSMOS_CONNECTION_STRING nor COSMOS_ENDPOINT is set');
    containerPromise = Promise.resolve(client.database(process.env.COSMOS_DATABASE || 'fortress').container(process.env.COSMOS_CONTAINER || 'cases'));
  }
  return containerPromise;
}

let anthropicKey = null;
async function getAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;          // local development only
  if (anthropicKey) return anthropicKey;
  const uri = process.env.KEYVAULT_URI;
  if (!uri) throw new Error('KEYVAULT_URI is not set');
  const secret = await new SecretClient(uri, cred()).getSecret(process.env.ANTHROPIC_SECRET_NAME || 'anthropic-api-key');
  anthropicKey = secret.value;
  return anthropicKey;
}

const json = (status, body) => ({ status, jsonBody: body });
const text = (status, body) => ({ status, body, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/* Wraps a handler so an exception becomes a 500 with a one-line reason the page can show
   ("Not saved: Database: …") and a full stack in the function log, instead of an empty 500. */
function guard(fn) {
  return async (request, context) => {
    try { return await fn(request, context); }
    catch (e) {
      context.error(e && e.stack || e);
      const msg = (e && e.message) || String(e);
      const kind = /cosmos|database|container|partition|resource not found|403|401|credential|managed identity|token/i.test(msg) ? 'Database' : 'Server';
      return text(500, kind + ': ' + msg.split('\n')[0].slice(0, 300));
    }
  };
}

module.exports = { principal, cases, getAnthropicKey, json, text, guard };
