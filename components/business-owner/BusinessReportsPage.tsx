"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { User } from "@supabase/supabase-js";
import {
  FileText,
  Download,
  Calendar,
  FileSpreadsheet,
  FileType,
  Loader2,
  TrendingUp,
  Eye,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useBusinessListings } from "@/hooks/useBusinessListings";
import { BusinessOwnerPageHeader } from "./BusinessOwnerPageHeader";

interface BusinessReportsPageProps {
  user: User;
  profile: {
    full_name?: string | null;
    role?: string;
  } | null;
}

type ReportType = "analytics" | "reviews" | "performance";
type ReportFormat = "csv" | "pdf" | "excel";
type DateRange = "7d" | "30d" | "90d" | "custom";

export function BusinessReportsPage({
  user: _user,
  profile: _profile,
}: BusinessReportsPageProps) {
  const { toast } = useToast();
  const { listings, loading: listingsLoading } = useBusinessListings();
  const [reportType, setReportType] = React.useState<ReportType>("analytics");
  const [selectedListing, setSelectedListing] = React.useState<string>("all");
  const [dateRange, setDateRange] = React.useState<DateRange>("30d");
  const [format, setFormat] = React.useState<ReportFormat>("pdf");
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleGenerateReport = async () => {
    try {
      setIsGenerating(true);

      const response = await fetch("/api/business/reports/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportType,
          format,
          listingId: selectedListing,
          dateRange,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate report");
      }

      // Get filename from headers
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `report-${format}.${format === "excel" ? "xlsx" : format}`;

      if (contentDisposition) {
        const matches = /filename="([^"]+)"/.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Report Generated",
        description: `Your ${reportType} report has been downloaded successfully.`,
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const reportTypes = [
    {
      value: "analytics",
      label: "Analytics Summary",
      description: "Views, engagement, and visitor metrics",
      icon: TrendingUp,
    },
    {
      value: "reviews",
      label: "Reviews Report",
      description: "Customer reviews and ratings breakdown",
      icon: Star,
    },
    {
      value: "performance",
      label: "Performance Insights",
      description: "Detailed performance analysis over time",
      icon: Eye,
    },
  ];

  const formatOptions = [
    { value: "csv", label: "CSV", icon: FileType },
    { value: "pdf", label: "PDF", icon: FileText },
    { value: "excel", label: "Excel", icon: FileSpreadsheet },
  ];

  const dateRangeOptions = [
    { value: "7d", label: "Last 7 Days" },
    { value: "30d", label: "Last 30 Days" },
    { value: "90d", label: "Last 90 Days" },
    { value: "custom", label: "Custom Range" },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <BusinessOwnerPageHeader
        icon={FileText}
        title="Export reports"
        description="Generate and download detailed business reports (coming soon)"
      />

      {/* Report Type Selection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="space-y-6 mb-8"
      >
        <div>
          <Label className="text-base font-semibold mb-4 block">
            Report Type
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reportTypes.map((type) => (
              <Card
                key={type.value}
                className={`p-4 cursor-pointer transition-all duration-200 ${
                  reportType === type.value
                    ? "ring-2 ring-primary bg-primary/5"
                    : "hover:bg-accent"
                }`}
                onClick={() => setReportType(type.value as ReportType)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      reportType === type.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent"
                    }`}
                  >
                    <type.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">{type.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {type.description}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Listing Selection */}
        <div>
          <Label htmlFor="listing-select" className="text-base font-semibold">
            Select Listing
          </Label>
          <Select value={selectedListing} onValueChange={setSelectedListing}>
            <SelectTrigger id="listing-select" className="mt-2">
              <SelectValue placeholder="Choose a listing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Listings</SelectItem>
              {listingsLoading ? (
                <SelectItem value="loading" disabled>
                  Loading listings...
                </SelectItem>
              ) : (
                listings.map((listing) => (
                  <SelectItem key={listing.id} value={listing.id.toString()}>
                    {listing.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range */}
        <div>
          <Label htmlFor="date-range" className="text-base font-semibold">
            Date Range
          </Label>
          <Select
            value={dateRange}
            onValueChange={(v) => setDateRange(v as DateRange)}
          >
            <SelectTrigger id="date-range" className="mt-2">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              {dateRangeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Export Format */}
        <div>
          <Label className="text-base font-semibold mb-4 block">
            Export Format
          </Label>
          <div className="grid grid-cols-3 gap-4">
            {formatOptions.map((formatOption) => (
              <Card
                key={formatOption.value}
                className={`p-4 cursor-pointer transition-all duration-200 ${
                  format === formatOption.value
                    ? "ring-2 ring-primary bg-primary/5"
                    : "hover:bg-accent"
                }`}
                onClick={() => setFormat(formatOption.value as ReportFormat)}
              >
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`p-3 rounded-lg ${
                      format === formatOption.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent"
                    }`}
                  >
                    <formatOption.icon className="h-6 w-6" />
                  </div>
                  <span className="font-semibold text-sm">
                    {formatOption.label}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Generate Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Button
          size="lg"
          className="w-full gap-2"
          onClick={handleGenerateReport}
          disabled={isGenerating || listingsLoading}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Report...
            </>
          ) : (
            <>
              <Download className="h-5 w-5" />
              Generate & Download Report
            </>
          )}
        </Button>
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-8"
      >
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-primary/5 dark:from-blue-900/10 dark:to-primary/5 border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold mb-2">About Reports</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>
              • Reports are generated in real-time based on your selected
              criteria
            </li>
            <li>• PDF reports include charts and visualizations</li>
            <li>• CSV/Excel formats are ideal for further data analysis</li>
            <li>• All reports respect your data privacy and security</li>
          </ul>
        </Card>
      </motion.div>
    </div>
  );
}
