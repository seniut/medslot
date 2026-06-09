// Small, dependency-free interval and time-of-day helpers used by availability
// calculation.

export type Interval = {
  start: Date;
  end: Date;
};

/** Parse a "HH:MM" wall-clock string into minutes since midnight. */
export function parseHhMm(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid time string: ${value}`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error(`Invalid time string: ${value}`);
  }
  return hours * 60 + minutes;
}

/** Whether two half-open intervals [start, end) overlap. */
export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/** Whether `candidate` overlaps any interval in `others`. */
export function overlapsAny(candidate: Interval, others: Interval[]): boolean {
  return others.some((other) => intervalsOverlap(candidate, other));
}
