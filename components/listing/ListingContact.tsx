"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Database } from "@/types/database";
import {
  Phone,
  Mail,
  Globe,
  MapPin,
  MessageCircle,
  Copy,
  Check,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumHeading } from "@/components/brand/Typography";
import {
  sectionVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"];

interface ListingContactProps {
  listing: Listing;
}

export function ListingContact({ listing }: ListingContactProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatPhoneNumber = (phone: string) => {
    // Clean and format phone number
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("92")) {
      return `+${cleaned}`;
    }
    if (cleaned.startsWith("021") || cleaned.startsWith("0")) {
      return `+92-${cleaned.substring(1)}`;
    }
    return phone;
  };

  const formatSocialUrl = (url: string | null, domain: string) => {
    if (!url) return null;

    // If URL already has http/https, return as is
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    // If URL contains the domain, add https
    if (url.includes(domain)) {
      return `https://${url}`;
    }

    // If URL is just a username/path, construct full URL
    return `https://${domain}/${url}`;
  };

  const contactMethods = [
    {
      icon: Phone,
      label: "Phone",
      value: listing.phone_number,
      action: () => window.open(`tel:${listing.phone_number}`),
      copyValue: listing.phone_number,
      description: "Call us directly",
      colors: {
        bg: "from-blue-500/20 via-blue-500/10 to-blue-500/5",
        border: "border-blue-500/30",
        icon: "text-blue-500",
        accent: "bg-blue-500",
        glow: "hover:shadow-xl hover:shadow-blue-500/25",
      },
    },
    {
      icon: Mail,
      label: "Email",
      value: listing.email,
      action: () => window.open(`mailto:${listing.email}`),
      copyValue: listing.email,
      description: "Send us an email",
      colors: {
        bg: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
        border: "border-emerald-500/30",
        icon: "text-emerald-500",
        accent: "bg-emerald-500",
        glow: "hover:shadow-xl hover:shadow-emerald-500/25",
      },
    },
    {
      icon: Globe,
      label: "Website",
      value: listing.website ? "Visit Website" : null,
      action: () => listing.website && window.open(listing.website, "_blank"),
      copyValue: listing.website,
      description: "Visit our website",
      colors: {
        bg: "from-purple-500/20 via-purple-500/10 to-purple-500/5",
        border: "border-purple-500/30",
        icon: "text-purple-500",
        accent: "bg-purple-500",
        glow: "hover:shadow-xl hover:shadow-purple-500/25",
      },
    },
    {
      icon: MapPin,
      label: "Address",
      value: listing.address,
      action: () =>
        listing.address &&
        window.open(
          `https://maps.google.com/?q=${encodeURIComponent(listing.address)}`,
          "_blank"
        ),
      copyValue: listing.address,
      description: "Get directions",
      colors: {
        bg: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
        border: "border-amber-500/30",
        icon: "text-amber-500",
        accent: "bg-amber-500",
        glow: "hover:shadow-xl hover:shadow-amber-500/25",
      },
    },
  ].filter((method) => method.value);

  // Custom social icons as SVG components
  const FacebookIcon = () => (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );

  const InstagramIcon = () => (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );

  const WhatsAppIcon = () => (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.89 3.488" />
    </svg>
  );

  const socialLinks = [
    {
      name: "WhatsApp",
      icon: WhatsAppIcon,
      url: listing.whatsapp_number
        ? `https://wa.me/${listing.whatsapp_number.replace(/\D/g, "")}`
        : null,
      colors: {
        bg: "from-green-500/20 via-green-500/10 to-green-500/5",
        border: "border-green-500/30",
        icon: "text-green-500",
        glow: "hover:shadow-lg hover:shadow-green-500/25",
        accent: "bg-green-500",
      },
    },
    {
      name: "Facebook",
      icon: FacebookIcon,
      url: formatSocialUrl(listing.facebook_url, "facebook.com"),
      colors: {
        bg: "from-blue-600/20 via-blue-600/10 to-blue-600/5",
        border: "border-blue-600/30",
        icon: "text-blue-600",
        glow: "hover:shadow-lg hover:shadow-blue-600/25",
        accent: "bg-blue-600",
      },
    },
    {
      name: "Instagram",
      icon: InstagramIcon,
      url: formatSocialUrl(listing.instagram_url, "instagram.com"),
      colors: {
        bg: "from-pink-500/20 via-pink-500/10 to-pink-500/5",
        border: "border-pink-500/30",
        icon: "text-pink-500",
        glow: "hover:shadow-lg hover:shadow-pink-500/25",
        accent: "bg-pink-500",
      },
    },
    {
      name: "YouTube",
      icon: () => (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      ),
      url: formatSocialUrl(listing.youtube_url, "youtube.com"),
      colors: {
        bg: "from-red-500/20 via-red-500/10 to-red-500/5",
        border: "border-red-500/30",
        icon: "text-red-500",
        glow: "hover:shadow-lg hover:shadow-red-500/25",
        accent: "bg-red-500",
      },
    },
  ].filter((social) => social.url);

  return (
    <motion.div
      className="space-y-6 md:space-y-8"
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      {/* Get in Touch Section - Only show if there are contact methods */}
      {contactMethods.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="relative overflow-hidden rounded-2xl p-6 md:p-8 backdrop-blur-xl border-2 md:border border-border/50 bg-gradient-to-br from-primary/5 via-transparent to-primary/10"
        >
          {/* Background effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
          <div className="absolute top-4 right-4 w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-xl" />

          <div className="relative space-y-6 md:space-y-8">
            <div className="text-center space-y-3 md:space-y-4">
              <div className="flex items-center justify-center space-x-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <PremiumHeading level={2} dense className="text-foreground">
                  Get in <span className="gradient-text-primary">Touch</span>
                </PremiumHeading>
              </div>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-medium max-w-sm mx-auto leading-relaxed md:mt-1">
                Ready to visit or have questions? We&apos;re here to help!
              </p>
            </div>

            {/* Icon-Only Action Bar */}
            <div className="relative">
              {/* Floating action bar */}
              <div className="flex items-center justify-center gap-3 md:gap-4">
                {/* Contact methods */}
                <div className="flex items-center justify-center gap-3 md:gap-4">
                  {contactMethods.map((method, index) => {
                    const IconComponent = method.icon;
                    return (
                      <div key={method.label} className="relative group">
                        {/* Tooltip */}
                        <div className="absolute -top-12 md:-top-14 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-20">
                          <div className="bg-foreground text-background text-xs font-medium px-2 md:px-3 py-1.5 md:py-2 rounded-lg shadow-lg whitespace-nowrap">
                            {method.label === "Phone" && method.value
                              ? `Call ${formatPhoneNumber(method.value)}`
                              : method.label === "Email" && method.value
                              ? `Email ${method.value}`
                              : method.label === "Website"
                              ? "Visit Website"
                              : method.label === "Address" && method.value
                              ? "Get Directions"
                              : method.description}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground"></div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <motion.button
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            duration: 0.5,
                            delay: index * 0.1,
                            type: "spring",
                            stiffness: 200,
                            damping: 15,
                          }}
                          onClick={method.action}
                          className={cn(
                            "relative overflow-hidden w-14 h-14 md:w-16 md:h-16 rounded-xl transition-all duration-300",
                            "backdrop-blur-xl border-2 md:border hover:scale-110 group/btn",
                            `bg-gradient-to-br ${method.colors.bg}`,
                            method.colors.border,
                            method.colors.glow,
                            "transform-gpu hover:rotate-3 shadow-lg hover:shadow-xl"
                          )}
                        >
                          {/* Glow effect */}
                          <div className="absolute inset-0 rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 pointer-events-none">
                            <div
                              className={cn(
                                "absolute inset-0 rounded-xl opacity-30 blur-md",
                                method.colors.accent
                              )}
                            />
                            <div
                              className={cn(
                                "absolute inset-0 rounded-xl opacity-10 blur-lg",
                                method.colors.accent
                              )}
                            />
                          </div>

                          <div className="relative flex items-center justify-center h-full">
                            <IconComponent
                              className={cn(
                                "h-5 w-5 md:h-6 md:w-6 transition-transform duration-300 group-hover/btn:scale-110",
                                method.colors.icon
                              )}
                            />
                          </div>
                        </motion.button>

                        {/* Copy button for applicable methods */}
                        {method.copyValue && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              duration: 0.4,
                              delay: index * 0.1 + 0.2,
                              type: "spring",
                              stiffness: 200,
                              damping: 15,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(method.copyValue!, method.label);
                            }}
                            className="absolute -top-1.5 md:-top-2 -right-1.5 md:-right-2 w-6 h-6 md:w-7 md:h-7 rounded-full bg-background border border-border/50 hover:bg-accent/50 transition-all duration-300 hover:scale-110 shadow-lg flex items-center justify-center"
                          >
                            {copiedField === method.label ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-2.5 w-2.5 md:h-3 md:w-3 text-muted-foreground" />
                            )}
                          </motion.button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Background decoration */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-2xl -z-10 blur-xl" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Social Media Section - Only show if there are social links */}
      {socialLinks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="relative overflow-hidden rounded-2xl p-4 md:p-6 backdrop-blur-xl border-2 md:border border-border/50 bg-gradient-to-br from-primary/5 via-transparent to-primary/10"
        >
          {/* Background effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
          <div className="absolute top-4 right-4 w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-xl" />

          <div className="relative space-y-4 md:space-y-6">
            {/* Header - Always Centered */}
            <div className="text-center space-y-2 md:space-y-3">
              <div className="flex items-center justify-center space-x-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
                  <Share2 className="h-6 w-6 text-primary" />
                </div>
                <PremiumHeading level={2} dense className="text-foreground">
                  Follow <span className="gradient-text-primary">Us</span>
                </PremiumHeading>
              </div>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                Stay connected and get the latest updates
              </p>
            </div>

            <div className="flex justify-center gap-2.5 md:gap-3">
              {socialLinks.map((social, index) => {
                const IconComponent = social.icon;
                return (
                  <motion.button
                    key={social.name}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.6 + index * 0.1,
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                    }}
                    onClick={() =>
                      social.url && window.open(social.url, "_blank")
                    }
                    className={cn(
                      "relative overflow-hidden w-12 h-12 rounded-xl transition-all duration-300",
                      "backdrop-blur-xl border-2 md:border hover:scale-110 group",
                      `bg-gradient-to-br ${social.colors.bg}`,
                      social.colors.border,
                      social.colors.glow
                    )}
                  >
                    {/* Hover effect */}
                    <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                      <div
                        className={cn(
                          "absolute inset-0 rounded-xl opacity-20 blur-sm",
                          social.colors.accent
                        )}
                      />
                    </div>

                    <div
                      className={cn(
                        "relative flex items-center justify-center h-full transition-transform duration-300 group-hover:scale-110",
                        social.colors.icon
                      )}
                    >
                      <div className="w-5 h-5">
                        <IconComponent />
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Notice Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.7, ease: [0.4, 0, 0.2, 1] }}
        className="relative overflow-hidden rounded-2xl p-4 md:p-6 backdrop-blur-xl border-2 md:border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent"
      >
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-amber-500/10 opacity-50" />
        <div className="absolute top-4 right-4 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-lg" />

        <div className="relative flex items-start gap-3 md:gap-4">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-amber-500/5 border border-amber-500/30 flex items-center justify-center">
            <span className="text-amber-500 text-base md:text-lg">⚠️</span>
          </div>
          <div className="flex-1">
            <div className="mb-2">
              <h3 className="text-lg md:text-xl font-semibold text-foreground">
                Important Notice
              </h3>
            </div>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
              Please call ahead to confirm availability and current operating
              hours. We recommend making reservations for a better experience.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
