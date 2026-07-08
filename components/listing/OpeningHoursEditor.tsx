import * as React from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";
import {
  OpeningHour,
  DAY_NAMES_MONDAY_FIRST,
  dbDayToEditorIndex,
} from "@/types/listing.types";
import { toast } from "@/hooks/use-toast";

export interface OpeningHoursEditorProps {
  value: OpeningHour[];
  onChange: (value: OpeningHour[]) => void;
  disabled?: boolean;
  headerSuffix?: React.ReactNode;
  description?: React.ReactNode;
  customAction?: React.ReactNode;
}

/**
 * OpeningHoursEditor Component
 *
 * Displays opening hours with Monday as the first day (Pakistan convention).
 * The component handles transformation between:
 * - Editor display: Monday-first (index 0 = Monday)
 * - Database storage: Sunday-first (day_of_week 0 = Sunday)
 *
 * The `value` prop contains OpeningHour objects with dayOfWeek in database format.
 * We transform these for display and maintain the mapping throughout.
 */
export function OpeningHoursEditor({
  value,
  onChange,
  disabled,
  headerSuffix,
  description,
  customAction,
}: OpeningHoursEditorProps) {
  /**
   * Sort hours for Monday-first display
   * Input: Array of OpeningHour with dayOfWeek in DB format (0=Sunday)
   * Output: Sorted array with Monday first for display
   */
  const sortedHours = React.useMemo(() => {
    return [...value].sort((a, b) => {
      const indexA = dbDayToEditorIndex(a.dayOfWeek);
      const indexB = dbDayToEditorIndex(b.dayOfWeek);
      return indexA - indexB;
    });
  }, [value]);

  const handleChange = (
    dayOfWeek: number, // DB format: 0=Sunday
    field: keyof OpeningHour,
    fieldValue: string | boolean | null
  ) => {
    const updated = value.map((item) =>
      item.dayOfWeek === dayOfWeek ? { ...item, [field]: fieldValue } : item
    );
    onChange(updated);
  };

  /**
   * Smart Fill: Copy Monday's hours to all other days
   * Monday in DB format is dayOfWeek = 1
   */
  const handleSmartFill = () => {
    const monday = value.find((item) => item.dayOfWeek === 1); // Monday is day 1 in DB

    if (
      !monday ||
      (!monday.isClosed && !monday.openTime && !monday.closeTime)
    ) {
      toast({
        title: "Please fill Monday's hours first",
        description:
          "Set Monday's opening and closing time, then use Smart Fill.",
        variant: "destructive",
      });
      return;
    }

    const filled = value.map((item) =>
      item.dayOfWeek === 1 // Keep Monday as-is
        ? item
        : {
            ...item,
            openTime: monday.openTime,
            closeTime: monday.closeTime,
            isClosed: monday.isClosed,
          }
    );

    onChange(filled);

    toast({
      title: "Hours copied successfully",
      description: "Monday's hours have been applied to all days.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header + Smart Fill */}
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="text-lg font-medium">Opening Hours</h3>
          {headerSuffix}
        </div>
        {customAction ? (
          customAction
        ) : (
          <button
            type="button"
            className="px-4 py-2 rounded-md bg-primary text-white text-xs font-semibold shadow hover:bg-primary/90 transition disabled:opacity-50"
            onClick={handleSmartFill}
            disabled={disabled || value.length === 0}
            aria-label="Smart Fill: Copy Monday's hours to all days"
          >
            Smart Fill All Days
          </button>
        )}
      </div>

      {description && (
        <div className="text-sm text-muted-foreground">{description}</div>
      )}

      {/* Hours Grid - Display in Monday-first order */}
      <div className="space-y-4">
        {sortedHours.map((item) => {
          const editorIndex = dbDayToEditorIndex(item.dayOfWeek);
          const dayName = DAY_NAMES_MONDAY_FIRST[editorIndex];

          return (
            <div
              key={item.dayOfWeek}
              className="flex items-center gap-4 p-4 rounded-lg border bg-card"
            >
              <Label className="w-24 font-medium">{dayName}</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={item.isClosed}
                  onCheckedChange={(checked) =>
                    handleChange(item.dayOfWeek, "isClosed", checked)
                  }
                  disabled={disabled}
                  id={`closed-${item.dayOfWeek}`}
                />
                <Label htmlFor={`closed-${item.dayOfWeek}`} className="text-sm">
                  Closed
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={item.openTime || ""}
                  onChange={(e) =>
                    handleChange(item.dayOfWeek, "openTime", e.target.value)
                  }
                  disabled={item.isClosed || disabled}
                  className="w-28"
                  placeholder="09:00"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="time"
                  value={item.closeTime || ""}
                  onChange={(e) =>
                    handleChange(item.dayOfWeek, "closeTime", e.target.value)
                  }
                  disabled={item.isClosed || disabled}
                  className="w-28"
                  placeholder="17:00"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
