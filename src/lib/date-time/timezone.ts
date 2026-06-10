// Timezone helpers for clinic-local availability calculations.
//
// The clinic stores working hours as wall-clock strings ("09:00") for a given
// IANA timezone (e.g. "Europe/Warsaw"). Appointments are stored as absolute
// UTC instants. These helpers convert between a wall-clock time in a timezone
// and an absolute instant, handling DST correctly, using only the built-in
// Intl APIs (no extra dependency).

export type WallTime = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
};

export type ZonedDate = {
  year: number;
  month: number;
  day: number;
  /** ISO calendar date, e.g. "2026-06-12". */
  dateString: string;
};

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getTimeZoneParts(timeZone: string, date: Date): Parts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  let hour = Number(map.hour);
  // Some environments format midnight as "24"; normalize to 0.
  if (hour === 24) {
    hour = 0;
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function offsetMs(timeZone: string, date: Date): number {
  const parts = getTimeZoneParts(timeZone, date);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const dateMs = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - dateMs;
}

/**
 * Convert a wall-clock time in the given timezone to an absolute UTC instant.
 * Correct across DST transitions.
 */
export function zonedWallTimeToUtc(timeZone: string, wall: WallTime): Date {
  const utcGuess = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    0,
  );
  const firstOffset = offsetMs(timeZone, new Date(utcGuess));
  let result = new Date(utcGuess - firstOffset);
  const secondOffset = offsetMs(timeZone, result);
  if (secondOffset !== firstOffset) {
    result = new Date(utcGuess - secondOffset);
  }
  return result;
}

/**
 * ISO day of week for a calendar date: 1 = Monday ... 7 = Sunday.
 * Pure calendar math; independent of any timezone.
 */
export function isoDayOfWeek(year: number, month: number, day: number): number {
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun
  return ((utcDay + 6) % 7) + 1;
}

/**
 * Enumerate `days` consecutive calendar dates in the timezone, starting from
 * the timezone-local date of `from`.
 */
export function enumerateZonedDates(
  timeZone: string,
  from: Date,
  days: number,
): ZonedDate[] {
  const today = getTimeZoneParts(timeZone, from);
  const noonAnchor = zonedWallTimeToUtc(timeZone, {
    year: today.year,
    month: today.month,
    day: today.day,
    hour: 12,
    minute: 0,
  });

  const result: ZonedDate[] = [];
  for (let i = 0; i < days; i += 1) {
    const parts = getTimeZoneParts(
      timeZone,
      new Date(noonAnchor.getTime() + i * 86_400_000),
    );
    result.push({
      year: parts.year,
      month: parts.month,
      day: parts.day,
      dateString: `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`,
    });
  }
  return result;
}

/** Format an absolute instant for display in the given locale and timezone. */
export function formatInTimeZone(
  date: Date,
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
}

/**
 * Wall-clock calendar date ("YYYY-MM-DD") and time ("HH:mm") of an absolute
 * instant in the given timezone. The inverse of `zonedWallTimeToUtc` for the
 * fields a date/time form needs, e.g. to pre-fill a reschedule form.
 */
export function zonedDateTimeParts(
  timeZone: string,
  date: Date,
): { date: string; time: string } {
  const parts = getTimeZoneParts(timeZone, date);
  return {
    date: `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`,
    time: `${pad2(parts.hour)}:${pad2(parts.minute)}`,
  };
}

/**
 * Shift an ISO calendar date ("YYYY-MM-DD") by a whole number of days.
 * Pure calendar math, independent of any timezone.
 */
export function shiftIsoDate(dateString: string, deltaDays: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + deltaDays);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(
    shifted.getUTCDate(),
  )}`;
}
