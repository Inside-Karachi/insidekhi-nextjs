"use client";

import { useState } from "react";
import Image from "next/image";
import { CreditCard, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Database } from "@/types/supabase";

// Use real Supabase types
type CardVariant = Database["public"]["Tables"]["card_variants"]["Row"];

interface BankCardImageProps {
  cardVariant: CardVariant;
  bankName: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  showName?: boolean;
}

// Size configurations - Fixed aspect ratios for real credit cards (1.586:1)
const sizeConfig = {
  xs: {
    width: 48,
    height: 30,
    className: "w-12 h-[30px]",
    textSize: "text-xs",
  },
  sm: { width: 64, height: 40, className: "w-16 h-10", textSize: "text-xs" },
  md: {
    width: 80,
    height: 50,
    className: "w-20 h-[50px]",
    textSize: "text-sm",
  },
  lg: { width: 96, height: 60, className: "w-24 h-15", textSize: "text-base" },
};

// Network colors and styles
const networkStyles = {
  visa: {
    gradient: "from-blue-500 to-blue-700",
    text: "text-white",
    badge: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  },
  mastercard: {
    gradient: "from-red-500 to-orange-600",
    text: "text-white",
    badge: "bg-red-500/20 text-red-700 border-red-500/30",
  },
  unionpay: {
    gradient: "from-green-500 to-emerald-600",
    text: "text-white",
    badge: "bg-green-500/20 text-green-700 border-green-500/30",
  },
};

// Smart card name extraction from filename - DYNAMIC for all banks
const getCardDisplayName = (filename: string, dbCardName?: string) => {
  if (dbCardName && dbCardName.trim() !== "" && dbCardName !== "Unknown") {
    // If the name is just "Debit Card" or "Credit Card", try to make it more specific
    // by checking if we're calling this from the component where we have tier info
    if (
      ["debit card", "credit card", "card"].includes(dbCardName.toLowerCase())
    ) {
      return null; // Fallback to other methods or construction
    }
    return dbCardName;
  }
  if (!filename) return "Card";
  const cleanName = filename
    .replace(/\.(png|jpg|jpeg|webp)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
  return cleanName;
};

// Get shortened card name for compact display
// Extracts a unique, readable short name from the full card name
export const getShortCardName = (
  cardName: string,
  cardType?: string,
  cardTier?: string | null,
): string => {
  if (!cardName) return "Card";

  // Extract identifying parts from card name
  // Remove bank name prefix (anything before first recognizable card term)
  let shortName = cardName
    // Remove common bank prefixes
    .replace(
      /^(bank\s*alfalah|faysal\s*islami?|meezan|hbl|mcb|ubl|askari|allied|al[\s-]?habib|bahl|habib\s*metro|standard\s*chartered|nexgen|amal)\s*/gi,
      "",
    )
    // Remove network names
    .replace(
      /\b(visa|mastercard|unionpay|american\s*express|amex|paypak)\b/gi,
      "",
    )
    // Remove "debit card" / "credit card" suffix but keep "debit" or "credit" for context
    .replace(/\s+(debit|credit|prepaid)\s+card$/gi, "")
    .replace(/\s+card$/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // If the result is too short or generic, use tier + type combo
  if (!shortName || shortName.length < 3) {
    const tier = cardTier || "";
    const type = cardType || "";
    shortName = `${tier} ${type}`.trim() || "Card";
  }

  // Capitalize first letter of each word
  shortName = shortName
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  // If name is still too long, truncate with ellipsis
  if (shortName.length > 20) {
    shortName = shortName.substring(0, 18).trim() + "...";
  }

  return shortName || "Card";
};

// Tier icons
const getTierIcon = (tier?: string) => {
  if (tier === "platinum" || tier === "world") return Sparkles;
  return CreditCard;
};

export function BankCardImage({
  cardVariant,
  bankName,
  size = "sm",
  className = "",
  showName = false,
}: BankCardImageProps) {
  const [imageError, setImageError] = useState(false);
  const config = sizeConfig[size];
  const networkStyle =
    networkStyles[cardVariant.card_network as keyof typeof networkStyles] ||
    networkStyles.visa;
  const TierIcon = getTierIcon(cardVariant.card_tier || undefined);

  // Use image_filename directly - it already contains the full Supabase storage URL
  // e.g., "https://xxx.supabase.co/storage/v1/object/public/card-images/7-card-name.png"
  const imagePath = cardVariant.image_filename || null;

  const displayCardName = getCardDisplayName(
    cardVariant.image_filename || "",
    cardVariant.card_name,
  );

  const PremiumCardFallback = () => (
    <div
      className={`w-full h-full flex flex-col justify-between p-2 bg-gradient-to-br ${networkStyle.gradient} ${networkStyle.text} rounded-lg relative overflow-hidden shadow-md`}
    >
      <div className="absolute top-0 right-0 w-8 h-8 bg-white/10 rounded-full -translate-y-4 translate-x-4"></div>
      <div className="absolute bottom-0 left-0 w-6 h-6 bg-white/10 rounded-full translate-y-3 -translate-x-3"></div>
      <div className="absolute top-1/2 left-1/2 w-12 h-12 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2"></div>

      <div className="flex items-center justify-between relative z-10">
        <span className="text-xs font-bold opacity-90">
          {bankName.split(" ")[0]}
        </span>
        <div className="flex items-center space-x-1">
          <TierIcon className="h-3 w-3 opacity-80" />
        </div>
      </div>

      <div className="flex flex-col relative z-10">
        <div className="text-xs opacity-60 mb-1">•••• •••• •••• ••••</div>
        <div className="text-xs opacity-90 font-medium">{displayCardName}</div>
      </div>

      <div className="flex items-end justify-between relative z-10">
        <span className="text-xs opacity-75 capitalize">
          {cardVariant.card_tier || "Classic"}
        </span>
        <span className="text-xs font-bold uppercase tracking-wider">
          {cardVariant.card_network}
        </span>
      </div>
    </div>
  );

  return (
    <div className={`${config.className} ${className} group relative`}>
      <div className="relative w-full h-full overflow-hidden rounded-lg border border-border/30 bg-gradient-to-br from-background to-muted/30 shadow-sm hover:shadow-md transition-all duration-300">
        {imagePath && !imageError ? (
          <Image
            src={imagePath}
            alt={`${bankName} ${displayCardName}`}
            fill
            className="object-contain"
            onError={() => setImageError(true)}
            unoptimized
            priority={false}
            sizes="(max-width: 768px) 64px, 80px"
          />
        ) : (
          <PremiumCardFallback />
        )}
      </div>

      {showName && (
        <Badge
          variant="outline"
          className={`absolute -bottom-1 left-1/2 -translate-x-1/2 ${config.textSize} px-1.5 py-0.5 ${networkStyle.badge} backdrop-blur-sm`}
        >
          <TierIcon className="h-2.5 w-2.5 mr-1" />
          {displayCardName}
        </Badge>
      )}
    </div>
  );
}

export function BankCardFallback({
  bankName,
  size = "sm",
  className = "",
}: {
  bankName?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const config = sizeConfig[size];

  return (
    <div className={`${config.className} ${className} flex gap-2`}>
      <div className="flex-1 relative group">
        <div className="w-full h-full bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-lg border border-blue-400/30 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-6 h-6 bg-white/10 rounded-full -translate-y-3 translate-x-3"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 bg-white/10 rounded-full translate-y-2 -translate-x-2"></div>
          <div className="absolute top-1/2 left-1/2 w-8 h-8 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2"></div>

          <div className="relative z-10 w-full h-full flex flex-col justify-between p-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/90">
                {bankName?.split(" ")[0] || "BANK"}
              </span>
              <div className="w-3 h-2 bg-white/20 rounded-sm"></div>
            </div>

            <div className="space-y-0.5">
              <div className="text-xs text-white/60">•••• ••••</div>
              <div className="text-xs font-bold text-white tracking-wider">
                VISA
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 transform translate-y-full opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-20">
          <div className="bg-black/90 text-white text-xs font-medium px-2 py-1 rounded-md shadow-lg backdrop-blur-sm mx-0.5 mt-1">
            <div className="flex items-center justify-center space-x-1">
              <CreditCard className="h-3 w-3" />
              <span>Visa Cards</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 relative group">
        <div className="w-full h-full bg-gradient-to-br from-red-500 via-red-600 to-orange-600 rounded-lg border border-red-400/30 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-6 h-6 bg-white/10 rounded-full -translate-y-3 translate-x-3"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 bg-white/10 rounded-full translate-y-2 -translate-x-2"></div>
          <div className="absolute top-1/2 left-1/2 w-8 h-8 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2"></div>

          <div className="relative z-10 w-full h-full flex flex-col justify-between p-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/90">
                {bankName?.split(" ")[0] || "BANK"}
              </span>
              <div className="w-3 h-2 bg-white/20 rounded-sm"></div>
            </div>

            <div className="space-y-0.5">
              <div className="text-xs text-white/60">•••• ••••</div>
              <div className="text-xs font-bold text-white tracking-wider">
                MC
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 transform translate-y-full opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-20">
          <div className="bg-black/90 text-white text-xs font-medium px-2 py-1 rounded-md shadow-lg backdrop-blur-sm mx-0.5 mt-1">
            <div className="flex items-center justify-center space-x-1">
              <CreditCard className="h-3 w-3" />
              <span>Mastercard</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
