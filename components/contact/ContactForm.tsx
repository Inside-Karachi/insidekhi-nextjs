"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import {
  Mail,
  CheckCircle,
  ArrowRight,
  User,
  MessageSquare,
  Phone,
  Building2,
} from "lucide-react";

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    phone: "",
    website_confirm: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  // Initialize reCAPTCHA hook
  const { executeRecaptcha } = useRecaptcha(
    process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY,
  );

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

  const validateField = (field: string, value: unknown) => {
    const v = typeof value === "string" ? value.trim() : "";
    switch (field) {
      case "name":
        if (!v) return "Name is required";
        return "";
      case "email":
        if (!v) return "Email is required";
        if (!validateEmail(v as string)) return "Invalid email address";
        return "";
      case "message":
        if (!v) return "Message is required";
        if ((v as string).length < 10) return "Please provide more details";
        return "";
      case "phone": {
        if (!v) return ""; // optional
        const norm = normalizePakPhone(v as string);
        if (!norm) return "Enter a valid Pakistan phone number";
        return "";
      }
      default:
        return "";
    }
  };

  const handleChange = (field: string, value: string) => {
    if (field === "phone") {
      value = value.replace(/[^0-9+\s-]/g, "");
      value = value.replace(/\++/g, "+");
      if (value.length > 0 && value[0] !== "+")
        value = value.replace(/\+/g, "");
      value = value.slice(0, 13);
      value = formatPakPhone(value);
    }
    setFormData((p) => ({ ...p, [field]: value }));
    const err = validateField(field, value);
    setErrors((e) => ({ ...e, [field]: err }));
  };

  const handleSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    // Validate all required fields
    const fields = ["name", "email", "message", "phone"];
    const next: Record<string, string> = {};
    let hasError = false;
    for (const f of fields) {
      const err = validateField(f, (formData as Record<string, string>)[f]);
      next[f] = err;
      if (err) hasError = true;
    }
    setErrors((e) => ({ ...e, ...next }));
    if (hasError) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "Please fix the highlighted fields.",
      });
      // focus first invalid
      for (const f of fields)
        if (next[f]) {
          try {
            document.getElementById(f)?.focus();
          } catch {}
          break;
        }
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = { ...formData };

      // reCAPTCHA v3: attempt to fetch token if available
      try {
        const token = await executeRecaptcha("contact");
        if (token) payload.recaptcha_token = token;
      } catch (e) {
        console.warn("reCAPTCHA token fetch failed", e);
      }
      const resp = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await resp.json();
      if (resp.ok && j?.success) {
        setIsSubmitted(true);
        toast({
          title: "Message sent",
          description: "We'll reply as soon as we can.",
        });
      } else {
        console.error("Contact submit error", j);
        toast({
          variant: "destructive",
          title: "Send failed",
          description: j?.error || "Failed to submit message",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Network error",
        description: "Could not connect to the server.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // reCAPTCHA is now handled by the useRecaptcha hook

  if (isSubmitted) {
    return (
      <section
        id="contact-success"
        className="py-16 lg:py-24 relative overflow-hidden"
      >
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-emerald-500/5" />
        <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(var(--primary-rgb),0.02)_1px,transparent_1px),linear-gradient(-45deg,rgba(var(--primary-rgb),0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />

        {/* Floating Elements */}
        <motion.div
          animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 right-20 p-3 rounded-xl bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/20"
        >
          <CheckCircle className="h-6 w-6 text-emerald-500" />
        </motion.div>

        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="relative p-8 lg:p-12 rounded-3xl bg-background/80 backdrop-blur-xl border border-border/50 shadow-premium-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-background to-emerald-500/10 rounded-3xl" />

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="relative w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
              >
                <CheckCircle className="w-10 h-10 text-white" />
              </motion.div>

              <div className="relative space-y-4">
                <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground">
                  Message Sent Successfully!
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Thanks for contacting us! We&apos;ve received your message and
                  will respond within 1-2 business days.
                </p>
                <Badge className="px-6 py-2 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Contact request received
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
      id="contact-form"
      className="py-12 lg:py-16 relative overflow-hidden"
    >
      {/* Background styling */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />

      {/* Background elements */}
      <div className="absolute -top-16 sm:-top-32 -right-16 sm:-right-32 w-48 h-48 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-16 sm:-bottom-32 -left-16 sm:-left-32 w-48 h-48 sm:w-96 sm:h-96 bg-primary/5 rounded-full blur-3xl" />

      {/* Grid pattern */}
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
            <Mail className="w-4 h-4 mr-2" />
            Send Message
          </Badge>
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
            Get in <span className="gradient-text-primary">Touch</span>
          </h2>
          <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed px-4 sm:px-0">
            Have a question or want to work together? We&apos;d love to hear
            from you. Send us a message and we&apos;ll respond as soon as
            possible.
          </p>
        </motion.div>

        {/* Contact Form */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl backdrop-blur-xl border border-border/50 bg-gradient-to-br from-background/80 via-background/90 to-background/80 shadow-premium-lg">
            {/* Border glow (hover reveals) */}
            <div className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none">
              <div className="absolute inset-0 rounded-2xl bg-primary/10 opacity-30 blur-md" />
              <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-10 blur-lg" />
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 p-6 lg:p-8">
              {/* Hidden field to catch bots */}
              <input
                type="text"
                id="website_confirm"
                name="website_confirm"
                value={formData.website_confirm}
                onChange={(e) =>
                  handleChange("website_confirm", e.target.value)
                }
                autoComplete="off"
                tabIndex={-1}
                className="hidden"
              />

              <div className="space-y-6 lg:space-y-8">
                {/* First Row - Name & Email */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="space-y-2"
                  >
                    <Label
                      htmlFor="name"
                      className="text-sm font-semibold text-foreground flex items-center gap-2"
                    >
                      <User className="h-4 w-4 text-primary" />
                      Full Name *
                    </Label>
                    <div className="relative group">
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        placeholder="Enter your full name"
                        className="h-12 pl-4 pr-4 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all duration-300 group-hover:border-primary/30"
                        aria-invalid={!!errors.name}
                      />
                      {errors.name && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-destructive mt-2 flex items-center gap-1"
                        >
                          {errors.name}
                        </motion.p>
                      )}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="space-y-2"
                  >
                    <Label
                      htmlFor="email"
                      className="text-sm font-semibold text-foreground flex items-center gap-2"
                    >
                      <Mail className="h-4 w-4 text-primary" />
                      Email Address *
                    </Label>
                    <div className="relative group">
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder="you@company.com"
                        className="h-12 pl-4 pr-4 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all duration-300 group-hover:border-primary/30"
                        aria-invalid={!!errors.email}
                      />
                      {errors.email && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-destructive mt-2 flex items-center gap-1"
                        >
                          {errors.email}
                        </motion.p>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Second Row - Subject & Phone */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="space-y-2"
                  >
                    <Label
                      htmlFor="subject"
                      className="text-sm font-semibold text-foreground flex items-center gap-2"
                    >
                      <Building2 className="h-4 w-4 text-primary" />
                      Subject
                    </Label>
                    <div className="relative group">
                      <Input
                        id="subject"
                        value={formData.subject}
                        onChange={(e) =>
                          handleChange("subject", e.target.value)
                        }
                        placeholder="What's this about?"
                        className="h-12 pl-4 pr-4 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all duration-300 group-hover:border-primary/30"
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="space-y-2"
                  >
                    <Label
                      htmlFor="phone"
                      className="text-sm font-semibold text-foreground flex items-center gap-2"
                    >
                      <Phone className="h-4 w-4 text-primary" />
                      Phone Number
                    </Label>
                    <div className="relative group">
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        placeholder="0300 1234567"
                        className="h-12 pl-4 pr-4 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all duration-300 group-hover:border-primary/30"
                      />
                      {errors.phone && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-destructive mt-2 flex items-center gap-1"
                        >
                          {errors.phone}
                        </motion.p>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Message Field */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="space-y-2"
                >
                  <Label
                    htmlFor="message"
                    className="text-sm font-semibold text-foreground flex items-center gap-2"
                  >
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Your Message *
                  </Label>
                  <div className="relative group">
                    <textarea
                      id="message"
                      value={formData.message}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        handleChange("message", e.target.value)
                      }
                      rows={6}
                      className="w-full min-h-[120px] rounded-xl border border-border/50 bg-background/50 px-4 py-3 text-base resize-none focus:border-primary/50 focus:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all duration-300 group-hover:border-primary/30"
                      placeholder="Tell us about your project, questions, or how we can help..."
                    />
                    {errors.message && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-destructive mt-2 flex items-center gap-1"
                      >
                        {errors.message}
                      </motion.p>
                    )}
                  </div>
                </motion.div>

                {/* Submit Section */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4"
                >
                  <div className="text-sm text-muted-foreground text-center sm:text-left">
                    <span className="hidden sm:inline">
                      Prefer a faster reply? Include your phone and best time to
                      call.
                    </span>
                    <span className="sm:hidden">
                      We&apos;ll respond within 24 hours
                    </span>
                  </div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      size="lg"
                      className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group min-w-[160px]"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Sending...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>Send Message</span>
                          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                        </div>
                      )}
                    </Button>
                  </motion.div>
                </motion.div>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default ContactForm;
