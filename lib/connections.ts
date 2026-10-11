import { createMarketplaceClient, responseData } from "./api";
import type { components } from "./generated/api";
export type Credential = components["schemas"]["Credential"];
export type IssuedCredential = components["schemas"]["IssuedCredential"];
export type Provider = components["schemas"]["IdentityProviderStatus"];
const client = createMarketplaceClient();
export const connectionsApi = {
  async list() {
    return responseData(await client.GET("/api/v1/credentials")).credentials
      .items;
  },
  async create(name: string, scopes: string[]) {
    return responseData(
      await client.POST("/api/v1/credentials", {
        params: { header: client.browserHeaders() },
        body: { name, scopes, expires_days: 7 },
      }),
    ).credential;
  },
  async revoke(id: string) {
    return responseData(
      await client.DELETE("/api/v1/credentials/{credential_id}", {
        params: {
          path: { credential_id: id },
          header: client.browserHeaders(),
        },
      }),
    ).credential;
  },
  async providers(): Promise<Provider[]> {
    const response = await fetch("/api/v1/identity/providers", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok)
      throw new Error("Sign-in connection status is unavailable.");
    return (await response.json()).identity.providers;
  },
  async link(id: Provider["id"]): Promise<string> {
    const response = await fetch(`/api/v1/identity/${id}/link`, {
      method: "POST",
      credentials: "same-origin",
      headers: client.browserHeaders(),
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(
        body.error?.message || "Could not start account linking.",
      );
    return body.identity.redirect_url;
  },
};
