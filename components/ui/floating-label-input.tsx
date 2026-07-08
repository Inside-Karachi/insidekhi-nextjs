"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FloatingLabelInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id?: string;
}

export const FloatingLabelInput = React.forwardRef<
  HTMLInputElement,
  FloatingLabelInputProps
>(({ label, id, className, ...props }, ref) => {
  const autoId = React.useId();
  const inputId = id || `floating-${autoId}`;

  return (
    <div className="relative">
      <Input
        id={inputId}
        ref={ref}
        className={cn(
          "peer bg-transparent placeholder-transparent pt-6",
          "focus:ring-2 focus:ring-primary/50 focus:border-primary",
          className
        )}
        placeholder=" "
        {...props}
      />

      <Label
        htmlFor={inputId}
        className={cn(
          "absolute left-4 top-3.5 transition-all pointer-events-none text-muted-foreground",
          // floating behavior: show as placeholder by default, float when focused or when input has value
          "peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0",
          "peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-primary",
          "peer-not-placeholder-shown:scale-75 peer-not-placeholder-shown:-translate-y-3"
        )}
      >
        {label}
      </Label>
    </div>
  );
});

FloatingLabelInput.displayName = "FloatingLabelInput";

export default FloatingLabelInput;
