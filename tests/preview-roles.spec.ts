import { expect, test } from "@playwright/test";

test("local preview opens real buyer and seller sessions and clears the previous account", async ({
  page,
  request,
}) => {
  const config = await (await request.get("/api/demo/session")).json();
  test.skip(
    !config.enabled,
    "Requires explicitly enabled loopback demo preview",
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Buyer preview", exact: true })
    .click();
  await expect(page.getByLabel("Workspace", { exact: true })).toHaveValue(
    "ws-buyer",
  );
  await expect(
    page.getByRole("button", { name: "Buyer preview", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Requests", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Seller preview", exact: true })
    .click();
  await expect(page.getByLabel("Workspace", { exact: true })).toHaveValue(
    "ws-forma",
  );
  await expect(
    page.getByRole("button", { name: "Seller preview", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Requests", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Agreed sales value/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Buyer preview", exact: true })
    .click();
  await expect(page.getByLabel("Workspace", { exact: true })).toHaveValue(
    "ws-buyer",
  );
  await expect(
    page.getByRole("button", { name: /^Agreed purchase value/ }),
  ).toBeVisible();
});
