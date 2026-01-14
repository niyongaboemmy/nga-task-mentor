/**
 * Utility functions for handling timezone conversions and date operations,
 * with the browser's detected timezone used for accurate conversions.
 */

/**
 * Converts a datetime-local string (local time) to a UTC Date object.
 * Uses the browser's detected timezone for accurate conversion.
 * Example:
 *   "2025-10-24T08:30" (user's local time) → Date(2025-10-24T06:30:00.000Z)
 */
export function parseLocalDateTimeToUTC(dateTimeLocal: string): Date {
  if (!dateTimeLocal) throw new Error("Date string is required");

  // Parse the input as local datetime
  const localDate = new Date(dateTimeLocal);
  if (isNaN(localDate.getTime())) throw new Error("Invalid date string format");

  // Use browser's timezone offset to convert to UTC
  // getTimezoneOffset() returns negative for timezones ahead of UTC (e.g., -120 for UTC+2)
  // We need to subtract the absolute offset to convert local time to UTC
  const tzOffset = localDate.getTimezoneOffset(); // in minutes
  const utcDate = new Date(localDate.getTime() - Math.abs(tzOffset) * 60 * 1000);

  return utcDate;
}

/**
 * Converts a UTC date to local timezone string (for datetime-local inputs)
 * Uses the browser's detected timezone for accurate conversion.
 * Example:
 *   "2025-10-24T06:30:00.000Z" → "2025-10-24T08:30" (user's local time)
 */
export function formatUTCToLocalDateTime(utcDate: Date | string): string {
  const date = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  if (!date || isNaN(date.getTime())) throw new Error("Invalid UTC date");

  // Use browser's timezone offset to convert from UTC to local
  // getTimezoneOffset() returns negative for timezones ahead of UTC (e.g., -120 for UTC+2)
  // We need to add the absolute offset to convert UTC to local time
  const tzOffset = date.getTimezoneOffset(); // in minutes
  const localDate = new Date(date.getTime() + Math.abs(tzOffset) * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

/**
 * Formats a UTC date for human-readable display in user's local timezone.
 * Uses the browser's detected timezone for accurate conversion.
 * Example:
 *   "2025-10-24T06:30:00.000Z" → "October 24, 2025, 8:30 AM"
 */
export function formatDateTimeLocal(
  utcDate: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }
): string {
  const date = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  if (!date || isNaN(date.getTime())) return "Invalid Date";

  // Use browser's detected timezone for display
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: userTimezone,
  }).format(date);
}

/**
 * Checks if a UTC date is in the past (based on current UTC time)
 */
export function isPastDate(utcDate: Date | string): boolean {
  const date = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  if (!date || isNaN(date.getTime())) return false;

  // Compare UTC timestamps directly
  const nowUTC = Date.now(); // Current UTC time in milliseconds since epoch
  const dateUTC = date.getTime(); // Date time in UTC milliseconds since epoch

  return dateUTC < nowUTC;
}

/**
 * Creates a UTC Date object from provided components (assuming local time input).
 * Uses browser's timezone detection for accurate conversion.
 */
export function createUTCDate(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0
): Date {
  // Create date in local time, then convert to UTC
  const localDate = new Date(year, month, day, hour, minute);
  const tzOffset = localDate.getTimezoneOffset();
  return new Date(localDate.getTime() - tzOffset * 60 * 1000);
}

/**
 * Returns the user's current timezone offset in minutes.
 * Uses browser's detected timezone for accuracy.
 */
export function getCurrentTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
}

/**
 * Ensures consistent UTC ISO string format for API submission
 */
export function formatForAPI(date: Date | string): string {
  if (!date) throw new Error("Date is required");
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) throw new Error("Invalid date");
  return d.toISOString();
}

export default {
  parseLocalDateTimeToUTC,
  formatUTCToLocalDateTime,
  formatDateTimeLocal,
  isPastDate,
  createUTCDate,
  getCurrentTimezoneOffset,
  formatForAPI,
};
