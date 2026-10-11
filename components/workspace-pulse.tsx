"use client";

import { ArrowRight, ChevronRight } from "lucide-react";
import { human, type Room, type Workspace } from "@/lib/api";

type PulseView = "negotiations" | "approvals" | "activity";

export type WorkspacePulseProps = {
  rooms: Room[];
  workspace: Workspace;
  onOpenRoom: (room: Room) => void;
  onNavigate: (view: PulseView) => void;
};

const groups = [
  {
    id: "agents",
    label: "With agents",
    states: ["negotiating", "needs_revision"],
  },
  { id: "review", label: "Human review", states: ["awaiting_approval"] },
  { id: "ordered", label: "Demo orders recorded", states: ["ordered"] },
  { id: "closed", label: "Closed", states: ["declined", "expired"] },
];

function latestRecordedAt(room: Room) {
  const dates = [
    room.request.created_at,
    ...room.activity.map((entry) => entry.at),
    ...room.offers.map((offer) => offer.created_at),
    ...room.human_guidance.map((entry) => entry.created_at),
  ];
  return Math.max(0, ...dates.map((value) => Date.parse(value) || 0));
}

function roomSummary(room: Room, workspace: Workspace) {
  if (room.state === "awaiting_approval") {
    const approved = room.current_offer?.approvals.some(
      (approval) => approval.workspace_id === workspace.id,
    );
    return {
      label: "Human review",
      tone: "review",
      next: !room.valid
        ? "Review the offer’s outstanding issues"
        : approved
          ? "Your approval is recorded; waiting for the other business"
          : "Your business has an offer to review",
    };
  }
  if (["negotiating", "needs_revision"].includes(room.state)) {
    const actor =
      room.next_role === workspace.role ? "Your" : "The other business’s";
    const claimed = room.agent_status === "claimed";
    return {
      label: claimed ? "Turn claimed" : "Waiting for agent",
      tone: "agents",
      next: claimed
        ? `${actor} agent has claimed the next turn`
        : `${actor} agent can take the next turn`,
    };
  }
  if (room.state === "ordered") {
    return {
      label: "Demo order recorded",
      tone: "ordered",
      next: "Both businesses approved the recorded terms",
    };
  }
  if (room.state === "needs_human_review") {
    return {
      label: "Human input needed",
      tone: "review",
      next: room.human_questions.some(
        (question) => question.status === "pending",
      )
        ? "Your agent has a question for your business"
        : "Open the negotiation to review what is needed",
    };
  }
  return {
    label: human(room.state),
    tone: "closed",
    next: ["declined", "expired", "cancelled"].includes(room.state)
      ? "Review the recorded negotiation history"
      : "Open the negotiation for its current details",
  };
}

export function WorkspacePulse({
  rooms,
  workspace,
  onOpenRoom,
  onNavigate,
}: WorkspacePulseProps) {
  const distribution = groups.map((group) => ({
    ...group,
    count: rooms.filter((room) => group.states.includes(room.state)).length,
  }));
  const knownStates = groups.flatMap((group) => group.states);
  const otherRooms = rooms.filter((room) => !knownStates.includes(room.state));
  if (otherRooms.length) {
    distribution.push({
      id: "other",
      label: "Other states",
      states: [...new Set(otherRooms.map((room) => room.state))],
      count: otherRooms.length,
    });
  }
  const awaitingReview = distribution.find(
    (group) => group.id === "review",
  )!.count;
  const latestRooms = [...rooms]
    .sort((left, right) => latestRecordedAt(right) - latestRecordedAt(left))
    .slice(0, 3);

  return (
    <section className="workspace-pulse" aria-label="Negotiation snapshot">
      <header className="workspace-pulse-heading">
        <h2>Negotiation snapshot</h2>
        <p>Up to 100 recent negotiations</p>
      </header>
      <div className="workspace-pulse-body">
        <div className="pulse-distribution">
          <div className="pulse-column-heading">
            <h3>Where talks stand</h3>
            <span>{rooms.length} total</span>
          </div>
          <p className="pulse-chart-caption">Current state distribution</p>
          <div className="pulse-distribution-bar" aria-hidden="true">
            {distribution
              .filter((group) => group.count > 0)
              .map((group) => (
                <span
                  key={group.id}
                  className={`pulse-segment pulse-tone-${group.id}`}
                  style={{ width: `${(group.count / rooms.length) * 100}%` }}
                />
              ))}
          </div>
          <dl className="pulse-distribution-list">
            {distribution.map((group) => (
              <div key={group.id}>
                <dt>
                  <span
                    className={`pulse-key pulse-tone-${group.id}`}
                    aria-hidden="true"
                  />
                  <span>
                    {group.label}
                    {group.id === "other" && (
                      <small>{group.states.map(human).join(", ")}</small>
                    )}
                  </span>
                </dt>
                <dd>{group.count}</dd>
              </div>
            ))}
          </dl>
          <button
            className="pulse-action"
            type="button"
            onClick={() =>
              onNavigate(awaitingReview ? "approvals" : "negotiations")
            }
          >
            {awaitingReview ? "Open approval queue" : "Explore negotiations"}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="pulse-recent">
          <div className="pulse-column-heading">
            <h3>Latest negotiations</h3>
            <button
              type="button"
              className="pulse-text-action"
              onClick={() => onNavigate("negotiations")}
            >
              View all <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          {latestRooms.length ? (
            <ol className="pulse-room-list">
              {latestRooms.map((room) => {
                const summary = roomSummary(room, workspace);
                return (
                  <li key={room.id}>
                    <button
                      className="pulse-room"
                      type="button"
                      onClick={() => onOpenRoom(room)}
                    >
                      <span className="pulse-room-identity">
                        <span className="pulse-room-title">
                          <strong>{room.request.title}</strong>
                        </span>
                        <span className="pulse-room-supplier">
                          {room.supplier}
                        </span>
                      </span>
                      <span className="pulse-room-progress">
                        <span
                          className={`pulse-room-state pulse-room-state-${summary.tone}`}
                        >
                          {summary.label}
                        </span>
                        <span className="pulse-room-next">{summary.next}</span>
                      </span>
                      <ChevronRight
                        className="pulse-room-chevron"
                        size={20}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="pulse-empty">
              <h4>Your next agreement starts here.</h4>
              <p>
                When a negotiation is recorded for your business, its agent
                activity and next step will appear here.
              </p>
            </div>
          )}
          <div className="pulse-recent-footer">
            <p>Agent status reflects turn claims.</p>
            <button
              type="button"
              className="pulse-text-action"
              onClick={() => onNavigate("activity")}
            >
              View activity <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
