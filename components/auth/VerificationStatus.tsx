"use client";

import { motion } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type VerificationStatusType =
  | "success"
  | "error"
  | "loading"
  | "warning";

interface VerificationStatusProps {
  status: VerificationStatusType;
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function VerificationStatus({
  status,
  title,
  message,
  onRetry,
  retryLabel = "Try Again",
  className = "",
}: VerificationStatusProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "success":
        return {
          icon: CheckCircle,
          iconColor: "text-green-500",
          bgColor: "bg-green-50 dark:bg-green-950/20",
          borderColor: "border-green-200 dark:border-green-800",
        };
      case "error":
        return {
          icon: XCircle,
          iconColor: "text-red-500",
          bgColor: "bg-red-50 dark:bg-red-950/20",
          borderColor: "border-red-200 dark:border-red-800",
        };
      case "warning":
        return {
          icon: AlertCircle,
          iconColor: "text-yellow-500",
          bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
          borderColor: "border-yellow-200 dark:border-yellow-800",
        };
      case "loading":
        return {
          icon: Loader2,
          iconColor: "text-primary",
          bgColor: "bg-primary/5",
          borderColor: "border-primary/20",
        };
      default:
        return {
          icon: AlertCircle,
          iconColor: "text-gray-500",
          bgColor: "bg-gray-50 dark:bg-gray-950/20",
          borderColor: "border-gray-200 dark:border-gray-800",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-lg border ${config.bgColor} ${config.borderColor} ${className}`}
    >
      <div className="flex items-start space-x-3">
        <Icon
          className={`h-5 w-5 mt-0.5 ${config.iconColor} ${
            status === "loading" ? "animate-spin" : ""
          }`}
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {message}
          </p>
          {onRetry && status === "error" && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-3"
            >
              {retryLabel}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
