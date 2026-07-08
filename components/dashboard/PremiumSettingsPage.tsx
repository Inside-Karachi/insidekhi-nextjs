"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Bell,
  MapPin,
  Save,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  UserPreferences,
  PremiumSettingsPageProps,
} from "@/types/settings.types";

export function PremiumSettingsPage({ profile }: PremiumSettingsPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: "system",
    notifications: {
      email: true,
      bookings: true,
      reviews: true,
      marketing: false,
    },
    location: {
      lat: 24.8607, // Karachi coordinates
      lng: 67.0011,
      name: "Karachi, Pakistan",
    },
  });

  const { toast } = useToast();
  const router = useRouter();

  // Load user preferences on mount
  useEffect(() => {
    if (profile?.user_preferences) {
      // Handle Json type from Supabase
      const prefs = profile.user_preferences as UserPreferences;
      setPreferences((prev) => ({
        ...prev,
        ...prefs,
      }));
    }

    // Load theme from localStorage
    const savedTheme = localStorage.getItem("theme") as
      | "light"
      | "dark"
      | "system"
      | null;
    if (savedTheme) {
      setPreferences((prev) => ({ ...prev, theme: savedTheme }));
    }
  }, [profile]);

  // Theme management
  const updateTheme = (theme: "light" | "dark" | "system") => {
    setPreferences((prev) => ({ ...prev, theme }));

    // Apply theme immediately
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      // System preference
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.toggle("dark", systemTheme === "dark");
    }

    // Save to localStorage
    localStorage.setItem("theme", theme);
  };

  // Update notification preferences
  const updateNotification = (
    key: keyof NonNullable<UserPreferences["notifications"]>,
    value: boolean
  ) => {
    setPreferences((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value,
      },
    }));
  };

  // Save preferences to database
  const savePreferences = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPreferences: preferences,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Back Navigation */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>
      </div>

      {/* Settings Sections - Matching Profile Page Card Design */}
      <div className="space-y-6">
        {/* Theme Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden glass-card border border-border rounded-2xl p-6 md:p-8 mb-6 md:mb-8 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 shadow-sm"
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-40 dark:from-primary/10 dark:to-primary/5 pointer-events-none"
            aria-hidden
          />
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sun className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
                Theme <span className="gradient-text-primary">Preferences</span>
              </h2>
              <p className="text-muted-foreground text-sm">
                Choose your preferred theme for the application
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { key: "light", icon: Sun, label: "Light", desc: "Bright theme" },
              { key: "dark", icon: Moon, label: "Dark", desc: "Easy on eyes" },
              {
                key: "system",
                icon: Monitor,
                label: "System",
                desc: "Auto detect",
              },
            ].map(({ key, icon: Icon, label, desc }) => (
              <button
                key={key}
                onClick={() => updateTheme(key as "light" | "dark" | "system")}
                className={`p-6 rounded-xl border-2 transition-all hover:scale-105 ${
                  preferences.theme === key
                    ? "border-primary bg-primary/5 text-primary shadow-lg"
                    : "border-border/40 hover:border-border/60 bg-card/50"
                }`}
              >
                <Icon className="w-8 h-8 mx-auto mb-3" />
                <span className="text-sm font-semibold block">{label}</span>
                <span className="text-xs text-muted-foreground mt-1 block">
                  {desc}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Notification Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative overflow-hidden glass-card border border-border rounded-2xl p-6 md:p-8 mb-6 md:mb-8 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 shadow-sm"
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-40 dark:from-primary/10 dark:to-primary/5 pointer-events-none"
            aria-hidden
          />
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
                Notification{" "}
                <span className="gradient-text-primary">Preferences</span>
              </h2>
              <p className="text-muted-foreground text-sm">
                Control how and when you receive notifications
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {[
              {
                key: "email",
                label: "Email Notifications",
                description: "Receive important updates via email",
              },
              {
                key: "bookings",
                label: "Booking Updates",
                description:
                  "Get notified about your bookings and reservations",
              },
              {
                key: "reviews",
                label: "Review Activity",
                description: "Notifications about new reviews and responses",
              },
              {
                key: "marketing",
                label: "Marketing Updates",
                description: "Receive promotional content and platform news",
              },
            ].map(({ key, label, description }) => (
              <div
                key={key}
                className="flex items-center justify-between p-4 rounded-lg border border-border/30 bg-card/30 hover:bg-card/50 transition-colors"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{label}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {description}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={
                      preferences.notifications?.[
                        key as keyof NonNullable<
                          UserPreferences["notifications"]
                        >
                      ] || false
                    }
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateNotification(
                        key as keyof NonNullable<
                          UserPreferences["notifications"]
                        >,
                        e.target.checked
                      )
                    }
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Location Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative overflow-hidden glass-card border border-border rounded-2xl p-6 md:p-8 mb-6 md:mb-8 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 shadow-sm"
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-40 dark:from-primary/10 dark:to-primary/5 pointer-events-none"
            aria-hidden
          />
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
                Location{" "}
                <span className="gradient-text-primary">Preferences</span>
              </h2>
              <p className="text-muted-foreground text-sm">
                Set your default location for personalized recommendations
              </p>
            </div>
          </div>

          <div className="p-6 rounded-lg border border-border/30 bg-card/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {preferences.location?.name || "Karachi, Pakistan"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {preferences.location?.lat?.toFixed(4)},{" "}
                  {preferences.location?.lng?.toFixed(4)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Location picker will be implemented in the next phase for enhanced
              personalization.
            </p>
          </div>
        </motion.div>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex justify-end pt-6"
        >
          <Button
            onClick={savePreferences}
            disabled={isLoading}
            className="px-8 py-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </>
  );
}
