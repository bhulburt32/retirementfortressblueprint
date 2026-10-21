# Azure pieces — what goes where in the repo

This folder is step 7 of *Moving the Retirement Fortress Blueprint to Azure*. Copy its contents into the
repository root (`bhulburt32/<repo>`), replacing files of the same name:

| From this folder | To | What it is |
|---|---|---|
| `api/` | `api/` | The Functions API (Node 20, `@azure/functions` v4): `GET/PUT/DELETE /api/cases`, `GET /api/cases/export`, `POST /api/summary`, nightly purge of soft-deleted cases. |
| `staticwebapp.config.json` | repo root | Routes, Entra ID sign-in, security headers. **Replace `<TENANT_ID>`** with the Directory (tenant) ID from the Entra app's Overview page before the first deploy. |
| `.github/workflows/azure-static-web-apps.yml` | `.github/workflows/` | Replaces the workflow Azure generated when the Static Web App was created. Open the generated one first and copy its secret name (`AZURE_STATIC_WEB_APPS_API_TOKEN_…`) into the two `secrets.` references, or rename the secret in GitHub → Settings → Secrets to `AZURE_STATIC_WEB_APPS_API_TOKEN`. Then delete the generated file. |
| `scripts/build.py` | `scripts/build.py` | Replaces the build script. Same outputs as before plus `dist/preview-smith.html`; `--azure` adds `dist/azure/index.html` + the config. |
| `src/fortress-mapper.html` | `src/fortress-mapper.html` | Version 172 of the page (also in the cumulative patch). |
| `tests/`, `modules/`, `docs/`, `samples/`, `assets/` | same | The maintained tests now load `dist/preview-smith.html`; modules, guide, sample case and worksheet as before. |

## package.json

Add the `build:azure` script and bump the version:

```json
"version": "1.172.0",
"scripts": {
  "build": "python3 scripts/build.py && node --check dist/_x.js",
  "build:azure": "python3 scripts/build.py --azure && node --check dist/_x.js",
  "test": "npm run build && node tests/run.js",
  ...
}
```

`tests/run.js`: replace `'t-default'` in `SUITE` with `'t-cfneg', 't-status', 't-pfdeck'` — `t-default` checked the
old sample banner, which no longer exists. (`t-pfdeck`, `t-prop`, `t-prop2` need a Nitrogen proposal PDF at
`samples/portfolio-proposal.pdf` or in `PROPOSAL_PDF`; without one they report "skipped".)

## Static Web App settings (portal → the SWA → Settings → Environment variables)

| Name | Value |
|---|---|
| `AAD_CLIENT_ID` | the Entra app's Application (client) ID |
| `AAD_CLIENT_SECRET` | the Entra app’s client secret value, pasted directly (Key Vault references are not supported on managed functions) |
| `COSMOS_CONNECTION_STRING` | the account's **Primary Connection String** (Cosmos DB → Settings → Keys). Managed functions have no managed identity, so this is how the API reaches the database. |
| `COSMOS_ENDPOINT` | only for a bring-your-own Functions app with a managed identity; ignored when the connection string is set |
| `COSMOS_DATABASE` | `fortress` |
| `COSMOS_CONTAINER` | `cases` |
| `ANTHROPIC_API_KEY` | the Anthropic API key, pasted directly when compliance approves the summaries; leave unset until then |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` (or whichever is approved) |
| `SUMMARIES_ENABLED` | `false` until compliance signs off on section 3 of the plan, then `true` |
| `OWNER_IDS` | comma-separated Entra object IDs of the administrators who may see every advisor's cases (from Entra → Users → the person → Object ID) |

`KEYVAULT_URI` and `ANTHROPIC_SECRET_NAME` apply only to a bring-your-own Functions app with a managed identity.

Static Web Apps **managed** functions run without a managed identity, so the Cosmos DB role assignment and the
Key Vault references do not apply to them: the Cosmos connection string and the Entra client secret go straight
into the settings above (the settings blade is encrypted at rest and visible only to people with access to the
Static Web App). Nothing secret goes in the repo. Moving to a bring-your-own Functions app later restores the
managed-identity path without code changes.

## Local run (optional)

```bash
cd api && npm install && cp local.settings.json.example local.settings.json   # fill in values
npm install -g azure-functions-core-tools@4 @azure/static-web-apps-cli
npm run build:azure
swa start dist/azure --api-location api        # http://localhost:4280 with a fake sign-in page
```

## What the page does on Azure

`dist/azure/index.html` is the standalone page with `window.RFB_API = '/api'` set ahead of the app. With
that set the page: shows "Signed in as …" in the masthead (from `/.auth/me`) and fills the Advisor field
on a new case; shows the **Saved cases** panel in section 23 (Save / Save as new / Open / Delete /
Export all through `/api/cases`); and routes the three Claude summaries (section 12 Nitrogen, section 16
portfolio, goals drafting) through `POST /api/summary`, so only the parsed figures leave the browser. The
claude.ai artifact never sets `RFB_API`, so none of this is active there.
