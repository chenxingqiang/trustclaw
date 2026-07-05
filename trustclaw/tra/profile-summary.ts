import type { DatabaseSync } from "node:sqlite";
import { bootstrapTraDatabase, resolvePrimaryUserId } from "./db.js";
import { resolveTraDbPath, type TraPathOverrides } from "./paths.js";
import { readGlp1CheckSnapshot } from "./query.js";
import type { Glp1CheckSnapshot } from "./types.js";

export type TraClinicalDiagnosisSummary = {
  icd10_code: string;
  diagnosis_name: string;
};

export type TraMedicationSummary = {
  drug_name: string;
  termination_reason: string | null;
};

/** Human-readable private data fields shown in consent prompts. */
export const TRA_PRIVATE_DATA_FIELD_LABELS: Record<string, { en: string; "zh-CN": string }> = {
  patient_name: { en: "Patient name", "zh-CN": "患者姓名" },
  age: { en: "Age", "zh-CN": "年龄" },
  gender: { en: "Gender", "zh-CN": "性别" },
  weight_kg: { en: "Weight (kg)", "zh-CN": "体重 (kg)" },
  height_cm: { en: "Height (cm)", "zh-CN": "身高 (cm)" },
  bmi: { en: "BMI", "zh-CN": "BMI 指数" },
  hba1c: { en: "HbA1c (%)", "zh-CN": "糖化血红蛋白 HbA1c" },
  clinical_diagnoses: { en: "Clinical diagnoses", "zh-CN": "临床诊断记录" },
  medication_history: { en: "Medication history", "zh-CN": "用药史" },
  glp1_eligibility_snapshot: {
    en: "GLP-1 eligibility snapshot",
    "zh-CN": "GLP-1 医保资格快照",
  },
};

export type TraHealthProfileSummary = {
  mounted: boolean;
  patient_name: string;
  gender: "男" | "女";
  age_years: number;
  weight_kg: number;
  height_cm: number;
  bmi: number;
  hba1c_percent: number;
  diagnoses: TraClinicalDiagnosisSummary[];
  medications: TraMedicationSummary[];
  snapshot: Glp1CheckSnapshot | null;
  /** Keys from TRA_PRIVATE_DATA_FIELD_LABELS present in this profile. */
  private_data_fields: string[];
  analysis_notes: string[];
};

function ageFromBirthDate(birthDate: string): number {
  const year = Number.parseInt(birthDate.slice(0, 4), 10);
  if (!Number.isFinite(year)) {
    return 0;
  }
  return Math.max(0, new Date().getFullYear() - year);
}

function readProfileFromDb(db: DatabaseSync): Omit<TraHealthProfileSummary, "mounted"> | null {
  const userId = resolvePrimaryUserId(db);
  if (!userId) {
    return null;
  }

  const profile = db
    .prepare(`SELECT name, birth_date, biological_sex FROM user_profile WHERE user_id = ? LIMIT 1`)
    .get(userId) as { name: string; birth_date: string; biological_sex: number } | undefined;
  if (!profile) {
    return null;
  }

  const anthropometrics = db
    .prepare(
      `SELECT height_m, weight_kg, bmi FROM body_anthropometrics
       ORDER BY body_id DESC LIMIT 1`,
    )
    .get() as { height_m: number; weight_kg: number; bmi: number } | undefined;

  const hba1cRow = db
    .prepare(
      `SELECT test_value FROM lab_test_results
       WHERE test_code = 'HbA1c' ORDER BY test_id DESC LIMIT 1`,
    )
    .get() as { test_value: number } | undefined;

  const diagnoses = db
    .prepare(
      `SELECT icd10_code, diagnosis_name FROM clinical_diagnoses
       WHERE is_active = 1 ORDER BY id`,
    )
    .all() as TraClinicalDiagnosisSummary[];

  const medications = db
    .prepare(
      `SELECT drug_name, termination_reason FROM medication_history
       ORDER BY med_id`,
    )
    .all() as TraMedicationSummary[];

  const heightM = anthropometrics?.height_m ?? 0;
  const weightKg = anthropometrics?.weight_kg ?? 0;
  const heightCm = heightM > 0 ? Math.round(heightM * 1000) / 10 : 0;
  const bmi = anthropometrics?.bmi ?? 0;
  const hba1c = hba1cRow?.test_value ?? 0;
  const gender: "男" | "女" = profile.biological_sex === 2 ? "女" : "男";

  const privateDataFields = [
    "patient_name",
    "age",
    "gender",
    "weight_kg",
    "height_cm",
    "bmi",
    "hba1c",
    ...(diagnoses.length > 0 ? ["clinical_diagnoses"] : []),
    ...(medications.length > 0 ? ["medication_history"] : []),
    "glp1_eligibility_snapshot",
  ];

  const analysisNotes: string[] = [];
  if (profile.name) {
    analysisNotes.push(`Profile loaded for ${profile.name}.`);
  }
  if (hba1c > 6.5) {
    analysisNotes.push(`HbA1c ${hba1c}% is above typical reference range.`);
  }
  if (bmi >= 28) {
    analysisNotes.push(`BMI ${bmi.toFixed(1)} suggests overweight range.`);
  }
  if (diagnoses.some((row) => row.icd10_code === "E11")) {
    analysisNotes.push("Type 2 diabetes diagnosis is on file.");
  }
  if (medications.some((row) => row.termination_reason === "INEFFECTIVE")) {
    analysisNotes.push("Prior oral therapy with inadequate control is recorded.");
  }

  return {
    patient_name: profile.name,
    gender,
    age_years: ageFromBirthDate(profile.birth_date),
    weight_kg: weightKg,
    height_cm: heightCm,
    bmi,
    hba1c_percent: hba1c,
    diagnoses,
    medications,
    snapshot: null,
    private_data_fields: privateDataFields,
    analysis_notes: analysisNotes,
  };
}

export function buildTraHealthProfileSummary(
  dbPathOrOverrides?: string | TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): TraHealthProfileSummary {
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolveTraDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolveTraDbPath(dbPathOrOverrides, env);
  const db = bootstrapTraDatabase(dbPath);
  try {
    const profile = readProfileFromDb(db);
    if (!profile) {
      return {
        mounted: false,
        patient_name: "",
        gender: "男",
        age_years: 0,
        weight_kg: 0,
        height_cm: 0,
        bmi: 0,
        hba1c_percent: 0,
        diagnoses: [],
        medications: [],
        snapshot: null,
        private_data_fields: [],
        analysis_notes: [],
      };
    }
    const snapshot = readGlp1CheckSnapshot({ dbPath }, env);
    return {
      mounted: true,
      ...profile,
      snapshot,
    };
  } finally {
    db.close();
  }
}

export function formatPrivateDataFieldLabels(
  fieldKeys: string[],
  locale: "en" | "zh-CN" = "zh-CN",
): string[] {
  return fieldKeys.map((key) => TRA_PRIVATE_DATA_FIELD_LABELS[key]?.[locale] ?? key);
}
