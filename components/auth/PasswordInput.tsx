"use client";

import * as React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// Use React's built-in InputHTMLAttributes to correctly type the component props.
// This allows all standard input attributes (id, name, placeholder, etc.) to be passed through.
export type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  showStrength?: boolean;
};

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, value, showStrength = true, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    // The password strength logic is handled entirely within this memoized calculation.
    const passwordStrength = React.useMemo(() => {
      let score = 0;
      const pass = String(value || "");
      if (pass.length > 8) score++;
      if (/[A-Z]/.test(pass)) score++;
      if (/[0-9]/.test(pass)) score++;
      if (/[^A-Za-z0-9]/.test(pass)) score++;

      switch (score) {
        case 1:
          return { width: "25%", color: "bg-red-500", label: "Weak" };
        case 2:
          return { width: "50%", color: "bg-orange-500", label: "Medium" };
        case 3:
          return { width: "75%", color: "bg-yellow-500", label: "Strong" };
        case 4:
          return { width: "100%", color: "bg-green-500", label: "Very Strong" };
        default:
          return { width: "0%", color: "", label: "" };
      }
    }, [value]);

    return (
      <div className="grid gap-2">
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type={showPassword ? "text" : "password"}
            className={cn("pl-10 pr-10", className)} // Space for icons
            ref={ref}
            value={value}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm transition-colors duration-200 flex items-center justify-center"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {showStrength && String(value || "").length > 0 && (
          <div className="flex items-center gap-2" aria-live="polite">
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ease-in-out ${passwordStrength.color}`}
                style={{ width: passwordStrength.width }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground w-16 text-right">
              {passwordStrength.label}
            </span>
          </div>
        )}
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
