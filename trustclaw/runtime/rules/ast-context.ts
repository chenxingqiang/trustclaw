import type { DatabaseSync } from "node:sqlite";
import { bootstrapPtdsDatabase, resolvePrimaryUserId } from "../../ptds/db.js";
import { resolvePtdsDbPath, type PtdsPathOverrides } from "../../ptds/paths.js";
import { readPrescriptionContext } from "../../ptds/prescription-context.js";

/** Demo fallback when prescription_context row is absent (pre-init DB probes). */
export type PrescriptionContextDefaults = {
  is_first_prescription: number;
  institution_level: number;
  is_specialist_physician: number;
};

const DEFAULT_PRESCRIPTION_CONTEXT: PrescriptionContextDefaults = {
  is_first_prescription: 1,
  institution_level: 3,
  is_specialist_physician: 1,
};

function ageFromBirthDate(birthDate: string): number {
  const year = Number.parseInt(birthDate.slice(0, 4), 10);
  if (!Number.isFinite(year)) {
    return 0;
  }
  return Math.max(0, new Date().getFullYear() - year);
}

function readNested(map: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = map;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function parseFieldPath(field: string): string[] {
  return field
    .replace(/\['([^']+)'\]/g, ".$1")
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
}

export function resolveComplianceFieldValue(
  context: Record<string, unknown>,
  field: string,
): unknown {
  return readNested(context, parseFieldPath(field));
}

export function buildComplianceEvalContext(
  db: DatabaseSync,
  prescriptionDefaults: PrescriptionContextDefaults = DEFAULT_PRESCRIPTION_CONTEXT,
): Record<string, unknown> {
  const userId = resolvePrimaryUserId(db);
  const prescriptionRow = userId ? readPrescriptionContext(db, userId) : prescriptionDefaults;
  if (!userId) {
    return { prescription_context: prescriptionRow };
  }

  const profile = db
    .prepare(`SELECT birth_date FROM user_profile WHERE user_id = ? LIMIT 1`)
    .get(userId) as { birth_date: string } | undefined;

  const anthropometrics = db
    .prepare(`SELECT bmi FROM body_anthropometrics ORDER BY body_id DESC LIMIT 1`)
    .get() as { bmi: number } | undefined;

  const hba1cRow = db
    .prepare(
      `SELECT test_value FROM lab_test_results
       WHERE test_code = 'HbA1c' ORDER BY test_id DESC LIMIT 1`,
    )
    .get() as { test_value: number } | undefined;

  const diagnoses = db
    .prepare(`SELECT icd10_code, is_active FROM clinical_diagnoses`)
    .all() as Array<{ icd10_code: string; is_active: number }>;

  const medications = db
    .prepare(`SELECT atc_code, termination_reason FROM medication_history`)
    .all() as Array<{ atc_code: string; termination_reason: string | null }>;

  const icd10Map: Record<string, { is_active: number }> = {};
  for (const row of diagnoses) {
    icd10Map[row.icd10_code] = { is_active: row.is_active };
  }

  const cardioCodes = new Set(["I25", "I21", "I63", "I70", "I51"]);
  const hasCardioComorbidity = diagnoses.some(
    (row) => row.is_active === 1 && cardioCodes.has(row.icd10_code),
  )
    ? 1
    : 0;

  const atcMap: Record<string, { termination_reason: string | null; is_used: number }> = {};
  for (const row of medications) {
    atcMap[row.atc_code] = {
      termination_reason: row.termination_reason,
      is_used: 1,
    };
    const prefix = row.atc_code.slice(0, 4);
    if (!atcMap[prefix]) {
      atcMap[prefix] = { termination_reason: row.termination_reason, is_used: 1 };
    }
    const classPrefix = row.atc_code.slice(0, 3);
    if (!atcMap[classPrefix]) {
      atcMap[classPrefix] = { termination_reason: row.termination_reason, is_used: 1 };
    }
  }

  return {
    user_profile: {
      age: profile ? ageFromBirthDate(profile.birth_date) : 0,
    },
    body_measurement: {
      latest: {
        bmi: anthropometrics?.bmi ?? 0,
      },
    },
    clinical_diagnoses: {
      icd10: icd10Map,
      icd10_group: {
        CARDIO_COMORBIDITY: { is_active: hasCardioComorbidity },
      },
    },
    medication_history: {
      atc_code: atcMap,
    },
    lab_test_results: {
      latest: {
        HbA1c: { test_value: hba1cRow?.test_value ?? 0 },
      },
    },
    prescription_context: prescriptionRow,
  };
}

export function buildComplianceEvalContextFromDb(
  dbPathOrOverrides?: string | PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolvePtdsDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolvePtdsDbPath(dbPathOrOverrides, env);
  const db = bootstrapPtdsDatabase(dbPath);
  try {
    return buildComplianceEvalContext(db);
  } finally {
    db.close();
  }
}
