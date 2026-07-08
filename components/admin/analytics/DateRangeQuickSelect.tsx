"use client";

import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DateRangePreset } from "@/types/analytics";

interface DateRangeQuickSelectProps {
  value: DateRangePreset;
  onChange: (preset: DateRangePreset) => void;
  disabled?: boolean;
}

const presetOptions: Array<{ value: DateRangePreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

/**
 * Date range filter for analytics - inline button group style
 * Follows the same pattern as filters in other admin pages
 */
export function DateRangeQuickSelect({
  value,
  onChange,
  disabled,
}: DateRangeQuickSelectProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="p-1 bg-primary/10 rounded-md">
          <Calendar className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-medium">Date Range:</span>
      </div>

      {/* Preset Buttons */}
      <div className="flex gap-2">
        {presetOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? "default" : "outline"}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className="h-9"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
