"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ThemeAwareLogo } from "@/components/layout/ThemeAwareLogo";
import { CheckCircle, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { AuthFormPanel } from "@/components/auth/GlassPanel";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(5);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isSuccess = searchParams.get("success") === "true";
  const error = searchParams.get("error");

  useEffect(() => {
    if (isSuccess && !error) {
      // Start countdown for auto-redirect
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setIsRedirecting(true);
            clearInterval(timer);
            // Redirect to login with verification success message
            router.push("/login?verified=true");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isSuccess, error, router]);

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
            <AuthFormPanel className="text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="space-y-6"
              >
                {isSuccess && !error ? (
                  <>
                    {/* Success State */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        duration: 0.5,
                        delay: 0.5,
                        type: "spring",
                        bounce: 0.4,
                      }}
                      className="mx-auto w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6"
                    >
                      <CheckCircle className="w-10 h-10 text-green-400" />
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.7 }}
                      className="space-y-4"
                    >
                      <h1 className="text-3xl font-bold text-white">
                        🎉 Email Verified!
                      </h1>
                      <p className="text-white/80 text-sm leading-relaxed">
                        Your account has been successfully verified. You can now
                        log in to access all features of Inside Karachi.
                      </p>

                      {countdown > 0 && !isRedirecting && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.4, delay: 0.9 }}
                          className="text-white/60 text-sm"
                        >
                          Redirecting to login in {countdown} second
                          {countdown !== 1 ? "s" : ""}...
                        </motion.div>
                      )}

                      {isRedirecting && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center justify-center space-x-2 text-white/80"
                        >
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Redirecting...</span>
                        </motion.div>
                      )}
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 1.1 }}
                      className="space-y-4"
                    >
                      <Button
                        asChild
                        className="w-full bg-gradient-to-r from-[#ff184d] to-[#ff477e] hover:from-[#ff477e] hover:to-[#ff184d] text-white border-0 h-12 text-base font-medium"
                      >
                        <Link href="/login?verified=true">
                          Continue to Login
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>

                      <Button
                        asChild
                        variant="outline"
                        className="w-full border-white/20 text-white/80 hover:bg-white/10 hover:text-white h-12 text-base"
                      >
                        <Link href="/">Back to Home</Link>
                      </Button>
                    </motion.div>
                  </>
                ) : (
                  <>
                    {/* Error State */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        duration: 0.5,
                        delay: 0.5,
                        type: "spring",
                        bounce: 0.4,
                      }}
                      className="mx-auto w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6"
                    >
                      <div className="w-10 h-10 bg-red-500/30 rounded-full flex items-center justify-center">
                        <span className="text-red-400 text-xl">!</span>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.7 }}
                      className="space-y-4"
                    >
                      <h1 className="text-3xl font-bold text-white">
                        Verification Failed
                      </h1>
                      <p className="text-white/80 text-sm leading-relaxed">
                        {error ||
                          "We couldn't verify your email. The link may be expired or invalid."}
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.9 }}
                      className="space-y-4"
                    >
                      <Button
                        asChild
                        className="w-full bg-gradient-to-r from-[#ff184d] to-[#ff477e] hover:from-[#ff477e] hover:to-[#ff184d] text-white border-0 h-12 text-base font-medium"
                      >
                        <Link href="/login">
                          Go to Login
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>

                      <Button
                        asChild
                        variant="outline"
                        className="w-full border-white/20 text-white/80 hover:bg-white/10 hover:text-white h-12 text-base"
                      >
                        <Link href="/signup">Create New Account</Link>
                      </Button>
                    </motion.div>
                  </>
                )}
              </motion.div>
            </AuthFormPanel>

            {/* Additional Info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.3 }}
              className="text-center"
            >
              <p className="text-white/60 text-xs">
                Need help? Contact our support team
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}

export default function VerifyEmailPage() {
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
      <VerifyEmailContent />
    </Suspense>
  );
}
