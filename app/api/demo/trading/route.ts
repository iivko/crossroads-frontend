import { NextRequest } from "next/server";
import type { components } from "@/lib/generated/api";
import {
  configuration,
  trustedOrigin,
  failure,
  responseHeaders,
} from "@/lib/demo-preview-server";
import { DemoTradingError, runDemoTrading } from "@/lib/demo-trading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// This local preview runs one bounded request, not a durable or distributed job.
let running = false;

export async function POST(request: NextRequest) {
  const config = configuration();
  if (!config)
    return failure(404, "demo_disabled", "Local demo preview is not enabled.");
  if (!trustedOrigin(request, true))
    return failure(
      403,
      "demo_origin_rejected",
      "Open the demo from this local website.",
    );
  const csrf = request.cookies.get("market_csrf")?.value;
  if (
    !request.cookies.get("market_session")?.value ||
    !csrf ||
    request.headers.get("x-csrf-token") !== csrf
  ) {
    return failure(
      403,
      "demo_session_required",
      "Sign in to the local demo before running its agents.",
    );
  }
  try {
    if (
      request.headers.get("content-type")?.split(";")[0]?.trim() !==
      "application/json"
    )
      throw new Error("Invalid body");
    const text = await request.text();
    if (text.length > 100) throw new Error("Invalid body");
    const body: unknown = JSON.parse(text);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length
    )
      throw new Error("Invalid body");
  } catch {
    return failure(
      400,
      "invalid_demo_run",
      "Start the fixed local demo without custom trading instructions.",
    );
  }

  try {
    const identityResponse = await fetch(`${config.upstream}/api/v1/auth/me`, {
      headers: { Cookie: request.headers.get("cookie") || "" },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    if (!identityResponse.ok)
      return failure(
        401,
        "demo_session_required",
        "Sign in to the local demo before running its agents.",
      );
    const { identity } = (await identityResponse.json()) as {
      identity?: components["schemas"]["Me"];
    };
    if (
      identity?.demo !== true ||
      identity.credential.kind !== "browser" ||
      !["buyer@demo.local", "forma@demo.local"].includes(identity.user.email)
    ) {
      return failure(
        403,
        "demo_account_required",
        "Use the local buyer or seller preview to run this demo.",
      );
    }
  } catch {
    return failure(
      503,
      "demo_unavailable",
      "The local backend is unavailable. Start it and try again.",
    );
  }

  if (running)
    return failure(
      409,
      "demo_already_running",
      "A local agent demo is already running. Wait for it to finish.",
    );
  running = true;
  try {
    const demo = await runDemoTrading(
      config,
      AbortSignal.any([request.signal, AbortSignal.timeout(50000)]),
    );
    return Response.json(
      { demo, status_code: 200 },
      { headers: responseHeaders },
    );
  } catch (error) {
    return failure(
      error instanceof DemoTradingError ? error.status : 503,
      "demo_run_stopped",
      error instanceof DemoTradingError
        ? error.message
        : "The local agent demo stopped. Review any recorded negotiations, then try again.",
    );
  } finally {
    running = false;
  }
}
