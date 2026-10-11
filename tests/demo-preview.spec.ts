import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/demo/session/route";
import { switchDemoRole } from "../lib/demo-preview";

const origin = "http://127.0.0.1:3187";
const originalFetch = globalThis.fetch;
const originalEnv = {
  enabled: process.env.NEOPACT_DEMO_PREVIEW,
  password: process.env.NEOPACT_DEMO_PASSWORD,
  upstream: process.env.API_INTERNAL_URL,
};

function request(
  body: unknown = { role: "buyer" },
  headers: Record<string, string> = {},
  url = `${origin}/api/demo/session`,
) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      host: new URL(url).host,
      origin,
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function sessionResponse() {
  const headers = new Headers({ "content-type": "application/json" });
  headers.append(
    "set-cookie",
    "market_session=new-session; Path=/; HttpOnly; SameSite=Strict",
  );
  headers.append("set-cookie", "market_csrf=new-csrf; Path=/; SameSite=Strict");
  return Response.json(
    { session: { ok: true }, status_code: 200 },
    { headers },
  );
}

test.beforeEach(() => {
  process.env.NEOPACT_DEMO_PREVIEW = "true";
  process.env.NEOPACT_DEMO_PASSWORD = "server-only-test-password";
  process.env.API_INTERNAL_URL = "http://127.0.0.1:8100";
  globalThis.fetch = async () => {
    throw new Error("Unexpected backend request");
  };
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries({
    NEOPACT_DEMO_PREVIEW: originalEnv.enabled,
    NEOPACT_DEMO_PASSWORD: originalEnv.password,
    API_INTERNAL_URL: originalEnv.upstream,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("demo preview is disabled by default and does not expose credentials", async () => {
  delete process.env.NEOPACT_DEMO_PREVIEW;
  const config = await GET(
    new NextRequest(`${origin}/api/demo/session`, {
      headers: { host: "127.0.0.1:3187" },
    }),
  );
  expect(await config.json()).toEqual({
    enabled: false,
    labels: { buyer: "Buyer preview", seller: "Seller preview" },
  });
  expect(config.headers.get("cache-control")).toBe("no-store");
  expect((await POST(request())).status).toBe(404);
});

test("config exposes only availability and role labels when explicitly enabled", async () => {
  const response = await GET(
    new NextRequest(`${origin}/api/demo/session`, {
      headers: { host: "127.0.0.1:3187" },
    }),
  );
  expect(await response.json()).toEqual({
    enabled: true,
    labels: { buyer: "Buyer preview", seller: "Seller preview" },
  });
});

test("demo credentials must be configured on the server", async () => {
  delete process.env.NEOPACT_DEMO_PASSWORD;
  expect((await POST(request())).status).toBe(404);
});

for (const upstream of [
  "https://marketplace.example",
  "http://127.0.0.1.evil.example:8100",
  "http://user:password@127.0.0.1:8100",
  "http://127.0.0.1:8100/arbitrary-path",
]) {
  test(`demo switch refuses unsafe upstream ${upstream}`, async () => {
    process.env.API_INTERNAL_URL = upstream;
    expect((await POST(request())).status).toBe(404);
  });
}

const untrustedHeaders: Record<string, string>[] = [
  { origin: "https://attacker.example" },
  { origin: "http://localhost:3187" },
  { origin: "" },
  { host: "attacker.example" },
  { host: "" },
  { host: "127.0.0.1:8100" },
  { "sec-fetch-site": "cross-site" },
];
for (const headers of untrustedHeaders) {
  test(`demo switch rejects an untrusted browser boundary ${JSON.stringify(headers)}`, async () => {
    expect((await POST(request(undefined, headers))).status).toBe(403);
  });
}

for (const localOrigin of ["http://localhost:3187", "http://[::1]:3187"]) {
  test(`preserves the exact browser origin for ${localOrigin}`, async () => {
    globalThis.fetch = async (_input, init) => {
      expect(new Headers(init?.headers).get("origin")).toBe(localOrigin);
      return sessionResponse();
    };
    const response = await POST(
      request(
        { role: "buyer" },
        { origin: localOrigin },
        `${localOrigin}/api/demo/session`,
      ),
    );
    expect(response.status).toBe(200);
  });
}

test("a matching public host and origin cannot enable demo preview", async () => {
  const response = await POST(
    request(
      { role: "buyer" },
      { origin: "https://marketplace.example" },
      "https://marketplace.example/api/demo/session",
    ),
  );
  expect(response.status).toBe(403);
});

for (const body of [
  { role: "admin" },
  { role: "buyer", email: "another@example.com" },
  { email: "buyer@demo.local" },
  null,
]) {
  test(`demo switch accepts only a fixed role: ${JSON.stringify(body)}`, async () => {
    expect((await POST(request(body))).status).toBe(400);
  });
}

for (const role of ["buyer", "seller"] as const) {
  test(`opens the fixed ${role} account and forwards both browser cookies`, async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toBe("http://127.0.0.1:8100/api/v1/auth/session");
      expect(init?.method).toBe("POST");
      expect(init?.redirect).toBe("manual");
      expect(init?.cache).toBe("no-store");
      expect(new Headers(init?.headers).get("origin")).toBe(origin);
      expect(await new Response(init?.body).json()).toEqual({
        email: role === "buyer" ? "buyer@demo.local" : "forma@demo.local",
        password: "server-only-test-password",
      });
      return sessionResponse();
    };
    const response = await POST(request({ role }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ role, status_code: 200 });
    expect(response.headers.getSetCookie()).toEqual([
      "market_session=new-session; Path=/; HttpOnly; SameSite=Strict",
      "market_csrf=new-csrf; Path=/; SameSite=Strict",
    ]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
}

test("replaces the session only after sign-in succeeds, then revokes the old session", async () => {
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    paths.push(path);
    if (path.endsWith("/session")) return sessionResponse();
    const headers = new Headers(init?.headers);
    expect(path).toBe("/api/v1/auth/logout");
    expect(headers.get("cookie")).toBe(
      "market_session=previous-session; market_csrf=previous-csrf",
    );
    expect(headers.get("x-csrf-token")).toBe("previous-csrf");
    expect(headers.get("origin")).toBe(origin);
    expect(headers.has("x-workspace-id")).toBe(false);
    expect(headers.has("authorization")).toBe(false);
    return Response.json({ session: { ok: true }, status_code: 200 });
  };
  const response = await POST(
    request(
      { role: "seller" },
      {
        cookie: "market_session=previous-session; market_csrf=previous-csrf",
        "x-workspace-id": "stale-buyer-workspace",
        authorization: "Bearer never-forward-this",
      },
    ),
  );
  expect(response.status).toBe(200);
  expect(paths).toEqual(["/api/v1/auth/session", "/api/v1/auth/logout"]);
});

test("a failed demo sign-in keeps the existing session and does not echo backend content", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ error: "private upstream detail" }, { status: 401 });
  };
  const response = await POST(
    request(
      { role: "seller" },
      { cookie: "market_session=old; market_csrf=old-csrf" },
    ),
  );
  expect(response.status).toBe(401);
  expect(calls).toBe(1);
  expect(response.headers.getSetCookie()).toEqual([]);
  expect(await response.text()).not.toContain("private upstream detail");
});

test("upstream errors return a useful failure without setting session cookies", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("ECONNREFUSED");
  };
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    status_code: 503,
    error: { code: "demo_unavailable" },
  });
  expect(response.headers.getSetCookie()).toEqual([]);
});

test("browser helper sends only the selected role and surfaces server failure", async () => {
  globalThis.fetch = async (input, init) => {
    expect(input).toBe("/api/demo/session");
    expect(init?.credentials).toBe("same-origin");
    expect(await new Response(init?.body).json()).toEqual({ role: "seller" });
    return Response.json(
      { error: { message: "Start the local backend." }, status_code: 503 },
      { status: 503 },
    );
  };
  await expect(switchDemoRole("seller")).rejects.toThrow(
    "Start the local backend.",
  );
});
