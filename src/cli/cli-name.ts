// CLI-name helpers keep generated examples aligned with the binary the user invoked.
import path from "node:path";

const DEFAULT_CLI_NAME = "openclaw";
const TRUSTCLAW_CLI_NAME = "trustclaw";

const KNOWN_CLI_NAMES = new Set([DEFAULT_CLI_NAME, TRUSTCLAW_CLI_NAME]);
const CLI_PREFIX_RE = /^(?:((?:pnpm|npm|bunx|npx)\s+))?(openclaw|trustclaw)\b/;

/** True when `token` names a supported CLI binary (`openclaw` or `trustclaw`). */
export function isKnownCliBinary(token: string | undefined): boolean {
  if (!token?.trim()) {
    return false;
  }
  const base = path
    .basename(token.trim())
    .replace(/\.(?:cmd|exe)$/iu, "")
    .toLowerCase();
  return KNOWN_CLI_NAMES.has(base);
}

/** Resolve the displayed CLI binary name from argv, falling back to `openclaw`. */
export function resolveCliName(argv: string[] = process.argv): string {
  const argv1 = argv[1];
  if (!argv1) {
    return DEFAULT_CLI_NAME;
  }
  const base = path.basename(argv1).trim();
  if (KNOWN_CLI_NAMES.has(base)) {
    return base;
  }
  return DEFAULT_CLI_NAME;
}

/** Replace a leading `openclaw` command prefix with the active CLI name. */
export function replaceCliName(command: string, cliName = resolveCliName()): string {
  if (!command.trim()) {
    return command;
  }
  if (!CLI_PREFIX_RE.test(command)) {
    return command;
  }
  return command.replace(CLI_PREFIX_RE, (_match, runner: string | undefined) => {
    return `${runner ?? ""}${cliName}`;
  });
}
