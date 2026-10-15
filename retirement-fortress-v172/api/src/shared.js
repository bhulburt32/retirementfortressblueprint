/* Shared by every function: who is calling, the Cosmos container, the Anthropic key.
   Identity comes from the Static Web App, which checks the Entra sign-in and adds the
   x-ms-client-principal header to every request it forwards; nothing here trusts the body. */
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

const credential = new DefaultAzureCredential();            // the Static Web App's managed identity when deployed; your az login locally
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
    const endpoint = process.env.COSMOS_ENDPOINT;
    if (!endpoint) throw new Error('COSMOS_ENDPOINT is not set');
    const client = new CosmosClient({ endpoint, aadCredentials: credential });
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
  const secret = await new SecretClient(uri, credential).getSecret(process.env.ANTHROPIC_SECRET_NAME || 'anthropic-api-key');
  anthropicKey = secret.value;
  return anthropicKey;
}

const json = (status, body) => ({ status, jsonBody: body });
const text = (status, body) => ({ status, body, headers: { 'content-type': 'text/plain; charset=utf-8' } });

module.exports = { principal, cases, getAnthropicKey, json, text };
