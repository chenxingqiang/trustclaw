/** Frozen `POST /api/ptds/init` request shape (Panel A). */
export type PtdsInitRequest = {
  patientName?: string;
  gender: "男" | "女";
  age: number;
  weight: number;
  height: number;
  /** Client hint; SQLite stores generated BMI on body_anthropometrics. */
  bmi?: number;
  hba1c: number;
  isPregnantOrLactating: boolean;
  hasType2Diabetes: boolean;
  thyroidHistory: boolean;
  pancreatitisHistory: boolean;
  cardiovascularRisk: boolean;
  gastrointestinalSensitivity: boolean;
  hasArteriosclerosis: boolean;
  hasCoronaryHeartDisease: boolean;
  hasMyocardialInfarction: boolean;
  hasStroke: boolean;
  usedMetforminBadControl: boolean;
  usedSulfonylureaBadControl: boolean;
  usedInsulinBadControl: boolean;
  /** AST prescription_context.is_first_prescription (default: true). */
  isFirstPrescription?: boolean;
  /** AST prescription_context.institution_level 1–3 (default: 3). */
  institutionLevel?: number;
  /** AST prescription_context.is_specialist_physician (default: true). */
  isSpecialistPhysician?: boolean;
};

export const PTDS_INIT_DEFAULTS: Required<Pick<PtdsInitRequest, "patientName" | "gender" | "age">> &
  Omit<PtdsInitRequest, "patientName" | "gender" | "age" | "bmi"> = {
  patientName: "张三",
  gender: "男",
  age: 45,
  weight: 82,
  height: 170,
  hba1c: 6.8,
  isPregnantOrLactating: false,
  hasType2Diabetes: true,
  thyroidHistory: false,
  pancreatitisHistory: false,
  cardiovascularRisk: false,
  gastrointestinalSensitivity: false,
  hasArteriosclerosis: false,
  hasCoronaryHeartDisease: false,
  hasMyocardialInfarction: false,
  hasStroke: false,
  usedMetforminBadControl: false,
  usedSulfonylureaBadControl: false,
  usedInsulinBadControl: false,
};

export function computePtdsBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export type PtdsInitResult = {
  status: "success" | "error";
  message: string;
  db_file: string;
  records_inserted: number;
};

export type PtdsQueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
};

export type Glp1CheckSnapshot = {
  user_id: string;
  name: string;
  has_t2dm: number;
  prior_oral_therapy_status: number;
  latest_hospital_hba1c: number | null;
  has_cardiovascular_comorbidity: number;
  has_absolute_contraindication: number;
};
