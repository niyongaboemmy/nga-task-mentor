// server/src/utils/dateUtils.ts
/**
 * Utility functions for handling timezone conversions and date operations
 */

/**
 * Converts a date string from local timezone to UTC Date object
 * @param dateString - Date string in format "YYYY-MM-DDTHH:mm" (from datetime-local input)
 * @param timezone - Optional timezone offset in minutes (defaults to user's local timezone)
 * @returns Date object in UTC
 */
export function parseLocalDateTimeToUTC(dateString: string, timezone?: number): Date {
  if (!dateString) {
    throw new Error('Date string is required');
  }

  // Create date object from the local datetime string
  // This will be interpreted as local time initially
  const localDate = new Date(dateString);

  if (isNaN(localDate.getTime())) {
    throw new Error('Invalid date string format');
  }

  // Get the timezone offset in minutes
  const tzOffset = timezone ?? localDate.getTimezoneOffset();

  // Convert to UTC by subtracting the timezone offset
  const utcDate = new Date(localDate.getTime() - (tzOffset * 60 * 1000));

  return utcDate;
}

/**
 * Converts a UTC Date object to local timezone string for display
 * @param utcDate - UTC Date object
 * @param timezone - Optional timezone offset in minutes (defaults to user's local timezone)
 * @returns Formatted date string in local timezone
 */
export function formatUTCToLocal(utcDate: Date, timezone?: number): string {
  if (!utcDate || isNaN(utcDate.getTime())) {
    throw new Error('Valid UTC date is required');
  }

  const tzOffset = timezone ?? new Date().getTimezoneOffset();

  // Convert UTC to local time
  const localDate = new Date(utcDate.getTime() + (tzOffset * 60 * 1000));

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
  timezone?: number
): Date {
  const tzOffset = timezone ?? new Date().getTimezoneOffset();

  // Create date in local timezone first
  const localDate = new Date(year, month, day, hour, minute);

  // Convert to UTC
  return new Date(localDate.getTime() - (tzOffset * 60 * 1000));
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
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  }
): string {
  if (!utcDate || isNaN(utcDate.getTime())) {
    return 'Invalid Date';
  }

  return new Intl.DateTimeFormat('en-US', options).format(utcDate);
}

/**
 * Middleware to handle datetime fields (no timezone conversion)
 * @param dateFields - Array of field names that contain dates
 * @returns Express middleware function
 */
export function timezoneMiddleware(dateFields: string[] = ['due_date', 'submitted_at']) {
  return (req: any, res: any, next: any) => {
    // Process each specified field - maintain original format without conversion
    dateFields.forEach(field => {
      if (req.body[field]) {
        try {
          // Keep the datetime exactly as received (no timezone conversion)
          // The datetime should already be in the desired format
          req.body[field] = req.body[field];
        } catch (error) {
          console.error(`Error processing date field ${field}:`, error);
          // Continue with original value if processing fails
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
