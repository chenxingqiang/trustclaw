import { describe, expect, it } from "vitest";
import { renderAgentGrantHistoryTable } from "./agent-grant-history.js";

describe("renderAgentGrantHistoryTable", () => {
  it("renders scope chips and revoked state", () => {
    const html = renderAgentGrantHistoryTable(
      [
        {
          event_id: "e1",
          audit_trail_id: "grant_abc",
          timestamp: 1_700_000_000,
          agent_pack_id: "glp1-eligibility",
          scopes: ["ptds.chat", "panel.browse"],
          granted: true,
          status: "SUCCESS",
        },
        {
          event_id: "e2",
          audit_trail_id: "grant_def",
          timestamp: 1_700_000_100,
          agent_pack_id: "compliance-auditor",
          scopes: [],
          granted: false,
          status: "BLOCKED",
        },
      ],
      {
        empty: "empty",
        time: "Time",
        agent: "Agent",
        scopes: "Scopes",
        action: "Action",
        granted: "Granted",
        revoked: "Revoked",
        scopeLabels: { "ptds.chat": "Chat" },
        packDisplayName: (id) => id,
      },
    );
    expect(html).toContain("agent-grant-history-table");
    expect(html).toContain("Chat");
    expect(html).toContain("Revoked");
  });

  it("shows empty note when no history", () => {
    const html = renderAgentGrantHistoryTable([], {
      empty: "No history yet",
      time: "Time",
      agent: "Agent",
      scopes: "Scopes",
      action: "Action",
      granted: "Granted",
      revoked: "Revoked",
      scopeLabels: {},
      packDisplayName: (id) => id,
    });
    expect(html).toContain("No history yet");
  });
});
