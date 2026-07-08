/**
 * OPENING HOURS PARSER
 * Parses Peekaboo timings strings into structured opening hours format
 *
 * Supported Formats:
 * - "Mon-Fri: 10AM-10PM, Sat-Sun: 12PM-11PM"
 * - "9:00 AM - 9:00 PM (Daily)"
 * - "24/7"
 * - "Closed on Mondays"
 * - "10:00-22:00"
 */

export interface ParsedOpeningHour {
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  open_time: string; // "10:00:00" format
  close_time: string; // "22:00:00" format
  is_closed: boolean;
}

export class OpeningHoursParser {
  private readonly DAY_NAMES: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };

  private readonly WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri
  private readonly WEEKEND = [0, 6]; // Sun, Sat
  private readonly ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]; // Every day

  /**
   * Parse timings string to structured opening hours
   */
  parse(timings: string | null | undefined): ParsedOpeningHour[] {
    if (!timings || timings.trim() === "") {
      return [];
    }

    const cleaned = timings.trim().toLowerCase();

    // Handle special cases
    if (this.is24_7(cleaned)) {
      return this.create24_7Hours();
    }

    if (this.isClosed(cleaned)) {
      return this.createClosedHours();
    }

    // Try parsing standard formats
    return this.parseStandardFormat(cleaned);
  }

  /**
   * Parse detailed daily timings object
   */
  parseEveryDayTimings(
    timings: Record<string, string> | undefined | null
  ): ParsedOpeningHour[] {
    if (!timings || Object.keys(timings).length === 0) {
      return [];
    }

    const hours: ParsedOpeningHour[] = [];

    for (const [dayName, timeStr] of Object.entries(timings)) {
      const normalizedDay = dayName.toLowerCase().trim();
      const dayIndex = this.DAY_NAMES[normalizedDay];

      if (dayIndex !== undefined) {
        const cleanedTime = timeStr.trim().toLowerCase();
        let parsed: ParsedOpeningHour[] = [];

        // Check for 24 hours
        if (this.is24_7(cleanedTime)) {
          parsed = [
            {
              day_of_week: dayIndex,
              open_time: "00:00:00",
              close_time: "23:59:59",
              is_closed: false,
            },
          ];
        }
        // Check for closed
        else if (this.isClosed(cleanedTime)) {
          parsed = [
            {
              day_of_week: dayIndex,
              open_time: "00:00:00",
              close_time: "00:00:00",
              is_closed: true,
            },
          ];
        }
        // Standard parse
        else {
          // extractTimeRange returns { open_time, close_time, is_closed }
          // We need to wrap it with day_of_week
          const timeRange = this.extractTimeRange(cleanedTime);
          if (timeRange) {
            parsed = [
              {
                ...timeRange,
                day_of_week: dayIndex,
              },
            ];
          }
        }

        if (parsed.length > 0) {
          hours.push(...parsed);
        }
      }
    }

    return hours;
  }

  /**
   * Check if location is 24/7
   */
  private is24_7(timings: string): boolean {
    return (
      timings.includes("24/7") ||
      timings.includes("24 hours") ||
      timings.includes("open 24")
    );
  }

  /**
   * Check if location is always closed
   */
  private isClosed(timings: string): boolean {
    return (
      timings.includes("permanently closed") ||
      timings.includes("temporarily closed") ||
      timings === "closed"
    );
  }

  /**
   * Create 24/7 opening hours
   */
  private create24_7Hours(): ParsedOpeningHour[] {
    return this.ALL_DAYS.map((day) => ({
      day_of_week: day,
      open_time: "00:00:00",
      close_time: "23:59:59",
      is_closed: false,
    }));
  }

  /**
   * Create all-day closed hours
   */
  private createClosedHours(): ParsedOpeningHour[] {
    return this.ALL_DAYS.map((day) => ({
      day_of_week: day,
      open_time: "00:00:00",
      close_time: "00:00:00",
      is_closed: true,
    }));
  }

  /**
   * Parse standard timings format
   * Examples:
   * - "mon-fri: 10am-10pm, sat-sun: 12pm-11pm"
   * - "9:00 am - 9:00 pm (daily)"
   * - "10:00-22:00"
   */
  private parseStandardFormat(timings: string): ParsedOpeningHour[] {
    const hours: ParsedOpeningHour[] = [];

    // Split by comma or semicolon for multiple ranges
    const segments = timings.split(/[,;]/).map((s) => s.trim());

    for (const segment of segments) {
      const parsed = this.parseSegment(segment);
      hours.push(...parsed);
    }

    // If no hours parsed, try as single daily range
    if (hours.length === 0) {
      const dailyHours = this.parseDailyRange(timings);
      if (dailyHours) {
        return this.ALL_DAYS.map((day) => ({
          ...dailyHours,
          day_of_week: day,
        }));
      }
    }

    return hours;
  }

  /**
   * Parse single segment (e.g., "mon-fri: 10am-10pm")
   */
  private parseSegment(segment: string): ParsedOpeningHour[] {
    const hours: ParsedOpeningHour[] = [];

    // Check for "daily" or "everyday"
    if (segment.includes("daily") || segment.includes("everyday")) {
      const timeRange = this.extractTimeRange(segment);
      if (timeRange) {
        return this.ALL_DAYS.map((day) => ({
          ...timeRange,
          day_of_week: day,
        }));
      }
    }

    // Extract days and times
    const colonIndex = segment.indexOf(":");
    if (colonIndex === -1) {
      // No colon - might be just time range for all days
      const timeRange = this.extractTimeRange(segment);
      if (timeRange) {
        return this.ALL_DAYS.map((day) => ({
          ...timeRange,
          day_of_week: day,
        }));
      }
      return [];
    }

    const daysPart = segment.substring(0, colonIndex).trim();
    const timesPart = segment.substring(colonIndex + 1).trim();

    // Parse days
    const days = this.parseDayRange(daysPart);
    if (days.length === 0) return [];

    // Parse time range
    const timeRange = this.extractTimeRange(timesPart);
    if (!timeRange) return [];

    // Create hours for each day
    for (const day of days) {
      hours.push({
        ...timeRange,
        day_of_week: day,
      });
    }

    return hours;
  }

  /**
   * Parse day range (e.g., "mon-fri", "sat-sun", "monday")
   */
  private parseDayRange(daysPart: string): number[] {
    const days: number[] = [];

    // Check for range (e.g., "mon-fri")
    const rangeMatch = daysPart.match(/(\w+)\s*-\s*(\w+)/);

    if (rangeMatch) {
      const startDay = this.DAY_NAMES[rangeMatch[1]];
      const endDay = this.DAY_NAMES[rangeMatch[2]];

      if (startDay !== undefined && endDay !== undefined) {
        // Generate range
        let current = startDay;
        while (true) {
          days.push(current);
          if (current === endDay) break;
          current = (current + 1) % 7;
        }
        return days;
      }
    }

    // Check for single day
    for (const [name, num] of Object.entries(this.DAY_NAMES)) {
      if (daysPart.includes(name)) {
        days.push(num);
      }
    }

    return days;
  }

  /**
   * Extract time range from string
   */
  private extractTimeRange(
    timeStr: string
  ): { open_time: string; close_time: string; is_closed: boolean } | null {
    // Remove parentheses and extra text
    const cleaned = timeStr.replace(/[()]/g, "").trim();

    // PRIORITY 1: Match HH:MM:SS-HH:MM:SS format (direct from Peekaboo API)
    // Example: "12:00:00-23:59:00", "10:00:00-22:00:00"
    const hhmmssPattern =
      /(\d{2}):(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2}):(\d{2})/;
    const hhmmssMatch = cleaned.match(hhmmssPattern);

    if (hhmmssMatch) {
      const openHour = parseInt(hhmmssMatch[1]);
      const openMin = parseInt(hhmmssMatch[2]);
      const openSec = parseInt(hhmmssMatch[3]);
      const closeHour = parseInt(hhmmssMatch[4]);
      const closeMin = parseInt(hhmmssMatch[5]);
      const closeSec = parseInt(hhmmssMatch[6]);

      // Validate ranges
      if (
        openHour >= 0 &&
        openHour <= 23 &&
        openMin >= 0 &&
        openMin <= 59 &&
        closeHour >= 0 &&
        closeHour <= 23 &&
        closeMin >= 0 &&
        closeMin <= 59
      ) {
        return {
          open_time: `${openHour.toString().padStart(2, "0")}:${openMin
            .toString()
            .padStart(2, "0")}:${openSec.toString().padStart(2, "0")}`,
          close_time: `${closeHour.toString().padStart(2, "0")}:${closeMin
            .toString()
            .padStart(2, "0")}:${closeSec.toString().padStart(2, "0")}`,
          is_closed: false,
        };
      }
    }

    // PRIORITY 2: Match AM/PM patterns
    // Examples: "10am-10pm", "9:00 am - 9:00 pm", "10:00-22:00"
    const timePattern =
      /(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?\s*-\s*(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?/;
    const match = cleaned.match(timePattern);

    if (!match) return null;

    const openHour = parseInt(match[1]);
    const openMin = match[2] ? parseInt(match[2]) : 0;
    const openPeriod = match[3]?.toLowerCase();

    const closeHour = parseInt(match[4]);
    const closeMin = match[5] ? parseInt(match[5]) : 0;
    const closePeriod = match[6]?.toLowerCase();

    // Convert to 24-hour format
    const open24 = this.to24Hour(openHour, openMin, openPeriod);
    const close24 = this.to24Hour(closeHour, closeMin, closePeriod);

    if (!open24 || !close24) return null;

    return {
      open_time: open24,
      close_time: close24,
      is_closed: false,
    };
  }

  /**
   * Parse daily range (when no days specified)
   */
  private parseDailyRange(
    timings: string
  ): Omit<ParsedOpeningHour, "day_of_week"> | null {
    const timeRange = this.extractTimeRange(timings);
    return timeRange;
  }

  /**
   * Convert to 24-hour format
   */
  private to24Hour(
    hour: number,
    minute: number,
    period?: string
  ): string | null {
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }

    let hour24 = hour;

    if (period) {
      if (period === "pm" && hour !== 12) {
        hour24 = hour + 12;
      } else if (period === "am" && hour === 12) {
        hour24 = 0;
      }
    }

    // Ensure valid range
    if (hour24 > 23) hour24 = 23;

    return `${hour24.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}:00`;
  }

  /**
   * Validate parsed hours
   */
  validate(hours: ParsedOpeningHour[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (hours.length === 0) {
      errors.push("No opening hours provided");
    }

    // Check for duplicate days
    const days = new Set<number>();
    for (const hour of hours) {
      if (days.has(hour.day_of_week)) {
        errors.push(`Duplicate entry for day ${hour.day_of_week}`);
      }
      days.add(hour.day_of_week);

      // Validate day range
      if (hour.day_of_week < 0 || hour.day_of_week > 6) {
        errors.push(`Invalid day_of_week: ${hour.day_of_week}`);
      }

      // Validate time format
      if (!/^\d{2}:\d{2}:\d{2}$/.test(hour.open_time)) {
        errors.push(`Invalid open_time format: ${hour.open_time}`);
      }
      if (!/^\d{2}:\d{2}:\d{2}$/.test(hour.close_time)) {
        errors.push(`Invalid close_time format: ${hour.close_time}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
export const openingHoursParser = new OpeningHoursParser();
