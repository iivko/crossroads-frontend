import type { components } from "@/lib/generated/api";

// This runner is server-only. Client components may import its result type only.
if (typeof window !== "undefined")
  throw new Error("Demo trading runs only on the local server.");

type Schema = components["schemas"];
type Configuration = { upstream: string; password: string };
type Agent = { ownerToken: string; token?: string; id?: string };

export type DemoTradingResult = {
  request_id: string;
  room_id: string;
  status: "awaiting_human_approval";
};

export class DemoTradingError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function dateAfter(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function pause(signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, 5000);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** One local run; deliberately scripted, without human approval or inventory writes. */
export async function runDemoTrading(
  config: Configuration,
  signal: AbortSignal,
): Promise<DemoTradingResult> {
  const agents: Agent[] = [];
  async function api<T>(
    path: string,
    resource: string,
    options: {
      token?: string;
      method?: string;
      body?: unknown;
      cleanup?: boolean;
    } = {},
  ): Promise<T> {
    const headers = new Headers();
    if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
    if (options.body !== undefined)
      headers.set("Content-Type", "application/json");
    if (options.method === "POST")
      headers.set("Idempotency-Key", crypto.randomUUID());
    const requestSignal = options.cleanup
      ? AbortSignal.timeout(2000)
      : AbortSignal.any([signal, AbortSignal.timeout(5000)]);
    requestSignal.throwIfAborted();
    const response = await fetch(`${config.upstream}/api/v1${path}`, {
      method: options.method || "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      redirect: "manual",
      signal: requestSignal,
    });
    if (!response.ok)
      throw new DemoTradingError(
        503,
        "The local agent demo stopped. Check the backend, review any recorded negotiations, and try again.",
      );
    const envelope = await response.json();
    if (envelope.status_code !== response.status || !envelope[resource]) {
      throw new DemoTradingError(
        503,
        "The local backend returned an unexpected demo response. Refresh and try again.",
      );
    }
    return envelope[resource] as T;
  }

  async function issueAgent(name: "buyer" | "forma" | "nord") {
    const owner = await api<Schema["Token"]>("/auth/token", "token", {
      method: "POST",
      body: { email: `${name}@demo.local`, password: config.password },
    });
    if (!owner.token)
      throw new DemoTradingError(
        503,
        "The local demo account could not be opened.",
      );
    const agent: Agent = { ownerToken: owner.token };
    agents.push(agent);
    const credential = await api<Schema["IssuedCredential"]>(
      "/credentials",
      "credential",
      {
        token: owner.token,
        method: "POST",
        body: {
          name: "Local live demo · scripted agent",
          scopes:
            name === "buyer"
              ? [
                  "catalogue:read",
                  "negotiations:read",
                  "negotiations:act",
                  "requests:write",
                ]
              : ["negotiations:read", "negotiations:act"],
          // One day is the minimum supported by the backend; finally revokes it immediately.
          expires_days: 1,
        } satisfies Schema["CredentialInput"],
      },
    );
    agent.id = credential.id;
    agent.token = credential.token;
    if (!agent.id || !agent.token)
      throw new DemoTradingError(
        503,
        "The local demo agent could not be issued.",
      );
    return agent.token;
  }

  async function act(
    token: string,
    roomId: string,
    action: Omit<Schema["ActionInput"], "expected_version" | "claim_token">,
  ) {
    await api<Schema["NegotiationContext"]>(
      `/negotiations/${roomId}/context`,
      "context",
      { token },
    );
    const claim = await api<Schema["Claim"]>(
      `/negotiations/${roomId}/claim`,
      "claim",
      { token, method: "POST" },
    );
    if (!Number.isInteger(claim.expected_version) || !claim.claim_token) {
      throw new DemoTradingError(
        503,
        "The local agent could not claim the current turn. Refresh and try again.",
      );
    }
    await pause(signal);
    return api<Schema["ActionResult"]>(
      `/negotiations/${roomId}/actions`,
      "action",
      {
        token,
        method: "POST",
        body: {
          ...action,
          expected_version: claim.expected_version,
          claim_token: claim.claim_token,
        },
      },
    );
  }

  try {
    const buyer = await issueAgent("buyer");
    const forma = await issueAgent("forma");
    const nord = await issueAgent("nord");
    const product = await api<Schema["Product"]>(
      "/products/prod-forma",
      "product",
      { token: buyer },
    );
    if (!product.published || product.stock < 80) {
      throw new DemoTradingError(
        409,
        "The demo needs 80 available Forma chairs. Review existing offers or restore demo stock through the CLI before trying again.",
      );
    }
    const request = await api<Schema["PurchaseRequest"]>(
      "/requests",
      "request",
      {
        token: buyer,
        method: "POST",
        body: {
          title: `80 chairs / Live demo ${crypto.randomUUID().slice(0, 6)}`,
          description:
            "Scripted local demonstration: 80 stackable chairs for Sofia.",
          category: "chairs",
          quantity: 80,
          material: "polypropylene",
          stackable: true,
          destination: "Sofia",
          latest_delivery: dateAfter(14),
          max_total: 700000,
          max_deposit_percent: 40,
          preference: "lower_deposit",
        } satisfies Schema["RequestInput"],
      },
    );
    if (!request.id)
      throw new DemoTradingError(
        503,
        "The demo request could not be confirmed. Review requests before trying again.",
      );
    await api<Schema["PurchaseRequest"]>(
      `/requests/${request.id}/launch`,
      "request",
      { token: buyer, method: "POST" },
    );
    const detail = await api<Schema["RequestDetail"]>(
      `/requests/${request.id}`,
      "request_detail",
      { token: buyer },
    );
    const formaRoom = detail.negotiations.find(
      (room) => room.product_id === "prod-forma",
    );
    const nordRoom = detail.negotiations.find(
      (room) => room.product_id === "prod-nord",
    );
    if (!formaRoom)
      throw new DemoTradingError(
        409,
        "Forma did not match this demo request. Review its recorded match reasons before trying again.",
      );
    await pause(signal);
    if (nordRoom) await act(nord, nordRoom.id, { type: "decline" });
    const terms = {
      unit_price: 9500,
      quantity: 80,
      delivery_date: dateAfter(12),
      deposit_percent: 50,
    };
    await act(forma, formaRoom.id, {
      type: "propose",
      terms,
      purpose: "explanation",
      message:
        "Scripted seller agent: proposing 80 chairs at EUR 95 each, with a 50% deposit.",
    });
    const counter = await act(buyer, formaRoom.id, {
      type: "counter",
      terms: { ...terms, unit_price: 8300, deposit_percent: 30 },
      purpose: "explanation",
      message:
        "Scripted buyer agent: countering at EUR 83 each, with a 30% deposit and the same delivery date.",
    });
    if (!counter.offer_id)
      throw new DemoTradingError(
        503,
        "The counteroffer could not be confirmed. Review the negotiation before trying again.",
      );
    const agreement = await act(forma, formaRoom.id, {
      type: "accept",
      offer_id: counter.offer_id,
    });
    if (agreement.state !== "awaiting_approval")
      throw new DemoTradingError(
        503,
        "The demo stopped before human review. Open the negotiation for its current state.",
      );
    return {
      request_id: request.id,
      room_id: formaRoom.id,
      status: "awaiting_human_approval",
    };
  } finally {
    // Cleanup gets its own short timeout even if the browser disconnected or the run expired.
    await Promise.allSettled(
      agents.map(async (agent) => {
        try {
          if (agent.id)
            await api(`/credentials/${agent.id}`, "credential", {
              token: agent.ownerToken,
              method: "DELETE",
              cleanup: true,
            });
        } finally {
          await api("/auth/logout", "session", {
            token: agent.ownerToken,
            method: "POST",
            cleanup: true,
          });
        }
      }),
    );
  }
}
