# neopact

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Business buyers and sellers use the workspace to follow their agents and trading partners, see incoming opportunities, inspect product evidence and exact commercial terms, and decide whether to approve. The local preview provides explicit buyer and seller perspectives so both businesses' workflows are discoverable.

## Product Purpose

Make agent-mediated B2B negotiations legible and engaging while keeping the final purchasing decision with authorized people at both businesses.

## Capabilities and Constraints

Next.js, React, TypeScript, native CSS and Lucide. The workspace includes overview, products, buyer requests, negotiations, approvals, orders, activity and Connections, with cookie authentication, workspace isolation, shared conversations, private needs and instructions, exact-offer approval and immutable demo orders. Agents run outside the dashboard. Marketplace creation and negotiation operations remain with the CLI or the local MCP server; the browser manages human decisions and restricted agent credentials.

The live trading board uses real participant-visible negotiation actions, lifecycle events and orders from the backend. Workspace data refreshes every five seconds; this is polling, not a server-pushed or global marketplace stream. “Your business” and “Trading partners” are views of records this workspace may access. Seller opportunities come from buyer requests matched to the seller's products. A next-turn claim is a time-limited lease, not agent connection health. Both businesses must approve the same offer. Orders are demo records, not processed payments or fulfilment.

Local preview controls are disabled by default and available only with explicit server configuration and loopback frontend/API addresses. Buyer preview signs into Forma Studio; seller preview signs into Forma Supply. These are separate authenticated demo accounts, not a production role override or expanded workspace membership. The browser sends a role choice; demo passwords stay on the server. Switching clears the prior workspace snapshot.

“Run live demo” drives a bounded, explicitly scripted buyer/seller exchange through the real local API. Requests, claims, offers and counteroffers appear as the backend records them. It stops at human approval, creates no payment and performs no automatic approval. The scenario is fictional; the recorded API actions are real. It does not start a continuously operating language model or simulate an entire public market.

Connections creates revocable, seven-day, workspace-bound credentials. Read access is the default; trading permissions require an explicit choice and remain role-scoped. The supplied local MCP server exposes 13 tools over stdio for catalogue, inbox, context, activity, orders and permitted trading operations. It has no human approval tool. The website supplies private configuration for a compatible local client. No hosted HTTPS MCP connector or remote MCP OAuth flow is shipped.

Google and ChatGPT website sign-in are separate from agent access. Provider-ready OIDC flows require registered credentials and exact callbacks, and an existing signed-in user must explicitly link the external identity. Matching email addresses do not link accounts. Unconfigured providers show “Setup required” in Connections and do not appear as working sign-in options. ChatGPT website sign-in currently requires access to OpenAI's limited commercial trial. Provider login does not grant agent trading permissions.

The frontend loads up to 100 records per list; summary counts describe that snapshot. The board shows seven recent events on Overview or up to 60 in Activity. Never represent partial data as all-time totals. No supported backend metrics establish revenue, conversion, savings, uptime or agent connectivity.

## Brand Commitments

The shared neopact kit in `design/neopact-brand-system` is the established visual authority. Use its supplied logos, fonts and semantic tokens. Product name: neopact. Primary line: “Terms aligned. Business moving.” Supporting line: “Your agents negotiate. Your business decides.” Impeccable and the requested Taste skill inform craft within this inherited identity; they do not authorize an unrelated visual system.

## Evidence on Hand

The upstream bases inspected against GitHub on 10 October 2026 were frontend `7dadea27bf6b09d12e01d9900e7a73ef6a15377c` and backend `130e5b8e3fa5c2298beb8db4346c64d70f9a7f56`. This implementation extends those bases. The local preview reads the Docker API's fictional demo businesses and actual recorded transactions. Mocked buyer/seller fixtures remain separate behavioral test evidence.

Implemented surfaces are defined by `components/live-trading-board.tsx`, `components/demo-preview-switch.tsx`, `components/demo-trading-control.tsx`, `components/connections.tsx` and their styles; endpoint details live in the backend's `docs/identity.md` and `mcp_server/README.md`. Research and limitations are recorded in `design/CRAFT-RESEARCH.md`.

## Product Principles

- Every summary should lead to the relevant decision or underlying record.
- Make recorded agent work and incoming opportunities visible without inventing live traffic.
- Distinguish agent work, human review and confirmed demo orders.
- Preserve the boundary between shared terms and private business instructions.
- Explain refresh cadence, stale data, demo activity and limited scope.
- Keep identity sign-in, workspace membership and agent permissions distinct.
- Visual improvements are conversion hypotheses until evaluated with real users.
