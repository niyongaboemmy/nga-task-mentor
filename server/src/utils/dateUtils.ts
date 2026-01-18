// server/src/utils/dateUtils.ts
/**
 * Utility functions for handling timezone conversions and date operations
 */

/**
 * Converts a date string from local timezone to UTC Date object
 * @param dateString - Date string (format "YYYY-MM-DDTHH:mm" or ISO)
 * @param timezone - Optional timezone offset in minutes
 * @returns Date object in UTC
 */
export function parseLocalDateTimeToUTC(
  dateString: string,
  timezone?: number,
): Date {
  if (!dateString) {
    throw new Error("Date string is required");
  }

  // If the string already looks like an ISO UTC string or has an offset,
  // don't attempt to manually shift it again.
  if (
    dateString.includes("Z") ||
    (dateString.includes("T") && dateString.match(/[+-]\d{2}:?\d{2}$/))
  ) {
    return new Date(dateString);
  }

  // Create date object from the local datetime string
  const localDate = new Date(dateString);

  if (isNaN(localDate.getTime())) {
    throw new Error("Invalid date string format");
  }

  // Get the timezone offset in minutes (UTC - Local)
  // getTimezoneOffset() returns -120 for UTC+2, 300 for UTC-5
  const tzOffset = timezone ?? localDate.getTimezoneOffset();

  // Convert to UTC: UTC = Local + offset
  // Note: new Date(dateString) already parses as local time in most JS environments
  // if no timezone is specified. We only need manual adjustment if we want to
  // override the environment's timezone with a specific 'timezone' argument.
  if (timezone !== undefined) {
    const localTimestamp = localDate.getTime();
    // Re-adjust from environment's offset to the Target offset
    const envOffset = localDate.getTimezoneOffset();
    return new Date(localTimestamp + (timezone - envOffset) * 60 * 1000);
  }

  return localDate;
}

/**
 * Converts a UTC Date object to local timezone string for display in datetime-local
 * @param utcDate - UTC Date object
 * @param timezone - Optional timezone offset in minutes (defaults to current environment's timezone)
 * @returns Formatted date string in local timezone (YYYY-MM-DDTHH:mm)
 */
export function formatUTCToLocal(utcDate: Date, timezone?: number): string {
  if (!utcDate || isNaN(utcDate.getTime())) {
    throw new Error("Valid UTC date is required");
  }

  const tzOffset = timezone ?? new Date().getTimezoneOffset();

  // Convert UTC to local time: Local = UTC - offset
  const localTimestamp = utcDate.getTime() - tzOffset * 60 * 1000;
  const localDate = new Date(localTimestamp);

  return localDate.toISOString().slice(0, 16); // Format: "YYYY-MM-DDTHH:mm"
}

/**
 * Creates a UTC Date object from individual components
 * @param year - Year
 * @param month - Month (0-11)
 * @param day - Day of month
 * @param hour - Hour (0-23)
 * @param minute - Minute (0-59)
 * @param timezone - Optional timezone offset in minutes
 * @returns UTC Date object
 */
export function createUTCDate(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  timezone?: number,
): Date {
  const tzOffset = timezone ?? new Date().getTimezoneOffset();

  // Create date in local timezone first
  const localDate = new Date(year, month, day, hour, minute);

  // Convert to UTC
  return new Date(localDate.getTime() - tzOffset * 60 * 1000);
}

/**
 * Checks if a date is in the past (considering UTC)
 * @param utcDate - UTC Date object to check
 * @returns Boolean indicating if the date is in the past
 */
export function isPastDate(utcDate: Date): boolean {
  if (!utcDate || isNaN(utcDate.getTime())) {
    return false;
  }

  // Compare UTC timestamps
  return utcDate.getTime() < Date.now();
}

/**
 * Formats a UTC date for display in user's local timezone
 * @param utcDate - UTC Date object
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string in local timezone
 */
export function formatDateTimeLocal(
  utcDate: Date,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  },
): string {
  if (!utcDate || isNaN(utcDate.getTime())) {
    return "Invalid Date";
  }

  return new Intl.DateTimeFormat("en-US", options).format(utcDate);
}

/**
 * Middleware to handle datetime fields (no timezone conversion)
 * @param dateFields - Array of field names that contain dates
 * @returns Express middleware function
 */
export function timezoneMiddleware(
  dateFields: string[] = ["due_date", "submitted_at"],
) {
  return (req: any, res: any, next: any) => {
    // Process each specified field
    dateFields.forEach((field) => {
      if (req.body[field]) {
        try {
          // If it's a valid date string, keep it as is.
          // The goal is just to ensure it's not malformed.
          // If we receive "YYYY-MM-DDTHH:mm", it's valid.
          const date = new Date(req.body[field]);
          if (!isNaN(date.getTime())) {
            // Valid date, proceed.
            // We don't change the format here to avoid messing up what the user sent
            // especially if they sent a specific format required by validation.
          }
        } catch (error) {
          console.error(`Error processing date field ${field}:`, error);
        }
      }
    });

    next();
  };
}

export default {
  parseLocalDateTimeToUTC,
  formatUTCToLocal,
  createUTCDate,
  isPastDate,
  formatDateTimeLocal,
  timezoneMiddleware,
};
