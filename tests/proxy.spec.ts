import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import {
  GET,
  POST,
  PUT,
  PATCH,
  DELETE,
  OPTIONS,
} from "../app/api/v1/[...path]/route";

const originalFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("OAuth redirects preserve transaction cookies and suppress referrer disclosure", async () => {
  globalThis.fetch = async (_input, options) => {
    expect(options?.redirect).toBe("manual");
    return new Response(null, {
      status: 303,
      headers: {
        location: "https://accounts.google.com/o/oauth2/v2/auth?state=opaque",
        "set-cookie":
          "neopact_identity=bound; HttpOnly; SameSite=Lax; Path=/api/v1/identity",
      },
    });
  };
  const response = await GET(
    new NextRequest("http://localhost:3187/api/v1/identity/google/login"),
    { params: Promise.resolve({ path: ["identity", "google", "login"] }) },
  );
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toContain(
    "https://accounts.google.com/",
  );
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.getSetCookie()).toHaveLength(1);
});

test("credential management forwards browser security and leaves authorization to backend", async () => {
  globalThis.fetch = async (_input, options) => {
    const headers = new Headers(options?.headers);
    expect(headers.get("x-csrf-token")).toBe("csrf");
    expect(headers.get("x-workspace-id")).toBe("seller-workspace");
    expect(headers.get("authorization")).toBeNull();
    return Response.json({
      credential: { id: "agent-1", revoked: true },
      status_code: 200,
    });
  };
  const response = await DELETE(
    new NextRequest("http://localhost:3187/api/v1/credentials/agent-1", {
      method: "DELETE",
      headers: {
        cookie: "market_session=browser",
        "x-csrf-token": "csrf",
        "x-workspace-id": "seller-workspace",
        authorization: "Bearer not-forwarded",
      },
    }),
    { params: Promise.resolve({ path: ["credentials", "agent-1"] }) },
  );
  expect(response.status).toBe(200);
});

test("dashboard proxy refuses agent operations with the standard error envelope", async () => {
  globalThis.fetch = async () => {
    throw new Error("Must not reach the backend");
  };
  const response = await POST(
    new NextRequest("http://localhost:3100/api/v1/products", {
      method: "POST",
    }),
    { params: Promise.resolve({ path: ["products"] }) },
  );
  expect(response.status).toBe(405);
  expect(await response.json()).toEqual({
    error: {
      code: "unsupported_dashboard_action",
      message: "Use the CLI for marketplace operations",
      details: null,
    },
    status_code: 405,
  });
});

for (const [method, handler] of Object.entries({
  PUT,
  PATCH,
  DELETE,
  OPTIONS,
})) {
  test(`${method} is rejected as JSON instead of a framework-generated empty error`, async () => {
    globalThis.fetch = async () => {
      throw new Error("Must not reach the backend");
    };
    const response = await handler(
      new NextRequest("http://localhost:3100/api/v1/products", { method }),
      { params: Promise.resolve({ path: ["products"] }) },
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD, POST");
    expect(await response.json()).toMatchObject({
      error: { code: "unsupported_dashboard_action", details: null },
      status_code: 405,
    });
  });
}

test("backend connection failures use a structured status-matching envelope", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("connect ECONNREFUSED");
  };
  const response = await GET(
    new NextRequest("http://localhost:3100/api/v1/products"),
    { params: Promise.resolve({ path: ["products"] }) },
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: {
      code: "backend_unavailable",
      message: "The marketplace API is unavailable. Please retry.",
      details: null,
    },
    status_code: 503,
  });
});

test("proxy preserves upstream envelopes, status and cookies for approved browser operations", async () => {
  const body = { offer_id: "offer-1", expected_version: 3 };
  const envelope = {
    error: {
      code: "version_conflict",
      message: "Review the current offer",
      details: null,
    },
    status_code: 409,
  };
  globalThis.fetch = async (input, init) => {
    expect(String(input)).toMatch(/\/api\/v1\/approvals\/room-1\/approve$/);
    expect(init?.method).toBe("POST");
    expect(init?.cache).toBe("no-store");
    const headers = new Headers(init?.headers);
    expect(headers.get("cookie")).toBe("market_session=browser-session");
    expect(headers.get("origin")).toBe("http://localhost:3100");
    expect(headers.get("x-csrf-token")).toBe("csrf-value");
    expect(headers.get("x-workspace-id")).toBe("buyer-workspace");
    expect(headers.has("authorization")).toBe(false);
    expect(await new Response(init?.body).json()).toEqual(body);
    const outgoing = new Headers({ "content-type": "application/json" });
    outgoing.append(
      "set-cookie",
      "market_session=renewed; HttpOnly; SameSite=Strict",
    );
    outgoing.append("set-cookie", "market_csrf=renewed-csrf; SameSite=Strict");
    return new Response(JSON.stringify(envelope), {
      status: 409,
      headers: outgoing,
    });
  };
  const response = await POST(
    new NextRequest("http://localhost:3100/api/v1/approvals/room-1/approve", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "market_session=browser-session",
        origin: "http://localhost:3100",
        "x-csrf-token": "csrf-value",
        "x-workspace-id": "buyer-workspace",
        authorization: "Bearer never-forward-agent-token",
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ path: ["approvals", "room-1", "approve"] }) },
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual(envelope);
  expect(response.headers.getSetCookie()).toEqual([
    "market_session=renewed; HttpOnly; SameSite=Strict",
    "market_csrf=renewed-csrf; SameSite=Strict",
  ]);
});

test("image proxy preserves binary bytes, content type and workspace query", async () => {
  const bytes = new Uint8Array([255, 216, 255, 217]);
  globalThis.fetch = async (input) => {
    expect(String(input)).toMatch(
      /\/api\/v1\/images\/image-1\/content\?thumbnail=true&workspace_id=buyer-workspace$/,
    );
    return new Response(bytes, {
      headers: {
        "content-type": "image/jpeg",
        "content-disposition": 'inline; filename="image-1.jpg"',
      },
    });
  };
  const response = await GET(
    new NextRequest(
      "http://localhost:3100/api/v1/images/image-1/content?thumbnail=true&workspace_id=buyer-workspace",
    ),
    { params: Promise.resolve({ path: ["images", "image-1", "content"] }) },
  );
  expect(response.headers.get("content-type")).toBe("image/jpeg");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
});

test("guidance proxy forwards browser security and idempotency, never agent authorization", async () => {
  const body = { instruction: "Try a better deposit.", expected_version: 7 };
  const envelope = { negotiation: { id: "room-1" }, status_code: 200 };
  globalThis.fetch = async (input, init) => {
    expect(String(input)).toMatch(/\/api\/v1\/negotiations\/room-1\/guidance$/);
    const headers = new Headers(init?.headers);
    expect(headers.get("cookie")).toBe("market_session=human");
    expect(headers.get("origin")).toBe("http://localhost:3100");
    expect(headers.get("x-csrf-token")).toBe("csrf");
    expect(headers.get("x-workspace-id")).toBe("seller-workspace");
    expect(headers.get("idempotency-key")).toBe("guidance-retry-key");
    expect(headers.has("authorization")).toBe(false);
    expect(await new Response(init?.body).json()).toEqual(body);
    return Response.json(envelope);
  };
  const response = await POST(
    new NextRequest(
      "http://localhost:3100/api/v1/negotiations/room-1/guidance",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "market_session=human",
          origin: "http://localhost:3100",
          "x-csrf-token": "csrf",
          "x-workspace-id": "seller-workspace",
          "idempotency-key": "guidance-retry-key",
          authorization: "Bearer agent-never-forwarded",
        },
        body: JSON.stringify(body),
      },
    ),
    {
      params: Promise.resolve({ path: ["negotiations", "room-1", "guidance"] }),
    },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(envelope);
});

for (const suffix of ["act", "claim", "retry", "guidance/extra"]) {
  test(`adding human guidance does not expose negotiation ${suffix} operations`, async () => {
    globalThis.fetch = async () => {
      throw new Error("Must not reach backend");
    };
    const response = await POST(
      new NextRequest(
        `http://localhost:3100/api/v1/negotiations/room-1/${suffix}`,
        { method: "POST" },
      ),
      {
        params: Promise.resolve({
          path: ["negotiations", "room-1", ...suffix.split("/")],
        }),
      },
    );
    expect(response.status).toBe(405);
  });
}
