import {
  human,
  type AuditEvent,
  type Order,
  type Room,
  type Workspace,
} from "./api";

export type TradingEvent = {
  id: string;
  at: string;
  lane: "yours" | "partners" | "market" | "orders";
  actor: string;
  title: string;
  detail: string;
  room: Room;
  total?: number;
};

const actions: Record<string, string> = {
  human_requested_negotiation: "Requested another round",
  business_brief_updated: "Updated the business brief",
  propose: "Proposed an offer",
  counter: "Made a counteroffer",
  revise: "Revised the terms",
  accept: "Accepted the proposed terms",
  decline: "Declined the negotiation",
  message: "Sent a message",
  request_clarification: "Asked for clarification",
  answer_clarification: "Answered a question",
  request_human_review: "Requested human input",
};

/** Render only participant-visible records; never infer ownership from credential IDs. */
export function tradingEvents(
  rooms: Room[],
  events: AuditEvent[],
  orders: Order[],
  workspace: Workspace,
): TradingEvent[] {
  const records: TradingEvent[] = rooms.flatMap((room) =>
    room.activity.map((action) => {
      const own = action.role === workspace.role;
      const humanNotice = [
        "human_requested_negotiation",
        "business_brief_updated",
      ].includes(action.type);
      const offer = room.offers.find(
        (candidate) => candidate.id === action.data.offer_id,
      );
      return {
        id: `action:${action.id}`,
        at: action.at,
        room,
        lane: own ? ("yours" as const) : ("partners" as const),
        actor: humanNotice
          ? own
            ? "Your business"
            : "Trading partner"
          : own
            ? "Your agent"
            : action.role === "seller"
              ? `${room.supplier} agent`
              : "Buyer agent",
        title: actions[action.type] || human(action.type),
        detail: offer
          ? `${offer.terms.quantity} units · ${offer.terms.deposit_percent}% deposit · Offer v${offer.version}`
          : room.request.title,
        total: offer?.terms.total,
      };
    }),
  );
  // Action audit rows duplicate Room.activity; add only separate lifecycle events.
  for (const event of events) {
    const room = rooms.find((candidate) => candidate.id === event.resource_id);
    if (!room || records.some((record) => record.id === `action:${event.id}`))
      continue;
    const role = event.data.role;
    if (event.type === "negotiation_opened")
      records.push({
        id: `event:${event.id}`,
        at: event.at,
        room,
        lane: "market",
        actor: "New opportunity",
        title:
          workspace.role === "seller"
            ? "A buyer request arrived"
            : `${room.supplier} matched your request`,
        detail: `${room.request.quantity} units · ${room.request.destination}`,
      });
    if (["human_approved", "human_requested_negotiation"].includes(event.type))
      records.push({
        id: `event:${event.id}`,
        at: event.at,
        room,
        lane:
          role === workspace.role
            ? "yours"
            : role === "buyer" || role === "seller"
              ? "partners"
              : "market",
        actor: role === workspace.role ? "Your business" : "Trading partner",
        title:
          event.type === "human_approved"
            ? "Approved the exact offer"
            : "Requested another round",
        detail: room.request.title,
      });
  }
  for (const order of orders) {
    const room = rooms.find((candidate) => candidate.id === order.room_id);
    if (room)
      records.push({
        id: `order:${order.id}`,
        at: order.created_at,
        room,
        lane: "orders",
        actor: "Both businesses",
        title: "Demo order recorded",
        detail: `${order.offer.terms.quantity} units · Both approvals received`,
        total: order.offer.terms.total,
      });
  }
  return records.sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id),
  );
}
