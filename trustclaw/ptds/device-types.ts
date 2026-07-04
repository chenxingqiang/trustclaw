import { z } from "zod";

export const deviceImportPreviewRequestSchema = z
  .object({
    package: z.unknown().optional(),
    url: z.string().trim().min(1).optional(),
    deviceHint: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .refine((body) => body.package !== undefined || body.url !== undefined, {
    message: "Provide package or url.",
  });

export const deviceImportExecuteRequestSchema = z
  .object({
    consentGranted: z.boolean(),
    sessionId: z.string().trim().min(1),
    agentPackId: z.string().trim().min(1).optional(),
    sourceLabel: z.string().trim().min(1).optional(),
    package: z.unknown().optional(),
    url: z.string().trim().min(1).optional(),
    deviceHint: z.string().trim().min(1).max(120).optional(),
    sql_statements: z.array(z.string().trim().min(1)).min(1),
    sql_hash: z.string().trim().min(16),
  })
  .strict()
  .refine((body) => body.package !== undefined || body.url !== undefined, {
    message: "Provide package or url.",
  });

export type DeviceImportPreviewRequest = z.infer<typeof deviceImportPreviewRequestSchema>;
export type DeviceImportExecuteRequest = z.infer<typeof deviceImportExecuteRequestSchema>;

export type DeviceImportPreviewResult = {
  status: "success" | "error";
  message: string;
  sql_statements?: string[];
  sql_hash?: string;
  statement_count?: number;
  tables?: string[];
  duration_ms?: number;
  payload_bytes?: number;
};

export type DeviceImportResult = {
  status: "success" | "error";
  message: string;
  rows_affected?: number;
  tables?: string[];
  statement_count?: number;
  sql_hash?: string;
};
