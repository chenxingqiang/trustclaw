import { describe, expect, it } from "vitest";
import { isKnownCliBinary, replaceCliName, resolveCliName } from "./cli-name.js";

describe("resolveCliName", () => {
  it("returns trustclaw when invoked via trustclaw.mjs", () => {
    expect(resolveCliName(["node", "/usr/local/bin/trustclaw", "status"])).toBe("trustclaw");
  });

  it("returns openclaw for the canonical binary", () => {
    expect(resolveCliName(["node", "/usr/local/bin/openclaw", "status"])).toBe("openclaw");
  });

  it("falls back to openclaw for unknown entrypoints", () => {
    expect(resolveCliName(["node", "/tmp/custom-runner.mjs", "status"])).toBe("openclaw");
  });
});

describe("replaceCliName", () => {
  it("rewrites openclaw examples to trustclaw when active", () => {
    expect(replaceCliName("openclaw gateway status", "trustclaw")).toBe("trustclaw gateway status");
    expect(replaceCliName("pnpm openclaw doctor", "trustclaw")).toBe("pnpm trustclaw doctor");
  });
});

describe("isKnownCliBinary", () => {
  it("accepts openclaw and trustclaw package runner tokens", () => {
    expect(isKnownCliBinary("openclaw")).toBe(true);
    expect(isKnownCliBinary("trustclaw")).toBe(true);
    expect(isKnownCliBinary("openclaw.cmd")).toBe(true);
    expect(isKnownCliBinary("trustclaw.exe")).toBe(true);
    expect(isKnownCliBinary("codex")).toBe(false);
  });
});
