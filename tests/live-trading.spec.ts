import { expect, test } from "@playwright/test";
import { mockMarketplace } from "./fixtures/guidance";

test("live trading receives real-shaped new IDs, separates roles and can pause for reading", async ({
  page,
}) => {
  const state = await mockMarketplace(page);
  state.rooms.buyer.state = "negotiating";
  state.rooms.buyer.next_role = "seller";
  state.rooms.buyer.activity = [
    {
      id: "proposal-1",
      role: "seller",
      type: "propose",
      data: { offer_id: "offer-1" },
      at: "2026-10-10T09:59:00Z",
      run: 1,
    },
  ];
  await page.clock.install({ time: new Date("2026-10-10T10:00:00Z") });
  await page.goto("/");
  const board = page.getByRole("region", { name: "Live trading activity" });
  await expect(board).toContainText("Chair seller agent");
  await expect(board).toContainText("€1,180.00");
  await expect(board.locator(".event-arrived")).toHaveCount(0);
  await board.getByRole("button", { name: "Pause activity feed" }).click();
  state.rooms.buyer.activity.push({
    id: "counter-2",
    role: "buyer",
    type: "counter",
    data: {},
    at: "2026-10-10T10:00:04Z",
    run: 1,
  });
  await page.clock.runFor(5000);
  await expect(board).not.toContainText("Made a counteroffer");
  await board.getByRole("button", { name: "Resume activity feed" }).click();
  await expect(board).toContainText("Made a counteroffer");
  await board
    .getByRole("button", { name: "Your business", exact: true })
    .click();
  await expect(board).toContainText("Your agent");
  await expect(board).not.toContainText("Proposed an offer");
  await board.getByRole("button", { name: "Connect your agent" }).click();
  await expect(
    page.getByRole("heading", { name: "Your agents, connected." }),
  ).toBeVisible();
});

test("connections issue role-scoped access, show a secret once and revoke it", async ({
  page,
}) => {
  await mockMarketplace(page, "seller");
  const credentials: object[] = [];
  await page.route("**/api/v1/identity/providers", (route) =>
    route.fulfill({
      json: {
        identity: {
          providers: [
            { id: "google", label: "Google", configured: false, linked: false },
          ],
        },
        status_code: 200,
      },
    }),
  );
  await page.route("**/api/v1/credentials**", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: { credentials: { items: credentials }, status_code: 200 },
      });
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      expect(body.scopes).toContain("products:write");
      expect(body.scopes).toContain("negotiations:act");
      expect(body.scopes).not.toContain("requests:write");
      expect(body.scopes).not.toContain("credentials:manage");
      const credential = {
        id: "connection-1",
        name: body.name,
        workspace_id: "seller-workspace",
        role: "seller",
        token: "test-one-time-secret",
        scopes: body.scopes,
        expires_at: "2030-10-17T00:00:00Z",
      };
      credentials.push({ ...credential, revoked: false });
      return route.fulfill({
        status: 201,
        json: { credential, status_code: 201 },
      });
    }
    expect(route.request().method()).toBe("DELETE");
    return route.fulfill({
      json: {
        credential: { id: "connection-1", revoked: true },
        status_code: 200,
      },
    });
  });
  await page.goto("/?view=connections");
  await page.getByLabel("Allow agent trading").check();
  await page
    .getByRole("button", { name: "Create connection", exact: true })
    .click();
  await expect(page.getByLabel("Private MCP configuration")).toHaveValue(
    /test-one-time-secret/,
  );
  await expect(page.getByLabel("Private MCP configuration")).toHaveValue(
    /seller-workspace/,
  );
  await page
    .getByRole("button", { name: "Dismiss private configuration" })
    .click();
  await expect(page.getByLabel("Private MCP configuration")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Revoke access", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm revoke", exact: true })
    .click();
  await expect(page.getByText("0 valid credentials")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Setup required", exact: true }),
  ).toBeDisabled();
});
