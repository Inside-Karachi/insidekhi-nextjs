import * as React from "react";
import { Utensils, Building, Ticket, Newspaper, HeartPulse, GraduationCap, Popcorn, ShoppingCart, Compass } from "lucide-react";

// Map category slugs to icons used across the app
export const iconMap: { [key: string]: React.ElementType } = {
  'eat-drink': Utensils,
  'where-to-stay': Building,
  'events': Ticket,
  'guides-reviews': Newspaper,
  'fitness-healthcare': HeartPulse,
  'education': GraduationCap,
  'entertainment': Popcorn,
  'shopping': ShoppingCart,
  'things-to-do': Compass,
};