import { expect, test } from "@playwright/test";
import type { Me, Product } from "../lib/api";

const lanUrl = process.env.LAN_TEST_URL;
test.use({ baseURL: lanUrl || "http://127.0.0.1:3100" });
test.skip(
  !lanUrl || Boolean(process.env.CI),
  "Opt-in local LAN smoke test; never runs in CI.",
);

// Real browser/proxy/storage traffic. Only normal sign-in/out sessions are written.
// No credentials, purchase requests, offers, approvals or orders are created.
for (const [role, email] of [
  ["buyer", process.env.LAN_BUYER_EMAIL || "buyer@demo.local"],
  ["seller", process.env.LAN_SELLER_EMAIL || "forma@demo.local"],
] as const) {
  test(`LAN ${role} can sign in, read product evidence and configure its agent`, async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
    expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe(
      "undefined",
    );
    expect(await page.evaluate(() => typeof crypto.getRandomValues)).toBe(
      "function",
    );
    await page.getByLabel("Email address").fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.DEMO_PASSWORD || "local-market-demo");
    await page.getByRole("button", { name: "Open workspace" }).click();
    await expect(
      page.getByRole("heading", { name: "Your commerce, in view." }),
    ).toBeVisible();
    try {
      const workspaceId = await page.evaluate(() =>
        localStorage.getItem("market_workspace"),
      );
      expect(workspaceId).toBeTruthy();
      const headers = { "X-Workspace-ID": workspaceId! };
      const identityResponse = await page.request.get("/api/v1/auth/me", {
        headers,
      });
      expect(identityResponse.status()).toBe(200);
      const { identity } = (await identityResponse.json()) as { identity: Me };
      expect(identity.workspace.role).toBe(role);
      expect(identity.can_approve).toBe(true);
      const productResponse = await page.request.get(
        "/api/v1/products?limit=100",
        { headers },
      );
      expect(productResponse.status()).toBe(200);
      const { products } = (await productResponse.json()) as {
        products: { items: Product[] };
      };
      const product = products.items.find((item) =>
        item.images.some((image) => image.status === "ready"),
      );
      expect(
        product,
        "Seed a product with ready image evidence before running this test",
      ).toBeTruthy();
      await page.getByRole("button", { name: "Products", exact: true }).click();
      await page
        .locator(".product-card")
        .filter({
          has: page.getByRole("heading", { name: product!.name, exact: true }),
        })
        .click();
      const dialog = page.getByRole("dialog", {
        name: product!.name,
        exact: true,
      });
      const image = dialog.locator(".gallery-main img");
      await expect(image).toBeVisible();
      await expect
        .poll(() =>
          image.evaluate(
            (element) => (element as HTMLImageElement).naturalWidth,
          ),
        )
        .toBeGreaterThan(0);
      const source = await image.getAttribute("src");
      expect(source).toContain(
        `workspace_id=${encodeURIComponent(workspaceId!)}`,
      );
      const evidence = await page.request.get(source!);
      expect(evidence.status()).toBe(200);
      expect(evidence.headers()["content-type"]).toMatch(/^image\//);
      expect((await evidence.body()).length).toBeGreaterThan(0);
      await dialog.getByRole("button", { name: "Close details" }).click();

      await page
        .getByRole("button", { name: "Connections", exact: true })
        .click();
      const expectedApi = new URL(lanUrl!);
      expectedApi.port = "8100";
      await expect(page.getByLabel("Backend API URL")).toHaveValue(
        `${expectedApi.origin}/api/v1`,
      );
      const optIn = page.getByLabel("Allow HTTP on this trusted LAN");
      await expect(optIn).not.toBeChecked();
      const create = page.getByRole("button", {
        name: "Create connection",
        exact: true,
      });
      await expect(create).toBeDisabled();
      await optIn.check();
      await expect(create).toBeEnabled();
      await expect(page.getByLabel("Allow agent trading")).not.toBeChecked();
      await page.screenshot({
        path: testInfo.outputPath(`${role}-lan-connections.png`),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
      await page.screenshot({
        path: testInfo.outputPath(`${role}-lan-connections-mobile.png`),
        fullPage: true,
      });
    } finally {
      await page.evaluate(async () => {
        const csrf = decodeURIComponent(
          document.cookie
            .split("; ")
            .find((cookie) => cookie.startsWith("market_csrf="))
            ?.slice("market_csrf=".length) || "",
        );
        await fetch("/api/v1/auth/logout", {
          method: "POST",
          headers: {
            "X-CSRF-Token": csrf,
            "X-Workspace-ID": localStorage.getItem("market_workspace") || "",
          },
        });
      });
    }
  });
}
