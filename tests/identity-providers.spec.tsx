import { expect, test } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { IdentityProviderOptions } from "../components/identity-providers";
import {
  identityProviders,
  providerAvailability,
  type ProviderStatus,
} from "../lib/identity-providers";

const configured = identityProviders([
  { id: "google", configured: true, linked: false },
  { id: "openai", configured: true, linked: true },
]);

test("an empty provider response keeps both known identities visible and disabled", () => {
  const providers = identityProviders([]);
  expect(providers.map(({ id, label }) => ({ id, label }))).toEqual([
    { id: "google", label: "Google" },
    { id: "openai", label: "ChatGPT" },
  ]);
  for (const provider of providers) {
    expect(providerAvailability(provider, "ready", "login")).toMatchObject({
      available: false,
      label: "Setup required",
    });
  }
});

test("unknown providers cannot add an identity or change canonical labels", () => {
  const providers = identityProviders([
    { id: "anthropic", label: "Claude", configured: true, linked: true },
    { id: "google", label: "Untrusted label", configured: true, linked: false },
  ]);
  expect(providers).toEqual([
    { id: "google", label: "Google", configured: true, linked: false },
    { id: "openai", label: "ChatGPT", configured: false, linked: false },
  ]);
});

test("malformed or ambiguous availability fails closed", () => {
  for (const value of [
    undefined,
    {},
    [{ id: "google", configured: "true", linked: false }],
    [{ id: "openai", configured: true }],
    [configured[0], configured[0]],
  ]) {
    expect(() => identityProviders(value)).toThrow(/status is unavailable/);
  }
});

for (const status of ["loading", "error"] as const) {
  test(`${status} never enables login or linking, even with earlier configured data`, () => {
    for (const provider of configured) {
      for (const mode of ["login", "link"] as const) {
        expect(providerAvailability(provider, status, mode).available).toBe(
          false,
        );
      }
    }
    const markup = renderOptions(status);
    expect(markup).toContain("Continue with Google");
    expect(markup).toContain("Continue with ChatGPT");
    expect(markup.match(/disabled=""/g)).toHaveLength(2);
    expect(markup).not.toContain("href=");
    if (status === "error") expect(markup).toContain("Retry sign-in options");
  });
}

test("configured login options preserve genuine identity routes", () => {
  const markup = renderOptions("ready");
  expect(markup).toContain('href="/api/v1/identity/google/login"');
  expect(markup).toContain('href="/api/v1/identity/openai/login"');
  expect(markup).not.toContain("disabled=");
  expect(markup).not.toContain("/anthropic/");
});

test("linking stays explicit and an already linked identity cannot be linked again", () => {
  expect(providerAvailability(configured[0]!, "ready", "link")).toMatchObject({
    available: true,
    label: "Link account",
  });
  expect(providerAvailability(configured[1]!, "ready", "link")).toMatchObject({
    available: false,
    label: "Linked",
  });
  expect(
    providerAvailability(
      { ...configured[1]!, configured: false },
      "ready",
      "link",
    ),
  ).toMatchObject({
    available: false,
    label: "Linked",
  });
  const markup = renderOptions("ready", "link");
  expect(markup).toContain("Link account");
  expect(markup).toContain("Linked to your account");
  expect(markup.match(/disabled=""/g)).toHaveLength(1);
  expect(markup).not.toContain("href=");
});

function renderOptions(
  status: ProviderStatus,
  mode: "login" | "link" = "login",
) {
  return renderToStaticMarkup(
    <IdentityProviderOptions
      providers={configured}
      status={status}
      mode={mode}
      retry={() => {}}
    />,
  );
}
