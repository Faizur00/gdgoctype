export const NAME_MAX_LENGTH = 24;

/** collapse whitespace, strip control/invisible chars, trim */
export function normalizeName(raw: string): string {
  return raw
    .replace(/\s+/gu, " ")
    .replace(/\p{C}/gu, "")
    .replace(/ {2,}/g, " ") // stripping can leave two spaces side by side
    .trim();
}

/** length in code points (an emoji counts as one), not UTF-16 units */
export function codePointLength(text: string): number {
  return Array.from(text).length;
}

export function truncateToCodePoints(text: string, max: number): string {
  return Array.from(text).slice(0, max).join("");
}

/** 1-24 characters (code points, not UTF-16 units) after normalizing */
export function isValidName(name: string): boolean {
  const length = codePointLength(name);
  return length >= 1 && length <= NAME_MAX_LENGTH;
}

/** same idea as the DB's name_key (lower(trim(name))) */
export function nameKey(name: string): string {
  return normalizeName(name).toLowerCase();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Given a base name (e.g. "Alex") and existing name_key list from the leaderboard,
 * picks the smallest free candidate:
 * 1. "Alex" if "alex" is not yet taken
 * 2. "Alex (2)" if "alex" is taken and "alex (2)" is free
 * 3. "Alex (3)", etc.
 * Truncates base name if adding suffix would exceed NAME_MAX_LENGTH (24 chars).
 */
export function pickSmallestFreeName(
  baseName: string,
  existingKeys: string[],
): string {
  const normBase = normalizeName(baseName);
  const baseK = nameKey(normBase);
  const escapedBase = escapeRegex(baseK);
  const pattern = new RegExp(`^${escapedBase}(?: \\((\\d+)\\))?$`);

  const usedNumbers = new Set<number>();
  for (const key of existingKeys) {
    const match = pattern.exec(key.trim().toLowerCase());
    if (match !== null) {
      if (match[1] === undefined) {
        usedNumbers.add(1);
      } else {
        const n = parseInt(match[1], 10);
        if (Number.isFinite(n) && n >= 2) {
          usedNumbers.add(n);
        }
      }
    }
  }

  // 1 means bare base name with no suffix
  if (!usedNumbers.has(1)) {
    return normBase;
  }

  for (let n = 2; n < 1000; n++) {
    if (!usedNumbers.has(n)) {
      const suffix = ` (${n})`;
      const maxBaseLen = NAME_MAX_LENGTH - codePointLength(suffix);
      const truncatedBase = truncateToCodePoints(normBase, maxBaseLen);
      return `${truncatedBase}${suffix}`;
    }
  }

  return normBase;
}
