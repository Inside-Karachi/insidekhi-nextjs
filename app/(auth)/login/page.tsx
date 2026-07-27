"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeAwareLogo } from "@/components/layout/ThemeAwareLogo";
import {
  Mail,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { AuthFormPanel, WelcomePanel } from "@/components/auth/GlassPanel";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AppleSignInButton } from "@/components/auth/AppleSignInButton";
import { useToast } from "@/hooks/use-toast";

function LoginForm() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false);
  const [showResendForm, setShowResendForm] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  // Handle URL parameters on component mount
  useEffect(() => {
    const verified = searchParams.get("verified");
    const errorParam = searchParams.get("error");
    const message = searchParams.get("message");

    if (verified === "true") {
      setShowVerificationSuccess(true);
      toast({
        title: "✅ Email Verified!",
        description:
          "Your account has been successfully verified. You can now log in.",
      });
    }

    if (errorParam) {
      setError(errorParam);
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: errorParam,
      });
    }

    if (message) {
      toast({
        title: "Notice",
        description: message,
      });
    }
  }, [searchParams, toast]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        const message = data.error || "An unexpected error occurred.";
        setError(message);

        if (data.code === "email_not_confirmed") {
          // Pre-fill the resend form with the address the user just typed and
          // open it immediately so they can act without any extra steps.
          setResendEmail(email);
          setShowResendForm(true);
          toast({
            variant: "destructive",
            title: "Email Not Verified",
            description:
              "Check your inbox for the confirmation link, or resend it below.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: message,
          });
        }
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You have been successfully logged in.",
      });

      const data = await response.json().catch(() => ({}));
      const role =
        data && typeof data === "object" && "role" in data
          ? String(data.role)
          : null;

      // Prefer next, then returnUrl (middleware uses returnUrl for admin intercepts).
      const nextUrl =
        searchParams.get("next") || searchParams.get("returnUrl");
      let destination =
        nextUrl && nextUrl.startsWith("/") && !nextUrl.startsWith("//")
          ? nextUrl
          : "/dashboard";

      // data_entry accounts may only use listing capacity
      if (role === "data_entry") {
        destination = "/admin/listing-capacity";
      }

      window.location.href = destination;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    setIsResending(true);

    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resendEmail }),
    });

    const data = await response.json();

    if (!response.ok) {
      toast({
        variant: "destructive",
        title: "Resend Failed",
        description:
          data.message || data.error || "Failed to resend verification email.",
      });
    } else {
      toast({
        title: "Email Sent",
        description: data.message || "Verification email sent successfully.",
      });
      setShowResendForm(false);
      setResendEmail("");
    }

    setIsResending(false);
  };

  return (
    <AuthBackground>
      <div className="min-h-screen flex flex-col">
        {/* Header with back button and logo */}
        <div className="flex justify-between items-center pt-8 pb-4 px-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link
              href="/"
              className="group flex items-center space-x-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all duration-300 text-white/80 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span className="text-sm font-medium">Home</span>
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <ThemeAwareLogo />
          </motion.div>
          <div className="w-20"></div> {/* Spacer for centering logo */}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md space-y-6">
            {/* Verification Success Banner */}
            {showVerificationSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 backdrop-blur-sm"
              >
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-green-400 font-medium text-sm">
                      Email Verified Successfully!
                    </h3>
                    <p className="text-green-300/80 text-xs mt-1">
                      Your account has been verified. You can now log in to
                      access all features.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowVerificationSuccess(false)}
                    className="text-green-400/60 hover:text-green-400 transition-colors"
                  >
                    ×
                  </button>
                </div>
              </motion.div>
            )}

            {/* Welcome Message */}
            <WelcomePanel className="mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-white"
              >
                <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
                <p className="text-white/80 text-sm">
                  Enter your credentials to access your account
                </p>
              </motion.div>
            </WelcomePanel>

            {/* Login Form */}
            <AuthFormPanel>
              <motion.form
                onSubmit={handleSignIn}
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/90 font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      name="email"
                      placeholder="name@example.com"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      className="pl-10 bg-white/15 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-white/30"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      className="text-white/90 font-medium"
                    >
                      Password
                    </Label>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-white/70 hover:text-white transition-colors underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <PasswordInput
                    id="password"
                    name="password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    disabled={isLoading}
                    showStrength={false}
                    className="bg-white/15 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-white/30"
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <motion.div
                    className="flex items-center gap-x-2 rounded-lg bg-red-500/20 border border-red-500/30 p-3 text-sm text-red-200"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <p>{error}</p>
                  </motion.div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </motion.form>

              {/* Divider */}
              <motion.div
                className="my-6 flex items-center gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <div className="h-px flex-1 bg-white/20" />
                <span className="text-xs text-white/60">OR</span>
                <div className="h-px flex-1 bg-white/20" />
              </motion.div>

              {/* Google Sign In */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.55 }}
              >
                <GoogleSignInButton
                  next={
                    searchParams.get("next") ||
                    searchParams.get("returnUrl") ||
                    undefined
                  }
                />
              </motion.div>

              {/* Apple Sign In */}
              <motion.div
                className="mt-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <AppleSignInButton
                  next={
                    searchParams.get("next") ||
                    searchParams.get("returnUrl") ||
                    undefined
                  }
                />
              </motion.div>

              {/* Sign Up Link */}
              <motion.div
                className="mt-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <p className="text-white/70 text-sm">
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/signup"
                    className="text-white font-semibold hover:text-white/80 transition-colors underline"
                  >
                    Sign up
                  </Link>
                </p>
              </motion.div>
            </AuthFormPanel>

            {/* Resend Verification Form */}
            {showResendForm && (
              <AuthFormPanel>
                <motion.form
                  onSubmit={handleResendVerification}
                  className="space-y-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-medium">
                      Resend Verification Email
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowResendForm(false)}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      ×
                    </button>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="resendEmail"
                      className="text-white/90 font-medium"
                    >
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                      <Input
                        id="resendEmail"
                        type="email"
                        placeholder="name@example.com"
                        required
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        className="pl-10 bg-white/15 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-white/30"
                        disabled={isResending}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#ff184d] to-[#ff477e] hover:from-[#ff477e] hover:to-[#ff184d] text-white border-0 h-12 text-base font-medium"
                    disabled={isResending}
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Resend Verification Email
                      </>
                    )}
                  </Button>
                </motion.form>
              </AuthFormPanel>
            )}

            {/* Didn't receive email link */}
            {!showResendForm && (
              <motion.div
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.7 }}
              >
                <button
                  onClick={() => setShowResendForm(true)}
                  className="text-white/70 hover:text-white text-sm underline transition-colors"
                >
                  Didn&apos;t receive verification email?
                </button>
              </motion.div>
            )}

            {/* Newsletter Section */}
            <WelcomePanel className="mt-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="text-white text-center"
              >
                <h3 className="font-semibold mb-2">Become an Insider</h3>
                <p className="text-white/70 text-sm mb-4">
                  Join our newsletter to get exclusive deals, early access to
                  events, and the best of Karachi delivered to you.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Your best email address"
                    className="bg-white/15 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-white/30 text-sm"
                  />
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white px-4 whitespace-nowrap"
                  >
                    Sign Me Up
                  </Button>
                </div>
              </motion.div>
            </WelcomePanel>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthBackground>
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </AuthBackground>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
