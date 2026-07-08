"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  XCircle,
  AlertTriangle,
  Home,
  CreditCard,
  Shield,
  Mail,
  RefreshCw,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckoutFailedContentProps {
  status: "failed" | "security_failed";
  basketId: string;
  transactionId?: string;
  errCode?: string;
  errMsg?: string;
}

export function CheckoutFailedContent({
  status,
  basketId,
  transactionId,
  errCode,
  errMsg,
}: CheckoutFailedContentProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const isSecurityFailed = status === "security_failed";

  // Floating decorative elements
  const floatingElements = [
    { icon: AlertTriangle, delay: 0, position: "top-16 left-4 sm:left-20" },
    { icon: Shield, delay: 2, position: "top-24 right-4 sm:right-32" },
    { icon: XCircle, delay: 4, position: "bottom-32 left-8 sm:left-16" },
    { icon: Info, delay: 1, position: "bottom-24 right-8 sm:right-16" },
    { icon: CreditCard, delay: 3, position: "top-1/2 left-4 sm:left-12" },
    { icon: Mail, delay: 5, position: "top-1/3 right-4 sm:right-12" },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Background gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-background to-rose-500/5"
        aria-hidden
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(239,68,68,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(239,68,68,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"
        aria-hidden
      />

      {/* Decorative orbs */}
      <motion.div
        animate={{ y: [0, 50, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="hidden sm:block absolute -top-32 -right-32 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden
      />

      <motion.div
        animate={{ y: [0, -30, 0] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        className="hidden sm:block absolute -bottom-32 -left-32 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl pointer-events-none"
        aria-hidden
      />

      {/* Floating decorative elements */}
      {floatingElements.map((element, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: [0.2, 0.5, 0.2],
            y: [0, -10, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: element.delay,
          }}
          className={cn(
            "absolute hidden sm:block pointer-events-none",
            element.position,
          )}
        >
          <element.icon className="w-6 h-6 text-red-500/30" />
        </motion.div>
      ))}

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl w-full space-y-8"
        >
          {/* Error Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              delay: 0.2,
            }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-red-500/20 to-rose-500/20 border-2 border-red-500/20 shadow-xl shadow-red-500/10">
              {isSecurityFailed ? (
                <AlertTriangle className="w-12 h-12 text-red-500" />
              ) : (
                <XCircle className="w-12 h-12 text-red-500" />
              )}
            </div>
          </motion.div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center space-y-3"
          >
            <Badge
              variant="outline"
              className="border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/10"
            >
              {isSecurityFailed ? (
                <>
                  <Shield className="w-3 h-3 mr-1.5" />
                  Security Issue
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1.5" />
                  Payment Failed
                </>
              )}
            </Badge>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
              {isSecurityFailed
                ? "Security Validation Failed"
                : "Payment Unsuccessful"}
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-md mx-auto px-4">
              {isSecurityFailed
                ? "The payment callback could not be verified. This may indicate a security issue."
                : errMsg ||
                  "We couldn't process your payment. No charges have been made to your account."}
            </p>
          </motion.div>

          {/* Transaction Details Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="relative group"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-1000" />

            <div className="relative rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Transaction Details
                </h3>
                <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">
                  {isSecurityFailed ? "Security Error" : "Failed"}
                </Badge>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Booking Reference
                  </span>
                  <span className="font-mono font-medium text-right break-all">
                    {basketId || "N/A"}
                  </span>
                </div>

                {transactionId && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Transaction ID
                    </span>
                    <span className="font-mono font-medium text-right break-all">
                      {transactionId}
                    </span>
                  </div>
                )}

                {errCode && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Error Code
                    </span>
                    <span className="font-mono font-medium text-right break-all">
                      {errCode}
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Status
                    </span>
                    <span className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-red-500 rounded-full" />
                      {isSecurityFailed ? "Security Failed" : "Payment Failed"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Help Notice - Only for payment failures, not security issues */}
          {!isSecurityFailed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm p-4"
            >
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm flex-1">
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Common reasons for payment failure:
                  </p>
                  <ul className="list-disc list-inside text-amber-800 dark:text-amber-200 space-y-0.5">
                    <li>Insufficient funds in your account</li>
                    <li>Incorrect card details or PIN</li>
                    <li>Card expired or blocked by bank</li>
                    <li>Transaction declined by your bank</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* Support Message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-center px-4"
          >
            <p className="text-sm text-muted-foreground">
              {isSecurityFailed
                ? "Please contact our support team if you believe this is an error or if you were charged."
                : "You can try again with a different payment method or contact your bank for assistance."}
            </p>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-3 items-stretch justify-center w-full sm:w-auto"
          >
            {!isSecurityFailed && basketId && (
              <Button asChild size="lg" className="w-full sm:w-auto sm:px-8">
                <Link href={`/checkout?retry=${basketId}`} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Link>
              </Button>
            )}

            <Button
              asChild
              variant={isSecurityFailed ? "default" : "outline"}
              size="lg"
              className="w-full sm:w-auto sm:px-8"
            >
              <Link href="/contact" className="gap-2">
                <Mail className="w-4 h-4" />
                Contact Support
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto sm:px-8"
            >
              <Link href="/" className="gap-2">
                <Home className="w-4 h-4" />
                Back to Home
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
