// Removed unused import
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ExportFilters {
  status?: string;
  categoryId?: string;
  isFeatured?: string;
  search?: string;
}

export interface ImportOptions {
  skipDuplicates: boolean;
  updateExisting: boolean;
  preview: boolean;
  dryRun: boolean;
  importId?: string;
}

/**
 * Validates CSV data structure and content
 */
export function validateCsvData(records: string[][]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (records.length === 0) {
    errors.push("CSV file is empty");
    return { isValid: false, errors };
  }

  // Check if we have at least a header row
  if (records.length < 1) {
    errors.push("CSV file must contain at least a header row");
    return { isValid: false, errors };
  }

  // Expected minimum columns (based on our export format)
  const minColumns = 10;
  const headerRow = records[0];

  if (headerRow.length < minColumns) {
    errors.push(
      `CSV must have at least ${minColumns} columns. Found: ${headerRow.length}`
    );
  }

  // Check for required headers
  const requiredHeaders = ["Name", "Address", "Phone"];
  const headerNames = headerRow.map((h) => h?.toString().trim() || "");

  for (const required of requiredHeaders) {
    if (
      !headerNames.some((h) => h.toLowerCase().includes(required.toLowerCase()))
    ) {
      errors.push(`Required column "${required}" not found in CSV headers`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Parses a timing string into structured format (supports multiple input formats).
 */
export function parseTimingString(timingString: string): Array<{
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}> {
  if (!timingString || timingString.trim() === "") {
    return [];
  }

  const dayMap: { [key: string]: number } = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };

  const timings: Array<{
    dayOfWeek: number;
    openTime: string | null;
    closeTime: string | null;
    isClosed: boolean;
  }> = [];

  // Clean the input string
  const cleanedString = timingString
    .replace(/â€“/g, "-") // Fix encoding issues
    .replace(/–/g, "-") // Fix em dash
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();

  // Split by common separators
  const entries = cleanedString.split(/\s*\|\s*/);

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    // Handle different formats
    const parts = trimmed.split(/\s*,\s*/);
    if (parts.length >= 2) {
      const dayPart = parts[0].trim();
      const timePart = parts.slice(1).join(", ").trim();

      // Parse day ranges like "Monday to Friday", "Sunday to Thursday", etc.
      const dayRangeMatch = dayPart.match(/^(\w+)\s+to\s+(\w+)$/i);
      if (dayRangeMatch) {
        const [, startDay, endDay] = dayRangeMatch;
        const startIndex = dayMap[startDay.toLowerCase()];
        const endIndex = dayMap[endDay.toLowerCase()];

        if (startIndex !== undefined && endIndex !== undefined) {
          // Add timing for each day in range
          for (let i = startIndex; i <= endIndex; i++) {
            const parsedTime = parseTimeRange(timePart);
            if (parsedTime) {
              timings.push({
                dayOfWeek: i,
                openTime: parsedTime.openTime,
                closeTime: parsedTime.closeTime,
                isClosed: parsedTime.isClosed,
              });
            }
          }
          continue;
        }
      }

      // Parse single day like "Monday", "Sunday", etc.
      const singleDayMatch = dayPart.match(/^(\w+)$/i);
      if (singleDayMatch) {
        const [, dayName] = singleDayMatch;
        const dayIndex = dayMap[dayName.toLowerCase()];

        if (dayIndex !== undefined) {
          const parsedTime = parseTimeRange(timePart);
          if (parsedTime) {
            timings.push({
              dayOfWeek: dayIndex,
              openTime: parsedTime.openTime,
              closeTime: parsedTime.closeTime,
              isClosed: parsedTime.isClosed,
            });
          }
          continue;
        }
      }

      // Parse day range with dash like "Monday-Saturday"
      const dashRangeMatch = dayPart.match(/^(\w+)-(\w+)$/i);
      if (dashRangeMatch) {
        const [, startDay, endDay] = dashRangeMatch;
        const startIndex = dayMap[startDay.toLowerCase()];
        const endIndex = dayMap[endDay.toLowerCase()];

        if (startIndex !== undefined && endIndex !== undefined) {
          for (let i = startIndex; i <= endIndex; i++) {
            const parsedTime = parseTimeRange(timePart);
            if (parsedTime) {
              timings.push({
                dayOfWeek: i,
                openTime: parsedTime.openTime,
                closeTime: parsedTime.closeTime,
                isClosed: parsedTime.isClosed,
              });
            }
          }
          continue;
        }
      }
    }

    // Fallback: try to parse as "Day: time" format
    const colonParts = trimmed.split(":");
    if (colonParts.length === 2) {
      const [dayPart, timePart] = colonParts;
      const dayIndex = dayMap[dayPart.toLowerCase().trim()];

      if (dayIndex !== undefined) {
        const parsedTime = parseTimeRange(timePart.trim());
        if (parsedTime) {
          timings.push({
            dayOfWeek: dayIndex,
            openTime: parsedTime.openTime,
            closeTime: parsedTime.closeTime,
            isClosed: parsedTime.isClosed,
          });
        }
      }
    }
  }

  return timings;
}

/**
 * Parse time range string into open/close times
 */
function parseTimeRange(timeRange: string): {
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
} | null {
  if (!timeRange) return null;

  const trimmed = timeRange.trim().toLowerCase();

  // Check if closed
  if (trimmed.includes("closed") || trimmed === "") {
    return { openTime: null, closeTime: null, isClosed: true };
  }

  // Handle various time formats
  // Format: "5 pm- 11:30 pm" or "11:30am-2:30am"
  const timeMatch = trimmed.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm|am|pm))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|am|pm))/i
  );

  if (timeMatch) {
    const [, openTime, closeTime] = timeMatch;
    return {
      openTime: normalizeTime(openTime),
      closeTime: normalizeTime(closeTime),
      isClosed: false,
    };
  }

  // Format: "12pm - 1am" or "8am - 1am"
  const simpleMatch = trimmed.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm|am|pm))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|am|pm))/i
  );

  if (simpleMatch) {
    const [, openTime, closeTime] = simpleMatch;
    return {
      openTime: normalizeTime(openTime),
      closeTime: normalizeTime(closeTime),
      isClosed: false,
    };
  }

  // Format: "24/7" or "24 hours" or "all day"
  if (
    trimmed.includes("24/7") ||
    trimmed.includes("24 hours") ||
    trimmed.includes("all day")
  ) {
    return {
      openTime: "00:00",
      closeTime: "23:59",
      isClosed: false,
    };
  }

  // Format: "open 24 hours"
  if (trimmed.includes("open 24")) {
    return {
      openTime: "00:00",
      closeTime: "23:59",
      isClosed: false,
    };
  }

  // Format: Single time like "12:00 PM" (assume it's open time, close time unknown)
  const singleTimeMatch = trimmed.match(
    /^(\d{1,2}(?::\d{2})?\s*(?:am|pm|am|pm))$/i
  );
  if (singleTimeMatch) {
    const [, timeStr] = singleTimeMatch;
    const normalizedTime = normalizeTime(timeStr);
    if (normalizedTime) {
      return {
        openTime: normalizedTime,
        closeTime: null, // Unknown close time
        isClosed: false,
      };
    }
  }

  // Format: "from X to Y" or "X to Y"
  const fromToMatch = trimmed.match(
    /(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm|am|pm))\s+to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|am|pm))/i
  );
  if (fromToMatch) {
    const [, openTime, closeTime] = fromToMatch;
    return {
      openTime: normalizeTime(openTime),
      closeTime: normalizeTime(closeTime),
      isClosed: false,
    };
  }

  return null;
}

/**
 * Normalizes time string to HH:MM format
 */
function normalizeTime(timeStr: string): string | null {
  if (!timeStr) return null;

  const trimmed = timeStr.trim().toLowerCase();

  // Handle 24-hour format
  const hour24Match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (hour24Match) {
    const [, hours, minutes] = hour24Match;
    const hour = parseInt(hours);
    if (hour >= 0 && hour <= 23) {
      return `${hour.toString().padStart(2, "0")}:${minutes}`;
    }
  }

  // Handle 12-hour format
  const hour12Match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (hour12Match) {
    const [, hours, minutes = "0", period] = hour12Match;
    let hour = parseInt(hours);

    if (period.toLowerCase() === "pm" && hour !== 12) {
      hour += 12;
    } else if (period.toLowerCase() === "am" && hour === 12) {
      hour = 0;
    }

    return `${hour.toString().padStart(2, "0")}:${minutes.padStart(2, "0")}`;
  }

  // If we can't parse it, return as-is (might be handled differently)
  return trimmed;
}

/**
 * Generates a unique slug from name
 */
export function generateSlug(
  name: string,
  existingSlugs: Set<string> = new Set()
): string {
  if (!name) return `listing-${Date.now()}`;

  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens

  let slug = baseSlug;
  let counter = 1;

  // Ensure uniqueness
  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  existingSlugs.add(slug);
  return slug;
}

/**
 * Sanitizes text input
 */
export function sanitizeText(text: string): string {
  if (!text) return "";

  return text
    .trim()
    .replace(/\s+/g, " ") // Normalize whitespace
    .substring(0, 1000); // Limit length
}

/**
 * Validates and sanitizes text for database operations (SQL-injection hardening).
 */
export function sanitizeForSQL(text: string): string {
  if (!text) return "";

  let sanitized = text.trim();

  // Remove potentially dangerous characters that could be used for SQL injection
  sanitized = sanitized
    .replace(/['"]/g, "") // Remove quotes
    .replace(/[\\]/g, "") // Remove backslashes
    .replace(/;/g, "") // Remove semicolons
    .replace(/--/g, "") // Remove SQL comments
    .replace(/\/\*/g, "") // Remove block comment starts
    .replace(/\*\//g, "") // Remove block comment ends
    .replace(/xp_/gi, "") // Remove extended procedure calls
    .replace(/sp_/gi, "") // Remove system procedure calls
    .replace(/exec/gi, "") // Remove exec statements
    .replace(/union/gi, "") // Remove union statements
    .replace(/select/gi, "") // Remove select statements
    .replace(/insert/gi, "") // Remove insert statements
    .replace(/update/gi, "") // Remove update statements
    .replace(/delete/gi, "") // Remove delete statements
    .replace(/drop/gi, "") // Remove drop statements
    .replace(/create/gi, "") // Remove create statements
    .replace(/alter/gi, "") // Remove alter statements
    .replace(/script/gi, "") // Remove script tags
    .replace(/javascript:/gi, "") // Remove javascript protocol
    .replace(/vbscript:/gi, "") // Remove vbscript protocol
    .replace(/onload/gi, "") // Remove onload events
    .replace(/onerror/gi, "") // Remove onerror events
    .replace(/onclick/gi, "") // Remove onclick events
    .replace(/<script/gi, "") // Remove script tags
    .replace(/<\/script>/gi, "") // Remove closing script tags
    .replace(/<iframe/gi, "") // Remove iframe tags
    .replace(/<\/iframe>/gi, "") // Remove closing iframe tags
    .replace(/\s+/g, " ") // Normalize whitespace
    .substring(0, 1000); // Limit length

  return sanitized;
}

/**
 * Validates email format and prevents injection
 */
export function validateAndSanitizeEmail(email: string): {
  isValid: boolean;
  sanitized: string;
  error?: string;
} {
  if (!email || email.trim() === "") {
    return { isValid: true, sanitized: "" }; // Empty emails are allowed
  }

  const sanitized = sanitizeForSQL(email.trim().toLowerCase());

  // Basic email validation regex
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(sanitized)) {
    return {
      isValid: false,
      sanitized: "",
      error: "Invalid email format",
    };
  }

  // Additional length check
  if (sanitized.length > 254) {
    return {
      isValid: false,
      sanitized: "",
      error: "Email too long (max 254 characters)",
    };
  }

  return { isValid: true, sanitized };
}

/**
 * Validates and sanitizes URLs
 */
export function validateAndSanitizeUrl(url: string): {
  isValid: boolean;
  sanitized: string;
  error?: string;
} {
  if (!url || url.trim() === "") {
    return { isValid: true, sanitized: "" };
  }

  const sanitized = sanitizeForSQL(url.trim());

  try {
    const urlObj = new URL(sanitized);

    // Only allow http and https protocols
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return {
        isValid: false,
        sanitized: "",
        error: "Only HTTP and HTTPS URLs are allowed",
      };
    }

    // Check for overly long URLs
    if (sanitized.length > 2000) {
      return {
        isValid: false,
        sanitized: "",
        error: "URL too long (max 2000 characters)",
      };
    }

    return { isValid: true, sanitized };
  } catch {
    return {
      isValid: false,
      sanitized: "",
      error: "Invalid URL format",
    };
  }
}

/**
 * Validates phone numbers for Pakistani format
 */
export function validateAndSanitizePhone(phone: string): {
  isValid: boolean;
  sanitized: string;
  error?: string;
} {
  if (!phone || phone.trim() === "") {
    return { isValid: true, sanitized: "" };
  }

  const sanitized = sanitizeForSQL(phone.trim());

  // Remove all non-digit characters except + and spaces
  let cleanNumber = sanitized.replace(/[^\d+\-\s]/g, "");

  // Handle Pakistani phone number formats
  if (cleanNumber.startsWith("+92")) {
    // Already in international format
    cleanNumber = cleanNumber.replace(/\s+/g, "");
  } else if (cleanNumber.startsWith("92")) {
    // Missing + prefix
    cleanNumber = "+" + cleanNumber.replace(/\s+/g, "");
  } else if (cleanNumber.startsWith("0")) {
    // Local format starting with 0
    if (cleanNumber.startsWith("021")) {
      // Karachi landline - keep as is
      cleanNumber = cleanNumber.replace(/\s+/g, "");
    } else if (cleanNumber.startsWith("03")) {
      // Mobile number starting with 0
      cleanNumber = "+92" + cleanNumber.substring(1).replace(/\s+/g, "");
    } else {
      // Other landline formats
      cleanNumber = cleanNumber.replace(/\s+/g, "");
    }
  } else if (cleanNumber.startsWith("3")) {
    // Mobile number without 0 prefix
    cleanNumber = "+92" + cleanNumber.replace(/\s+/g, "");
  } else {
    // Invalid format
    return {
      isValid: false,
      sanitized: "",
      error: "Invalid Pakistani phone number format",
    };
  }

  // Final validation - check length
  const digitsOnly = cleanNumber.replace(/[^\d]/g, "");
  if (digitsOnly.length < 10 || digitsOnly.length > 13) {
    return {
      isValid: false,
      sanitized: "",
      error: "Phone number must be 10-13 digits",
    };
  }

  return { isValid: true, sanitized: cleanNumber };
}

/**
 * Validates coordinates
 */
export function validateCoordinates(
  lat: string,
  lng: string
): {
  isValid: boolean;
  latitude: number | null;
  longitude: number | null;
  error?: string;
} {
  if (!lat || !lng || lat.trim() === "" || lng.trim() === "") {
    return { isValid: true, latitude: null, longitude: null };
  }

  const latNum = parseFloat(lat.trim());
  const lngNum = parseFloat(lng.trim());

  if (isNaN(latNum) || isNaN(lngNum)) {
    return {
      isValid: false,
      latitude: null,
      longitude: null,
      error: "Invalid coordinate format",
    };
  }

  // Validate latitude range (-90 to 90)
  if (latNum < -90 || latNum > 90) {
    return {
      isValid: false,
      latitude: null,
      longitude: null,
      error: "Latitude must be between -90 and 90",
    };
  }

  // Validate longitude range (-180 to 180)
  if (lngNum < -180 || lngNum > 180) {
    return {
      isValid: false,
      latitude: null,
      longitude: null,
      error: "Longitude must be between -180 and 180",
    };
  }

  // Check for Karachi bounds (optional but helpful for data quality)
  if (latNum < 24.5 || latNum > 25.5 || lngNum < 66.5 || lngNum > 68.0) {
    // Log warning but don't fail - could be valid for other areas
    console.warn(
      `Coordinates (${latNum}, ${lngNum}) are outside typical Karachi bounds`
    );
  }

  return {
    isValid: true,
    latitude: latNum,
    longitude: lngNum,
  };
}

/**
 * Checks for duplicate listings
 */
export async function checkForDuplicates(
  supabase: SupabaseClient,
  name: string,
  address: string,
  phone?: string
): Promise<{ isDuplicate: boolean; existingId?: number }> {
  let query = supabase
    .from("listings")
    .select("id, name, address, phone_number")
    .or(`name.ilike.%${name}%,address.ilike.%${address}%`);

  if (phone) {
    query = query.or(`phone_number.eq.${phone}`);
  }

  const { data } = await query.limit(5);

  if (data && data.length > 0) {
    // Simple fuzzy matching - could be enhanced
    for (const existing of data) {
      const nameMatch = existing.name
        ?.toLowerCase()
        .includes(name.toLowerCase().substring(0, 10));
      const addressMatch = existing.address
        ?.toLowerCase()
        .includes(address.toLowerCase().substring(0, 10));

      if (nameMatch && addressMatch) {
        return { isDuplicate: true, existingId: existing.id };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Validates if a CSV row contains valid listing data (not metadata/header rows)
 */
export function isValidListingRow(record: string[]): boolean {
  if (!record || record.length < 3) return false;

  // Detect CSV format based on first column
  const isClientFormat =
    record[0]?.includes("ChIJ") || record[0] === "DHA PHASE 2"; // Client format starts with Place ID or header

  let name: string;
  let address: string;
  let phone: string;
  let description: string;

  if (isClientFormat) {
    // Client CSV format: Place ID, Membership, Name, Address, Phone, Email, ...
    [, , name, address, phone, , , , description] = record;
  } else {
    // Export CSV format: Membership, Name, Address, Phone, Email, ...
    [, name, address, phone] = record;
    description = ""; // Not available in export format
  }

  // Skip rows that look like headers or metadata
  // Check if name field contains header-like text or is empty
  if (!name || typeof name !== "string") return false;

  const nameStr = name.toString().trim().toLowerCase();

  // Skip obvious header/metadata rows
  if (
    nameStr === "" ||
    nameStr.includes("place id") ||
    nameStr.includes("membership") ||
    nameStr.includes("name") ||
    nameStr.includes("address") ||
    nameStr.includes("phone") ||
    nameStr.includes("email") ||
    nameStr === "n/a" ||
    nameStr === "na" ||
    nameStr.length < 2 ||
    // Skip rows that look like area names without actual business data
    (nameStr.split(" ").length <= 3 && !address && !phone && !description)
  ) {
    return false;
  }

  // Must have at least name and address for a valid listing
  const hasBasicInfo =
    nameStr.length > 2 &&
    Boolean(address) &&
    address.toString().trim().length > 5;

  return hasBasicInfo;
}

/**
 * Sanitizes dirty client data.
 */
export function sanitizeListingField(
  value: unknown,
  fieldType: string
): unknown {
  if (
    !value ||
    value === "N/A" ||
    value === "n/a" ||
    value === "NA" ||
    value === ""
  ) {
    return null;
  }

  const strValue = value.toString().trim();

  // Additional check for obviously invalid data
  if (strValue.length === 0 || strValue === "-" || strValue === "--") {
    return null;
  }

  switch (fieldType) {
    case "phone":
      // Clean phone numbers - handle Pakistani format properly
      const cleanNumber = strValue
        .replace(/[\s\-\(\)\[\]\{\}]/g, "") // Remove various separators
        .replace(/[^\d\+\-]/g, ""); // Keep only digits, +, -

      // If already starts with +92 or 92, keep as is
      if (cleanNumber.startsWith("+92") || cleanNumber.startsWith("92")) {
        return cleanNumber.startsWith("92") ? `+${cleanNumber}` : cleanNumber;
      }

      // If starts with 0 but NOT 021 (Karachi landline), replace with +92-
      if (cleanNumber.startsWith("0") && !cleanNumber.startsWith("021")) {
        return `+92-${cleanNumber.substring(1)}`;
      }

      // If starts with 021 (Karachi landline), keep as is but clean
      if (cleanNumber.startsWith("021")) {
        return cleanNumber;
      }

      // If starts with 3 (mobile), add +92- prefix
      if (cleanNumber.startsWith("3")) {
        return `+92-${cleanNumber}`;
      }

      // For any other format, return as-is but clean
      return cleanNumber || null;

    case "email":
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const cleanEmail = strValue.toLowerCase().trim();

      // Skip obviously invalid entries like "N/A", "n/a", etc.
      if (["n/a", "na", "none", "null", ""].includes(cleanEmail)) {
        return null;
      }

      return emailRegex.test(cleanEmail) ? cleanEmail : null;

    case "url":
      // Clean URLs and handle various formats
      if (!strValue) return null;

      let cleanUrl = strValue.trim();

      // Add protocol if missing
      if (!cleanUrl.match(/^https?:\/\//i)) {
        // Check if it looks like a URL
        if (cleanUrl.includes(".") && !cleanUrl.includes(" ")) {
          cleanUrl = `https://${cleanUrl}`;
        } else {
          return null; // Not a valid URL
        }
      }

      // For very long URLs (like Google Maps), do basic validation
      if (cleanUrl.length > 2000) {
        // Check if it starts with http/https and contains a domain
        const basicUrlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
        return basicUrlPattern.test(cleanUrl) ? cleanUrl : null;
      }

      // Basic URL validation for normal URLs
      try {
        new URL(cleanUrl);
        return cleanUrl;
      } catch {
        return null;
      }

    case "boolean":
      const lowerValue = strValue.toLowerCase();
      return ["true", "1", "yes", "y", "on", "enabled"].includes(lowerValue);

    case "number":
      const num = parseFloat(strValue.replace(/[^\d.-]/g, ""));
      return isNaN(num) ? null : num;

    case "text":
    default:
      // Remove extra whitespace, normalize quotes, handle special characters
      const cleaned = strValue
        .replace(/\s+/g, " ") // Normalize whitespace
        .replace(/[""]/g, '"') // Normalize quotes
        .replace(/['']/, "'") // Normalize apostrophes
        .replace(/&amp;/g, "&") // HTML entities
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/â€™/g, "'") // Encoding issues
        .replace(/â€œ/g, '"')
        .replace(/â€/g, '"')
        .replace(/â€"/g, '"')
        .replace(/â€"/g, '"')
        .trim();

      // If the result is just whitespace or special characters, return null
      if (cleaned.replace(/[^a-zA-Z0-9]/g, "").length === 0) {
        return null;
      }

      // Limit length to prevent database issues
      return cleaned.substring(0, 2000);
  }
}
