import { describe, expect, it, vi } from "vitest";
import {
  buildBrowseUrl,
  buildControlUiChatSrc,
  callJson,
  createApiClient,
  isAgentChatError,
  resolveApiBaseUrl,
  resolveGatewayControlUiOrigin,
  type AgentChatResponse,
} from "./api.js";

describe("trustclaw/ui api client", () => {
  it("buildBrowseUrl encodes table and clamps limit to integer", () => {
    expect(buildBrowseUrl("http://x", "body_anthropometrics")).toBe(
      "/api/tra/browse?table=body_anthropometrics",
    );
    expect(buildBrowseUrl("http://x", "lab_test_results", 42.9)).toBe(
      "/api/tra/browse?table=lab_test_results&limit=42",
    );
  });

  it("buildBrowseUrl omits limit when undefined or non-finite", () => {
    expect(buildBrowseUrl("http://x", "t")).toBe("/api/tra/browse?table=t");
    expect(buildBrowseUrl("http://x", "t", Number.NaN)).toBe("/api/tra/browse?table=t");
  });

  it("resolveApiBaseUrl always uses same-origin relative API paths", () => {
    expect(resolveApiBaseUrl({ VITE_GATEWAY_URL: "http://gw/" }, { origin: "http://x" })).toBe("");
    expect(resolveApiBaseUrl(undefined, { origin: "http://x" })).toBe("");
  });

  it("resolveGatewayControlUiOrigin and buildControlUiChatSrc target gateway chat", () => {
    expect(
      resolveGatewayControlUiOrigin({ VITE_GATEWAY_URL: "http://gw/" }, { origin: "http://x" }),
    ).toBe("http://gw");
    expect(buildControlUiChatSrc(undefined, { origin: "http://ui" })).toBe("http://ui/chat");
    expect(
      buildControlUiChatSrc({ VITE_GATEWAY_URL: "http://gw" }, { origin: "http://ui" }, "/ui"),
    ).toBe("http://gw/ui/chat");
  });

  it("callJson uses relative path when baseUrl is empty", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    await callJson(fetchImpl as unknown as typeof fetch, "", "/api/tra/status");
    expect(fetchImpl.mock.calls[0]![0]).toBe("/api/tra/status");
  });

  it("callJson posts JSON with content-type header and parses response", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    const result = await callJson<{ ok: number }>(
      fetchImpl as unknown as typeof fetch,
      "http://host/",
      "/api/tra/init",
      { method: "POST", body: JSON.stringify({ a: 1 }) },
    );
    expect(result).toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("http://host/api/tra/init");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
  });

  it("callJson wraps non-JSON body with a descriptive error", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>oops</html>", { status: 500 }));
    await expect(
      callJson(fetchImpl as unknown as typeof fetch, "http://host", "/api/tra/status"),
    ).rejects.toThrow(/Non-JSON response from \/api\/tra\/status/);
  });

  it("createApiClient routes methods to the frozen endpoints", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/tra/status")) {
        return new Response(
          JSON.stringify({ status: "success", mounted: true, db_file: "x.db", snapshot: {} }),
        );
      }
      if (url.includes("/api/tra/browse?table=body_anthropometrics")) {
        return new Response(
          JSON.stringify({ status: "success", table: "body_anthropometrics", rows: [] }),
        );
      }
      if (url.endsWith("/api/agent/chat")) {
        return new Response(
          JSON.stringify({
            session_id: "sess_1",
            user_query: "?",
            pipeline_stages: {},
            audit_trail_id: "aud_1",
          }),
        );
      }
      return new Response("{}");
    });
    const client = createApiClient("http://host", fetchImpl as unknown as typeof fetch);
    await client.status();
    await client.browse("body_anthropometrics");
    const chat = await client.chat({ session_id: "sess_1", message: "hi" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    // The chat happy path returns Runtime Context (no top-level status field).
    expect(isAgentChatError(chat as AgentChatResponse)).toBe(false);
  });

  it("isAgentChatError distinguishes Runtime Context from error envelopes", () => {
    const okResponse = {
      session_id: "s",
      user_query: "q",
      pipeline_stages: {},
      audit_trail_id: "aud_1",
    };
    const errResponse = { status: "security_blocked" as const, message: "blocked" };
    expect(isAgentChatError(okResponse as unknown as AgentChatResponse)).toBe(false);
    expect(isAgentChatError(errResponse)).toBe(true);
  });
});
