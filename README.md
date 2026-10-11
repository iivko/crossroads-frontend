# neopact human dashboard

Next.js App Router, React and TypeScript. The dashboard shows the product catalogue and galleries, buyer requests and comparisons, negotiation history, approval queue, confirmed orders and workspace activity. Seller workspaces see their own negotiations and orders; buyer-only request views are absent.

Human reviewers inspect immutable terms, product evidence, changes from the previous offer, current validity and both approval states. Approval requires checking the exact-offer acknowledgement. The API rechecks the offer, policies and inventory when each approval arrives. A stale open dialog cannot approve a newer offer accidentally.

Catalogue editing, request creation, rule configuration and agent negotiation actions use the [CLI](https://github.com/iivko/crossroads-cli/blob/main/README.md). The browser proxy allows sign-in, logout, approval decisions, private human instructions, scoped credential management and explicit identity linking. The backend enforces the permissions for each operation.

## Buyer/seller preview and live activity

The local preview has explicit **Buyer preview** (Forma Studio) and **Seller preview** (Forma Supply) account buttons. These are separately authenticated demo accounts; the normal workspace selector still lists only actual memberships. Set the following server-only values in `.env.local` when using the seeded loopback API:

```dotenv
NEOPACT_DEMO_PREVIEW=true
NEOPACT_DEMO_PASSWORD=local-market-demo
# Optional absolute backend directory used in local MCP configuration:
NEOPACT_MCP_PROJECT_DIR=/absolute/path/to/crossroads-backend
```

The preview routes refuse non-loopback origins/upstreams and remain disabled by default. Restart the frontend after changing settings. **Run live demo** executes one bounded, scripted trading session through real scoped backend credentials. It creates one 80-chair request, records offers and counteroffers over roughly 30 seconds, and stops for human approval. It does not call an LLM, approve orders or process payments. Keep the page open during the run. Temporary credentials are revoked when it finishes; interrupted negotiations remain inspectable.

The trading floor polls every five seconds, separates your business from trading partners, resolves prices against historical offers, shows incoming requests and next-turn availability, and highlights only new backend events. Pause stops the displayed feed while the workspace keeps updating. Activity is participant-visible, not a public cross-business trade stream. The full audit trail remains expandable on Activity.

## Agent and sign-in connections

**Connections** creates a named, seven-day workspace credential and shows its MCP configuration once. Read-only access is the default; **Allow agent trading** additionally permits role-appropriate request/product actions and negotiation. Credentials can be revoked. A valid credential does not establish that a client is currently running.

The companion backend now includes a working local stdio MCP server with 13 tools; install with `uv sync --extra mcp`. Claude Desktop, Claude Code, Codex and compatible local clients can use the generated configuration. See the backend's `mcp_server/README.md`. It does not yet offer a hosted ChatGPT connector: remote OAuth, per-user authorization and public HTTPS are still required.

Google and ChatGPT account linking/sign-in are implemented in the backend. Configure registered provider credentials and exact callback URLs as described in `docs/identity.md` in the backend checkout. Buttons show **Setup required** until configured. ChatGPT website sign-in currently requires OpenAI commercial trial access; a ChatGPT subscription/API key is not an OAuth client. Sign-in identities are separate from trading-agent access. Provider callback errors are explained without exposing token material.

## Negotiate more

Open a room from **Negotiations** or **Approvals**, select **Negotiate more**, write what your agent should try, then select **Send to my agent**. Both buyer and seller approvers can do this. The instruction is private to your workspace and agent, and the dashboard shows when it is waiting or has been handled.

Sending starts a fresh bounded round and clears previous approvals. Existing price floors, budgets and other rules still apply. A new agreement requires both human approvals; confirmed orders cannot be reopened. Your own agent must be connected and watching its inbox, or restarted to pick up the instruction. The dashboard does not host a model. See the [complete guidance and agent setup guide](https://github.com/iivko/crossroads-backend/blob/main/docs/NEGOTIATE_MORE.md).

## Neopact design system

The application uses the shared neopact logos, locally hosted Manrope and IBM Plex Mono, and semantic design tokens. See [frontend application and research](design/FRONTEND-APPLICATION.md) for the dashboard decisions and backend metric definitions. The overview shows a bounded snapshot of recent negotiations and demo orders, with drilldowns and refresh status; values are not all-time revenue or agent health telemetry.

The shared [brand kit](design/neopact-brand-system/README.md) contains logos, bundled fonts, CSS/JSON tokens, component guidance, and the visual reference. Contributors and implementation agents should start with the [agent handoff](design/neopact-brand-system/AGENT-HANDOFF.md) before building UI.

Open `design/neopact-brand-system/visual-guide.html` after cloning to preview the guide, or [download the standalone kit](design/neopact-brand-system.zip). Use the supplied SVG logos and retain the bundled font licenses. [Palette research](design/neopact-brand-system/PALETTE-RESEARCH.md) distinguishes measured readability from conversion hypotheses.
## Conversations, needs and human review

Open a negotiation to follow the agents' actual messages, questions, replies and explanations. Offer cards show the recorded commercial terms, and image references open the product evidence. The shared conversation contains only messages and needs published to both businesses. It does not show the other workspace's private goals, limits or questions to its human.

**Your goals and needs** shows your current owner brief. Requirements are marked **Met**, **Not met**, **Unverified** or **Waived by owner**, with supporting evidence where available. Unsupported needs remain visible. An unresolved must-have blocks agreement; an unverified preference is not a confirmed promise. A waiver records the owner's decision and does not mark the need as met. Owners update briefs, sharing choices and waivers through the CLI.

When an agent needs a decision, its question appears under **Your agent needs your input**. Select **Reply privately to my agent**, enter your answer and send it through the existing private instruction flow. Replies restart the negotiation and clear prior approvals. Giving an answer does not edit the brief or waive a requirement; those changes still require the owner to update the brief through the CLI.

After both agents agree, the offer appears in both businesses' **Approvals** queues. Review the exact terms, product evidence and **Needs reviewed with offer** before approving. This needs review is saved with the offer and retained in the order; later changes to the current brief do not rewrite it. Each business must approve the same valid offer before an order is recorded.

## Run locally

Recommended: follow [backend Docker Compose setup](https://github.com/iivko/crossroads-backend/blob/main/README.md). The UI runs at http://localhost:3100.

For host development, start the API and worker separately, then:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The API and worker can run from the backend's existing Docker configuration while this checkout serves the UI on the host. From the backend directory, run `docker compose up --build -d postgres minio api worker`, followed by the explicit demo seed command `docker compose exec api python -m market.manage seed`. Keep the database and storage volumes. Start this frontend with `API_INTERNAL_URL=http://127.0.0.1:8100`; changing that runtime URL requires restarting the frontend process. This hybrid setup also works when the two checkouts have different directory names from the full-stack Compose example.

Node.js 24 is the tested runtime. `API_INTERNAL_URL` is a server-only runtime setting, defaulting to `http://127.0.0.1:8100`; Compose sets it to `http://api:8100`. No browser bearer token or storage secret is embedded in the build. Browser calls stay on the dashboard origin through `/api/v1/*`.

The API uses HttpOnly session cookies plus a CSRF cookie/header and an allowed Origin check. Configure `FRONTEND_URL` and `ALLOWED_ORIGINS` in the backend if changing the dashboard port. Keep agent credentials separate from human browser sessions.

## Typed API client and schema workflow

The dashboard uses [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) with TypeScript definitions generated by `openapi-typescript`. `lib/api.ts` creates the client, adds the current workspace and CSRF headers, and extracts each named response payload. The component types are aliases of the generated schemas; there is no separate handwritten copy of the wire DTOs. Endpoint paths, path/query parameters, request bodies and response payloads are checked by TypeScript.

JSON responses contain one resource label and the HTTP status, for example:

```json
{
  "products": { "items": [], "total": 0, "offset": 0, "limit": 100 },
  "status_code": 200
}
```

Errors use `error: { code, message, details }` with the matching `status_code`; `details` is `null` when no extra information is available. The client preserves the API error message, machine code and HTTP status in `ApiError`, and rejects success envelopes with a missing or mismatched status. Image content endpoints retain their binary JPEG responses. See the [complete backend API guide](https://github.com/iivko/crossroads-backend/blob/main/docs/api.md) for labels, permissions and request examples.

A typed request looks like this:

```ts
import { createMarketplaceClient, responseData } from "@/lib/api";

const client = createMarketplaceClient();
const { product } = responseData(
  await client.GET("/api/v1/products/{product_id}", {
    params: { path: { product_id: "prod-forma" } },
  }),
);
```

Two generated artifacts are checked into this repository:

- `openapi/openapi.json`: the backend OpenAPI snapshot.
- `lib/generated/api.d.ts`: generated, formatted TypeScript definitions.

Do not edit generated definitions by hand. After a backend contract change, start the updated API, then run these commands **from the frontend directory**:

```sh
npm ci
just fetch
npm run typecheck
```

`just fetch` runs `scripts/fetch-openapi.sh` with Bash. Its default URL is `http://127.0.0.1:8100/openapi.json`. Override it with a positional URL or `OPENAPI_URL`:

```sh
just fetch http://localhost:8100/openapi.json
OPENAPI_URL=http://localhost:8100/openapi.json just fetch
```

The URL argument takes precedence over `OPENAPI_URL`. `API_INTERNAL_URL` configures the dashboard proxy; it does not configure schema downloads. The fetch recipe validates the response contract and generates types in a temporary directory before replacing the checked-in artifacts. Failed downloads, invalid schemas and generation errors leave existing artifacts untouched.

These recipes work offline using the checked-in snapshot:

```sh
just generate     # Regenerate the TypeScript definitions.
just check-api    # Fail if the definitions differ; does not modify artifacts.
```

Required tools are Node.js 24, npm, Bash and curl, plus [just](https://just.systems/man/en/packages.html) for the recipes. `npm ci` installs the pinned generator and formatter. If just is unavailable, use the equivalent npm commands or Bash script directly:

| just recipe      | npm equivalent             |
| ---------------- | -------------------------- |
| `just fetch`     | `npm run api:fetch`        |
| `just fetch URL` | `npm run api:fetch -- URL` |
| `just generate`  | `npm run api:generate`     |
| `just check-api` | `npm run api:check`        |

```sh
bash scripts/fetch-openapi.sh
bash scripts/fetch-openapi.sh --offline
bash scripts/fetch-openapi.sh --check
```

Commit the snapshot and generated definitions together with any client changes. `check-api` verifies that the types match the committed snapshot; it does not contact the backend or detect an unexported backend change. Builds and CI use the committed artifacts and need no running API.

## Checks

```sh
npm run api:check
npm run typecheck
npm run format:check
npm run test:unit
npm run build
npm run test:ui
```

CI runs these checks on every push and pull request. `test:unit` runs mocked transport and proxy tests: resource envelopes, API failures, workspace headers, cookie/CSRF and idempotency transport, blocked dashboard operations and binary images. `test:ui` starts an isolated preview and mocks every API call to test buyer/seller instructions, draft preservation, retries, shared conversation, private questions, needs evidence, immutable reviews and workspace isolation. It checks mobile controls and transcript bounds, including long untrusted text. Both suites leave real data untouched. Browser tests use local Chrome by default; CI installs Playwright Chromium.

The Docker image runs Next.js's standalone server as a non-root user. For a temporary host production preview, `npm run start` serves the completed build; Docker uses the generated standalone `server.js` directly.

## Browser test

Start the full stack and seed data. Prepare one pending deal using `uv run python scripts/demo_agents.py` from `backend`, then:

```sh
npx playwright test workspace.spec.ts
```

The approval test selects a valid demonstration with neither approval recorded. Set `DEMO_ROOM_ID` to the room ID printed by the script to target a specific fresh deal. Buyer and seller follow the same room and immutable offer ID: sellers intentionally receive a redacted request title, so their title must not be matched against the buyer's private title. The test checks both recorded approvals, one resulting order, and the corresponding stock allocation.

To reconcile the dashboard with the actual seeded backend without creating orders:

```sh
npx playwright test live-metrics.spec.ts
```

These live checks compare buyer/seller metrics, state distribution and offer drilldowns against authenticated API responses, and verify real product images, purchase requirements and audit activity. They require at least one negotiation created by the CLI demonstration. All business-data operations in this suite are reads; sign-in creates normal local sessions.

`npm test` includes the live read-only checks and the state-changing approval integration test. CI runs the safe `test:unit` and `test:ui` suites instead; it never runs either live test file.

The integration test uses `/usr/bin/google-chrome` by default. Set `CHROME_PATH` to a Chrome/Chromium executable if needed, and `FRONTEND_URL` if the dashboard is elsewhere. It logs in as both demo users, downloads visible gallery images, reviews exact terms, approves the same offer twice, and verifies the persisted order. **It creates a demo order and allocates 80 chairs**; run it only against a disposable or explicitly seeded demo environment. The backend unit/integration suite uses separate schemas and does not consume demo stock.

Screenshots and traces are written to ignored `test-results/`. Desktop and 390px mobile views are covered. The interface polls every five seconds and also has manual Refresh. No third-party analytics or external image services are used.
