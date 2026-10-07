const placeholderValues = new Set([
  "unassigned",
  "undefined",
  "null",
  "n/a",
  "na",
  "none",
  "-",
]);

function decodeDisplayText(value: string) {
  let text = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!/%[0-9a-f]{2}/i.test(text)) break;
    try {
      const decoded = decodeURIComponent(text.replace(/\+/g, " "));
      if (decoded === text) break;
      text = decoded;
    } catch {
      break;
    }
  }
  return text;
}

export function cleanDisplayText(value: unknown) {
  if (value === null || value === undefined) return "";
  let text = decodeDisplayText(String(value).trim());
  const metadataStart = text.indexOf("{");
  if (metadataStart >= 0) {
    const metadata = text.slice(metadataStart);
    if (/"(?:source_table|source_id|source|sourceTable|sourceId)"\s*:/i.test(metadata)) {
      text = text.slice(0, metadataStart);
    }
  }
  return text.replace(/\s+/g, " ").replace(/\s+([,;:/])/g, "$1").trim();
}

export function meaningfulDisplayText(value: unknown) {
  const text = cleanDisplayText(value);
  return placeholderValues.has(text.toLowerCase()) ? "" : text;
}

type NarrativeKind = "notes" | "checklist" | "description";

const narrativeKeys: Record<NarrativeKind, string[]> = {
  notes: ["worknotes", "comment", "comments", "note", "notes", "description"],
  checklist: [
    "checklist",
    "activitychecklist",
    "procedure",
    "procedures",
    "steps",
    "description",
    "comment",
  ],
  description: ["description", "comment", "comments", "note", "notes"],
};

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sourcePayload(value: unknown) {
  const decoded = decodeDisplayText(String(value || "").trim());
  const start = decoded.indexOf("{");
  const end = decoded.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(decoded.slice(start, end + 1));
  } catch {
    return null;
  }
}

function collectNarrativeValues(
  value: unknown,
  rows: Array<{ key: string; value: unknown }>,
  depth = 0,
) {
  if (!value || depth > 4) return;
  if (typeof value === "string") {
    const nested = sourcePayload(value);
    if (nested) collectNarrativeValues(nested, rows, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    rows.push({ key: normalizedKey(key), value: child });
    collectNarrativeValues(child, rows, depth + 1);
  });
}

export function cleanImportedNarrative(
  value: unknown,
  kind: NarrativeKind = "description",
) {
  if (value === null || value === undefined) return "";
  const payload = sourcePayload(value);
  if (payload) {
    const rows: Array<{ key: string; value: unknown }> = [];
    collectNarrativeValues(payload, rows);
    for (const key of narrativeKeys[kind]) {
      const match = rows.find(
        (row) => row.key === key && ["string", "number"].includes(typeof row.value),
      );
      const text = meaningfulDisplayText(match?.value);
      if (text) return text;
    }
  }
  return meaningfulDisplayText(value);
}

export function cleanLocationRecord<T extends Record<string, any>>(location: T): T {
  const cleaned = { ...location } as Record<string, any>;
  const hierarchyFields = [
    "site",
    "zone",
    "building",
    "floor",
    "room",
    "parentLocation",
  ];
  hierarchyFields.forEach((field) => {
    cleaned[field] = meaningfulDisplayText(location[field]);
  });
  ["code", "description", "type", "locationClass"].forEach((field) => {
    cleaned[field] = cleanDisplayText(location[field]);
  });
  return cleaned as T;
}
