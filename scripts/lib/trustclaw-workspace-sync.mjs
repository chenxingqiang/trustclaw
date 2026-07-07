import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

/** Sync OpenClaw workspace markdown, avatars, and skills from repo templates into state dir. */
export function syncWorkspaceTemplate(templateDir, targetDir) {
  if (!existsSync(templateDir)) {
    return;
  }
  mkdirSync(targetDir, { recursive: true });
  for (const name of ["SOUL.md", "IDENTITY.md", "AGENTS.md"]) {
    const src = path.join(templateDir, name);
    if (existsSync(src)) {
      cpSync(src, path.join(targetDir, name), { force: true });
    }
  }
  const avatarSrcDir = path.join(templateDir, "avatars");
  if (existsSync(avatarSrcDir)) {
    cpSync(avatarSrcDir, path.join(targetDir, "avatars"), { force: true, recursive: true });
  }
  const skillsSrcDir = path.join(templateDir, "skills");
  if (existsSync(skillsSrcDir)) {
    cpSync(skillsSrcDir, path.join(targetDir, "skills"), { force: true, recursive: true });
  }
}
