import { describe, expect, it } from "vitest";

import {
  enumerateZonedDates,
  formatInTimeZone,
  isoDayOfWeek,
  shiftIsoDate,
  zonedDateTimeParts,
  zonedWallTimeToUtc,
} from "@/lib/date-time/timezone";

describe("zonedWallTimeToUtc", () => {
  it("converts summer (CEST, UTC+2) wall time to UTC", () => {
    const utc = zonedWallTimeToUtc("Europe/Warsaw", {
      year: 2026,
      month: 6,
      day: 10,
      hour: 9,
      minute: 0,
    });
    expect(utc.toISOString()).toBe("2026-06-10T07:00:00.000Z");
  });

  it("converts winter (CET, UTC+1) wall time to UTC", () => {
    const utc = zonedWallTimeToUtc("Europe/Warsaw", {
      year: 2026,
      month: 1,
      day: 10,
      hour: 9,
      minute: 0,
    });
    expect(utc.toISOString()).toBe("2026-01-10T08:00:00.000Z");
  });

  it("treats UTC wall time as identity", () => {
    const utc = zonedWallTimeToUtc("UTC", {
      year: 2026,
      month: 6,
      day: 10,
      hour: 9,
      minute: 30,
    });
    expect(utc.toISOString()).toBe("2026-06-10T09:30:00.000Z");
  });

  it("returns a valid instant for a DST spring-forward gap time", () => {
    // 2026-03-29 02:30 does not exist in Europe/Warsaw (clocks jump 02->03).
    const utc = zonedWallTimeToUtc("Europe/Warsaw", {
      year: 2026,
      month: 3,
      day: 29,
      hour: 2,
      minute: 30,
    });
    expect(Number.isNaN(utc.getTime())).toBe(false);
  });
});

describe("isoDayOfWeek", () => {
  it("maps known dates (Mon=1 .. Sun=7)", () => {
    expect(isoDayOfWeek(2024, 1, 1)).toBe(1); // Monday
    expect(isoDayOfWeek(2024, 1, 6)).toBe(6); // Saturday
    expect(isoDayOfWeek(2024, 1, 7)).toBe(7); // Sunday
  });
});

describe("enumerateZonedDates", () => {
  it("lists consecutive local calendar dates", () => {
    const from = new Date("2026-06-10T00:30:00Z"); // 02:30 local in Warsaw
    const dates = enumerateZonedDates("Europe/Warsaw", from, 3);
    expect(dates.map((d) => d.dateString)).toEqual([
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
    ]);
  });
});

describe("shiftIsoDate", () => {
  it("shifts within and across month/year boundaries", () => {
    expect(shiftIsoDate("2026-06-10", 1)).toBe("2026-06-11");
    expect(shiftIsoDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftIsoDate("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("formatInTimeZone", () => {
  it("renders an instant in the target timezone", () => {
    const out = formatInTimeZone(
      new Date("2026-06-10T07:00:00Z"),
      "en-GB",
      "Europe/Warsaw",
      { hour: "2-digit", minute: "2-digit", hour12: false },
    );
    expect(out).toBe("09:00");
  });
});

describe("zonedDateTimeParts", () => {
  it("extracts wall-clock date and time in summer (CEST, UTC+2)", () => {
    const parts = zonedDateTimeParts(
      "Europe/Warsaw",
      new Date("2026-06-10T07:00:00Z"),
    );
    expect(parts).toEqual({ date: "2026-06-10", time: "09:00" });
  });

  it("extracts wall-clock date and time in winter (CET, UTC+1)", () => {
    const parts = zonedDateTimeParts(
      "Europe/Warsaw",
      new Date("2026-01-10T08:30:00Z"),
    );
    expect(parts).toEqual({ date: "2026-01-10", time: "09:30" });
  });

  it("round-trips with zonedWallTimeToUtc", () => {
    const instant = zonedWallTimeToUtc("Europe/Warsaw", {
      year: 2026,
      month: 6,
      day: 12,
      hour: 14,
      minute: 45,
    });
    expect(zonedDateTimeParts("Europe/Warsaw", instant)).toEqual({
      date: "2026-06-12",
      time: "14:45",
    });
  });
});
