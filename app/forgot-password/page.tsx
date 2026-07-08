"use client";

import Link from "next/link";
import { useState } from "react";
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
} from "lucide-react";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { AuthFormPanel, WelcomePanel } from "@/components/auth/GlassPanel";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "An unexpected error occurred.");
      toast({
        variant: "destructive",
        title: "Error",
        description: data.error || "An unexpected error occurred.",
      });
      setIsLoading(false);
    } else {
      setIsSuccess(true);
      toast({
        title: "Reset Email Sent",
        description: "Check your email for password reset instructions.",
      });
      setIsLoading(false);
    }
  };

  if (isSuccess) {
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

          {/* Success Content */}
          <div className="flex-1 flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md space-y-6">
              <WelcomePanel className="mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-white text-center"
                >
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-400" />
                  <h1 className="text-3xl font-bold mb-2">Check Your Email</h1>
                  <p className="text-white/80 text-sm">
                    We&apos;ve sent password reset instructions to {email}
                  </p>
                </motion.div>
              </WelcomePanel>

              <AuthFormPanel>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="text-center space-y-4"
                >
                  <p className="text-white/80 text-sm">
                    Didn&apos;t receive the email? Check your spam folder or{" "}
                    <button
                      onClick={() => setIsSuccess(false)}
                      className="text-white hover:text-white/80 underline"
                    >
                      try again
                    </button>
                  </p>

                  <Link
                    href="/login"
                    className="inline-flex items-center space-x-2 text-white/70 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Login</span>
                  </Link>
                </motion.div>
              </AuthFormPanel>
            </div>
          </div>
        </div>
      </AuthBackground>
    );
  }

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
            {/* Welcome Message */}
            <WelcomePanel className="mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-white"
              >
                <h1 className="text-3xl font-bold mb-2">Reset Password</h1>
                <p className="text-white/80 text-sm">
                  Enter your email address and we&apos;ll send you a link to
                  reset your password
                </p>
              </motion.div>
            </WelcomePanel>

            {/* Reset Form */}
            <AuthFormPanel>
              <motion.form
                onSubmit={handleSubmit}
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/90 font-medium">
                    Email Address
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

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center space-x-2 p-3 rounded-lg bg-red-500/20 border border-red-500/30"
                  >
                    <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </motion.div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium py-3 rounded-lg transition-all duration-300 hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Reset Email...
                    </>
                  ) : (
                    <>
                      Send Reset Email
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                {/* Back to Login */}
                <div className="text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center space-x-2 text-white/70 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Login</span>
                  </Link>
                </div>
              </motion.form>
            </AuthFormPanel>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}
