"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PremiumDropdown } from "@/components/brand/Dropdown";
import { useToast } from "@/hooks/use-toast";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import {
  Store,
  MapPin,
  Globe,
  Phone,
  Mail,
  Clock,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Shield,
  Zap,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function GetListedForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  // Initialize reCAPTCHA hook
  const { executeRecaptcha } = useRecaptcha(
    process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY,
  );

  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    yearsInBusiness: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    website: "",
    contactName: "",
    email: "",
    phone: "",
    operatingHours: "",
    description: "",
    socialMedia: "",
  });

  // honeypot field (invisible) to trap bots
  const [website_confirm, setWebsiteConfirm] = useState("");

  // File selection state for photos
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const normalizePakPhone = (raw?: string): string | null => {
    if (!raw) return null;
    const s = String(raw).replace(/[^0-9+]/g, "");
    const digits = s.replace(/^\+/, "");
    if (/^03\d{9}$/.test(digits)) return "+92" + digits.slice(1);
    if (/^3\d{9}$/.test(digits)) return "+92" + digits;
    if (/^92?3\d{9}$/.test(digits)) return "+" + digits.replace(/^0+/, "");
    return null;
  };

  const formatPakPhone = (value: string) => {
    if (!value) return "";
    // remove all non digits and plus
    let s = value.replace(/[^0-9+]/g, "");
    // collapse multiple plus to single leading
    s = s.replace(/\++/g, "+");
    if (s[0] !== "+") s = s.replace(/\+/g, "");
    // display formatting for +92########## -> +92 300 1234567
    if (s.startsWith("+92")) {
      const rest = s.slice(3).replace(/\D/g, "");
      const part1 = rest.slice(0, 3);
      const part2 = rest.slice(3, 10);
      return ["+92", part1, part2].filter(Boolean).join(" ").trim();
    }
    // local 03xxxxxxxxx -> 03x xxx xxxx
    if (s.startsWith("03")) {
      const rest = s;
      const p1 = rest.slice(0, 4);
      const p2 = rest.slice(4, 7);
      const p3 = rest.slice(7, 11);
      return [p1, p2, p3].filter(Boolean).join(" ").trim();
    }
    return s;
  };

  const validateField = (field: string, value: unknown) => {
    const v = typeof value === "string" ? value.trim() : "";
    switch (field) {
      case "businessName":
      case "contactName":
      case "address":
      case "city":
        if (!v) return "This field is required";
        return "";
      case "businessType":
        if (!v) return "Please select a business category";
        return "";
      case "email":
        if (!v) return "Email is required";
        if (!validateEmail(v as string)) return "Invalid email address";
        return "";
      case "phone": {
        const norm = normalizePakPhone(v as string);
        if (!v) return "Phone is required";
        if (!norm) return "Enter phone as +923001234567 or 03001234567";
        return "";
      }
      case "yearsInBusiness":
        if (v && !/^\d+$/.test(v as string))
          return "Enter years as numbers only";
        return "";
      case "zipCode":
        if (v && !/^\d{5}$/.test(v as string))
          return "Enter a 5 digit postal code";
        return "";
      case "website":
        if (!v) return "";
        try {
          new URL(
            (v as string).startsWith("http")
              ? (v as string)
              : `https://${v as string}`,
          );
          return "";
        } catch {
          return "Invalid website URL";
        }
      default:
        return "";
    }
  };

  const businessCategories = [
    "Restaurant & Food Service",
    "Hotel & Accommodation",
    "Event Management",
    "Entertainment & Leisure",
    "Shopping & Retail",
    "Fitness & Healthcare",
    "Education & Training",
    "Professional Services",
    "Beauty & Wellness",
    "Automotive Services",
    "Technology & IT",
    "Real Estate",
    "Other",
  ];

  const businessCategoryOptions = businessCategories.map((c) => ({
    value: c,
    label: c,
  }));

  const steps = [
    {
      number: 1,
      title: "Business Details",
      description: "Basic information about your business",
      icon: Store,
    },
    {
      number: 2,
      title: "Contact Information",
      description: "How customers can reach you",
      icon: Mail,
    },
    {
      number: 3,
      title: "Additional Information",
      description: "Complete your business profile",
      icon: Sparkles,
    },
  ];

  const handleInputChange = (field: string, value: string) => {
    // sanitize a few fields while typing
    if (field === "yearsInBusiness") value = value.replace(/[^0-9]/g, "");
    if (field === "phone") {
      // allow digits, spaces, dashes and a single leading +
      value = value.replace(/[^0-9+\s-]/g, "");
      value = value.replace(/\++/g, "+");
      if (value.length > 0 && value[0] !== "+")
        value = value.replace(/\+/g, "");
      // limit display length
      value = value.slice(0, 13);
      // auto-format for display
      value = formatPakPhone(value);
    }
    if (field === "zipCode") value = value.replace(/\D/g, "").slice(0, 5);

    setFormData((prev) => ({ ...prev, [field]: value }));
    const err = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const openFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files || []);
      setSelectedFiles(files);
    };
    input.click();
  };

  const handleNext = () => {
    // validate fields for this step before advancing
    const fieldsByStep: Record<number, string[]> = {
      1: ["businessName", "businessType", "address", "city"],
      2: ["contactName", "email", "phone"],
      3: [],
    };
    const toCheck = fieldsByStep[currentStep] || [];
    const nextErrors = { ...errors };
    let hasError = false;
    for (const f of toCheck) {
      const err = validateField(f, (formData as Record<string, string>)[f]);
      nextErrors[f] = err;
      if (err) hasError = true;
    }
    setErrors(nextErrors);
    if (hasError) {
      // focus first invalid field
      for (const f of toCheck) {
        if (nextErrors[f]) {
          try {
            document.getElementById(f)?.focus();
          } catch {}
          break;
        }
      }
      return;
    }
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // full-form validation
    const allFields = [
      "businessName",
      "businessType",
      "contactName",
      "email",
      "phone",
      "address",
      "city",
      "website",
      "yearsInBusiness",
      "zipCode",
    ];
    const nextErrors: Record<string, string> = {};
    let hasError = false;
    for (const f of allFields) {
      const val = (formData as Record<string, string>)[f];
      const err = validateField(f, val as unknown);
      nextErrors[f] = err;
      if (err) hasError = true;
    }
    setErrors((prev) => ({ ...prev, ...nextErrors }));
    if (hasError) {
      // focus first invalid field
      for (const f of allFields) {
        if (nextErrors[f]) {
          try {
            document.getElementById(f)?.focus();
          } catch {}
          break;
        }
      }
      return;
    }

    setIsSubmitting(true);
    try {
      // normalize phone before sending
      const phoneNormalized = normalizePakPhone(formData.phone);
      const payload = { ...formData, phone: phoneNormalized };

      // Use atomic submit endpoint that includes files
      const fd = new FormData();
      // append known form fields explicitly to avoid unsafe casts
      const keys = [
        "businessName",
        "businessType",
        "yearsInBusiness",
        "address",
        "city",
        "state",
        "zipCode",
        "website",
        "contactName",
        "email",
        "phone",
        "operatingHours",
        "description",
        "socialMedia",
      ];
      for (const k of keys) {
        const v = (payload as Record<string, string>)[k];
        if (v !== undefined && v !== null) fd.append(k, v);
      }
      // append honeypot
      fd.append("website_confirm", website_confirm || "");

      // reCAPTCHA v3 token if configured
      try {
        const token = await executeRecaptcha("submit");
        if (token) fd.append("recaptcha_token", token);
      } catch (e) {
        console.warn("reCAPTCHA token fetch failed", e);
      }
      for (const f of selectedFiles.slice(0, 8)) fd.append("files", f);

      const response = await fetch("/api/get-listed/submit", {
        method: "POST",
        body: fd,
      });
      const result = await response.json();
      if (response.ok && result.success) {
        // store receipt id for anonymous users so refresh shows confirmation
        try {
          if (result.receipt)
            localStorage.setItem("get_listed_receipt", String(result.receipt));
          else if (result.id)
            localStorage.setItem("get_listed_receipt", String(result.id));
        } catch {}
        setIsSubmitted(true);
        toast({
          title: "Listing submitted",
          description:
            "Your listing has been sent for review. Our team will contact you.",
        });
      } else {
        console.error("Submission failed:", result.error);
        toast({
          variant: "destructive",
          title: "Submission failed",
          description:
            result.error || "Failed to submit listing. Please try again.",
        });
      }
    } catch (error) {
      console.error("Network error:", error);
      toast({
        variant: "destructive",
        title: "Network error",
        description: "Could not connect to the server.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // on mount: check for receipt or previous submission
  React.useEffect(() => {
    (async () => {
      try {
        const signed =
          typeof window !== "undefined"
            ? localStorage.getItem("get_listed_signed")
            : null;
        const id =
          typeof window !== "undefined"
            ? localStorage.getItem("get_listed_receipt")
            : null;
        if (signed && id) {
          const resp = await fetch(
            `/api/get-listed/latest?id=${encodeURIComponent(
              id,
            )}&signed=${encodeURIComponent(signed)}`,
            { credentials: "include" },
          );
          const data = await resp.json();
          if (data?.success && data.submission) setIsSubmitted(true);
        } else if (id) {
          const resp = await fetch(
            `/api/get-listed/latest?id=${encodeURIComponent(id)}`,
            { credentials: "include" },
          );
          const data = await resp.json();
          if (data?.success && data.submission) setIsSubmitted(true);
        } else {
          // fallback: fetch latest for logged-in user
          const resp = await fetch("/api/get-listed/latest", {
            credentials: "include",
          });
          const data = await resp.json();
          if (data?.success && data.submission) setIsSubmitted(true);
        }
      } catch (err) {
        console.debug("latest check failed", err);
      }
    })();
  }, []);

  if (isSubmitted) {
    return (
      <section
        id="listing-form"
        className="py-16 lg:py-24 relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/5"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="p-8 lg:p-12 rounded-3xl bg-card border border-border/50 shadow-premium">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-10 h-10 text-white" />
              </motion.div>

              <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground mb-4">
                Listing Submitted — Under Review
              </h3>

              <p className="text-muted-foreground mb-6">
                Thank you for listing your business with Inside Karachi. Our
                team will review your submission and your listing will be live
                within 24-48 hours.
              </p>

              <div className="space-y-4">
                <Badge className="px-4 py-2">
                  <Zap className="w-4 h-4 mr-2" />
                  Business Listing Submitted
                </Badge>

                <div className="text-sm text-muted-foreground space-y-2">
                  <p className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    You&apos;ll receive a confirmation email shortly
                  </p>
                  <p className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Our team will contact you within 24 hours
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="listing-form"
      className="py-16 lg:py-24 relative overflow-hidden"
    >
      {/* Background - matching homepage pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />

      {/* Animated Background Elements */}
      <div className="absolute -top-16 sm:-top-32 -right-16 sm:-right-32 w-48 h-48 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-16 sm:-bottom-32 -left-16 sm:-left-32 w-48 h-48 sm:w-96 sm:h-96 bg-primary/5 rounded-full blur-3xl" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--primary-rgb),0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--primary-rgb),0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center space-y-4 lg:space-y-6 mb-12 lg:mb-16"
        >
          <Badge className="px-6 py-2 text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
            <Shield className="w-4 h-4 mr-2" />
            Quick & Secure
          </Badge>

          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
            List Your Business
            <span className="gradient-text-primary"> in Minutes</span>
          </h2>

          <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed px-4 sm:px-0">
            Ready to list your business? Share your details below and our team
            will be in touch.
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          {/* honeypot field - visually hidden */}
          <input
            type="text"
            name="website_confirm"
            value={website_confirm}
            onChange={(e) => setWebsiteConfirm(e.target.value)}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          />
          {/* Progress Steps - Mobile Optimized */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            {/* Mobile Progress - Horizontal Dots */}
            <div className="flex sm:hidden justify-center items-center space-x-6 mb-8">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="flex flex-col items-center space-y-2"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 text-sm font-semibold",
                      currentStep >= step.number
                        ? "bg-primary text-white shadow-lg"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500",
                    )}
                  >
                    {currentStep > step.number ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <div
                    className={cn(
                      "text-xs font-medium text-center max-w-16",
                      currentStep >= step.number
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {step.title.split(" ")[0]}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Progress - Full Layout */}
            <div className="hidden sm:flex justify-center items-center space-x-8">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center">
                  <div className="flex items-center space-x-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                        currentStep >= step.number
                          ? "bg-primary text-white shadow-lg"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-500",
                      )}
                    >
                      {currentStep > step.number ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <step.icon className="w-6 h-6" />
                      )}
                    </div>

                    <div className="text-left">
                      <div
                        className={cn(
                          "font-semibold text-sm",
                          currentStep >= step.number
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {step.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {step.description}
                      </div>
                    </div>
                  </div>

                  {index < steps.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-muted-foreground mx-4" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative overflow-hidden rounded-xl sm:rounded-2xl backdrop-blur-xl border border-border/50 bg-gradient-to-br from-background/80 via-background/90 to-background/80 shadow-premium-lg"
          >
            {/* Border glow (hover reveals) */}
            <div className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none">
              <div className="absolute inset-0 rounded-2xl bg-primary/10 opacity-30 blur-md" />
              <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-10 blur-lg" />
            </div>

            <div className="relative z-10 p-6 lg:p-8">
              {/* Step 1: Business Details */}
              {currentStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label
                        htmlFor="businessName"
                        className="flex items-center gap-2"
                      >
                        <Store className="w-4 h-4 text-primary" />
                        Business Name *
                      </Label>
                      <Input
                        id="businessName"
                        placeholder="Enter your business name"
                        value={formData.businessName}
                        onChange={(e) =>
                          handleInputChange("businessName", e.target.value)
                        }
                        className="h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="businessType">Business Category *</Label>
                      <PremiumDropdown
                        value={formData.businessType}
                        onChange={(val) =>
                          handleInputChange("businessType", val || "")
                        }
                        options={businessCategoryOptions}
                        placeholder="Select category"
                        searchable={true}
                      />
                      {errors.businessType && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.businessType}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="yearsInBusiness"
                        className="flex items-center gap-2"
                      >
                        <Clock className="w-4 h-4 text-primary" />
                        Years in Business
                      </Label>
                      <Input
                        id="yearsInBusiness"
                        placeholder="How long have you been operating?"
                        value={formData.yearsInBusiness}
                        onChange={(e) =>
                          handleInputChange("yearsInBusiness", e.target.value)
                        }
                        className="h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="website"
                        className="flex items-center gap-2"
                      >
                        <Globe className="w-4 h-4 text-primary" />
                        Website
                      </Label>
                      <Input
                        id="website"
                        placeholder="https://your-website.com"
                        value={formData.website}
                        onChange={(e) =>
                          handleInputChange("website", e.target.value)
                        }
                        className="h-12"
                      />
                    </div>

                    <div className="lg:col-span-2 space-y-2">
                      <Label
                        htmlFor="address"
                        className="flex items-center gap-2"
                      >
                        <MapPin className="w-4 h-4 text-primary" />
                        Business Address *
                      </Label>
                      <Input
                        id="address"
                        placeholder="Enter your complete business address"
                        value={formData.address}
                        onChange={(e) =>
                          handleInputChange("address", e.target.value)
                        }
                        className={cn(
                          "h-12",
                          errors.address && "border-destructive",
                        )}
                      />
                      {errors.address && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.address}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        placeholder="Karachi"
                        value={formData.city}
                        onChange={(e) =>
                          handleInputChange("city", e.target.value)
                        }
                        className={cn(
                          "h-12",
                          errors.city && "border-destructive",
                        )}
                      />
                      {errors.city && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.city}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state">State/Province</Label>
                      <Input
                        id="state"
                        placeholder="Sindh"
                        value={formData.state}
                        onChange={(e) =>
                          handleInputChange("state", e.target.value)
                        }
                        className="h-12"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Contact Information */}
              {currentStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Contact Person *</Label>
                      <Input
                        id="contactName"
                        placeholder="Your full name"
                        value={formData.contactName}
                        onChange={(e) =>
                          handleInputChange("contactName", e.target.value)
                        }
                        className="h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="email"
                        className="flex items-center gap-2"
                      >
                        <Mail className="w-4 h-4 text-primary" />
                        Email Address *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.email@business.com"
                        value={formData.email}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                        className={cn(
                          "h-12",
                          errors.email && "border-destructive",
                        )}
                      />
                      {errors.email && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="phone"
                        className="flex items-center gap-2"
                      >
                        <Phone className="w-4 h-4 text-primary" />
                        Phone Number *
                      </Label>
                      <Input
                        id="phone"
                        placeholder="+92 300 1234567"
                        value={formData.phone}
                        onChange={(e) =>
                          handleInputChange("phone", e.target.value)
                        }
                        className={cn(
                          "h-12",
                          errors.phone && "border-destructive",
                        )}
                      />
                      {errors.phone ? (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.phone}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Format: +923001234567 or 03001234567
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="zipCode">Zip/Postal Code</Label>
                      <Input
                        id="zipCode"
                        placeholder="74000"
                        value={formData.zipCode}
                        onChange={(e) =>
                          handleInputChange("zipCode", e.target.value)
                        }
                        className={cn(
                          "h-12",
                          errors.zipCode && "border-destructive",
                        )}
                      />
                      {errors.zipCode && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.zipCode}
                        </p>
                      )}
                    </div>

                    <div className="lg:col-span-2 space-y-2">
                      <Label
                        htmlFor="operatingHours"
                        className="flex items-center gap-2"
                      >
                        <Clock className="w-4 h-4 text-primary" />
                        Operating Hours
                      </Label>
                      <Input
                        id="operatingHours"
                        placeholder="e.g., Mon-Fri 9AM-6PM, Sat 10AM-4PM"
                        value={formData.operatingHours}
                        onChange={(e) =>
                          handleInputChange("operatingHours", e.target.value)
                        }
                        className="h-12"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Additional Information */}
              {currentStep === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="description">Business Description</Label>
                      <textarea
                        id="description"
                        placeholder="Tell us about your business, services, specialties, and what makes you unique..."
                        value={formData.description}
                        onChange={(e) =>
                          handleInputChange("description", e.target.value)
                        }
                        className="w-full h-32 px-3 py-2 rounded-md border border-border bg-background text-foreground resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="socialMedia">Social Media Links</Label>
                      <Input
                        id="socialMedia"
                        placeholder="Facebook, Instagram, Twitter URLs (comma separated)"
                        value={formData.socialMedia}
                        onChange={(e) =>
                          handleInputChange("socialMedia", e.target.value)
                        }
                        className="h-12"
                      />
                    </div>

                    <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-primary/20">
                      <div className="flex items-start gap-4">
                        <Upload className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                        <div>
                          <h4 className="font-semibold text-foreground mb-2">
                            Upload Photos (Optional)
                          </h4>
                          <p className="text-sm text-muted-foreground mb-4">
                            Add high-quality photos of your business, products,
                            or services to attract more customers.
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={openFilePicker}
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              Choose Files
                            </Button>
                            {selectedFiles.length > 0 && (
                              <div className="text-sm text-muted-foreground">
                                {selectedFiles.length} file(s) selected
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-primary/10 rounded-2xl border border-primary/20">
                      <h4 className="font-semibold text-foreground mb-2">
                        What happens next?
                      </h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                          Our team will review your listing within 24 hours
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                          You&apos;ll receive approval notification via email
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                          Your business will be live and searchable immediately
                        </li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Form Navigation */}
              <div className="pt-8 border-t border-border/50">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    {currentStep > 1 && (
                      <Button
                        variant="outline"
                        onClick={handlePrevious}
                        className="px-4 sm:px-6"
                      >
                        Previous
                      </Button>
                    )}
                  </div>

                  <div className="flex-1 flex justify-end">
                    {currentStep < 3 ? (
                      <Button
                        onClick={handleNext}
                        className="px-4 sm:px-6 group"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <span className="sm:hidden">Next</span>
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-4 sm:px-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border- border-border/30 border-t-white rounded-full animate-spin mr-2" />
                            <span className="hidden sm:inline">
                              Submitting...
                            </span>
                            <span className="sm:hidden">Submitting...</span>
                          </>
                        ) : (
                          <>
                            <span className="hidden sm:inline">
                              Submit Listing
                            </span>
                            <span className="sm:hidden">Submit</span>
                            <Store className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
