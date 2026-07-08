"use client";

import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BankCardProps {
  bankName: string;
  cardType?: "visa" | "mastercard" | "both";
  size?: "sm" | "md" | "lg";
  variant?: "flat" | "elevated";
}

// Bank brand colors and gradients
const bankStyles: Record<
  string,
  {
    gradient: string;
    textColor: string;
    accentColor: string;
    logoText: string;
  }
> = {
  "HBL Bank": {
    gradient: "bg-gradient-to-br from-green-600 via-green-700 to-green-800",
    textColor: "text-white",
    accentColor: "text-green-200",
    logoText: "HBL",
  },
  "UBL Bank": {
    gradient: "bg-gradient-to-br from-red-600 via-red-700 to-red-800",
    textColor: "text-white",
    accentColor: "text-red-200",
    logoText: "UBL",
  },
  "Standard Chartered": {
    gradient: "bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800",
    textColor: "text-white",
    accentColor: "text-blue-200",
    logoText: "SCB",
  },
  "Allied Bank": {
    gradient: "bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800",
    textColor: "text-white",
    accentColor: "text-purple-200",
    logoText: "ALLIED",
  },
  "MCB Bank": {
    gradient: "bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800",
    textColor: "text-white",
    accentColor: "text-orange-200",
    logoText: "MCB",
  },
  "JS Bank": {
    gradient: "bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800",
    textColor: "text-white",
    accentColor: "text-indigo-200",
    logoText: "JS",
  },
};

const cardTypeIcons = {
  visa: "💳",
  mastercard: "💳",
  both: "💳💳",
};

export function BankCard({
  bankName,
  cardType = "both",
  size = "sm",
  variant = "flat",
}: BankCardProps) {
  const style = bankStyles[bankName] || bankStyles["HBL Bank"];

  const sizeClasses = {
    sm: "w-16 h-10 text-xs",
    md: "w-20 h-12 text-sm",
    lg: "w-24 h-15 text-base",
  };

  const elevationClass =
    variant === "elevated"
      ? "shadow-lg hover:shadow-xl transition-shadow duration-300"
      : "";

  return (
    <div
      className={`
      ${style.gradient} ${style.textColor} ${sizeClasses[size]} ${elevationClass}
      rounded-lg flex flex-col justify-between p-2 relative overflow-hidden
      border border-white/20
    `}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-xs leading-none">{style.logoText}</span>
        <CreditCard className="h-3 w-3 opacity-80" />
      </div>

      <div className="flex items-end justify-between">
        <span className={`text-xs ${style.accentColor} opacity-90`}>
          {cardTypeIcons[cardType]}
        </span>
        <span className={`text-xs ${style.accentColor} font-medium`}>
          {cardType === "visa"
            ? "VISA"
            : cardType === "mastercard"
            ? "MC"
            : "VISA/MC"}
        </span>
      </div>

      <div className="absolute top-1 right-1 w-8 h-8 bg-white/10 rounded-full -translate-y-4 translate-x-4" />
      <div className="absolute bottom-1 left-1 w-6 h-6 bg-white/10 rounded-full translate-y-3 -translate-x-3" />
    </div>
  );
}

export function BankCardBadge({ bankName }: Pick<BankCardProps, "bankName">) {
  const style = bankStyles[bankName] || bankStyles["HBL Bank"];

  return (
    <Badge
      variant="outline"
      className={`
        ${style.gradient} ${style.textColor} border-white/30
        text-xs px-2 py-1 font-medium
      `}
    >
      <CreditCard className="h-3 w-3 mr-1" />
      {style.logoText}
    </Badge>
  );
}
