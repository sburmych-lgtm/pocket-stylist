export type Language = "uk" | "en";

export interface Translations {
  [key: string]: string | Translations;
}

/** Flatten nested translation object to dot-notation keys */
export function flattenTranslations(
  obj: Translations,
  prefix = "",
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof val === "string") {
      result[fullKey] = val;
    } else {
      Object.assign(result, flattenTranslations(val, fullKey));
    }
  }
  return result;
}
