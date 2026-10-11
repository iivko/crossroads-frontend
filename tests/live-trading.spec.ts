import { expect, test, type Page } from "@playwright/test";
import { mockMarketplace } from "./fixtures/guidance";

async function mockInstallerClipboard(page: Page, fail = false) {
  await page.addInitScript((shouldFail) => {
    const copies: string[] = [];
    Object.defineProperty(window, "installerCopies", { value: copies });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          if (shouldFail) throw new Error("Clipboard access denied");
          copies.push(value);
        },
      },
    });
  }, fail);
}

const installers = [
  {
    label: "ChatGPT",
    heading: "Neopact for ChatGPT",
    repository: "https://github.com/Sashe-Bashe/neopact-chatgpt",
    commands:
      "codex plugin marketplace add Sashe-Bashe/neopact-chatgpt\ncodex plugin add neopact@neopact",
  },
  {
    label: "Claude Code",
    heading: "Neopact for Claude Code",
    repository: "https://github.com/AGH2084/crossroads-claude-plugin",
    commands:
      "claude plugin marketplace add AGH2084/crossroads-claude-plugin\nclaude plugin install neopact@crossroads",
  },
];

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
      expect(body.scopes).toEqual([
        "catalogue:read",
        "images:read",
        "negotiations:read",
        "orders:read",
        "negotiations:act",
        "products:write",
      ]);
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
  await expect(page.getByLabel("Private workspace token")).toHaveCount(0);
  await expect(page.getByLabel("Private MCP configuration")).toHaveCount(0);
  const apiUrl = page.getByLabel("Backend API URL");
  await expect(apiUrl).toHaveValue(
    /http:\/\/(localhost|127\.0\.0\.1):8100\/api\/v1/,
  );
  const lanOptIn = page.getByLabel("Allow HTTP on this trusted LAN");
  await expect(lanOptIn).not.toBeChecked();
  await apiUrl.fill("http://192.168.68.109:8100/api/v1");
  const create = page.getByRole("button", {
    name: "Create connection",
    exact: true,
  });
  await expect(create).toBeDisabled();
  await lanOptIn.check();
  await page.getByLabel("Allow agent trading").check();
  await create.click();
  await expect(page.getByLabel("Private workspace token")).toHaveValue(
    "test-one-time-secret",
  );
  const settings = page.locator("dl").filter({
    has: page.getByText("NEOPACT_MCP_WORKSPACE", { exact: true }),
  });
  await expect(settings).toContainText("seller-workspace");
  await expect(settings).toContainText("NEOPACT_MCP_API_URL");
  await expect(settings).toContainText("http://192.168.68.109:8100/api/v1");
  await expect(settings).toContainText("NEOPACT_MCP_ALLOW_LAN_HTTP");
  const manualConfiguration = page.locator("details").filter({
    has: page.getByText("Other MCP clients: manual configuration", {
      exact: true,
    }),
  });
  await expect(manualConfiguration).not.toHaveAttribute("open", "");
  await manualConfiguration.locator("summary").click();
  await expect(page.getByLabel("Private MCP configuration")).toHaveValue(
    /test-one-time-secret/,
  );
  await expect(page.getByLabel("Private MCP configuration")).toHaveValue(
    /seller-workspace/,
  );
  let configuration = JSON.parse(
    await page.getByLabel("Private MCP configuration").inputValue(),
  );
  expect(configuration.mcpServers.neopact.env.NEOPACT_MCP_API_URL).toBe(
    "http://192.168.68.109:8100/api/v1",
  );
  expect(configuration.mcpServers.neopact.env.NEOPACT_MCP_ALLOW_LAN_HTTP).toBe(
    "true",
  );
  await apiUrl.fill("https://market.example/api/v1");
  await expect(lanOptIn).not.toBeChecked();
  await expect(settings).not.toContainText("NEOPACT_MCP_ALLOW_LAN_HTTP");
  configuration = JSON.parse(
    await page.getByLabel("Private MCP configuration").inputValue(),
  );
  expect(configuration.mcpServers.neopact.env.NEOPACT_MCP_API_URL).toBe(
    "https://market.example/api/v1",
  );
  expect(configuration.mcpServers.neopact.env).not.toHaveProperty(
    "NEOPACT_MCP_ALLOW_LAN_HTTP",
  );
  await page
    .getByRole("button", { name: "Dismiss private configuration" })
    .click();
  await expect(page.getByLabel("Private MCP configuration")).toHaveCount(0);
  await expect(page.getByLabel("Private workspace token")).toHaveCount(0);
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

test("plugin installers copy public commands without issuing or exposing workspace credentials", async ({
  page,
}) => {
  await mockMarketplace(page, "buyer");
  await mockInstallerClipboard(page);
  let issuedCount = 0;
  await page.route("**/api/v1/credentials**", async (route) => {
    const method = route.request().method();
    if (method === "GET")
      return route.fulfill({
        json: { credentials: { items: [] }, status_code: 200 },
      });
    if (method === "POST") {
      issuedCount++;
      const body = route.request().postDataJSON();
      expect(body.scopes).toEqual([
        "catalogue:read",
        "images:read",
        "negotiations:read",
        "orders:read",
        "negotiations:act",
        "requests:write",
      ]);
      return route.fulfill({
        status: 201,
        json: {
          credential: {
            id: "buyer-connection-1",
            name: body.name,
            workspace_id: "buyer-workspace",
            role: "buyer",
            token: "private-buyer-token-never-in-an-installer",
            scopes: body.scopes,
            expires_at: "2030-10-17T00:00:00Z",
          },
          status_code: 201,
        },
      });
    }
    expect(method).toBe("DELETE");
    return route.fulfill({
      json: {
        credential: { id: "buyer-connection-1", revoked: true },
        status_code: 200,
      },
    });
  });
  await page.goto("/?view=connections");
  await expect(page.getByLabel("Private workspace token")).toHaveCount(0);
  await expect(page.getByLabel("Allow agent trading")).not.toBeChecked();
  for (const installer of installers) {
    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: installer.heading, exact: true }),
    });
    await expect(
      card.getByRole("link", {
        name: `View ${installer.heading} repository (opens in a new tab)`,
      }),
    ).toHaveAttribute("href", installer.repository);
    await card
      .getByRole("button", {
        name: `Copy ${installer.label} install commands`,
      })
      .click();
    await expect(card.getByRole("status")).toHaveText("Commands copied.");
  }
  expect(issuedCount).toBe(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { installerCopies: string[] }).installerCopies,
    ),
  ).toEqual(installers.map((installer) => installer.commands));
  await expect(page.getByLabel("Private workspace token")).toHaveCount(0);

  await page.getByLabel("Allow agent trading").check();
  await page
    .getByRole("button", { name: "Create connection", exact: true })
    .click();
  await expect(page.getByLabel("Private workspace token")).toHaveValue(
    "private-buyer-token-never-in-an-installer",
  );
  await page
    .getByRole("button", { name: "Copy ChatGPT install commands" })
    .click();
  const copied = await page.evaluate(
    () => (window as unknown as { installerCopies: string[] }).installerCopies,
  );
  expect(copied).toHaveLength(3);
  expect(copied[2]).toBe(installers[0]!.commands);
  expect(copied.join("\n")).not.toContain("private-buyer-token");
  expect(issuedCount).toBe(1);
  await page
    .getByRole("button", { name: "Revoke access", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm revoke", exact: true })
    .click();
  await expect(page.getByLabel("Private workspace token")).toHaveCount(0);
  await expect(page.getByLabel("Private MCP configuration")).toHaveCount(0);
});

test("mobile plugin installers offer manual copy when clipboard access fails without creating access", async ({
  page,
}) => {
  await mockMarketplace(page);
  await mockInstallerClipboard(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  const credentialWrites: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/api/v1/credentials") &&
      request.method() !== "GET"
    )
      credentialWrites.push(request.method());
  });
  await page.goto("/?view=connections");
  for (const installer of installers) {
    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: installer.heading, exact: true }),
    });
    await card
      .getByRole("button", {
        name: `Copy ${installer.label} install commands`,
      })
      .click();
    await expect(card.getByRole("status")).toHaveText(
      "Clipboard unavailable. Select and copy the commands manually.",
    );
    await expect(
      card.getByLabel(`${installer.label} install commands`, { exact: true }),
    ).toHaveText(installer.commands);
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
      installer.commands,
    );
  }
  expect(credentialWrites).toEqual([]);
  await expect(page.getByLabel("Private workspace token")).toHaveCount(0);
  await expect(page.getByLabel("Private MCP configuration")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
