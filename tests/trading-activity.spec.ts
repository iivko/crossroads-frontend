import { expect, test } from "@playwright/test";
import { tradingEvents } from "../lib/trading-activity";
import { exampleRoom } from "./fixtures/guidance";
import type { AuditEvent } from "../lib/api";

const buyer = { id: "buyer-workspace", name: "Buyer", role: "buyer" as const };
test("activity uses the recorded role and immutable historical offer, never the current offer", () => {
  const room = exampleRoom();
  room.activity = [
    {
      id: "a1",
      at: "2026-10-10T10:00:00Z",
      role: "seller",
      type: "propose",
      data: { offer_id: "offer-1" },
      run: 1,
    },
  ];
  room.current_offer = {
    ...room.offers[0]!,
    id: "offer-2",
    version: 2,
    terms: { ...room.offers[0]!.terms, total: 90000 },
  };
  const [record] = tradingEvents([room], [], [], buyer);
  expect(record).toMatchObject({
    lane: "partners",
    actor: "Chair seller agent",
    total: 118000,
  });
  expect(record!.detail).toContain("Offer v1");
});
test("action audit duplicates are omitted and incoming request is a separate lifecycle event", () => {
  const room = exampleRoom();
  room.activity = [
    {
      id: "a1",
      at: "2026-10-10T10:00:00Z",
      role: "buyer",
      type: "counter",
      data: {},
      run: 1,
    },
  ];
  const audit: AuditEvent[] = ["counter", "negotiation_opened"].map(
    (type, index) => ({
      id: String(index),
      type,
      resource_id: room.id,
      actor_id: "arbitrary-credential-id",
      data: {},
      at: "2026-10-10T09:00:00Z",
    }),
  );
  const records = tradingEvents([room], audit, [], {
    id: "seller-workspace",
    name: "Seller",
    role: "seller",
  });
  expect(records).toHaveLength(2);
  expect(records[0]).toMatchObject({ actor: "Buyer agent", lane: "partners" });
  expect(records[1]!.title).toBe("A buyer request arrived");
});
test("missing historical offer never borrows a different offer's price", () => {
  const room = exampleRoom();
  room.activity = [
    {
      id: "a1",
      at: "2026-10-10T10:00:00Z",
      role: "buyer",
      type: "counter",
      data: { offer_id: "not-loaded" },
      run: 1,
    },
  ];
  const [record] = tradingEvents([room], [], [], buyer);
  expect(record!.total).toBeUndefined();
  expect(record!.actor).toBe("Your agent");
});
test("unrelated workspace events and private metadata never enter the trading floor", () => {
  const room = exampleRoom();
  const events = [
    {
      id: "e1",
      type: "human_requested_negotiation",
      resource_id: "other-room",
      actor_id: "user",
      at: "2026-10-10T10:00:00Z",
      data: { instruction: "private", role: "buyer" },
    },
  ];
  expect(tradingEvents([room], events, [], buyer)).toEqual([]);
});

test("human guidance notices are identified as business decisions and never duplicated", () => {
  const room = exampleRoom();
  room.activity = [
    {
      id: "guidance-1",
      at: "2026-10-10T10:00:00Z",
      role: "buyer",
      type: "human_requested_negotiation",
      data: { role: "buyer", run: 2 },
      run: 2,
    },
  ];
  const events = [
    {
      id: "guidance-1",
      at: "2026-10-10T10:00:00Z",
      type: "human_requested_negotiation",
      resource_id: room.id,
      actor_id: "human",
      data: { role: "buyer" },
    },
  ];
  const records = tradingEvents([room], events, [], buyer);
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    actor: "Your business",
    title: "Requested another round",
  });
});
