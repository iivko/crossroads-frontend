import { NextRequest } from "next/server";
import {
  configuration,
  trustedOrigin,
  failure,
  responseHeaders,
} from "@/lib/demo-preview-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const labels = { buyer: "Buyer preview", seller: "Seller preview" };
const accounts = { buyer: "buyer@demo.local", seller: "forma@demo.local" };
/** Availability is deliberately public; credentials never leave this server module. */
export async function GET(request: NextRequest) {
  return Response.json(
    {
      enabled:
        Boolean(configuration()) && Boolean(trustedOrigin(request, false)),
      labels,
      ...(configuration() &&
      trustedOrigin(request, false) &&
      process.env.NEOPACT_MCP_PROJECT_DIR
        ? { mcpProjectDirectory: process.env.NEOPACT_MCP_PROJECT_DIR }
        : {}),
    },
    { headers: responseHeaders },
  );
}

export async function POST(request: NextRequest) {
  const config = configuration();
  if (!config) {
    return failure(404, "demo_disabled", "Local demo preview is not enabled.");
  }
  const origin = trustedOrigin(request, true);
  if (!origin) {
    return failure(
      403,
      "demo_origin_rejected",
      "Open the demo from this local website.",
    );
  }
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !==
    "application/json"
  ) {
    return failure(
      400,
      "invalid_demo_role",
      "Select the buyer or seller preview.",
    );
  }

  let role: keyof typeof accounts;
  try {
    const text = await request.text();
    if (text.length > 1000) throw new Error("Invalid role");
    const body: unknown = JSON.parse(text);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !("role" in body) ||
      (body.role !== "buyer" && body.role !== "seller")
    ) {
      throw new Error("Invalid role");
    }
    role = body.role;
  } catch {
    return failure(
      400,
      "invalid_demo_role",
      "Select the buyer or seller preview.",
    );
  }

  try {
    const upstream = await fetch(`${config.upstream}/api/v1/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        email: accounts[role],
        password: config.password,
      }),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok) {
      return failure(
        upstream.status >= 400 && upstream.status < 500 ? upstream.status : 503,
        "demo_sign_in_failed",
        "The demo account could not be opened. Check the local backend and demo credentials.",
      );
    }
    const cookies = upstream.headers.getSetCookie();
    if (
      !cookies.some((cookie) => cookie.startsWith("market_session=")) ||
      !cookies.some((cookie) => cookie.startsWith("market_csrf="))
    ) {
      return failure(
        503,
        "demo_unavailable",
        "The local backend did not return a demo session. Please retry.",
      );
    }

    // Only revoke after the new sign-in succeeds, so a failed switch preserves access.
    // An expired old session or a logout transport failure cannot invalidate the new one.
    const oldSession = request.cookies.get("market_session")?.value;
    const oldCsrf = request.cookies.get("market_csrf")?.value;
    if (oldSession && oldCsrf) {
      try {
        await fetch(`${config.upstream}/api/v1/auth/logout`, {
          method: "POST",
          headers: {
            Origin: origin,
            Cookie: `market_session=${oldSession}; market_csrf=${oldCsrf}`,
            "X-CSRF-Token": oldCsrf,
          },
          cache: "no-store",
          redirect: "manual",
          signal: AbortSignal.timeout(3000),
        });
      } catch {
        // The previous credential retains its backend expiry if revocation is unavailable.
      }
    }

    const headers = new Headers(responseHeaders);
    for (const cookie of cookies) headers.append("Set-Cookie", cookie);
    return Response.json({ role, status_code: 200 }, { headers });
  } catch {
    return failure(
      503,
      "demo_unavailable",
      "The local backend is unavailable. Start it and try again.",
    );
  }
}
