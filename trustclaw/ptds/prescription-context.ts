import type { DatabaseSync } from "node:sqlite";
import { PTDS_LOCAL_USER_ID } from "./db.js";
import type { PtdsInitRequest } from "./types.js";

export type PrescriptionContextRow = {
  is_first_prescription: number;
  institution_level: number;
  is_specialist_physician: number;
};

export const PRESCRIPTION_CONTEXT_INIT_DEFAULTS: PrescriptionContextRow = {
  is_first_prescription: 1,
  institution_level: 3,
  is_specialist_physician: 1,
};

export function resolvePrescriptionContextFromInit(
  request: PtdsInitRequest,
): PrescriptionContextRow {
  return {
    is_first_prescription:
      request.isFirstPrescription === false
        ? 0
        : PRESCRIPTION_CONTEXT_INIT_DEFAULTS.is_first_prescription,
    institution_level: clampInstitutionLevel(
      request.institutionLevel ?? PRESCRIPTION_CONTEXT_INIT_DEFAULTS.institution_level,
    ),
    is_specialist_physician:
      request.isSpecialistPhysician === false
        ? 0
        : PRESCRIPTION_CONTEXT_INIT_DEFAULTS.is_specialist_physician,
  };
}

function clampInstitutionLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return PRESCRIPTION_CONTEXT_INIT_DEFAULTS.institution_level;
  }
  return Math.min(3, Math.max(1, Math.round(level)));
}

export function upsertPrescriptionContext(
  db: DatabaseSync,
  row: PrescriptionContextRow,
  userId = PTDS_LOCAL_USER_ID,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO prescription_context (
       user_id, is_first_prescription, institution_level, is_specialist_physician, updated_at
     ) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       is_first_prescription = excluded.is_first_prescription,
       institution_level = excluded.institution_level,
       is_specialist_physician = excluded.is_specialist_physician,
       updated_at = excluded.updated_at`,
  ).run(userId, row.is_first_prescription, row.institution_level, row.is_specialist_physician, now);
}

export function readPrescriptionContext(
  db: DatabaseSync,
  userId = PTDS_LOCAL_USER_ID,
): PrescriptionContextRow {
  const row = db
    .prepare(
      `SELECT is_first_prescription, institution_level, is_specialist_physician
       FROM prescription_context WHERE user_id = ? LIMIT 1`,
    )
    .get(userId) as PrescriptionContextRow | undefined;
  return row ?? { ...PRESCRIPTION_CONTEXT_INIT_DEFAULTS };
}
