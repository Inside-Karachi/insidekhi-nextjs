"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import {
  Compass,
  Utensils,
  Building,
  Ticket,
  Newspaper,
  HeartPulse,
  GraduationCap,
  Popcorn,
  ShoppingCart,
  MapPin,
  Star,
  Coffee,
  Music,
  Camera,
  BookOpen,
  Dumbbell,
  Briefcase,
  Car,
  Hospital,
  Scissors,
  Sparkles,
  Home,
  Plane,
  Gamepad2,
  Palette,
  Gift,
  PawPrint,
  Landmark,
  Leaf,
  Wifi,
} from "lucide-react";
import { CATEGORY_ICONS, type CategoryIconName } from "@/types/category.types";

// Map icon names to actual Lucide React components
const iconComponents: Record<string, React.ElementType> = {
  compass: Compass,
  utensils: Utensils,
  building: Building,
  ticket: Ticket,
  newspaper: Newspaper,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  popcorn: Popcorn,
  "shopping-cart": ShoppingCart,
  "map-pin": MapPin,
  star: Star,
  coffee: Coffee,
  music: Music,
  camera: Camera,
  "book-open": BookOpen,
  dumbbell: Dumbbell,
  briefcase: Briefcase,
  car: Car,
  hospital: Hospital,
  scissors: Scissors,
  sparkles: Sparkles,
  home: Home,
  plane: Plane,
  "gamepad-2": Gamepad2,
  palette: Palette,
  gift: Gift,
  "paw-print": PawPrint,
  landmark: Landmark,
  leaf: Leaf,
  wifi: Wifi,
};

interface CategoryIconSelectProps {
  value: string;
  onChange: (value: CategoryIconName) => void;
  disabled?: boolean;
}

export function CategoryIconSelect({
  value,
  onChange,
  disabled = false,
}: CategoryIconSelectProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  // Filter icons based on search query
  const filteredIcons = React.useMemo(() => {
    if (!searchQuery) return CATEGORY_ICONS;
    const query = searchQuery.toLowerCase();
    return CATEGORY_ICONS.filter(
      (icon) =>
        icon.label.toLowerCase().includes(query) ||
        icon.description.toLowerCase().includes(query) ||
        icon.value.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Get the currently selected icon
  const selectedIcon = CATEGORY_ICONS.find((icon) => icon.value === value);
  const IconComponent = iconComponents[value] || Compass;

  return (
    <div className="space-y-2">
      <Label htmlFor="icon-select">Icon</Label>
      <Select
        value={value}
        onValueChange={(val) => onChange(val as CategoryIconName)}
        disabled={disabled}
      >
        <SelectTrigger
          id="icon-select"
          className="w-full"
          aria-label="Select category icon"
        >
          <SelectValue placeholder="Select an icon">
            <div className="flex items-center gap-2">
              <IconComponent className="h-4 w-4 text-muted-foreground" />
              <span>{selectedIcon?.label || "Select icon"}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {/* Search input inside dropdown */}
          <div className="px-2 pb-2 sticky top-0 bg-popover z-10">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search icons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Icon options */}
          {filteredIcons.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No icons found
            </div>
          ) : (
            filteredIcons.map((icon) => {
              const Icon = iconComponents[icon.value] || Compass;
              return (
                <SelectItem
                  key={icon.value}
                  value={icon.value}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-medium">{icon.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {icon.description}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              );
            })
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Get the Lucide icon component for a given icon name
 */
export function getCategoryIcon(iconName: string | null): React.ElementType {
  if (!iconName) return Compass;
  return iconComponents[iconName] || Compass;
}
