import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { syncWorkspaceTemplate } from "../../scripts/lib/trustclaw-workspace-sync.mjs";

describe("trustclaw-workspace-sync", () => {
  it("syncWorkspaceTemplate copies markdown, avatars, and skills", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tc-workspace-sync-"));
    const templateDir = path.join(root, "template");
    const targetDir = path.join(root, "target");
    try {
      mkdirSync(path.join(templateDir, "avatars"), { recursive: true });
      mkdirSync(path.join(templateDir, "skills", "tra-pack-operations"), { recursive: true });
      writeFileSync(path.join(templateDir, "SOUL.md"), "# soul");
      writeFileSync(path.join(templateDir, "avatars", "c3po.png"), "png");
      writeFileSync(
        path.join(templateDir, "skills", "tra-pack-operations", "SKILL.md"),
        "# tra pack ops",
      );

      syncWorkspaceTemplate(templateDir, targetDir);

      expect(readFileSync(path.join(targetDir, "SOUL.md"), "utf8")).toBe("# soul");
      expect(readFileSync(path.join(targetDir, "avatars", "c3po.png"), "utf8")).toBe("png");
      expect(
        readFileSync(path.join(targetDir, "skills", "tra-pack-operations", "SKILL.md"), "utf8"),
      ).toBe("# tra pack ops");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("syncWorkspaceTemplate is a no-op when template dir is missing", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tc-workspace-sync-missing-"));
    try {
      const targetDir = path.join(root, "target");
      syncWorkspaceTemplate(path.join(root, "missing"), targetDir);
      expect(existsSync(targetDir)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
