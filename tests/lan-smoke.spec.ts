import { expect, test } from "@playwright/test";
import type { Me, Product } from "../lib/api";
import type { AgentPrompt } from "../lib/connections";

const lanUrl = process.env.LAN_TEST_URL;
test.use({ baseURL: lanUrl || "http://127.0.0.1:3100" });
test.skip(
  !lanUrl || Boolean(process.env.CI),
  "Opt-in local LAN smoke test; never runs in CI.",
);

// Real browser/proxy/storage traffic. Only normal sign-in/out sessions are written.
// No credentials, purchase requests, offers, approvals or orders are created.
// POST /agent/prompt only renders instructions; it does not write business records.
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
      const negotiator = page.getByRole("region", {
        name: "Set up your negotiator",
      });
      await negotiator
        .getByLabel("What should your agent achieve?")
        .fill(
          role === "buyer"
            ? "Prefer reliable delivery and a smaller deposit."
            : "Seek a higher feasible price with useful delivery tradeoffs.",
        );
      const generated = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/v1/agent/prompt") &&
          response.request().method() === "POST",
      );
      await negotiator
        .getByRole("button", { name: "Generate negotiation prompt" })
        .click();
      const response = await generated;
      expect(response.status()).toBe(200);
      const envelope = (await response.json()) as {
        agent_prompt: AgentPrompt;
        status_code: number;
      };
      expect(envelope.status_code).toBe(200);
      expect(envelope.agent_prompt).toMatchObject({
        role,
        workspace_id: workspaceId,
        poll_interval_seconds: 20,
        mode: "start",
      });
      expect(envelope.agent_prompt.prompt).toContain("wait_for_updates");
      expect(envelope.agent_prompt.prompt).toContain(
        "Both humans still approve",
      );
      expect(envelope.agent_prompt.prompt).toContain(
        role === "buyer"
          ? "private budget is a ceiling"
          : "highest feasible price",
      );
      const promptPreview = negotiator.getByLabel("Negotiation prompt", {
        exact: true,
      });
      await expect(promptPreview).toHaveValue(envelope.agent_prompt.prompt);
      await negotiator
        .getByRole("button", { name: "Copy negotiation prompt" })
        .click();
      const copyStatus = negotiator.getByRole("status");
      await expect(copyStatus).toHaveText(
        /^(Prompt copied\.|Clipboard access is unavailable)/,
      );
      await expect(promptPreview).toBeFocused();
      expect(
        await promptPreview.evaluate((element: HTMLTextAreaElement) =>
          element.value.slice(element.selectionStart, element.selectionEnd),
        ),
      ).toBe(envelope.agent_prompt.prompt);
      if ((await copyStatus.textContent())?.startsWith("Prompt copied.")) {
        await expect(
          negotiator.getByRole("button", {
            name: "Prompt copied",
            exact: true,
          }),
        ).toBeVisible();
        // Verify native LAN clipboard contents by pasting into a disposable
        // browser-only field; no marketplace data or objective is changed.
        await page.evaluate(() => {
          const field = document.createElement("textarea");
          field.id = "lan-clipboard-verification";
          field.setAttribute("aria-label", "Clipboard verification");
          document.body.append(field);
          field.focus();
        });
        await page.keyboard.press("ControlOrMeta+V");
        await expect(page.getByLabel("Clipboard verification")).toHaveValue(
          envelope.agent_prompt.prompt,
        );
        await page
          .locator("#lan-clipboard-verification")
          .evaluate((element) => element.remove());
      }
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
