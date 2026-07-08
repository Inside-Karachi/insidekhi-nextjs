"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/components/admin/CategoryIconSelect";
import {
  getCategoryGradient,
  type GradientStyle,
} from "@/lib/utils/gradientStyles";

interface Category {
  id: number;
  name: string;
  slug: string;
  published_listing_count: number;
  icon_name: string | null;
  gradient_style: GradientStyle | null;
  category_type: string;
}

interface FeaturedCategoriesSectionProps {
  categories: Category[];
}

export function FeaturedCategoriesSection({
  categories,
}: FeaturedCategoriesSectionProps) {
  return (
    <section className="relative py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/50 to-background" />

      {/* Floating Background Elements */}
      <div className="absolute top-20 right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header - CSS animation */}
        <div className="mb-12 sm:mb-16 animate-hero-fade-in">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
                Explore by{" "}
                <span className="gradient-text-primary">Category</span>
              </h2>
            </div>
            <p className="max-w-2xl mx-auto text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed px-4 sm:px-0">
              From hidden culinary gems to trending entertainment spots,
              discover what makes Karachi extraordinary.
            </p>
          </div>
        </div>

        {/* Categories Grid - CSS animations with stagger via animation-delay */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {categories.map((category, index) => {
            const IconComponent = getCategoryIcon(category.icon_name);
            const colors = getCategoryGradient(category.gradient_style);

            const listingCount = category.published_listing_count ?? 0;
            const isEvent =
              category.category_type === "event" || category.slug === "events";
            const href = isEvent ? "/events" : `/listings/${category.slug}`;
            const baseLabel = isEvent ? "event" : "place";
            const countLabel = `${baseLabel}${
              listingCount === 1 ? "" : "s"
            } available`;

            return (
              <div
                key={category.id}
                className="opacity-0 animate-hero-fade-in"
                style={{ animationDelay: `${0.1 + index * 0.05}s` }}
              >
                <Link
                  href={href}
                  className="category-link block no-underline group"
                  style={{ textDecoration: "none" }}
                >
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-2xl p-4 md:p-6 cursor-pointer",
                      "backdrop-blur-xl border transition-all duration-500",
                      "hover:scale-[1.02] hover:-translate-y-1",
                      `bg-gradient-to-br ${colors.bg}`,
                      colors.border,
                      colors.glow,
                      "transform-gpu",
                      "hover:border-opacity-50",
                    )}
                  >
                    {/* Border glow */}
                    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                      <div
                        className={cn(
                          "absolute inset-0 rounded-2xl opacity-30 blur-md",
                          colors.accent,
                        )}
                      />
                      <div
                        className={cn(
                          "absolute inset-0 rounded-2xl opacity-10 blur-lg",
                          colors.accent,
                        )}
                      />
                    </div>

                    {/* Animated accent line - safelist: bg-emerald-500 bg-orange-500 bg-blue-500 bg-purple-500 bg-red-500 bg-indigo-500 bg-amber-500 bg-teal-500 bg-pink-500 bg-cyan-500 bg-lime-500 bg-rose-500 bg-slate-500 */}
                    <div
                      className={cn(
                        "absolute top-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700 ease-out rounded-t-2xl",
                        colors.accent,
                      )}
                    />

                    <div className="relative z-10">
                      {/* Header with icon and arrow */}
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <div
                          className={cn(
                            "relative p-2 md:p-3 rounded-xl transition-all duration-500",
                            "group-hover:scale-110 group-hover:rotate-6 transform-gpu",
                            `bg-gradient-to-br ${colors.bg}`,
                            "border border-white/20 dark:border-white/10",
                            "shadow-lg group-hover:shadow-xl",
                          )}
                        >
                          <div
                            className={cn("h-5 w-5 md:h-6 md:w-6", colors.icon)}
                          >
                            <IconComponent className="h-full w-full" />
                          </div>
                        </div>

                        <ArrowRight
                          className={cn(
                            "h-5 w-5 transition-all duration-300",
                            "group-hover:translate-x-1 group-hover:scale-110",
                            colors.icon,
                          )}
                        />
                      </div>

                      {/* Category Info */}
                      <div className="space-y-1 md:space-y-2">
                        <h3 className="text-base md:text-lg lg:text-xl font-bold text-foreground transition-colors duration-300">
                          {category.name}
                        </h3>
                        <p className="text-xs md:text-sm text-muted-foreground">
                          {listingCount} {countLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
