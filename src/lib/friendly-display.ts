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
