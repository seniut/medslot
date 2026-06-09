import { describe, expect, it } from "vitest";

import { validateWorkingDays, WEEKDAYS } from "@/lib/validation/workingHoursSchema";

function activeDay(dayOfWeek: number, startTime = "09:00", endTime = "17:00") {
  return { dayOfWeek, isActive: true, startTime, endTime };
}

describe("validateWorkingDays", () => {
  it("returns no errors for a valid Mon-Fri week", () => {
    const days = WEEKDAYS.map((d) =>
      d <= 5 ? activeDay(d) : { dayOfWeek: d, isActive: false, startTime: "09:00", endTime: "17:00" },
    );
    expect(validateWorkingDays(days)).toEqual({});
  });

  it("flags an active day whose end is not after its start", () => {
    const errors = validateWorkingDays([activeDay(1, "17:00", "09:00")]);
    expect(errors[1]).toBe("endBeforeStart");
  });

  it("flags equal start and end on an active day", () => {
    const errors = validateWorkingDays([activeDay(2, "09:00", "09:00")]);
    expect(errors[2]).toBe("endBeforeStart");
  });

  it("flags a malformed time", () => {
    const errors = validateWorkingDays([activeDay(3, "9:00", "17:00")]);
    expect(errors[3]).toBe("invalidTime");
  });

  it("ignores ordering on inactive days", () => {
    const errors = validateWorkingDays([
      { dayOfWeek: 6, isActive: false, startTime: "17:00", endTime: "09:00" },
    ]);
    expect(errors[6]).toBeUndefined();
  });

  it("still validates time format on inactive days", () => {
    const errors = validateWorkingDays([
      { dayOfWeek: 7, isActive: false, startTime: "0900", endTime: "17:00" },
    ]);
    expect(errors[7]).toBe("invalidTime");
  });
});
