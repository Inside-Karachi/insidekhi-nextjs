"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Home,
  Briefcase,
  Navigation,
  Plus,
  Check,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface SavedLocation {
  id: number;
  label: "home" | "work" | "current" | "custom";
  custom_label: string | null;
  address: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  created_at: string;
}

const LABEL_META: Record<
  SavedLocation["label"],
  { icon: React.ElementType; fallbackName: string }
> = {
  home: { icon: Home, fallbackName: "Home" },
  work: { icon: Briefcase, fallbackName: "Work" },
  current: { icon: Navigation, fallbackName: "Current Location" },
  custom: { icon: MapPin, fallbackName: "Saved place" },
};

function displayName(location: SavedLocation): string {
  if (location.label === "custom") {
    return location.custom_label || "Saved place";
  }
  return LABEL_META[location.label].fallbackName;
}

interface LocationSwitcherProps {
  initialLocations: SavedLocation[];
  className?: string;
}

export function LocationSwitcher({
  initialLocations,
  className,
}: LocationSwitcherProps) {
  const [locations, setLocations] =
    React.useState<SavedLocation[]>(initialLocations);
  const [open, setOpen] = React.useState(false);
  const [capturing, setCapturing] = React.useState<
    "home" | "work" | "current" | "custom" | null
  >(null);
  const [customLabelInput, setCustomLabelInput] = React.useState("");
  const [showCustomInput, setShowCustomInput] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const active = locations.find((l) => l.is_active) || null;

  const captureAndSave = React.useCallback(
    async (label: "home" | "work" | "current" | "custom", customLabel?: string) => {
      setError(null);
      setCapturing(label);
      try {
        if (!navigator.geolocation) {
          throw new Error("Geolocation isn't supported on this device");
        }

        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            }),
        );

        const { latitude, longitude } = position.coords;

        let address = "Karachi, Pakistan";
        try {
          const res = await fetch(
            `/api/location?lat=${latitude}&lng=${longitude}`,
          );
          if (res.ok) {
            const data = await res.json();
            address = data.formattedAddress || data.location || address;
          }
        } catch {
          // Fall back to the generic address below - not fatal.
        }

        const res = await fetch("/api/user/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            customLabel,
            address,
            latitude,
            longitude,
            setActive: true,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to save location");
        }

        const { location } = await res.json();
        setLocations((prev) => [
          location,
          ...prev.filter((l) => l.id !== location.id).map((l) => ({ ...l, is_active: false })),
        ]);
        setShowCustomInput(false);
        setCustomLabelInput("");
        setOpen(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't get your location. Check location permissions.",
        );
      } finally {
        setCapturing(null);
      }
    },
    [],
  );

  const activate = React.useCallback(async (id: number) => {
    setError(null);
    const previous = locations;
    setLocations((prev) =>
      prev.map((l) => ({ ...l, is_active: l.id === id })),
    );
    setOpen(false);

    try {
      const res = await fetch(`/api/user/locations/${id}`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error();
    } catch {
      setLocations(previous);
      setError("Couldn't switch location, please try again.");
    }
  }, [locations]);

  const remove = React.useCallback(async (id: number) => {
    const previous = locations;
    setLocations((prev) => prev.filter((l) => l.id !== id));
    try {
      const res = await fetch(`/api/user/locations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      setLocations(previous);
      setError("Couldn't remove that location.");
    }
  }, [locations]);

  const ActiveIcon = active ? LABEL_META[active.label].icon : MapPin;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={cn(
            "inline-flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25",
            "backdrop-blur-sm border border-white/20 px-3 py-1.5 md:px-4 md:py-2",
            "transition-all duration-300 group",
            className,
          )}
        >
          <ActiveIcon className="h-3.5 w-3.5 md:h-4 md:w-4 text-white flex-shrink-0" />
          <span className="text-xs md:text-sm font-semibold text-white truncate max-w-[140px] md:max-w-[220px]">
            {active ? displayName(active) : "Set your location"}
          </span>
          {active && (
            <span className="hidden md:inline text-white/70 text-xs truncate max-w-[160px]">
              · {active.address}
            </span>
          )}
        </motion.button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0 overflow-hidden" align="start">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-semibold text-sm text-foreground">
            Your locations
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Used to personalize recommendations near you
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {locations.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No saved locations yet.
            </p>
          )}
          {locations.map((location) => {
            const Icon = LABEL_META[location.label].icon;
            return (
              <div
                key={location.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors group",
                  location.is_active && "bg-primary/5",
                )}
              >
                <button
                  onClick={() => !location.is_active && activate(location.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      location.is_active
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {displayName(location)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {location.address}
                    </p>
                  </div>
                </button>
                {location.is_active ? (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                ) : (
                  <button
                    onClick={() => remove(location.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10 flex-shrink-0"
                    aria-label={`Remove ${displayName(location)}`}
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-border/50 space-y-1.5">
          {!locations.some((l) => l.label === "home") && (
            <button
              onClick={() => captureAndSave("home")}
              disabled={capturing !== null}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-accent/50 transition-colors disabled:opacity-50"
            >
              {capturing === "home" ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Home className="h-4 w-4 text-muted-foreground" />
              )}
              Set this place as Home
            </button>
          )}
          {!locations.some((l) => l.label === "work") && (
            <button
              onClick={() => captureAndSave("work")}
              disabled={capturing !== null}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-accent/50 transition-colors disabled:opacity-50"
            >
              {capturing === "work" ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              )}
              Set this place as Work
            </button>
          )}
          <button
            onClick={() => captureAndSave("current")}
            disabled={capturing !== null}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-accent/50 transition-colors disabled:opacity-50"
          >
            {capturing === "current" ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Navigation className="h-4 w-4 text-muted-foreground" />
            )}
            Use my current location
          </button>

          {showCustomInput ? (
            <div className="flex items-center gap-2 pt-1">
              <input
                autoFocus
                value={customLabelInput}
                onChange={(e) => setCustomLabelInput(e.target.value)}
                placeholder="e.g. Mom's house"
                className="flex-1 h-8 px-2 rounded-md border border-border text-sm bg-background"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customLabelInput.trim()) {
                    captureAndSave("custom", customLabelInput.trim());
                  }
                }}
              />
              <button
                onClick={() =>
                  customLabelInput.trim() &&
                  captureAndSave("custom", customLabelInput.trim())
                }
                disabled={capturing !== null || !customLabelInput.trim()}
                className="h-8 px-2 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
              >
                {capturing === "custom" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Save"
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomInput(true)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-accent/50 transition-colors text-muted-foreground"
            >
              <Plus className="h-4 w-4" />
              Add a place (uses current position)
            </button>
          )}

          {error && <p className="text-xs text-destructive px-2">{error}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
