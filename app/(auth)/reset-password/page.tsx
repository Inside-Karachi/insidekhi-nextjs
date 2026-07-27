"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ThemeAwareLogo } from "@/components/layout/ThemeAwareLogo";
import {
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { AuthFormPanel, WelcomePanel } from "@/components/auth/GlassPanel";
import { useToast } from "@/hooks/use-toast";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const resetCode = searchParams.get("code") || searchParams.get("token");

    if (!resetCode) {
      setError(
        "Invalid or expired reset link. Please request a new password reset.",
      );
      setIsValidToken(false);
      return;
    }

    setCode(resetCode);
    setIsValidToken(true);
  }, [searchParams]);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/(?=.*\d)/.test(password)) {
      return "Password must contain at least one number";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      setIsLoading(false);
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update password. Please try again.");
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to update password.",
        });
      } else {
        setIsSuccess(true);
        toast({
          title: "Password Updated",
          description: "Your password has been successfully updated.",
        });

        // Redirect to login after a short delay
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err) {
      console.error("Password update error:", err);
      setError("An unexpected error occurred. Please try again.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred.",
      });
    }

    setIsLoading(false);
  };

  if (isValidToken === false) {
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

          {/* Error Content */}
          <div className="flex-1 flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md space-y-6">
              <WelcomePanel className="mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-white text-center"
                >
                  <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-400" />
                  <h1 className="text-3xl font-bold mb-2">
                    Invalid Reset Link
                  </h1>
                  <p className="text-white/80 text-sm">
                    This password reset link is invalid or has expired.
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
                  <Link
                    href="/forgot-password"
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium rounded-lg transition-all duration-300 hover:border-white/50"
                  >
                    Request New Reset Link
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <div>
                    <Link
                      href="/login"
                      className="inline-flex items-center space-x-2 text-white/70 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Back to Login</span>
                    </Link>
                  </div>
                </motion.div>
              </AuthFormPanel>
            </div>
          </div>
        </div>
      </AuthBackground>
    );
  }

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
                  <h1 className="text-3xl font-bold mb-2">Password Updated!</h1>
                  <p className="text-white/80 text-sm">
                    Your password has been successfully updated.
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
                    You will be redirected to the login page shortly...
                  </p>

                  <Link
                    href="/login"
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium rounded-lg transition-all duration-300 hover:border-white/50"
                  >
                    Go to Login
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              </AuthFormPanel>
            </div>
          </div>
        </div>
      </AuthBackground>
    );
  }

  if (isValidToken === null) {
    return (
      <AuthBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Validating reset link...</p>
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
                <h1 className="text-3xl font-bold mb-2">Set New Password</h1>
                <p className="text-white/80 text-sm">
                  Enter your new password below
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
                {/* New Password Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-white/90 font-medium"
                  >
                    New Password
                  </Label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Enter new password"
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      className="w-full pl-4 pr-10 py-3 bg-white/15 border border-white/30 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-white/30 rounded-lg"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/80"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-white/60 text-xs">
                    Password must be at least 8 characters with uppercase,
                    lowercase, and number
                  </p>
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-white/90 font-medium"
                  >
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Confirm new password"
                      required
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      className="w-full pl-4 pr-10 py-3 bg-white/15 border border-white/30 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-white/30 rounded-lg"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/80"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
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
                  disabled={
                    isLoading || !password.trim() || !confirmPassword.trim()
                  }
                  className="w-full bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium py-3 rounded-lg transition-all duration-300 hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      Update Password
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthBackground>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-white text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading...</p>
            </div>
          </div>
        </AuthBackground>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
