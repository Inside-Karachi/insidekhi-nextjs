"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PremiumDropdown } from "@/components/brand/Dropdown";
import { useToast } from "@/hooks/use-toast";
import {
  Building,
  MapPin,
  Globe,
  Phone,
  Mail,
  Calendar,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Shield,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRecaptcha } from "@/hooks/useRecaptcha";

export function MembershipForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();
  const { executeRecaptcha } = useRecaptcha(
    process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY,
  );

  const [formData, setFormData] = useState({
    companyName: "",
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
    interests: "",
  });

  // Per-field inline error messages
  const [errors, setErrors] = useState<Record<string, string>>({});
  // honeypot field to trap bots
  const [website_confirm, setWebsiteConfirm] = useState("");

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
    let s = value.replace(/[^0-9+]/g, "");
    s = s.replace(/\++/g, "+");
    if (s[0] !== "+") s = s.replace(/\+/g, "");
    if (s.startsWith("+92")) {
      const rest = s.slice(3).replace(/\D/g, "");
      const part1 = rest.slice(0, 3);
      const part2 = rest.slice(3, 10);
      return ["+92", part1, part2].filter(Boolean).join(" ").trim();
    }
    if (s.startsWith("03")) {
      const rest = s.replace(/\D/g, "");
      const p1 = rest.slice(0, 4);
      const p2 = rest.slice(4, 7);
      const p3 = rest.slice(7, 11);
      return [p1, p2, p3].filter(Boolean).join(" ").trim();
    }
    return s;
  };

  const validateField = (field: string, value: unknown): string => {
    const v = typeof value === "string" ? value.trim() : "";
    switch (field) {
      case "companyName":
      case "contactName":
      case "address":
      case "city":
        if (!v) return "This field is required";
        return "";
      case "businessType":
        if (!v) return "Please select a business type";
        return "";
      case "email":
        if (!v) return "Email is required";
        if (!validateEmail(v as string)) return "Invalid email address";
        return "";
      case "phone": {
        const norm = normalizePakPhone(v as string);
        if (!v) return "Phone is required";
        if (!norm) return "Invalid Pakistan phone number";
        return "";
      }
      case "yearsInBusiness":
        if (v && !/^\d+$/.test(v as string))
          return "Please enter years as a number";
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

  const businessTypes = [
    "Restaurant & Food",
    "Hotel & Accommodation",
    "Event Management",
    "Entertainment & Leisure",
    "Shopping & Retail",
    "Fitness & Healthcare",
    "Education & Training",
    "Professional Services",
    "Other",
  ];

  const businessTypeOptions = businessTypes.map((type) => ({
    value: type,
    label: type,
  }));

  const steps = [
    {
      number: 1,
      title: "Company Details",
      description: "Tell us about your business",
      icon: Building,
    },
    {
      number: 2,
      title: "Contact Information",
      description: "How can we reach you",
      icon: Mail,
    },
    {
      number: 3,
      title: "Additional Information",
      description: "Final details to complete",
      icon: Sparkles,
    },
  ];

  const handleInputChange = (field: string, value: string) => {
    // Sanitize some fields as user types
    if (field === "yearsInBusiness") {
      // allow only digits
      value = value.replace(/[^0-9]/g, "");
    }

    if (field === "phone") {
      // allow digits, plus, spaces, dashes while typing
      value = value.replace(/[^0-9+\s-]/g, "");
      // collapse multiple plus signs and keep only leading plus
      value = value.replace(/\++/g, "+");
      if (value.length > 0 && value[0] !== "+") {
        // allow either leading + or digits; ensure only one leading +
        value = value.replace(/\+/g, "");
      } else if (value.indexOf("+") > 0) {
        value = value.replace(/\+/g, "");
        value = "+" + value;
      }
      // enforce max length for E.164 Pakistan: +92########## -> 13 chars
      value = value.slice(0, 13);
      // auto-format for display
      value = formatPakPhone(value);
    }

    if (field === "zipCode") {
      // allow only digits and limit to 5 characters (Pakistan postal codes are 5 digits)
      value = value.replace(/\D/g, "").slice(0, 5);
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
    const err = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  // Focus helper for first invalid field
  const focusField = (field: string) => {
    try {
      const el = document.getElementById(field) as HTMLElement | null;
      if (el && typeof el.focus === "function") el.focus();
    } catch {
      // ignore in SSR or if element not present
    }
  };

  const handleNext = () => {
    // Validate current step before moving forward
    const fieldsByStep: Record<number, string[]> = {
      1: ["companyName", "businessType", "address", "city"],
      2: ["contactName", "email", "phone"],
      3: [],
    };
    const toCheck = fieldsByStep[currentStep] || [];
    let hasError = false;
    const nextErrors = { ...errors };
    for (const f of toCheck) {
      const val = (formData as Record<string, string>)[f];
      const err = validateField(f, val as unknown);
      nextErrors[f] = err;
      if (err) hasError = true;
    }
    setErrors(nextErrors);
    if (hasError) {
      // focus first invalid field in this step
      for (const f of toCheck) {
        if (nextErrors[f]) {
          focusField(f);
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
    // Client-side validation (full form)

    // (validators live at component scope)
    // Run per-field validators and collect errors
    const allFields = [
      "companyName",
      "businessType",
      "contactName",
      "email",
      "phone",
      "address",
      "city",
      "website",
      "yearsInBusiness",
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
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "Please fix the highlighted fields.",
      });
      // focus first invalid field
      for (const f of allFields) {
        if (nextErrors[f]) {
          focusField(f);
          break;
        }
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const phoneNormalized = normalizePakPhone(formData.phone);

      const payload = {
        ...formData,
        phone: phoneNormalized,
        website_confirm,
      };

      // Try to attach a reCAPTCHA v3 token
      try {
        const token = await executeRecaptcha("membership_submit");
        if (token)
          (payload as Record<string, unknown>)["recaptcha_token"] = token;
      } catch {}

      const response = await fetch("/api/membership", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        try {
          if (result.signedReceipt)
            localStorage.setItem(
              "membership_signed",
              String(result.signedReceipt),
            );
        } catch {}
        setIsSubmitted(true);
        toast({
          title: "Submitted",
          description: "Membership application submitted.",
        });
      } else {
        console.error("Submission failed:", result.error);
        toast({
          variant: "destructive",
          title: "Submission Error",
          description: result.error || "An unexpected error occurred.",
        });
      }
    } catch (error) {
      console.error("Network error:", error);
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "Could not connect to the server.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // on mount: check if current logged-in user has membership application
  React.useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("/api/membership", { credentials: "include" });
        if (!resp.ok) return;
        const j = await resp.json();
        if (
          j &&
          j.success &&
          Array.isArray(j.applications) &&
          j.applications.length > 0
        ) {
          setIsSubmitted(true);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  if (isSubmitted) {
    return (
      <section
        id="membership-form"
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
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="relative overflow-hidden rounded-xl sm:rounded-2xl backdrop-blur-xl border border-border/50 bg-gradient-to-br from-background/80 via-background/90 to-background/80 shadow-premium-lg p-8 lg:p-12">
              {/* Border glow */}
              <div className="absolute inset-0 rounded-2xl opacity-50 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 opacity-30 blur-md" />
                <div className="absolute inset-0 rounded-2xl bg-emerald-500/5 opacity-10 blur-lg" />
              </div>

              <div className="relative z-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle className="w-10 h-10 text-white" />
                </motion.div>

                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-4">
                  Application Submitted Successfully!
                </h3>

                <p className="text-muted-foreground mb-6">
                  Thank you for your interest in joining Inside Karachi. Our
                  membership team will review your application and get back to
                  you within 2-3 business days.
                </p>

                <Badge className="px-6 py-2 text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
                  <Zap className="w-4 h-4 mr-2" />
                  Membership Pending
                </Badge>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="membership-form"
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
            Secure Application
          </Badge>

          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
            Join Our Premium{" "}
            <span className="gradient-text-primary">Membership Program</span>
          </h2>

          <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed px-4 sm:px-0">
            Tell us about your business and interests below and a membership
            representative will be in touch.
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          {/* honeypot field - visually hidden from users */}
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
            className="max-w-4xl mx-auto"
          >
            <div className="relative overflow-hidden rounded-xl sm:rounded-2xl backdrop-blur-xl border border-border/50 bg-gradient-to-br from-background/80 via-background/90 to-background/80 shadow-premium-lg">
              {/* Border glow */}
              <div className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 rounded-2xl bg-primary/10 opacity-30 blur-md" />
                <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-10 blur-lg" />
              </div>

              <div className="relative z-10 p-6 lg:p-8">
                {/* Step 1: Company Details */}
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
                          htmlFor="companyName"
                          className="flex items-center gap-2"
                        >
                          <Building className="w-4 h-4 text-primary" />
                          Company Name *
                        </Label>
                        <Input
                          id="companyName"
                          placeholder="Enter your company name"
                          value={formData.companyName}
                          onChange={(e) =>
                            handleInputChange("companyName", e.target.value)
                          }
                          className={cn(
                            "h-12",
                            errors.companyName && "border-destructive",
                          )}
                        />
                        {errors.companyName && (
                          <p className="mt-1 text-sm text-destructive">
                            {errors.companyName}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="businessType">Business Type *</Label>
                        <div>
                          <PremiumDropdown
                            value={formData.businessType}
                            onChange={(value) =>
                              handleInputChange("businessType", value || "")
                            }
                            options={businessTypeOptions}
                            placeholder="Select business type"
                            searchable={true}
                          />
                          {errors.businessType && (
                            <p className="mt-1 text-sm text-destructive">
                              {errors.businessType}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="yearsInBusiness"
                          className="flex items-center gap-2"
                        >
                          <Calendar className="w-4 h-4 text-primary" />
                          Years in Business
                        </Label>
                        <Input
                          id="yearsInBusiness"
                          placeholder="How long have you been in business?"
                          value={formData.yearsInBusiness}
                          onChange={(e) =>
                            handleInputChange("yearsInBusiness", e.target.value)
                          }
                          className={cn(
                            "h-12",
                            errors.yearsInBusiness && "border-destructive",
                          )}
                        />
                        {errors.yearsInBusiness && (
                          <p className="mt-1 text-sm text-destructive">
                            {errors.yearsInBusiness}
                          </p>
                        )}
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
                          className={cn(
                            "h-12",
                            errors.website && "border-destructive",
                          )}
                        />
                        {errors.website && (
                          <p className="mt-1 text-sm text-destructive">
                            {errors.website}
                          </p>
                        )}
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
                          placeholder="Enter your business address"
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
                        <Label htmlFor="contactName">Contact Name *</Label>
                        <Input
                          id="contactName"
                          placeholder="Your full name"
                          value={formData.contactName}
                          onChange={(e) =>
                            handleInputChange("contactName", e.target.value)
                          }
                          className={cn(
                            "h-12",
                            errors.contactName && "border-destructive",
                          )}
                        />
                        {errors.contactName && (
                          <p className="mt-1 text-sm text-destructive">
                            {errors.contactName}
                          </p>
                        )}
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
                          placeholder="your.email@company.com"
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
                          className="h-12"
                        />
                        {errors.zipCode && (
                          <p className="mt-1 text-sm text-destructive">
                            {errors.zipCode}
                          </p>
                        )}
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
                    <div className="space-y-2">
                      <Label htmlFor="interests">Areas of Interest</Label>
                      <textarea
                        id="interests"
                        placeholder="Tell us about your business goals, marketing interests, or any specific areas where you'd like our support..."
                        value={formData.interests}
                        onChange={(e) =>
                          handleInputChange("interests", e.target.value)
                        }
                        className="w-full h-32 px-3 py-2 rounded-md border border-border bg-background text-foreground resize-none"
                      />
                    </div>

                    <div className="p-6 bg-primary/10 rounded-2xl border border-primary/20">
                      <h4 className="font-semibold text-foreground mb-2">
                        What happens next?
                      </h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                          Our team will review your application within 2-3
                          business days
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                          We&apos;ll schedule a consultation to discuss
                          membership benefits
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                          Upon approval, you&apos;ll receive premium member
                          access immediately
                        </li>
                      </ul>
                    </div>
                  </motion.div>
                )}

                {/* Form Navigation */}
                <div className="pt-8 border-t border-border/50">
                  {/* Progress Indicators - Always Centered */}
                  {/* <div className="flex justify-center mb-6">
                  <div className="flex space-x-3">
                    {steps.map((_, index) => (
                      <div
                        key={index}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all duration-300",
                          currentStep >= index + 1 
                            ? "bg-primary shadow-lg shadow-primary/25" 
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                      />
                    ))}
                  </div>
                </div> */}

                  {/* Buttons */}
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
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                              <span className="hidden sm:inline">
                                Submitting...
                              </span>
                              <span className="sm:hidden">Submitting...</span>
                            </>
                          ) : (
                            <>
                              <span className="hidden sm:inline">
                                Submit Application
                              </span>
                              <span className="sm:hidden">Submit</span>
                              <Sparkles className="w-4 h-4 ml-2" />
                            </>
                          )}
                        </Button>
                      )}
                    </div>
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
