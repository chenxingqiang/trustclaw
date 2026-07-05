import { z } from "zod";

export const AGENT_PACK_STARTER_QUESTION_COUNT = 3;

export const agentPackStarterQuestionSchema = z
  .object({
    "zh-CN": z.string().min(1),
    en: z.string().min(1),
  })
  .strict();

export type AgentPackStarterQuestion = z.infer<typeof agentPackStarterQuestionSchema>;

export const AGENT_PACK_PIPELINE_STAGES = [
  "TEXT2SQL_GEN",
  "DB_QUERY",
  "RULE_EVAL",
  "AGENT_DECISION",
  "LEDGER_COMMIT",
] as const;

export const agentPackDocumentSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
    version: z.string().min(1),
    displayName: z.object({
      "zh-CN": z.string().min(1),
      en: z.string().min(1),
    }),
    domain: z.array(z.string().min(1)).optional(),
    starterQuestions: z
      .array(agentPackStarterQuestionSchema)
      .length(AGENT_PACK_STARTER_QUESTION_COUNT)
      .optional(),
    openclaw: z
      .object({
        agentId: z.string().min(1).optional(),
        persona: z.string().min(1).optional(),
      })
      .optional(),
    tools: z
      .object({
        read: z.string().min(1),
        write: z.string().min(1).optional(),
      })
      .strict(),
    prompts: z
      .object({
        system: z.string().min(1),
        text2sql: z.string().min(1).optional(),
        personalWrite: z.string().min(1).optional(),
      })
      .strict(),
    data: z
      .object({
        readTables: z.array(z.string().min(1)).min(1),
        writeTables: z.array(z.string().min(1)).optional(),
        snapshotView: z.string().min(1).optional(),
      })
      .strict(),
    rules: z
      .object({
        engine: z.enum(["ast-compliance", "nrdl-table", "none"]),
        activeStandardHint: z.string().min(1).optional(),
        drugIdResolver: z.string().min(1).optional(),
      })
      .strict(),
    pipeline: z
      .object({
        stages: z.array(z.enum(AGENT_PACK_PIPELINE_STAGES)).min(1),
        decisionBuilder: z.enum(["glp1-decision", "pass-through"]),
      })
      .strict(),
    consent: z
      .object({
        read: z.object({ allowAlways: z.boolean() }).strict(),
        write: z.object({ allowAlways: z.boolean() }).strict().optional(),
      })
      .strict(),
    audit: z
      .object({
        businessComponent: z.string().min(1),
        decisionComponent: z.string().min(1),
        ruleEvalComponent: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

export type AgentPackDocument = z.infer<typeof agentPackDocumentSchema>;

export type ResolvedAgentPack = AgentPackDocument & {
  packDir: string;
  packFile: string;
};

export const DEFAULT_AGENT_PACK_ID = "glp1-eligibility";
