/**
 * Gradient styles for categories
 * Each gradient is unique and designed for visual distinction
 */

export type GradientStyle =
  | "orange"
  | "blue"
  | "purple"
  | "emerald"
  | "red"
  | "indigo"
  | "amber"
  | "teal"
  | "pink"
  | "cyan"
  | "lime"
  | "rose"
  | "slate";

export interface GradientColors {
  bg: string;
  border: string;
  icon: string;
  accent: string;
  glow: string;
  label: string;
}

export const GRADIENT_OPTIONS: Record<GradientStyle, GradientColors> = {
  orange: {
    bg: "from-orange-500/20 via-orange-500/10 to-orange-500/5",
    border: "border-orange-500/30",
    icon: "text-orange-500",
    accent: "bg-orange-500",
    glow: "hover:shadow-xl hover:shadow-orange-500/25",
    label: "Orange Sunrise",
  },
  blue: {
    bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
    border: "border-blue-500/30",
    icon: "text-blue-500",
    accent: "bg-blue-500",
    glow: "hover:shadow-xl hover:shadow-blue-500/25",
    label: "Ocean Blue",
  },
  purple: {
    bg: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
    border: "border-purple-500/30",
    icon: "text-purple-500",
    accent: "bg-purple-500",
    glow: "hover:shadow-xl hover:shadow-purple-500/25",
    label: "Royal Purple",
  },
  emerald: {
    bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
    border: "border-emerald-500/30",
    icon: "text-emerald-500",
    accent: "bg-emerald-500",
    glow: "hover:shadow-xl hover:shadow-emerald-500/25",
    label: "Emerald Green",
  },
  red: {
    bg: "from-red-500/20 via-red-500/10 to-red-500/5",
    border: "border-red-500/30",
    icon: "text-red-500",
    accent: "bg-red-500",
    glow: "hover:shadow-xl hover:shadow-red-500/25",
    label: "Ruby Red",
  },
  indigo: {
    bg: "from-indigo-500/20 via-indigo-500/10 to-indigo-500/5",
    border: "border-indigo-500/30",
    icon: "text-indigo-500",
    accent: "bg-indigo-500",
    glow: "hover:shadow-xl hover:shadow-indigo-500/25",
    label: "Deep Indigo",
  },
  amber: {
    bg: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
    border: "border-amber-500/30",
    icon: "text-amber-500",
    accent: "bg-amber-500",
    glow: "hover:shadow-xl hover:shadow-amber-500/25",
    label: "Golden Amber",
  },
  teal: {
    bg: "from-teal-500/20 via-teal-500/10 to-teal-500/5",
    border: "border-teal-500/30",
    icon: "text-teal-500",
    accent: "bg-teal-500",
    glow: "hover:shadow-xl hover:shadow-teal-500/25",
    label: "Tropical Teal",
  },
  pink: {
    bg: "from-pink-500/20 via-pink-500/10 to-pink-500/5",
    border: "border-pink-500/30",
    icon: "text-pink-500",
    accent: "bg-pink-500",
    glow: "hover:shadow-xl hover:shadow-pink-500/25",
    label: "Rose Pink",
  },
  cyan: {
    bg: "from-cyan-500/20 via-cyan-500/10 to-cyan-500/5",
    border: "border-cyan-500/30",
    icon: "text-cyan-500",
    accent: "bg-cyan-500",
    glow: "hover:shadow-xl hover:shadow-cyan-500/25",
    label: "Bright Cyan",
  },
  lime: {
    bg: "from-lime-500/20 via-lime-500/10 to-lime-500/5",
    border: "border-lime-500/30",
    icon: "text-lime-500",
    accent: "bg-lime-500",
    glow: "hover:shadow-xl hover:shadow-lime-500/25",
    label: "Lime Green",
  },
  rose: {
    bg: "from-rose-500/20 via-rose-500/10 to-rose-500/5",
    border: "border-rose-500/30",
    icon: "text-rose-500",
    accent: "bg-rose-500",
    glow: "hover:shadow-xl hover:shadow-rose-500/25",
    label: "Soft Rose",
  },
  slate: {
    bg: "from-slate-500/20 via-slate-500/10 to-slate-500/5",
    border: "border-slate-500/30",
    icon: "text-slate-500",
    accent: "bg-slate-500",
    glow: "hover:shadow-xl hover:shadow-slate-500/25",
    label: "Cool Slate",
  },
};

/**
 * Get gradient colors for a category
 * @param style - The gradient style from database (nullable)
 * @returns GradientColors object for styling
 */
export function getCategoryGradient(
  style: GradientStyle | null | undefined,
): GradientColors {
  return GRADIENT_OPTIONS[style || "slate"];
}

/**
 * Get all available gradient options for select dropdown
 * @returns Array of gradient options with labels
 */
export function getGradientOptions(): Array<{
  value: GradientStyle;
  label: string;
  colors: GradientColors;
}> {
  return Object.entries(GRADIENT_OPTIONS).map(([value, colors]) => ({
    value: value as GradientStyle,
    label: colors.label,
    colors,
  }));
}
