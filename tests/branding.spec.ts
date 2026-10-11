import { expect, test } from "@playwright/test";
import type { Order, Room } from "../lib/api";
import { mockMarketplace } from "./fixtures/guidance";

const snapshotTime = new Date("2026-10-10T10:00:00Z");

function demoOrder(room: Room): Order {
  const offer = structuredClone(room.current_offer!);
  offer.approvals = ["buyer", "seller"].map((role) => ({
    workspace_id: `${role}-workspace`,
    user_id: `${role}-human`,
    at: snapshotTime.toISOString(),
  }));
  return {
    id: "order-1",
    request_id: room.request_id,
    room_id: room.id,
    buyer_id: "buyer-workspace",
    seller_id: "seller-workspace",
    created_at: snapshotTime.toISOString(),
    offer,
    buyer: "Chair buyer",
    seller: "Chair seller",
    status: "confirmed_demo",
  };
}

test("the workspace presents the canonical neopact identity", async ({
  page,
}) => {
  await mockMarketplace(page);
  await page.goto("/");

  await expect(page).toHaveTitle("neopact — Terms aligned. Business moving.");
  const logo = page.getByRole("img", { name: "neopact", exact: true });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("src", "/brand/neopact-logo-primary.svg");
  await expect(logo).toHaveJSProperty("complete", true);
  await expect
    .poll(() =>
      logo.evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBeGreaterThan(0);
});

for (const role of ["buyer", "seller"] as const) {
  test(`${role} review count excludes its own approval but still requires review after the counterparty approves`, async ({
    page,
  }) => {
    const state = await mockMarketplace(page, role);
    const room = state.rooms[role];
    room.current_offer!.approvals = [
      {
        workspace_id: `${role}-workspace`,
        user_id: `${role}-human`,
        at: snapshotTime.toISOString(),
      },
    ];
    await page.clock.install({ time: snapshotTime });
    await page.goto("/");

    const reviewStat = page.getByRole("button", { name: /^Needs your review/ });
    await expect(reviewStat.locator("strong")).toHaveText("0");
    await expect(reviewStat).toContainText(
      "1 already approved by your business",
    );

    const counterparty = role === "buyer" ? "seller" : "buyer";
    room.current_offer!.approvals = [
      {
        workspace_id: `${counterparty}-workspace`,
        user_id: `${counterparty}-human`,
        at: snapshotTime.toISOString(),
      },
    ];
    await page.clock.runFor(5000);

    await expect(reviewStat.locator("strong")).toHaveText("1");
    await expect(reviewStat).toContainText(
      "0 already approved by your business",
    );
  });
}

test("a failed sync retains the complete last snapshot and recovers on the next poll", async ({
  page,
}) => {
  const state = await mockMarketplace(page);
  state.orders.buyer.push(demoOrder(state.rooms.buyer));
  await page.clock.install({ time: snapshotTime });
  await page.goto("/");

  const syncStatus = page.locator("header").getByRole("status");
  const reviewStat = page.getByRole("button", { name: /^Needs your review/ });
  const valueStat = page.getByRole("button", {
    name: /^Agreed purchase value/,
  });
  await expect(syncStatus).toHaveText(/^\s*Updated /);
  await expect(reviewStat.locator("strong")).toHaveText("1");
  await expect(valueStat.locator("strong")).toHaveText("€1,180.00");

  state.rooms.buyer.current_offer!.approvals = [
    {
      workspace_id: "buyer-workspace",
      user_id: "buyer-human",
      at: snapshotTime.toISOString(),
    },
  ];
  state.orders.buyer[0]!.offer.terms.total = 236000;
  await page.route(
    /\/api\/v1\/products(?:\?.*)?$/,
    async (route) => {
      await route.fulfill({
        status: 503,
        json: {
          error: {
            code: "backend_unavailable",
            message: "The marketplace is temporarily unavailable.",
            details: null,
          },
          status_code: 503,
        },
      });
    },
    { times: 1 },
  );
  await page.clock.runFor(5000);

  await expect(syncStatus).toHaveText("Sync paused · showing last snapshot");
  await expect(reviewStat.locator("strong")).toHaveText("1");
  await expect(valueStat.locator("strong")).toHaveText("€1,180.00");

  await page.clock.runFor(5000);

  await expect(syncStatus).toHaveText(/^\s*Updated /);
  await expect(reviewStat.locator("strong")).toHaveText("0");
  await expect(valueStat.locator("strong")).toHaveText("€2,360.00");
});

test("an open offer warns about stale terms after a failed sync and clears the warning on recovery", async ({
  page,
}) => {
  const state = await mockMarketplace(page);
  await page.clock.install({ time: snapshotTime });
  await page.goto("/?view=approvals&room=room-1");

  const modal = page.getByRole("dialog");
  const staleWarning = modal.getByRole("alert").filter({
    hasText: "Workspace sync paused.",
  });
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("€1,180.00");
  await expect(staleWarning).toHaveCount(0);

  state.rooms.buyer.current_offer!.terms.total = 119000;
  state.rooms.buyer.version++;
  await page.route(
    /\/api\/v1\/products(?:\?.*)?$/,
    async (route) => {
      await route.fulfill({
        status: 503,
        json: {
          error: {
            code: "backend_unavailable",
            message: "The marketplace is temporarily unavailable.",
            details: null,
          },
          status_code: 503,
        },
      });
    },
    { times: 1 },
  );
  await page.clock.runFor(5000);

  await expect(staleWarning).toBeVisible();
  await expect(staleWarning).toHaveText(
    "Workspace sync paused. These are the last retrieved terms; refresh before making a decision.",
  );
  await expect(modal).toContainText("€1,180.00");
  await expect(modal).not.toContainText("€1,190.00");

  await page.clock.runFor(5000);

  await expect(staleWarning).toHaveCount(0);
  await expect(modal).toContainText("€1,190.00");
});

test("overview qualifies the loaded scope and labels order values as demo totals", async ({
  page,
}) => {
  const state = await mockMarketplace(page, "seller");
  state.orders.seller.push(demoOrder(state.rooms.seller));
  await page.goto("/");

  await expect(
    page.getByText(/up to 100 recent negotiations and 100 orders/),
  ).toContainText("Demo totals do not represent payments.");
  const valueStat = page.getByRole("button", { name: /^Agreed sales value/ });
  await expect(valueStat).toContainText("€1,180.00");
  await expect(valueStat).toContainText("Internal demo order totals");
});
