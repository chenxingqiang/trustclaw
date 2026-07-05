import type { DatabaseSync } from "node:sqlite";
import { bootstrapPtdsDatabase, PTDS_LOCAL_USER_ID } from "./db.js";
import { resolvePtdsDbPath, type PtdsPathOverrides } from "./paths.js";
import {
  resolvePrescriptionContextFromInit,
  upsertPrescriptionContext,
} from "./prescription-context.js";
import { PTDS_INIT_DEFAULTS, type PtdsInitRequest, type PtdsInitResult } from "./types.js";

function clearPtdsPersonalData(db: DatabaseSync): void {
  db.prepare("DELETE FROM clinical_diagnoses").run();
  db.prepare("DELETE FROM medication_history").run();
  db.prepare("DELETE FROM lab_test_results").run();
  db.prepare("DELETE FROM body_anthropometrics").run();
  db.prepare("DELETE FROM prescription_context WHERE user_id = ?").run(PTDS_LOCAL_USER_ID);
  db.prepare("DELETE FROM user_profile WHERE user_id = ?").run(PTDS_LOCAL_USER_ID);
}

function birthDateFromAge(age: number): string {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

function insertDiagnosis(db: DatabaseSync, icd10Code: string, diagnosisName: string): void {
  db.prepare(
    `INSERT INTO clinical_diagnoses (
       icd10_code, diagnosis_name, diagnosed_at, source_id, is_active, provenance_level
     ) VALUES (?, ?, date('now'), 'PATIENT_SELF_REPORT', 1, 1)`,
  ).run(icd10Code, diagnosisName);
}

function insertIneffectiveMedication(db: DatabaseSync, drugName: string, atcCode: string): void {
  db.prepare(
    `INSERT INTO medication_history (
       drug_name, atc_code, start_date, end_date, termination_reason, source_id, provenance_level
     ) VALUES (?, ?, date('now', '-180 days'), date('now'), 'INEFFECTIVE', 'PATIENT_SELF_REPORT', 1)`,
  ).run(drugName, atcCode);
}

export function applyPtdsInitRequest(db: DatabaseSync, request: PtdsInitRequest): number {
  clearPtdsPersonalData(db);

  const name = request.patientName?.trim() || PTDS_INIT_DEFAULTS.patientName;
  const heightM = request.height / 100;
  const biologicalSex = request.gender === "女" ? 2 : 1;
  const now = new Date().toISOString();
  let inserted = 0;

  db.prepare(
    `INSERT INTO user_profile (user_id, name, birth_date, biological_sex)
     VALUES (?, ?, ?, ?)`,
  ).run(PTDS_LOCAL_USER_ID, name, birthDateFromAge(request.age), biologicalSex);
  inserted += 1;

  db.prepare(
    `INSERT INTO body_anthropometrics (
       recorded_at, height_m, weight_kg, source_id, provenance_level, recorder_user_id
     ) VALUES (?, ?, ?, 'PATIENT_SELF_REPORT', 1, ?)`,
  ).run(now, heightM, request.weight, PTDS_LOCAL_USER_ID);
  inserted += 1;

  db.prepare(
    `INSERT INTO lab_test_results (
       recorded_at, test_code, test_value, test_unit,
       reference_range_low, reference_range_high, clinical_status,
       source_id, provenance_level
     ) VALUES (?, 'HbA1c', ?, '%', 4.0, 6.0, 'HIGH', 'PATIENT_SELF_REPORT', 1)`,
  ).run(now, request.hba1c);
  inserted += 1;

  const diagnosisFlags: Array<[boolean, string, string]> = [
    [request.hasType2Diabetes, "E11", "2型糖尿病"],
    [request.thyroidHistory, "C73", "甲状腺髓样癌"],
    [request.pancreatitisHistory, "K85", "急性胰腺炎"],
    [request.isPregnantOrLactating, "Z34", "妊娠或哺乳期"],
    [request.cardiovascularRisk, "I51", "心血管高危风险"],
    [request.gastrointestinalSensitivity, "K92", "重度胃肠敏感"],
    [request.hasArteriosclerosis, "I70", "动脉硬化"],
    [request.hasCoronaryHeartDisease, "I25", "冠心病"],
    [request.hasMyocardialInfarction, "I21", "心肌梗死"],
    [request.hasStroke, "I63", "脑卒中"],
  ];

  for (const [enabled, icd10, label] of diagnosisFlags) {
    if (!enabled) {
      continue;
    }
    insertDiagnosis(db, icd10, label);
    inserted += 1;
  }

  const medicationFlags: Array<[boolean, string, string]> = [
    [request.usedMetforminBadControl, "二甲双胍", "A10BA02"],
    [request.usedSulfonylureaBadControl, "磺脲类口服降糖药", "A10BB12"],
    [request.usedInsulinBadControl, "胰岛素", "A10AB01"],
  ];

  for (const [enabled, drugName, atcCode] of medicationFlags) {
    if (!enabled) {
      continue;
    }
    insertIneffectiveMedication(db, drugName, atcCode);
    inserted += 1;
  }

  upsertPrescriptionContext(db, resolvePrescriptionContextFromInit(request));
  inserted += 1;

  return inserted;
}

export function initializePtds(
  request: PtdsInitRequest,
  dbPathOrOverrides?: string | PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): PtdsInitResult {
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolvePtdsDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolvePtdsDbPath(dbPathOrOverrides, env);
  try {
    const db = bootstrapPtdsDatabase(dbPath);
    const recordsInserted = applyPtdsInitRequest(db, request);
    db.close();
    return {
      status: "success",
      message: "Trust runtime initialized successfully.",
      db_file: dbPath,
      records_inserted: recordsInserted,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      message,
      db_file: dbPath,
      records_inserted: 0,
    };
  }
}

export function resetPtds(
  dbPathOrOverrides?: string | PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): PtdsInitResult {
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolvePtdsDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolvePtdsDbPath(dbPathOrOverrides, env);
  try {
    const db = bootstrapPtdsDatabase(dbPath);
    clearPtdsPersonalData(db);
    db.close();
    return {
      status: "success",
      message: "Trust runtime personal data cleared.",
      db_file: dbPath,
      records_inserted: 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      message,
      db_file: dbPath,
      records_inserted: 0,
    };
  }
}
