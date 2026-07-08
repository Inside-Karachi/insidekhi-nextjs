"use client";

import * as React from "react";
import { useAdminDashboard } from "../../hooks/useAdminDashboard";
import { SuperAdminDashboard } from "./SuperAdminDashboard";
import { SuperAdminDashboardProps } from "../../types/dashboard.types";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuperAdminDashboardWrapperProps {
  user: SuperAdminDashboardProps["user"];
  profile: SuperAdminDashboardProps["profile"];
}

export function SuperAdminDashboardWrapper({
  user,
  profile,
}: SuperAdminDashboardWrapperProps) {
  const { data, isLoading, error, refetch } = useAdminDashboard();

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="text-center space-y-4">
          <div className="h-4 bg-muted rounded w-64 mx-auto animate-pulse" />
          <div className="h-12 bg-muted rounded w-96 mx-auto animate-pulse" />
          <div className="h-4 bg-muted rounded w-48 mx-auto animate-pulse" />
        </div>

        {/* Stats grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-8 w-8 bg-muted rounded-lg animate-pulse" />
                <div className="h-4 w-12 bg-muted rounded animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-6 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Activity sections skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-muted rounded-lg animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                  <div className="h-3 bg-muted rounded w-24 animate-pulse" />
                </div>
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-start space-x-4">
                    <div className="h-12 w-12 bg-muted rounded-xl animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                      <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-full border border-purple-200/20 mb-4">
            <AlertCircle className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Super Admin Access
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight">
            System Control{" "}
            <span className="gradient-text-primary">Center</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Welcome back, {profile?.full_name || user.email}! Full platform oversight and control.
          </p>
        </div>

        <div className="max-w-2xl mx-auto p-6 rounded-xl border border-red-200/20 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800/20">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                Failed to Load Dashboard Data
              </h3>
              <p className="text-red-700 dark:text-red-300 text-sm mb-4">
                {error}
              </p>
              <Button onClick={refetch} variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-50">
                <Loader2 className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state - render the actual dashboard
  if (data) {
    return (
      <SuperAdminDashboard
        user={user}
        profile={profile}
        dashboardData={{
          statistics: data.statistics,
          recentActivity: data.recentActivity,
        }}
      />
    );
  }

  // Fallback
  return null;
}
