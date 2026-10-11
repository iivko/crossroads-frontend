# Applying neopact to the human workspace

This is an extension of the merged brand system, not a replacement identity. Scope: sign-in, dashboard, product evidence, negotiations, approvals, private guidance, local buyer/seller previews, live participant activity and Connections. Mode: Operate; sign-in also explains the product.

## Direction contract

THESIS: Make agent work legible to the business, with each summary leading to a real decision or record. Avoid decorative performance charts without underlying data.

OWN-WORLD: Inherit the merged neopact kit: Manrope, canonical SVGs, warm canvas, white working surfaces, evergreen controls and sparse lime brand emphasis. The business workspace remains light for reading detailed terms.

STORY: Choose the local buyer or seller perspective, see agent actions and incoming opportunities, inspect a record, review exact terms, then make a deliberate decision. Connections gives an external agent restricted access. Private guidance stays separate from shared conversation; scripted demonstrations, demo values and snapshot limits are explicit.

FIRST VIEWPORT: A compact sidebar and topbar frame a local-preview toolbar when enabled, then a working title and four clickable metrics in one open strip. “Your market, in motion.” follows with a participant event stream and a next-turn queue. Offers awaiting approval and the compact negotiation snapshot continue below. The review metric uses a subtle neutral fill and evergreen text; exact-offer Review remains an explicit action. Sign-in retains its split brand/form composition and gains the same discoverable buyer/seller demo control. Configured, already-linked identity providers can appear as additional sign-in options.

FORM: Inherited-direction exception. The user's confirmed request applies an already merged brand kit throughout the existing frontend and adds a local metrics section. `reference/new-work.md` section 3, “Extend an existing surface,” says to inherit world and composition without a concept tournament. No new visual world or whole new page was selected, and no concept seed or roll was run. This is recorded as an inherited extension, not fabricated seed provenance.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Quality bar

Quality bar: readable 14px working text and 12px metadata, 16px fields, 44px main controls, labeled semantic statuses, strong focus treatment, usable 390px layouts, local fonts, no external asset requests. Keep quantity, terms, exact versions, private/shared boundaries and both approval states intact.

## Research and implementation decisions

Research checked 10 October 2026. This is evidence-informed design, not measured conversion improvement.

- [SAP overview pages](https://help.sap.com/docs/abap_platform_new/468a97775123488ab3345a0c48cadd8f/c64ef8c6c65d4effbfd512e9c9aa5044.html) connect a business summary to actionable underlying records. Application: metric buttons and negotiation drilldowns, with a distinct role for each section.
- [SAP overview cards](https://www.sap.com/design-system/fiori-design-web/v1-108/page-types/floorplans/overview-page-ovp/overview-page-card) emphasize pertinent data, progressive disclosure and avoiding duplicated information. Application: state distribution next to a compact record list, followed by the existing review table.
- [NN/g: Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/) explains how feedback reduces uncertainty and lets people steer a workflow. Application: show the last successful refresh and a stale snapshot warning on failure; describe the backend's actual agent-turn state.
- [Shopify analytics overview](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/overview-dashboard) demonstrates explicit metric scope and freshness. Application: label the current 100-record limit and demo order values. This is a design inference, not a claim that neopact has Shopify's reporting capabilities.

## Backend mapping

| Visible signal | Source and meaning |
| --- | --- |
| Active negotiations | Rooms in `negotiating` or `needs_revision` |
| Needs your review | Approval-stage rooms whose current offer has no approval from this workspace; inspect validity before authorizing |
| Demo orders / agreed value | Loaded order records and `offer.terms.total`, in EUR cents; no payment processed |
| Turn claimed | An active agent-turn lease; never a connection-health claim |
| Waiting for agent | Active negotiation with no current claim; never an offline assertion |
| Human review | `awaiting_approval`; display own vs counterparty approval status from approval records |
| Last updated | Client time of the last complete successful workspace refresh; polling cadence is five seconds |
| Trading event | A participant-visible room action or lifecycle event, with a drilldown to its room; immutable offer terms supply historical values |
| Incoming opportunity | `negotiation_opened` in a room involving this business; sellers see only the public matched request |
| Next moves | Active rooms grouped by whether `next_role` matches this workspace's role |
| Deals recorded | Real loaded demo order records after both exact-offer approvals; never checkout/payment telemetry |
| Valid connections | Unrevoked, unexpired workspace credentials; not evidence that a client is online |
| Account sign-in status | Provider configuration and explicit link status returned by the identity endpoint |

Closed rooms must not produce agent work alerts. Ordered rooms can become invalid after inventory allocation; that must not turn a completed order into an outstanding decision. Do not sum competing offers as pipeline revenue, infer durations from request creation, or expose the other business's private brief.

## Validation and measurement

The existing API, private guidance and conversation suites protect backend semantics. Added UI coverage checks brand identity, own-approval counts, bounded snapshot labels and sync failure/recovery. The earlier visual review covered desktop and mobile login, overview and negotiation details. New preview, trading-board and Connections behavior must be evaluated against the actual local Docker records and its dedicated tests; this documentation update is source-derived and does not certify a new visual or provider-login review.

After deployment, assess time to identify a waiting decision, successful sign-in, review completion, navigation errors and accidental approval attempts. Establish a baseline before comparing designs. Color alone does not establish conversion lift.

## Craft refinement — 10 October 2026

The user requested a research-backed Impeccable/Taste pass. The existing identity remains authoritative; this changes hierarchy and density within the same product. See `CRAFT-RESEARCH.md` for four sources and the distinction between evidence and implementation judgment. The actual refinement uses a compact metric band, a decision-first overview, aligned commercial columns, shorter recent-record rows, and descriptive section headings. No unsupported metrics or backend behavior were added.


## Live trading and connections extension — 10 October 2026

The user's checkout-display analogy establishes a desire to see business happening. The shipped interpretation is a readable stream of real actions involving this business, with actor labels, relative times, offer totals and room links. It has four filters, a pause-for-reading control and a next-turn queue. Pausing freezes the displayed feed only; the workspace continues polling. New event IDs receive a brief subtle-neutral arrival treatment, disabled for reduced motion. The Activity view retains an expandable workspace audit trail below the board. There is no decorative perpetual ticker or invented market-wide volume.

The trading board uses a white bordered surface with 24px section padding and a canvas queue; the queue is 276px on wide screens, 240px below 1150px and stacks below 850px. Event values align with tabular figures. At 520px the header stacks, event values wrap below the copy and queue rooms become a single column. Connections pairs a credential form with setup steps, then lists access validity and provider sign-in status. Its two columns stack at 850px; provider and credential rows stack at 520px. The inherited colors, fonts, radii and focus rules remain authoritative.

The local demo perspective uses two adjacent labeled buttons with `aria-pressed`; selected state is evergreen and white. It is visibly distinct from the membership-based workspace selector. The server gate is disabled by default, requires loopback addresses and keeps demo passwords out of client code. The adjacent “Run live demo” describes scripted agents and waits at human review. Neither control exists as a public account-switching shortcut.

Connections defaults to read access, offers role-appropriate trading as an explicit checkbox, shows private configuration only after issuance, and makes revocation a deliberate inline action. The local stdio MCP server has 13 tools; it cannot approve orders, change workspace or administer business rules. The page explicitly states that remote ChatGPT/hosted MCP needs a separate public HTTPS endpoint and OAuth authorization, which this release does not provide.

Website identity linking uses the backend's Google/ChatGPT OIDC implementation. Setup state comes from the server, not a cosmetic connected badge. Registered provider credentials are required; ChatGPT website sign-in is currently a limited trial. These sign-in methods identify a person and do not connect a trading agent. See the primary protocol references in `CRAFT-RESEARCH.md`.
