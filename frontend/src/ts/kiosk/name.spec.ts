import { describe, expect, it } from "vitest";

import { pickSmallestFreeName } from "./name";

describe("pickSmallestFreeName", () => {
  it("picks base name when no existing names exist", () => {
    expect(pickSmallestFreeName("Alex", [])).toBe("Alex");
  });

  it("picks (2) when base name is taken", () => {
    expect(pickSmallestFreeName("Alex", ["alex"])).toBe("Alex (2)");
  });

  it("picks (3) when base and (2) are taken", () => {
    expect(pickSmallestFreeName("Alex", ["alex", "alex (2)"])).toBe("Alex (3)");
  });

  it("picks smallest free slot when there is a gap", () => {
    expect(pickSmallestFreeName("Alex", ["alex", "alex (3)"])).toBe("Alex (2)");
  });

  it("ignores names that merely start with base as prefix", () => {
    expect(pickSmallestFreeName("Alex", ["alexander", "alexandra"])).toBe("Alex");
  });

  it("handles base with parentheses cleanly", () => {
    expect(pickSmallestFreeName("Andi (TI)", ["andi (ti)"])).toBe("Andi (TI) (2)");
  });

  it("truncates base so that base + suffix never exceeds 24 characters", () => {
    const longName = "123456789012345678901234"; // 24 chars
    const candidate = pickSmallestFreeName(longName, [longName.toLowerCase()]);
    expect(candidate.length).toBeLessThanOrEqual(24);
    expect(candidate.endsWith(" (2)")).toBe(true);
  });
});
