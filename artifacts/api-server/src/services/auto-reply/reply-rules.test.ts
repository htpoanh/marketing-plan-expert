import { describe, it, expect } from "vitest";
import { decideReviewAction, decideCommentAction } from "./reply-rules";

describe("decideReviewAction", () => {
  it("escalates ratings at or below the threshold", () => {
    expect(decideReviewAction({ rating: 1, escalateThreshold: 2 }).action).toBe("escalate");
    expect(decideReviewAction({ rating: 2, escalateThreshold: 2 }).action).toBe("escalate");
  });

  it("auto-sends 5★ without an invite", () => {
    const d = decideReviewAction({ rating: 5, escalateThreshold: 2 });
    expect(d.action).toBe("auto_send");
    expect(d.addInvite).toBe(false);
  });

  it("auto-sends 3-4★ with a subtle invite", () => {
    expect(decideReviewAction({ rating: 3, escalateThreshold: 2 })).toMatchObject({
      action: "auto_send",
      addInvite: true,
    });
    expect(decideReviewAction({ rating: 4, escalateThreshold: 2 }).addInvite).toBe(true);
  });

  it("respects a custom threshold", () => {
    expect(decideReviewAction({ rating: 3, escalateThreshold: 3 }).action).toBe("escalate");
  });
});

describe("decideCommentAction", () => {
  it("always escalates complaints regardless of platform toggle", () => {
    const d = decideCommentAction({ intent: "complaint", platformEnabled: true });
    expect(d.action).toBe("escalate");
    expect(d.resultingStatus).toBe("escalated");
  });

  it("auto-sends compliments publicly when enabled", () => {
    const d = decideCommentAction({ intent: "compliment", platformEnabled: true });
    expect(d.action).toBe("auto_send");
    expect(d.replyMode).toBe("public");
  });

  it("auto-sends booking/price privately (DM) when enabled", () => {
    expect(decideCommentAction({ intent: "booking", platformEnabled: true })).toMatchObject({
      action: "auto_send",
      replyMode: "private",
    });
    expect(decideCommentAction({ intent: "price", platformEnabled: true }).replyMode).toBe("private");
  });

  it("queues (no auto-send) when the platform is disabled", () => {
    const d = decideCommentAction({ intent: "compliment", platformEnabled: false });
    expect(d.action).toBe("queue");
    expect(d.resultingStatus).toBe("pending");
  });

  it("queues 'other' intent for human review", () => {
    expect(decideCommentAction({ intent: "other", platformEnabled: true }).action).toBe("queue");
  });
});
