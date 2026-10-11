# Neopact commerce workspace: focused craft research

Researched 10 October 2026. Scope: the overview, review queue, metrics, live participant activity, local role preview, agent connections and identity sign-in. Preserve the approved Neopact identity and backend semantics. These sources support usability choices; they do not prove a conversion uplift for this product.

## Evidence

- [SAP Fiori: Overview Page — Cards](https://www.sap.com/design-system/fiori-design-web/v1-108/page-types/floorplans/overview-page-ovp/overview-page-card): overview content should present pertinent information for a task/topic; each card should add value instead of repeating another card. Short titles explain the card's purpose. Group previews lead to individual records, while the heading leads to the full collection. This is versioned Fiori guidance, not a claim that v1.108 is the latest release. The indexed source contained the guidance; the live SAP shell did not load its content in Obscura.
- [Carbon: Data table guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines), updated 30 September 2026: give dense tables substantial page width, use consistent component density, describe the data's purpose in the title, and use concise column labels. A row hover helps users follow data across columns. Keep limited row actions visible. Retrieved with Obscura; web text also verified the current document. Carbon does **not** explicitly prescribe right alignment in this page.
- [NN/g: The Layer-Cake Pattern of Scanning Content on the Web](https://www.nngroup.com/articles/layer-cake-pattern-scanning/), 4 August 2019: eyetracking evidence favors descriptive, consistently distinct headings and clear proximity between each heading and its content. Excessive heading emphasis can resemble advertising. Retrieved with Obscura.
- [NN/g: Dashboards — Making Charts and Graphs Easier to Understand](https://www.nngroup.com/articles/dashboards-preattentive/), June 2017: operational dashboards need to communicate critical information quickly. Length and position enable easier quantitative comparison than area or angle; large gauges consume space with limited information. Retrieved with Obscura.

## Earlier hierarchy pass: five evidence-informed recommendations

1. **Make the next human decision the first content section.** After a compact metric strip, place the review table before the negotiation snapshot. The pre-refinement layout placed the larger snapshot first. A future queue refinement could sort rows still needing this business's approval before rows waiting on the counterparty. This visual pass preserves the API's existing row order and approval semantics. This ordering is our application of SAP task relevance and NN/g operational urgency; it is not a prescribed layout from either source.

2. **Compress the metric container, retain its precision.** Use one calm band with four aligned values, lighter dividers, and restrained padding. Keep the single review emphasis and clickable drilldowns. Put the 100-record limit and demo-total qualification in one readable line immediately below. Do not invent time-series, revenue growth or always-online indicators. The specific band is an inference from the current data and hierarchy, not a source-mandated component.

3. **Give comparable commercial terms consistent columns.** Let request/supplier use flexible width; right-align amount and percentage headers and values, with tabular figures and a stable action column. Keep dates in a consistent format. Retain a subtle row hover and visible Review control. Width/density/action behavior follow Carbon; right alignment is our typographic decision for comparing money and percentages. IDs and names remain text-aligned.

4. **Make each negotiation row identify a real record.** Use the backend request title as the principal line, supplier as secondary, then a compact quantity/product or offer-version line only if it helps distinguish repeated requests. In the snapshot, align the status/next-step treatment consistently rather than letting each record become a differently sized mini-card. Use only metadata supplied to this workspace. Do not recover private buyer titles for sellers. This is an application of descriptive hierarchy and progressive detail; the exact fields are determined by the API.

5. **Use semantic status and whitespace to establish the hierarchy.** Keep plain-language state text and the next actor beside the record. Preserve the honest difference between a claimed agent turn, waiting for an agent, and awaiting human review. Retain the linear distribution plus exact counts, reduce duplicate captions, and avoid an extra decorative chart. The compact snapshot then supports the review queue instead of competing with it. The choice follows the research on linear comparisons and clear section labels; its precise styling remains Neopact's.

## Validation boundary

Check the resulting desktop and narrow layouts with real Docker data, long request titles and zero/nonzero review states. Preserve keyboard targets, visible focus, readable muted text and named sections. Evaluate the first viewport by whether a user can identify their outstanding decision, its supplier and its commercial terms. Research cannot certify the aesthetic result: visual inspection of the actual build remains required.


## Live participant activity and connections

Additional primary references checked 10 October 2026:

- [OpenAI: Sign in with ChatGPT on your website](https://developers.openai.com/siwc/website): describes website OIDC sign-in with authorization code, PKCE and verified identity claims. Access is currently limited to selected commercial partners. Application: show configuration requirements honestly; keep website identity separate from a hosted MCP connection. A ChatGPT subscription alone is not the application's OAuth registration.
- [Google: OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect): requires application credentials, registered callbacks and server verification of identity tokens. Application: explicit account linking and provider configuration state; Google branding or a button alone does not make authentication available.
- [MCP: Connect to local servers](https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers): documents connecting a desktop host to a local MCP process through client configuration. Application: supply scoped local stdio configuration and state that a separately hosted connector is not shipped. The 13-tool server is this project's implementation, not a capability inferred from the guide.

The user asked for the satisfaction of seeing activity, comparing it to visible checkout transactions. Our implementation judgment is to put the participant trading board after the compact metrics, before the approval table, with an explicit review metric and room drilldowns. This updates the earlier decision-first ordering to emphasize observable agent work while retaining exact-offer human decisions. The analogy does not establish a conversion effect, authorize disclosure of unrelated businesses' trades, or justify synthetic traffic presented as live.

The board uses action, lifecycle and order records already visible to the workspace, refreshes with the five-second workspace poll, identifies freshness and preserves the previous snapshot on failed refresh. Filters separate this business, its partners and recorded demo deals; “Pause” freezes the feed for reading without stopping the backend. A small subtle-neutral arrival treatment is triggered by new record IDs and respects reduced motion. The expandable workspace audit trail remains below the Activity board, and human lifecycle notices remain distinct from agent actions. The next-turn queue shows role and claim state rather than claiming that an agent is online.

Explicit “Buyer preview” and “Seller preview” controls solve the demo-account discoverability issue: Forma Studio and Forma Supply are separate accounts, not interchangeable memberships. The loopback-only, disabled-by-default preview gate and the plainly labeled scripted “Run live demo” are application decisions. The run writes real local requests and negotiation actions, then stops for authorized people to approve; it never manufactures payment activity.

Connections separates three concepts in the UI: a person's sign-in identity, the selected business workspace, and the access granted to an external agent. Read-only credentials are the initial choice; trading is opt-in. Credential validity is reported separately from runtime health. Hosted ChatGPT/remote MCP remains a stated deployment requirement, not an implied connected feature. New provider configuration and a real provider login need operator credentials and a separate smoke test.

## Current evidence boundary

This extension record was derived from the shipped source components and styles. It adds no claim of user-tested conversion improvement or successful Google/ChatGPT production sign-in. Technical tests, browser review and deployment readiness should be reported with their actual scope, separately from research rationale.
