import { expect, test, type Page } from "@playwright/test";
import type {
  AuditEvent,
  Me,
  Order,
  Product,
  PurchaseRequest,
  Room,
} from "../lib/api";

// This suite uses the real same-origin API proxy and seeded local workspaces.
// Apart from signing in, it only reads data; it never intercepts API requests.
const password = process.env.DEMO_PASSWORD || "local-market-demo";
const euro = (cents: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

async function readApi<T>(page: Page, path: string, workspaceId: string) {
  const response = await page.request.get(`/api/v1/${path}`, {
    headers: { "X-Workspace-ID": workspaceId },
  });
  expect(response.status(), `GET /api/v1/${path}`).toBe(200);
  const body = (await response.json()) as T & { status_code: number };
  expect(body.status_code).toBe(200);
  return body;
}

async function signIn(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Your commerce, in view." }),
  ).toBeVisible();
  await expect(page.locator("header").getByRole("status")).toHaveText(
    /^\s*Updated /,
  );
  const workspaceId = await page.evaluate(() =>
    localStorage.getItem("market_workspace"),
  );
  expect(workspaceId).toBeTruthy();
  const { identity } = await readApi<{ identity: Me }>(
    page,
    "auth/me",
    workspaceId!,
  );
  expect(identity.workspace.id).toBe(workspaceId);
  return identity;
}

function lastRecordedAt(room: Room) {
  return Math.max(
    0,
    ...[
      room.request.created_at,
      ...room.activity.map((event) => event.at),
      ...room.offers.map((offer) => offer.created_at),
      ...room.human_guidance.map((guidance) => guidance.created_at),
    ].map((value) => Date.parse(value) || 0),
  );
}

for (const [role, email] of [
  ["buyer", "buyer@demo.local"],
  ["seller", "forma@demo.local"],
] as const) {
  test(`live ${role} metrics and negotiation drilldown agree with its authenticated backend snapshot`, async ({
    page,
  }) => {
    const identity = await signIn(page, email);
    expect(identity.workspace.role).toBe(role);
    const workspaceId = identity.workspace.id;
    const [roomResponse, orderResponse] = await Promise.all([
      readApi<{ negotiations: { items: Room[] } }>(
        page,
        "negotiations?limit=100",
        workspaceId,
      ),
      readApi<{ orders: { items: Order[] } }>(
        page,
        "orders?limit=100",
        workspaceId,
      ),
    ]);
    const rooms = roomResponse.negotiations.items;
    const orders = orderResponse.orders.items;
    expect(
      rooms.length,
      "Seeded workspace must have real negotiations",
    ).toBeGreaterThan(0);
    expect(rooms.length).toBeLessThanOrEqual(100);
    expect(orders.length).toBeLessThanOrEqual(100);
    expect(
      rooms.every((room) =>
        role === "buyer"
          ? room.request.workspace_id === workspaceId
          : room.seller_id === workspaceId,
      ),
      "Negotiations are scoped to the authenticated business",
    ).toBe(true);
    expect(
      orders.every((order) =>
        role === "buyer"
          ? order.buyer_id === workspaceId
          : order.seller_id === workspaceId,
      ),
      "Orders are scoped to the authenticated business",
    ).toBe(true);

    const pending = rooms.filter((room) => room.state === "awaiting_approval");
    const ownReview = pending.filter(
      (room) =>
        room.current_offer &&
        !room.current_offer.approvals.some(
          (approval) => approval.workspace_id === workspaceId,
        ),
    );
    const active = rooms.filter((room) =>
      ["negotiating", "needs_revision"].includes(room.state),
    );
    await expect(
      page
        .getByRole("button", { name: /^Active negotiations/ })
        .locator("strong"),
    ).toHaveText(String(active.length));
    const reviewStat = page.getByRole("button", { name: /^Needs your review/ });
    await expect(reviewStat.locator("strong")).toHaveText(
      String(ownReview.length),
    );
    await expect(reviewStat).toContainText(
      `${pending.length - ownReview.length} already approved by your business`,
    );
    await expect(
      page.getByRole("button", { name: /^Demo orders/ }).locator("strong"),
    ).toHaveText(String(orders.length));
    const valueStat = page.getByRole("button", {
      name: role === "buyer" ? /^Agreed purchase value/ : /^Agreed sales value/,
    });
    await expect(valueStat.locator("strong")).toHaveText(
      euro(orders.reduce((total, order) => total + order.offer.terms.total, 0)),
    );
    await expect(valueStat).toContainText("Internal demo order totals");
    await expect(page.locator(".snapshot-scope")).toHaveText(
      "Current snapshot · up to 100 recent negotiations and 100 orders. Demo totals do not represent payments.",
    );

    const snapshot = page.getByRole("region", { name: "Negotiation snapshot" });
    await expect(
      snapshot.locator(".pulse-column-heading").first(),
    ).toContainText(`${rooms.length} total`);
    const counts = new Map<string, number>([
      ["With agents", active.length],
      ["Human review", pending.length],
      [
        "Demo orders recorded",
        rooms.filter((room) => room.state === "ordered").length,
      ],
      [
        "Closed",
        rooms.filter((room) => ["declined", "expired"].includes(room.state))
          .length,
      ],
    ]);
    const otherCount =
      rooms.length -
      [...counts.values()].reduce((sum, count) => sum + count, 0);
    if (otherCount) counts.set("Other states", otherCount);
    await expect(snapshot.locator(".pulse-distribution-list dd")).toHaveCount(
      counts.size,
    );
    for (const [label, count] of counts) {
      const row = snapshot
        .locator(".pulse-distribution-list > div")
        .filter({ hasText: label });
      await expect(row.locator("dd")).toHaveText(String(count));
    }

    const latest = [...rooms]
      .sort((left, right) => lastRecordedAt(right) - lastRecordedAt(left))
      .slice(0, 3);
    const cards = snapshot.locator(".pulse-room");
    await expect(cards).toHaveCount(latest.length);
    for (const [index, room] of latest.entries()) {
      const card = cards.nth(index);
      await expect(card.locator("strong")).toHaveText(room.request.title);
      await expect(card.locator(".pulse-room-supplier")).toHaveText(
        room.supplier,
      );
      if (["negotiating", "needs_revision"].includes(room.state)) {
        await expect(card.locator(".pulse-room-state")).toHaveText(
          room.agent_status === "claimed"
            ? "Turn claimed"
            : "Waiting for agent",
        );
      } else if (room.state === "awaiting_approval") {
        await expect(card.locator(".pulse-room-state")).toHaveText(
          "Human review",
        );
        if (room.valid) {
          await expect(card.locator(".pulse-room-next")).toHaveText(
            room.current_offer?.approvals.some(
              (approval) => approval.workspace_id === workspaceId,
            )
              ? "Your approval is recorded; waiting for the other business"
              : "Your business has an offer to review",
          );
        }
      } else if (room.state === "ordered") {
        await expect(card.locator(".pulse-room-state")).toHaveText(
          "Demo order recorded",
        );
      }
    }

    const first = latest[0]!;
    const { negotiation } = await readApi<{ negotiation: Room }>(
      page,
      `negotiations/${encodeURIComponent(first.id)}`,
      workspaceId,
    );
    await cards.first().click();
    const dialog = page.getByRole("dialog", {
      name: negotiation.request.title,
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".detail-meta")).toContainText(
      negotiation.supplier,
    );
    await expect(dialog.locator(".detail-meta .badge")).toHaveText(
      negotiation.state.replaceAll("_", " "),
    );
    if (negotiation.current_offer) {
      await expect(dialog.locator(".offer-heading")).toContainText(
        `Offer v${negotiation.current_offer.version}`,
      );
      await expect(dialog.locator(".terms-grid").first()).toContainText(
        euro(negotiation.current_offer.terms.total),
      );
      for (const [index, partyId] of [
        negotiation.request.workspace_id,
        negotiation.seller_id,
      ].entries()) {
        const approved = negotiation.current_offer.approvals.some(
          (approval) => approval.workspace_id === partyId,
        );
        const party = dialog.locator(".approval-party").nth(index);
        await expect(party).toHaveClass(
          approved ? /\bapproved\b/ : /\bpending\b/,
        );
      }
    }
    await dialog.getByRole("button", { name: "Close details" }).click();
    await reviewStat.click();
    await expect(
      page.getByRole("heading", { name: "The final decision is yours." }),
    ).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(pending.length);
  });
}

test("live buyer reads real catalogue images, purchase requirements and audit activity", async ({
  page,
}) => {
  const { workspace } = await signIn(page, "buyer@demo.local");
  const [productResponse, requestResponse, activityResponse] =
    await Promise.all([
      readApi<{ products: { items: Product[] } }>(
        page,
        "products?limit=100",
        workspace.id,
      ),
      readApi<{ requests: { items: PurchaseRequest[] } }>(
        page,
        "requests?limit=100",
        workspace.id,
      ),
      readApi<{ activity: { items: AuditEvent[] } }>(
        page,
        "activity?limit=100",
        workspace.id,
      ),
    ]);
  const product = productResponse.products.items.find((item) =>
    item.images.some((image) => image.status === "ready"),
  );
  expect(
    product,
    "Seeded catalogue must include uploaded product evidence",
  ).toBeTruthy();
  await page.getByRole("button", { name: "Products", exact: true }).click();
  const productCard = page.locator(".product-card").filter({
    has: page.getByRole("heading", { name: product!.name, exact: true }),
  });
  await productCard.click();
  const productDialog = page.getByRole("dialog", {
    name: product!.name,
    exact: true,
  });
  const image = productDialog.locator(".gallery-main img");
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty("complete", true);
  await expect
    .poll(() =>
      image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const source = await image.getAttribute("src");
  expect(source).toContain(`workspace_id=${encodeURIComponent(workspace.id)}`);
  const imageResponse = await page.request.get(source!);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()["content-type"]).toMatch(/^image\//);
  await productDialog.getByRole("button", { name: "Close details" }).click();

  await page.getByRole("button", { name: "Requests", exact: true }).click();
  const requests = requestResponse.requests.items;
  expect(
    requests.length,
    "Seeded buyer must have purchase requirements",
  ).toBeGreaterThan(0);
  await expect(page.locator("tbody tr")).toHaveCount(requests.length);
  const request = requests[0]!;
  await page
    .locator("tbody tr")
    .filter({ hasText: request.title })
    .first()
    .getByRole("button", { name: "Inspect" })
    .click();
  const requestDialog = page.getByRole("dialog", {
    name: request.title,
    exact: true,
  });
  await expect(requestDialog.locator(".description")).toHaveText(
    request.description || "",
  );
  const privateBudget = requestDialog
    .locator(".terms-grid > div")
    .filter({ hasText: "Private maximum total" });
  await expect(privateBudget.locator("strong")).toHaveText(
    euro(request.max_total || 0),
  );
  await expect(requestDialog).toContainText(request.destination);
  await requestDialog.getByRole("button", { name: "Close details" }).click();

  await page.getByRole("button", { name: "Activity", exact: true }).click();
  const events = activityResponse.activity.items;
  expect(
    events.length,
    "Seeded workspace must have an audit trail",
  ).toBeGreaterThan(0);
  await expect(page.locator(".activity-list .event")).toHaveCount(
    events.length,
  );
  for (const [index, event] of events.slice(0, 3).entries()) {
    const row = page.locator(".activity-list .event").nth(index);
    await expect(row.locator("strong")).toHaveText(
      event.type.replaceAll("_", " "),
    );
    await expect(row.locator("small")).toHaveText(
      `Record ${event.resource_id.slice(0, 8)} · Actor ${event.actor_id.slice(0, 12)}`,
    );
  }
});
