import type { Provider } from "./connections";

export type ProviderStatus = "loading" | "ready" | "error";

const supportedProviders: Provider[] = [
  { id: "google", label: "Google", configured: false, linked: false },
  { id: "openai", label: "ChatGPT", configured: false, linked: false },
];

/** Keep supported identities visible; only verified API flags enable actions. */
export function identityProviders(value: unknown): Provider[] {
  if (!Array.isArray(value))
    throw new Error("Sign-in connection status is unavailable.");
  return supportedProviders.map((provider) => {
    const matches = value.filter((entry) => entry?.id === provider.id);
    const entry = matches[0];
    if (
      matches.length > 1 ||
      (entry &&
        (typeof entry.configured !== "boolean" ||
          typeof entry.linked !== "boolean"))
    )
      throw new Error("Sign-in connection status is unavailable.");
    return {
      ...provider,
      configured: entry?.configured === true,
      linked: entry?.linked === true,
    };
  });
}

export function providerAvailability(
  provider: Provider,
  status: ProviderStatus,
  mode: "login" | "link",
) {
  if (status === "loading")
    return {
      available: false,
      label: "Checking…",
      detail: "Checking sign-in availability…",
    };
  if (status === "error")
    return {
      available: false,
      label: "Unavailable",
      detail: "Availability could not be checked. Retry below.",
    };
  if (mode === "link" && provider.linked)
    return {
      available: false,
      label: "Linked",
      detail: provider.configured
        ? "Linked to your account"
        : "Linked to your account; sign-in setup is required.",
    };
  if (!provider.configured)
    return {
      available: false,
      label: "Setup required",
      detail:
        provider.id === "google"
          ? "Google sign-in needs to be enabled by the site administrator."
          : "ChatGPT sign-in requires approved OpenAI client registration.",
    };
  return {
    available: true,
    label: mode === "login" ? "Continue" : "Link account",
    detail: mode === "login" ? "" : "Ready to link",
  };
}
