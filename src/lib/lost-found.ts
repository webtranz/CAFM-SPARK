export const LOST_FOUND_CASE_TYPES = ["LOST", "FOUND"] as const;
export const LOST_ITEM_STATUSES = ["Never Found", "Returned"] as const;
export const FOUND_ITEM_SETTLEMENT_STATUSES = ["Returned", "Destroyed"] as const;
export const FOUND_ITEM_OPEN_STATUS = "In Custody";

export type LostFoundCaseType = typeof LOST_FOUND_CASE_TYPES[number];

export function cleanLostFoundText(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeLostFoundCaseType(value: unknown): LostFoundCaseType {
  const type = cleanLostFoundText(value).toUpperCase();
  if (type === "LOST" || type === "FOUND") return type;
  throw Object.assign(new Error("Select Lost or Found case type."), { status: 400 });
}

export function normalizeLostFoundStatus(caseType: LostFoundCaseType, value: unknown, currentStatus?: string | null) {
  const status = cleanLostFoundText(value);
  if (caseType === "LOST") {
    if (!status) return cleanLostFoundText(currentStatus) || LOST_ITEM_STATUSES[0];
    if (LOST_ITEM_STATUSES.includes(status as typeof LOST_ITEM_STATUSES[number])) return status;
    throw Object.assign(new Error("Lost item status must be Never Found or Returned."), { status: 400 });
  }
  if (!status) return cleanLostFoundText(currentStatus) || FOUND_ITEM_OPEN_STATUS;
  if (
    status === FOUND_ITEM_OPEN_STATUS ||
    FOUND_ITEM_SETTLEMENT_STATUSES.includes(status as typeof FOUND_ITEM_SETTLEMENT_STATUSES[number])
  ) {
    return status;
  }
  throw Object.assign(new Error("Found item status must be Returned or Destroyed when settled."), { status: 400 });
}

export function lostFoundReturnDateForStatus(
  caseType: LostFoundCaseType,
  status: string,
  currentReturnDate?: Date | string | null,
  now = new Date(),
) {
  const shouldStamp =
    (caseType === "LOST" && status === "Returned") ||
    (caseType === "FOUND" && FOUND_ITEM_SETTLEMENT_STATUSES.includes(status as typeof FOUND_ITEM_SETTLEMENT_STATUSES[number]));
  if (!shouldStamp) return null;
  return currentReturnDate ? new Date(currentReturnDate) : now;
}

