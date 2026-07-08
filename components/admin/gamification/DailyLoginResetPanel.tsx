"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RotateCcw, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function DailyLoginResetPanel() {
  const [userId, setUserId] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [resetResult, setResetResult] = React.useState<{
    success: boolean;
    message: string;
    can_claim_again?: boolean;
  } | null>(null);
  const { toast } = useToast();

  const handleResetOwnDailyLogin = async () => {
    try {
      setIsLoading(true);
      setResetResult(null);

      const response = await fetch(
        "/api/admin/gamification/reset-daily-login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const result = await response.json();

      if (response.ok) {
        setResetResult({
          success: true,
          message: `Daily login reset successfully. Can claim again today!`,
          can_claim_again: result.can_claim_again,
        });
        toast({
          title: "Daily Login Reset",
          description: "Your daily login claim has been reset.",
        });
      } else {
        setResetResult({
          success: false,
          message: result.error || "Failed to reset daily login",
        });
        toast({
          title: "Error",
          description: result.error || "Failed to reset daily login",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error resetting daily login:", error);
      setResetResult({
        success: false,
        message: "An error occurred while resetting daily login",
      });
      toast({
        title: "Error",
        description: "Failed to reset daily login. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetUserDailyLogin = async () => {
    if (!userId.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a user ID",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      setResetResult(null);

      const response = await fetch(
        "/api/admin/gamification/reset-daily-login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setResetResult({
          success: true,
          message: `Daily login reset for user ${userId}. They can now claim again today!`,
          can_claim_again: result.can_claim_again,
        });
        toast({
          title: "Daily Login Reset",
          description: `User ${userId} can now claim daily login again.`,
        });
        setUserId("");
      } else {
        setResetResult({
          success: false,
          message: result.error || "Failed to reset daily login",
        });
        toast({
          title: "Error",
          description: result.error || "Failed to reset daily login",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error resetting daily login:", error);
      setResetResult({
        success: false,
        message: "An error occurred while resetting daily login",
      });
      toast({
        title: "Error",
        description: "Failed to reset daily login. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-yellow-200/30 bg-yellow-50/30 dark:border-yellow-800/30 dark:bg-yellow-900/10">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg mt-1">
              <RotateCcw className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Reset Daily Login Claim</CardTitle>
              <CardDescription className="text-sm mt-1">
                Reset a user&apos;s daily login claim to allow re-claiming on
                the same day. Useful for testing the daily check-in feature.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Reset Own Daily Login */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">
              Reset Your Own Daily Login
            </h4>
            <Button
              onClick={handleResetOwnDailyLogin}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {isLoading ? "Resetting..." : "Reset My Daily Login"}
            </Button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Reset Another User's Daily Login */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">
              Reset Another User&apos;s Daily Login
            </h4>
            <div className="space-y-2">
              <Label htmlFor="user-id" className="text-sm">
                User ID (UUID)
              </Label>
              <Input
                id="user-id"
                placeholder="e.g., 550e8400-e29b-41d4-a716-446655440000"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={isLoading}
                className="font-mono text-xs"
              />
            </div>
            <Button
              onClick={handleResetUserDailyLogin}
              disabled={isLoading || !userId.trim()}
              className="w-full"
              variant="outline"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {isLoading ? "Resetting..." : "Reset User's Daily Login"}
            </Button>
          </div>

          {/* Result Message */}
          {resetResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-lg flex gap-2 items-start ${
                resetResult.success
                  ? "bg-green-50/50 dark:bg-green-900/10 border border-green-200/30 dark:border-green-800/30"
                  : "bg-red-50/50 dark:bg-red-900/10 border border-red-200/30 dark:border-red-800/30"
              }`}
            >
              {resetResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm flex-1">
                <p
                  className={
                    resetResult.success
                      ? "text-green-800 dark:text-green-200"
                      : "text-red-800 dark:text-red-200"
                  }
                >
                  {resetResult.message}
                </p>
              </div>
            </motion.div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/30 dark:border-blue-800/30 p-3 rounded-lg text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <p className="font-semibold">What happens when you reset?</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Sets last_claimed_date to yesterday</li>
              <li>User can claim daily login again today</li>
              <li>Streak count remains unchanged</li>
              <li>Profile XP remains unchanged</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
