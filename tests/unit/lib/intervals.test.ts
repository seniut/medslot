import { describe, expect, it } from "vitest";

import { intervalsOverlap, overlapsAny, parseHhMm } from "@/lib/date-time/intervals";

describe("parseHhMm", () => {
  it("parses valid times to minutes since midnight", () => {
    expect(parseHhMm("00:00")).toBe(0);
    expect(parseHhMm("09:30")).toBe(570);
    expect(parseHhMm("23:59")).toBe(1439);
  });

  it("throws on out-of-range or malformed values", () => {
    expect(() => parseHhMm("24:00")).toThrow();
    expect(() => parseHhMm("09:60")).toThrow();
    expect(() => parseHhMm("9:30")).toThrow();
    expect(() => parseHhMm("ab:cd")).toThrow();
  });
});

function at(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 5, 10, hour, minute));
}

describe("intervalsOverlap", () => {
  it("is false for adjacent half-open intervals", () => {
    expect(intervalsOverlap({ start: at(9), end: at(10) }, { start: at(10), end: at(11) })).toBe(false);
  });

  it("is true for genuinely overlapping intervals", () => {
    expect(
      intervalsOverlap({ start: at(9), end: at(10) }, { start: at(9, 30), end: at(10, 30) }),
    ).toBe(true);
  });

  it("is true for identical intervals", () => {
    expect(intervalsOverlap({ start: at(9), end: at(10) }, { start: at(9), end: at(10) })).toBe(true);
  });

  it("is false for fully separate intervals", () => {
    expect(intervalsOverlap({ start: at(9), end: at(10) }, { start: at(8), end: at(9) })).toBe(false);
  });
});

describe("overlapsAny", () => {
  it("returns false against an empty list", () => {
    expect(overlapsAny({ start: at(9), end: at(10) }, [])).toBe(false);
  });

  it("detects an overlap with any member", () => {
    const candidate = { start: at(9), end: at(10) };
    const others = [
      { start: at(7), end: at(8) },
      { start: at(9, 30), end: at(11) },
    ];
    expect(overlapsAny(candidate, others)).toBe(true);
  });

  it("returns false when no member overlaps", () => {
    const candidate = { start: at(9), end: at(10) };
    const others = [
      { start: at(7), end: at(8) },
      { start: at(10), end: at(11) },
    ];
    expect(overlapsAny(candidate, others)).toBe(false);
  });
});
