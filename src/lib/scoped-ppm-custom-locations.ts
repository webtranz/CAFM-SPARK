export const FAILED_ONLY_CUSTOM_LOCATION_PPM_CODES = [
  "JPE00082",
  "JPJANCLN01",
  "JPJANWND01",
  "JPKLE003",
  "JPM00013",
  "JPM00017",
  "JPPSC0001",
  "JPPSC0002",
  "JPPSC0013",
  "JPPSC0014",
  "JPPSC0015",
  "JPPSC0016",
  "JPPSC0017",
  "JPPSC0018",
  "JPPSC0019",
  "JPPSC0020",
  "JPW00082",
] as const;

const FAILED_ONLY_CUSTOM_LOCATION_PPM_CODE_SET = new Set<string>(FAILED_ONLY_CUSTOM_LOCATION_PPM_CODES);

export function normalizePpmCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export function allowsCustomPpmLocation(value: unknown) {
  return FAILED_ONLY_CUSTOM_LOCATION_PPM_CODE_SET.has(normalizePpmCode(value));
}
