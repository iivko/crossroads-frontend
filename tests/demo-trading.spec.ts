import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/demo/trading/route";

const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
const savedEnv = {
  NEOPACT_DEMO_PREVIEW: process.env.NEOPACT_DEMO_PREVIEW,
  NEOPACT_DEMO_PASSWORD: process.env.NEOPACT_DEMO_PASSWORD,
  API_INTERNAL_URL: process.env.API_INTERNAL_URL,
};
const origin = "http://127.0.0.1:3187";
type Call = {
  path: string;
  method: string;
  token: string | null;
  idempotency: string | null;
  body: Record<string, unknown> | null;
};

function browserRequest(
  headers: Record<string, string> = {},
  body: unknown = {},
) {
  return new NextRequest(`${origin}/api/demo/trading`, {
    method: "POST",
    headers: {
      host: "127.0.0.1:3187",
      origin,
      cookie: "market_session=browser-session; market_csrf=browser-csrf",
      "x-csrf-token": "browser-csrf",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function fakeBackend(
  options: {
    email?: string;
    demo?: boolean;
    failAction?: boolean;
    failCredential?: string;
    stock?: number;
  } = {},
) {
  const calls: Call[] = [];
  let version = 7;
  const json = (resource: string, data: unknown, status = 200) =>
    Response.json({ [resource]: data, status_code: status }, { status });
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname.replace("/api/v1", "");
    const headers = new Headers(init?.headers);
    const body = init?.body ? await new Response(init.body).json() : null;
    const token = headers.get("authorization")?.replace("Bearer ", "") || null;
    calls.push({
      path,
      method: init?.method || "GET",
      token,
      body,
      idempotency: headers.get("idempotency-key"),
    });
    if (path === "/auth/me") {
      expect(headers.get("cookie")).toBe(
        "market_session=browser-session; market_csrf=browser-csrf",
      );
      return json("identity", {
        demo: options.demo ?? true,
        user: { email: options.email || "buyer@demo.local" },
        credential: { kind: "browser" },
      });
    }
    if (path === "/auth/token") {
      const name = String(body.email).split("@")[0];
      return json("token", {
        token: `owner-${name}`,
        credential_id: `owner-id-${name}`,
      });
    }
    if (path === "/credentials" && init?.method === "POST") {
      const name = token!.replace("owner-", "");
      if (options.failCredential === name)
        return Response.json({}, { status: 503 });
      return json(
        "credential",
        { id: `agent-id-${name}`, token: `agent-${name}` },
        201,
      );
    }
    if (path.startsWith("/credentials/") || path === "/auth/logout") {
      return json(path === "/auth/logout" ? "session" : "credential", {
        ok: true,
        revoked: true,
      });
    }
    if (path === "/products/prod-forma")
      return json("product", { stock: options.stock ?? 160, published: true });
    if (path === "/requests" && init?.method === "POST")
      return json("request", { id: "request-live" }, 201);
    if (path === "/requests/request-live/launch")
      return json("request", { id: "request-live" });
    if (path === "/requests/request-live")
      return json("request_detail", {
        negotiations: [
          { id: "forma-room", product_id: "prod-forma" },
          { id: "nord-room", product_id: "prod-nord" },
        ],
      });
    if (path.endsWith("/context")) return json("context", {});
    if (path.endsWith("/claim"))
      return json("claim", {
        expected_version: version++,
        claim_token: `claim-${version}-secret-token`,
      });
    if (path.endsWith("/actions")) {
      if (body.message && body.purpose !== "explanation") {
        return Response.json({}, { status: 422 });
      }
      if (options.failAction)
        return Response.json(
          { error: "private backend detail" },
          { status: 409 },
        );
      return json("action", {
        offer_id: body.type === "counter" ? "counter-offer" : "first-offer",
        state: body.type === "accept" ? "awaiting_approval" : "negotiating",
      });
    }
    throw new Error(`Unexpected backend path ${path}`);
  };
  return calls;
}

test.beforeEach(() => {
  process.env.NEOPACT_DEMO_PREVIEW = "true";
  process.env.NEOPACT_DEMO_PASSWORD = "server-test-password";
  process.env.API_INTERNAL_URL = "http://127.0.0.1:8100";
  globalThis.setTimeout = ((
    callback: (...args: unknown[]) => void,
    milliseconds?: number,
    ...args: unknown[]
  ) =>
    originalSetTimeout(
      callback,
      milliseconds === 5000 ? 0 : milliseconds,
      ...args,
    )) as typeof setTimeout;
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("live trading is disabled by default", async () => {
  const calls = fakeBackend();
  delete process.env.NEOPACT_DEMO_PREVIEW;
  expect((await POST(browserRequest())).status).toBe(404);
  expect(calls).toEqual([]);
});

test("live trading rejects remote upstreams and cross-origin browser requests before authentication", async () => {
  const calls = fakeBackend();
  expect(
    (await POST(browserRequest({ origin: "https://evil.example" }))).status,
  ).toBe(403);
  process.env.API_INTERNAL_URL = "https://marketplace.example";
  expect((await POST(browserRequest())).status).toBe(404);
  expect(calls).toEqual([]);
});

test("live trading requires the browser CSRF cookie and header to agree", async () => {
  const calls = fakeBackend();
  expect(
    (await POST(browserRequest({ "x-csrf-token": "incorrect" }))).status,
  ).toBe(403);
  expect(calls).toEqual([]);
});

for (const options of [{ demo: false }, { email: "unrelated@demo.local" }]) {
  test(`rejects an unauthorized backend identity ${JSON.stringify(options)}`, async () => {
    const calls = fakeBackend(options);
    expect((await POST(browserRequest())).status).toBe(403);
    expect(calls.map((call) => call.path)).toEqual(["/auth/me"]);
  });
}

test("does not accept caller-supplied accounts or trading instructions", async () => {
  const calls = fakeBackend();
  expect((await POST(browserRequest({}, { quantity: 500 }))).status).toBe(400);
  expect(calls).toEqual([]);
});

test("scripted agents claim real versions, negotiate, and stop before human approval", async () => {
  const calls = fakeBackend({ email: "forma@demo.local" });
  const response = await POST(browserRequest());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    status_code: 200,
    demo: {
      request_id: "request-live",
      room_id: "forma-room",
      status: "awaiting_human_approval",
    },
  });
  const actions = calls.filter((call) => call.path.endsWith("/actions"));
  expect(actions.map((call) => call.body?.type)).toEqual([
    "decline",
    "propose",
    "counter",
    "accept",
  ]);
  expect(actions.map((call) => call.body?.expected_version)).toEqual([
    7, 8, 9, 10,
  ]);
  expect(actions.map((call) => call.body?.claim_token)).toEqual([
    "claim-8-secret-token",
    "claim-9-secret-token",
    "claim-10-secret-token",
    "claim-11-secret-token",
  ]);
  expect(actions.map((call) => call.token)).toEqual([
    "agent-nord",
    "agent-forma",
    "agent-buyer",
    "agent-forma",
  ]);
  expect(actions.at(-1)?.body?.offer_id).toBe("counter-offer");
  expect(
    actions
      .filter((call) => call.body?.message)
      .every((call) => call.body?.purpose === "explanation"),
  ).toBe(true);
  expect(actions.every((call) => (call.idempotency?.length || 0) >= 8)).toBe(
    true,
  );
  expect(new Set(actions.map((call) => call.idempotency)).size).toBe(4);
  expect(calls.some((call) => /approvals|orders|stock/.test(call.path))).toBe(
    false,
  );
  const request = calls.find(
    (call) => call.path === "/requests" && call.method === "POST",
  );
  expect(request?.token).toBe("agent-buyer");
  expect(request?.body?.quantity).toBe(80);
  for (const issued of calls.filter((call) => call.path === "/credentials")) {
    expect(issued.body?.expires_days).toBe(1);
    expect(issued.body?.scopes).not.toContain("credentials:manage");
    expect(issued.body?.scopes).not.toContain("policies:write");
  }
  expect(
    calls
      .filter((call) => call.method === "DELETE")
      .map((call) => call.path)
      .sort(),
  ).toEqual([
    "/credentials/agent-id-buyer",
    "/credentials/agent-id-forma",
    "/credentials/agent-id-nord",
  ]);
  expect(
    calls
      .filter((call) => call.path === "/auth/logout")
      .map((call) => call.token)
      .sort(),
  ).toEqual(["owner-buyer", "owner-forma", "owner-nord"]);
});

test("revokes every issued token after an action fails and sanitizes the error", async () => {
  const calls = fakeBackend({ failAction: true });
  const response = await POST(browserRequest());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private backend detail");
  expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(3);
  expect(calls.filter((call) => call.path === "/auth/logout")).toHaveLength(3);
});

test("credential creation failure still revokes the owner token already issued", async () => {
  const calls = fakeBackend({ failCredential: "forma" });
  expect((await POST(browserRequest())).status).toBe(503);
  expect(
    calls
      .filter((call) => call.path === "/auth/logout")
      .map((call) => call.token)
      .sort(),
  ).toEqual(["owner-buyer", "owner-forma"]);
  expect(
    calls.filter((call) => call.method === "DELETE").map((call) => call.path),
  ).toEqual(["/credentials/agent-id-buyer"]);
});

test("insufficient inventory does not create requests or alter stock", async () => {
  const calls = fakeBackend({ stock: 20 });
  expect((await POST(browserRequest())).status).toBe(409);
  expect(calls.some((call) => call.path === "/requests")).toBe(false);
  expect(calls.some((call) => call.path.includes("/stock"))).toBe(false);
  expect(calls.filter((call) => call.path === "/auth/logout")).toHaveLength(3);
});

test("only one demo may run in this server process at a time", async () => {
  const calls = fakeBackend();
  const backend = globalThis.fetch;
  let entered!: () => void;
  let release!: () => void;
  const ownerLoginStarted = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const holdOwnerLogin = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith("/auth/token") && !held) {
      held = true;
      entered();
      await holdOwnerLogin;
    }
    return backend(input, init);
  };
  const first = POST(browserRequest());
  await ownerLoginStarted;
  try {
    const second = await POST(browserRequest());
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({
      error: { code: "demo_already_running" },
    });
  } finally {
    release();
    expect((await first).status).toBe(200);
  }
  expect(calls.filter((call) => call.path === "/auth/token")).toHaveLength(3);
});
