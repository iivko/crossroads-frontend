"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeftRight,
  Inbox,
  CheckCheck,
  Pause,
  Radio,
  Play,
} from "lucide-react";
import {
  money,
  type AuditEvent,
  type Order,
  type Room,
  type Workspace,
} from "@/lib/api";
import { tradingEvents, type TradingEvent } from "@/lib/trading-activity";

type Props = {
  rooms: Room[];
  events: AuditEvent[];
  orders: Order[];
  workspace: Workspace;
  synced: Date | null;
  stale: boolean;
  onOpenRoom: (room: Room) => void;
  onConnect: () => void;
  expanded?: boolean;
};
const filters = [
  { id: "all", label: "All activity" },
  { id: "yours", label: "Your business" },
  { id: "partners", label: "Trading partners" },
  { id: "orders", label: "Deals recorded" },
] as const;

function when(at: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(at)) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(at).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export function LiveTradingBoard({
  rooms,
  events,
  orders,
  workspace,
  synced,
  stale,
  onOpenRoom,
  onConnect,
  expanded = false,
}: Props) {
  const records = useMemo(
    () => tradingEvents(rooms, events, orders, workspace),
    [rooms, events, orders, workspace],
  );
  const [filter, setFilter] = useState<string>("all");
  const [paused, setPaused] = useState<TradingEvent[] | null>(null);
  const known = useRef<Set<string> | null>(null);
  const [arrivals, setArrivals] = useState<Set<string>>(new Set());
  useEffect(() => {
    const next = new Set(records.map((record) => record.id));
    if (known.current)
      setArrivals(new Set([...next].filter((id) => !known.current!.has(id))));
    known.current = next;
  }, [records]);
  const showing = (paused || records)
    .filter((record) => filter === "all" || record.lane === filter)
    .slice(0, expanded ? 60 : 7);
  const queue = rooms.filter((room) =>
    ["negotiating", "needs_revision"].includes(room.state),
  );
  const own = queue.filter((room) => room.next_role === workspace.role);
  const partner = queue.filter((room) => room.next_role !== workspace.role);
  const now = synced?.getTime() || Date.now();
  return (
    <section className="trading-board" aria-label="Live trading activity">
      <div className="trading-heading">
        <div>
          <h2>Your market, in motion.</h2>
          <p>Activity involving your business and its trading partners.</p>
        </div>
        <div className={`trading-sync${stale ? " is-stale" : ""}`}>
          <span className="live-dot" />
          {stale ? "Updates interrupted" : "Updates every 5 seconds"}
          <small>
            {synced
              ? `Last received ${synced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Loading recorded activity"}
          </small>
        </div>
      </div>
      <div className="trading-body">
        <div className="trading-stream">
          <div className="trading-controls">
            <div
              className="trading-filters"
              aria-label="Filter trading activity"
            >
              {filters.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={
                paused ? "Resume activity feed" : "Pause activity feed"
              }
              onClick={() => setPaused(paused ? null : records)}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          </div>
          {paused && (
            <p className="trading-paused" role="status">
              Feed paused for reading. Your workspace continues to update.
            </p>
          )}
          <ol className="trading-events">
            {showing.map((record) => (
              <li
                key={record.id}
                className={`${record.lane === "orders" ? "deal-recorded " : ""}${!paused && arrivals.has(record.id) ? "event-arrived" : ""}`}
              >
                <button type="button" onClick={() => onOpenRoom(record.room)}>
                  <span
                    className={`trading-event-mark lane-${record.lane}`}
                    aria-hidden="true"
                  >
                    {record.lane === "orders" ? (
                      <CheckCheck size={18} />
                    ) : record.lane === "market" ? (
                      <Inbox size={18} />
                    ) : (
                      <ArrowLeftRight size={18} />
                    )}
                  </span>
                  <span className="trading-event-copy">
                    <span className="trading-event-actor">
                      {record.actor}
                      <time
                        dateTime={record.at}
                        title={new Date(record.at).toLocaleString()}
                      >
                        {when(record.at, now)}
                      </time>
                    </span>
                    <strong>{record.title}</strong>
                    <span className="trading-event-context">
                      {record.room.product.name} · {record.detail}
                    </span>
                  </span>
                  <span className="trading-event-value">
                    {record.total !== undefined && <b>{money(record.total)}</b>}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {!showing.length && (
            <div className="trading-empty">
              <Radio size={24} />
              <strong>
                {filter === "orders"
                  ? "Your next agreement belongs here."
                  : "Ready for the next move."}
              </strong>
              <p>
                {filter === "orders"
                  ? "A deal appears when both businesses approve the same offer."
                  : "Recorded offers, replies and requests appear as your agents work."}
              </p>
            </div>
          )}
          <p className="trading-scope">
            {workspace.role === "seller"
              ? "Buyer requests are visible when they match your products. "
              : "Only your business’s negotiations are shown. "}
            Demo orders are recorded agreements, not payments.
          </p>
        </div>
        <aside className="agent-queue" aria-label="Agent turn queue">
          <div className="queue-title">
            <h3>Next moves</h3>
            <span>{queue.length} open</span>
          </div>
          <div className="queue-counts">
            <div>
              <strong>{own.length}</strong>
              <span>With your agent</span>
            </div>
            <ArrowLeftRight size={18} aria-hidden="true" />
            <div>
              <strong>{partner.length}</strong>
              <span>With partners</span>
            </div>
          </div>
          <p className="queue-caption">Who can take the next turn</p>
          <div className="queue-rooms">
            {[...own, ...partner].slice(0, 3).map((room) => (
              <button
                type="button"
                key={room.id}
                onClick={() => onOpenRoom(room)}
              >
                <span className="queue-room-heading">
                  <strong>{room.product.name}</strong>
                  <ArrowRight size={16} />
                </span>
                <span>
                  {room.next_role === workspace.role
                    ? "Your agent"
                    : workspace.role === "buyer"
                      ? room.supplier
                      : "Buyer agent"}{" "}
                  ·{" "}
                  {room.agent_status === "claimed"
                    ? "Turn claimed"
                    : "Ready to act"}
                </span>
                <small>
                  {room.request.quantity} units · {room.request.destination}
                </small>
              </button>
            ))}
          </div>
          {!queue.length && (
            <p className="queue-idle">
              No agent turns are waiting. New requests and revised offers will
              appear here.
            </p>
          )}
          <button type="button" className="queue-connect" onClick={onConnect}>
            Connect your agent <ArrowRight size={16} />
          </button>
          <small className="queue-note">
            A claimed turn is a temporary lease. Agents run through your
            connected client.
          </small>
        </aside>
      </div>
    </section>
  );
}
