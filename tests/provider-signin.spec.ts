import { expect, test, type Page } from "@playwright/test";
import { mockMarketplace } from "./fixtures/guidance";

async function signedOut(page: Page) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 401,
      json: { error: { message: "Sign in required" } },
    }),
  );
  await page.route("**/api/demo/session", (route) =>
    route.fulfill({
      json: {
        enabled: false,
        labels: { buyer: "Buyer preview", seller: "Seller preview" },
      },
    }),
  );
}

test("login keeps both providers visible and disabled while loading and when setup is absent", async ({
  page,
}) => {
  await signedOut(page);
  let complete!: () => void;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  await page.route("**/api/v1/identity/providers", async (route) => {
    await pending;
    await route.fulfill({ json: { identity: { providers: [] } } });
  });
  await page.goto("/");
  const options = page.locator(".provider-signin");
  await expect(
    options.getByRole("button", { name: "Continue with Google Checking…" }),
  ).toBeDisabled();
  await expect(
    options.getByRole("button", { name: "Continue with ChatGPT Checking…" }),
  ).toBeDisabled();
  complete();
  await expect(
    options.getByRole("button", {
      name: "Continue with Google Setup required",
    }),
  ).toBeDisabled();
  await expect(
    options.getByRole("button", {
      name: "Continue with ChatGPT Setup required",
    }),
  ).toBeDisabled();
  await expect(options.getByRole("link")).toHaveCount(0);
  await expect(options.getByText(/Google sign-in needs/)).toBeVisible();
  await expect(
    options.getByText(/approved OpenAI client registration/),
  ).toBeVisible();
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await options.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    for (const button of await options.getByRole("button").all()) {
      const overflows = await button.evaluate(
        (element) =>
          element.scrollWidth > element.clientWidth ||
          element.scrollHeight > element.clientHeight,
      );
      expect(overflows).toBe(false);
      const childrenInside = await button.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return [...element.children].every((child) => {
          const childBounds = child.getBoundingClientRect();
          return (
            childBounds.top >= bounds.top && childBounds.bottom <= bounds.bottom
          );
        });
      });
      expect(childrenInside).toBe(true);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});

test("failed login availability offers a retry that enables only configured provider routes", async ({
  page,
}) => {
  await signedOut(page);
  let attempts = 0;
  let passwordSubmissions = 0;
  await page.route("**/api/v1/auth/session", async (route) => {
    passwordSubmissions++;
    await route.abort();
  });
  await page.route("**/api/v1/identity/providers", async (route) => {
    attempts++;
    if (attempts === 1)
      return route.fulfill({ status: 503, body: "Unavailable" });
    await route.fulfill({
      json: {
        identity: {
          providers: [
            { id: "google", label: "Google", configured: true, linked: false },
            { id: "openai", label: "ChatGPT", configured: true, linked: false },
          ],
        },
      },
    });
  });
  await page.goto("/");
  const options = page.locator(".provider-signin");
  await expect(
    options.getByRole("button", { name: "Continue with Google Unavailable" }),
  ).toBeDisabled();
  await expect(
    options.getByRole("button", { name: "Continue with ChatGPT Unavailable" }),
  ).toBeDisabled();
  await expect(options.getByRole("link")).toHaveCount(0);
  await page.getByLabel("Email address").fill("human@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await options.getByRole("button", { name: "Retry sign-in options" }).click();
  await expect(
    options.getByRole("link", { name: "Continue with Google" }),
  ).toHaveAttribute("href", "/api/v1/identity/google/login");
  await expect(
    options.getByRole("link", { name: "Continue with ChatGPT" }),
  ).toHaveAttribute("href", "/api/v1/identity/openai/login");
  expect(passwordSubmissions).toBe(0);
  expect(attempts).toBe(2);
});

test("the bottom account section also retains both setup-required providers", async ({
  page,
}) => {
  await mockMarketplace(page);
  await page.goto("/?view=connections");
  const section = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Account sign-in", exact: true }),
  });
  await expect(section.getByText("Google", { exact: true })).toBeVisible();
  await expect(section.getByText("ChatGPT", { exact: true })).toBeVisible();
  await expect(
    section.getByRole("button", { name: "Setup required" }),
  ).toHaveCount(2);
  for (const button of await section
    .getByRole("button", { name: "Setup required" })
    .all()) {
    await expect(button).toBeDisabled();
  }
  await expect(
    page.getByText("Claude Desktop / Claude Code", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Link.*Claude|Continue with Claude/ }),
  ).toHaveCount(0);
});

test("account linking preserves its explicit POST and already-linked state", async ({
  page,
}) => {
  await mockMarketplace(page);
  await page.route("**/api/v1/identity/providers", (route) =>
    route.fulfill({
      json: {
        identity: {
          providers: [
            { id: "google", label: "Google", configured: true, linked: false },
            { id: "openai", label: "ChatGPT", configured: true, linked: true },
          ],
        },
      },
    }),
  );
  let linkMethod = "";
  await page.route("**/api/v1/identity/google/link", (route) => {
    linkMethod = route.request().method();
    return route.fulfill({
      json: { identity: { redirect_url: "/provider-link-started" } },
    });
  });
  await page.route("**/provider-link-started", (route) =>
    route.fulfill({
      contentType: "text/plain",
      body: "Mock identity provider",
    }),
  );
  await page.goto("/?view=connections");
  const options = page.locator(".provider-list");
  await expect(
    options.getByRole("button", { name: "Linked", exact: true }),
  ).toBeDisabled();
  await expect(
    options.getByText("Linked to your account", { exact: true }),
  ).toBeVisible();
  await options
    .getByRole("button", { name: "Link account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/provider-link-started$/);
  expect(linkMethod).toBe("POST");
});
