"use client";

import React from "react";
import { motion } from "framer-motion";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

type IconProp = React.ElementType | React.ReactNode | (() => React.ReactNode);

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: IconProp;
  count?: number;
  isLast?: boolean;
  className?: string;
  animated?: boolean;
  disabled?: boolean;
}

const baseClasses =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border backdrop-blur-sm";

const activeClasses =
  "bg-primary text-primary-foreground border-primary shadow-lg ring-2 ring-primary/20";
const inactiveClasses =
  "bg-card/50 hover:bg-card border-border/70 hover:border-border text-foreground hover:text-primary";
const disabledClasses = "opacity-50 cursor-not-allowed";

function renderIcon(icon?: IconProp) {
  if (!icon) return null;
  if (React.isValidElement(icon)) return icon;
  const MaybeComp = icon as React.ElementType;
  return <MaybeComp className="h-4 w-4" />;
}

const FilterChip = ({
  active,
  onClick,
  children,
  icon,
  count,
  isLast,
  className,
  animated = false,
  disabled = false,
}: FilterChipProps) => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const Tag: React.ElementType = animated ? motion.button : "button";

  return (
    <Tag
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[
        baseClasses,
        active ? activeClasses : inactiveClasses,
        disabled ? disabledClasses : "",
        isMobile ? "w-[9.3rem] truncate" : "",
        isMobile ? "mr-2" : "mr-3",
        isLast ? (isMobile ? "mr-3" : "mr-0") : "",
        className || "",
      ].join(" ")}
      {...(animated && !disabled
        ? { whileHover: { scale: 1.02, y: -2 }, whileTap: { scale: 0.98 } }
        : {})}
      {...(isMobile && typeof children === "string" && children.length > 18
        ? { title: children as string }
        : {})}
    >
      {renderIcon(icon)}
      <span className="block truncate">{children}</span>
      {count !== undefined && (
        <span
          className={`text-xs px-1.5 py-0.5 rounded-md font-semibold ${
            active ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"
          }`}
        >
          {count}
        </span>
      )}
    </Tag>
  );
};

export default FilterChip;
