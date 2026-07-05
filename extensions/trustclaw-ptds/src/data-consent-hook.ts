import { hasAgentDomainGrant } from "../../../trustclaw/ptds/agent-domain-grants.js";
import type { TrustclawPluginConfig } from "../../../trustclaw/ptds/config.js";
import { resolveTrustclawPaths } from "../../../trustclaw/ptds/config.js";
import { recordPtdsConsentAudit } from "../../../trustclaw/ptds/consent-audit.js";
import {
  grantPtdsDataAccess,
  hasPtdsDataAccessGrant,
} from "../../../trustclaw/ptds/consent-store.js";
import {
  buildPtdsHealthProfileSummary,
  formatPrivateDataFieldLabels,
} from "../../../trustclaw/ptds/profile-summary.js";
import { resolveBoundAgentPack } from "../../../trustclaw/runtime/agent-pack/index.js";
import {
  TRUSTCLAW_PTDS_QUERY_TOOL,
  TRUSTCLAW_PTDS_WRITE_TOOL,
} from "../../../trustclaw/runtime/constants.js";

const CONSENT_TITLE = "访问个人健康数据 / Access personal health data";
const WRITE_CONSENT_TITLE = "写入个人健康数据 / Write personal health data";

type PtdsConsentResolution = "allow-once" | "allow-always" | "deny" | "timeout" | "cancelled";

function readQuestion(params: Record<string, unknown>): string {
  return typeof params.message === "string" ? params.message.trim() : "";
}

function resolveSessionKey(sessionKey?: string, sessionId?: string): string {
  return sessionKey?.trim() || sessionId?.trim() || "default";
}

function truncateDescription(text: string, max = 256): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

export function buildPtdsDataConsentDescription(
  question: string,
  fieldLabels: string[],
  purposeLabel = "GLP-1 用药判断与医保报销 eligibility 分析",
): string {
  const preview = question.length > 80 ? `${question.slice(0, 77)}…` : question;
  const fields = fieldLabels.join("、");
  return truncateDescription(
    `将读取本地 PTDS 私人数据：${fields}。用途：${purposeLabel}（含审计）。问题：${preview}`,
  );
}

function resolvePackForHook(
  pluginConfig: TrustclawPluginConfig | undefined,
  sessionKey: string,
  openclawAgentId?: string,
) {
  return resolveBoundAgentPack({
    sessionKey,
    openclawAgentId,
    pluginConfig,
  }).pack;
}

export function createTrustclawPtdsDataConsentHook(
  pluginConfig: TrustclawPluginConfig | undefined,
) {
  return async (
    event: { toolName: string; params: Record<string, unknown> },
    ctx: { sessionKey?: string; sessionId?: string; agentId?: string },
  ) => {
    if (
      event.toolName !== TRUSTCLAW_PTDS_QUERY_TOOL &&
      event.toolName !== TRUSTCLAW_PTDS_WRITE_TOOL
    ) {
      return;
    }

    const paths = resolveTrustclawPaths(pluginConfig);
    const pathOverrides = { dbPath: paths.dbPath, auditDir: paths.auditDir };
    const sessionKey = resolveSessionKey(ctx.sessionKey, ctx.sessionId);
    const question = readQuestion(event.params);
    const profile = buildPtdsHealthProfileSummary({ dbPath: paths.dbPath });
    const pack = resolvePackForHook(pluginConfig, sessionKey, ctx.agentId);

    if (!profile.mounted) {
      return {
        block: true,
        blockReason:
          "Trust runtime is not mounted. Ask the user to initialize personal data in Panel A first.",
      };
    }

    const requiredScope = event.toolName === TRUSTCLAW_PTDS_WRITE_TOOL ? "ptds.write" : "ptds.chat";
    if (!hasAgentDomainGrant(pack.id, requiredScope, pathOverrides)) {
      return {
        block: true,
        blockReason: `Domain agent "${pack.id}" lacks user grant for ${requiredScope}. Grant permissions in Panel C first.`,
      };
    }

    if (event.toolName === TRUSTCLAW_PTDS_WRITE_TOOL) {
      if (!pack.tools.write) {
        return {
          block: true,
          blockReason: `Agent pack "${pack.id}" does not allow PTDS writes.`,
        };
      }
      const preview = truncateDescription(
        question.length > 0
          ? `将用 Text2SQL 生成 INSERT 并写入本地 PTDS（${pack.displayName["zh-CN"]}）。请求：${question}`
          : `将用 Text2SQL 生成 INSERT 并写入本地 PTDS（${pack.displayName["zh-CN"]}）。`,
      );
      const writeAllowAlways = pack.consent.write?.allowAlways === true;
      return {
        requireApproval: {
          title: WRITE_CONSENT_TITLE,
          description: preview,
          severity: "warning" as const,
          allowedDecisions: writeAllowAlways
            ? (["allow-once", "allow-always", "deny"] as const)
            : (["allow-once", "deny"] as const),
          timeoutMs: 300_000,
          timeoutBehavior: "deny" as const,
          pluginId: "trustclaw-ptds",
          onResolution(decision: PtdsConsentResolution) {
            const granted = decision === "allow-once" || decision === "allow-always";
            recordPtdsConsentAudit({
              sessionId: sessionKey,
              agentPackId: pack.id,
              question,
              privateDataFields: profile.private_data_fields,
              decision,
              granted,
              auditDir: paths.auditDir,
            });
          },
        },
      };
    }

    if (!pack.consent.read.allowAlways) {
      const fieldLabels = formatPrivateDataFieldLabels(profile.private_data_fields, "zh-CN");
      const description = buildPtdsDataConsentDescription(
        question,
        fieldLabels,
        pack.displayName["zh-CN"],
      );
      return {
        requireApproval: {
          title: CONSENT_TITLE,
          description,
          severity: "warning" as const,
          allowedDecisions: ["allow-once", "deny"] as const,
          timeoutMs: 300_000,
          timeoutBehavior: "deny" as const,
          pluginId: "trustclaw-ptds",
          onResolution(decision: PtdsConsentResolution) {
            const granted = decision === "allow-once";
            recordPtdsConsentAudit({
              sessionId: sessionKey,
              agentPackId: pack.id,
              question,
              privateDataFields: profile.private_data_fields,
              decision,
              granted,
              auditDir: paths.auditDir,
            });
          },
        },
      };
    }

    if (hasPtdsDataAccessGrant(sessionKey, pack.id, pathOverrides)) {
      return;
    }

    const fieldLabels = formatPrivateDataFieldLabels(profile.private_data_fields, "zh-CN");
    const description = buildPtdsDataConsentDescription(
      question,
      fieldLabels,
      pack.displayName["zh-CN"],
    );

    return {
      requireApproval: {
        title: CONSENT_TITLE,
        description,
        severity: "warning" as const,
        allowedDecisions: ["allow-once", "allow-always", "deny"] as const,
        timeoutMs: 300_000,
        timeoutBehavior: "deny" as const,
        pluginId: "trustclaw-ptds",
        onResolution(decision: PtdsConsentResolution) {
          const granted = decision === "allow-once" || decision === "allow-always";
          recordPtdsConsentAudit({
            sessionId: sessionKey,
            agentPackId: pack.id,
            question,
            privateDataFields: profile.private_data_fields,
            decision,
            granted,
            auditDir: paths.auditDir,
          });
          if (decision === "allow-always") {
            grantPtdsDataAccess(sessionKey, pack.id, "allow-always", pathOverrides);
          }
        },
      },
    };
  };
}
