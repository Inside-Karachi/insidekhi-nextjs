"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface UseVerificationOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useVerification(options: UseVerificationOptions = {}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [lastResendTime, setLastResendTime] = useState<number | null>(null);

  const resendVerification = async (email: string) => {
    if (!email?.trim()) {
      const error = "Email address is required";
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: error,
      });
      options.onError?.(error);
      return;
    }

    // Check if we recently sent an email (prevent spam)
    if (lastResendTime && Date.now() - lastResendTime < 30000) {
      const error = "Please wait 30 seconds before requesting another email";
      toast({
        variant: "destructive",
        title: "Too Soon",
        description: error,
      });
      options.onError?.(error);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send verification email");
      }

      setLastResendTime(Date.now());

      toast({
        title: "Verification Email Sent",
        description: "Please check your email for the verification link.",
      });

      options.onSuccess?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";

      toast({
        variant: "destructive",
        title: "Failed to Send Email",
        description: errorMessage,
      });

      options.onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const canResend = () => {
    if (!lastResendTime) return true;
    return Date.now() - lastResendTime >= 30000; // 30 seconds cooldown
  };

  const getTimeUntilNextResend = () => {
    if (!lastResendTime) return 0;
    const timeSinceLastResend = Date.now() - lastResendTime;
    const cooldownMs = 30000;
    return Math.max(0, cooldownMs - timeSinceLastResend);
  };

  return {
    resendVerification,
    isLoading,
    canResend: canResend(),
    timeUntilNextResend: getTimeUntilNextResend(),
  };
}
