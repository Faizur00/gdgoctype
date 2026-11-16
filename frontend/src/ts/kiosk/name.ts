export const NAME_MAX_LENGTH = 24;

/** collapse whitespace, strip control/invisible chars, trim */
export function normalizeName(raw: string): string {
  return raw
    .replace(/\s+/gu, " ")
    .replace(/\p{C}/gu, "")
    .replace(/ {2,}/g, " ") // stripping can leave two spaces side by side
    .trim();
}

/** 1-24 characters (code points, not UTF-16 units) after normalizing */
export function isValidName(name: string): boolean {
  const length = [...name].length;
  return length >= 1 && length <= NAME_MAX_LENGTH;
}

/** same idea as the DB's name_key (lower(trim(name))) */
export function nameKey(name: string): string {
  return normalizeName(name).toLowerCase();
}
