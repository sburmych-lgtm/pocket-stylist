/**
 * Translate a wardrobe enum value (colour / pattern / fabric / season) for
 * display. The stored value stays the canonical English token (needed for the
 * AI + DB); only the visible label is localised. Falls back to the raw value
 * when a translation is missing so nothing ever renders a bare dotted key.
 */
export type EnumKind = "colors" | "patterns" | "fabrics" | "seasons";

export function enumLabel(
  t: (key: string) => string,
  kind: EnumKind,
  value: string | null | undefined,
): string {
  if (!value) return "";
  const key = `${kind}.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}
