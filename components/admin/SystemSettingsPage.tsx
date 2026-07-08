"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Power,
  PowerOff,
  Clock,
  RefreshCw,
  AlertTriangle,
  Save,
  Info,
  Ticket,
  FolderTree,
  Building2,
  MessageCircle,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { CategoriesManagementPage } from "./CategoriesManagementPage";

interface SystemConfig {
  id: number;
  config_key: string;
  config_value: unknown;
  config_type: string;
  description: string | null;
  is_public: boolean | null;
  updated_at: string | null;
}

export function SystemSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Maintenance mode specific states
  const getDefaultEstimatedEnd = () => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const formatForDateTimeLocal = (rawValue: unknown): string | null => {
    if (rawValue === null || rawValue === undefined) {
      return null;
    }

    const stringValue = String(rawValue).replace(/^"|"$/g, "").trim();
    if (!stringValue || stringValue === "null") {
      return null;
    }

    // Keep already-compatible datetime-local value unchanged.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(stringValue)) {
      return stringValue;
    }

    const parsedDate = new Date(stringValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    const pad = (n: number) => String(n).padStart(2, "0");
    return `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}T${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}`;
  };

  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceEstimatedEnd, setMaintenanceEstimatedEnd] = useState(
    getDefaultEstimatedEnd,
  );

  // Ticketing & Fees states
  const [platformFeeFixed, setPlatformFeeFixed] = useState(0);
  const [platformFeePercentage, setPlatformFeePercentage] = useState(0);
  const [paymentFeeFixed, setPaymentFeeFixed] = useState(0);
  const [paymentFeePercentage, setPaymentFeePercentage] = useState(0);
  const [guestDetailsRequirement, setGuestDetailsRequirement] =
    useState("per_event");

  // Role Visibility states
  const DEFAULT_ADMIN_VISIBLE_ROLES = ["writer", "lister", "organizer"];
  const TOGGLEABLE_ROLES = [
    {
      value: "business_owner",
      label: "Business Owner",
      description: "Users who manage business listings on the platform",
    },
    {
      value: "writer",
      label: "Writer",
      description: "Content writers and article editors",
    },
    {
      value: "lister",
      label: "Lister",
      description: "Users with listing management permissions",
    },
    {
      value: "organizer",
      label: "Event Organizer",
      description: "Users who can create and manage events",
    },
    {
      value: "admin",
      label: "Admin",
      description: "Administrators with full management access",
    },
  ];
  const [adminVisibleRoles, setAdminVisibleRoles] = useState<string[]>(
    DEFAULT_ADMIN_VISIBLE_ROLES,
  );

  // Business Portal states
  const [slaHoursPriority, setSlaHoursPriority] = useState(12);
  const [slaHoursNormal, setSlaHoursNormal] = useState(24);
  const [slaHoursLow, setSlaHoursLow] = useState(48);
  const [maxReplyEdits, setMaxReplyEdits] = useState(3);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/settings");
      const data = await res.json();

      if (data.settings) {
        // Extract maintenance mode settings
        const enabledSetting = data.settings.find(
          (s: SystemConfig) => s.config_key === "maintenance.enabled",
        );
        const messageSetting = data.settings.find(
          (s: SystemConfig) => s.config_key === "maintenance.message",
        );
        const estimatedEndSetting = data.settings.find(
          (s: SystemConfig) => s.config_key === "maintenance.estimated_end",
        );
        setMaintenanceEnabled(enabledSetting?.config_value === true);
        setMaintenanceMessage(
          typeof messageSetting?.config_value === "string"
            ? messageSetting.config_value.replace(/^"|"$/g, "")
            : "We are performing scheduled maintenance. We'll be back shortly!",
        );
        const formattedEstimatedEnd = formatForDateTimeLocal(
          estimatedEndSetting?.config_value,
        );
        setMaintenanceEstimatedEnd(
          formattedEstimatedEnd ?? getDefaultEstimatedEnd(),
        );

        // Extract Ticketing & Fees settings
        const pFeeFixed = data.settings.find(
          (s: SystemConfig) => s.config_key === "fees.platform_fee_fixed",
        );
        const pFeePercent = data.settings.find(
          (s: SystemConfig) => s.config_key === "fees.platform_fee_percentage",
        );
        const payFeeFixed = data.settings.find(
          (s: SystemConfig) =>
            s.config_key === "fees.payment_processing_fee_fixed",
        );
        const payFeePercent = data.settings.find(
          (s: SystemConfig) =>
            s.config_key === "fees.payment_processing_fee_percentage",
        );
        const guestReq = data.settings.find(
          (s: SystemConfig) =>
            s.config_key === "ticketing.require_guest_details",
        );

        setPlatformFeeFixed(Number(pFeeFixed?.config_value) || 0);
        setPlatformFeePercentage(Number(pFeePercent?.config_value) || 0);
        setPaymentFeeFixed(Number(payFeeFixed?.config_value) || 0);
        setPaymentFeePercentage(Number(payFeePercent?.config_value) || 0);
        setGuestDetailsRequirement(
          typeof guestReq?.config_value === "string"
            ? guestReq.config_value.replace(/^"|"$/g, "")
            : "per_event",
        );

        // Extract Business Portal settings
        const slaPriority = data.settings.find(
          (s: SystemConfig) =>
            s.config_key === "business_portal_sla_hours_priority",
        );
        const slaNormal = data.settings.find(
          (s: SystemConfig) =>
            s.config_key === "business_portal_sla_hours_normal",
        );
        const slaLow = data.settings.find(
          (s: SystemConfig) => s.config_key === "business_portal_sla_hours_low",
        );
        const maxEdits = data.settings.find(
          (s: SystemConfig) =>
            s.config_key === "business_portal_max_reply_edits",
        );

        setSlaHoursPriority(Number(slaPriority?.config_value) || 12);
        setSlaHoursNormal(Number(slaNormal?.config_value) || 24);
        setSlaHoursLow(Number(slaLow?.config_value) || 48);
        setMaxReplyEdits(Number(maxEdits?.config_value) || 3);

        // Extract role visibility settings
        const visibleRolesSetting = data.settings.find(
          (s: SystemConfig) => s.config_key === "admin.visible_roles",
        );
        if (
          visibleRolesSetting &&
          Array.isArray(visibleRolesSetting.config_value)
        ) {
          setAdminVisibleRoles(visibleRolesSetting.config_value as string[]);
        }
      }
    } catch (error) {
      console.error("[SETTINGS] Error:", error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (
    config_key: string,
    config_value: unknown,
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config_key, config_value }),
      });

      if (!res.ok) {
        throw new Error("Failed to update setting");
      }

      return true;
    } catch (error) {
      console.error("Settings update error:", error);
      return false;
    }
  };

  const handleMaintenanceToggle = async (enabled: boolean) => {
    setIsSaving(true);

    let didAutoResetEstimatedEnd = false;

    if (enabled) {
      const parsedCurrentEstimatedEnd = maintenanceEstimatedEnd
        ? new Date(maintenanceEstimatedEnd)
        : null;
      const hasValidEstimatedEnd =
        parsedCurrentEstimatedEnd !== null &&
        !Number.isNaN(parsedCurrentEstimatedEnd.getTime());
      const isStaleEstimatedEnd =
        hasValidEstimatedEnd &&
        parsedCurrentEstimatedEnd.getTime() <= Date.now();

      if (!hasValidEstimatedEnd || isStaleEstimatedEnd) {
        const refreshedEstimatedEnd = getDefaultEstimatedEnd();
        const estimatedEndUpdated = await updateSetting(
          "maintenance.estimated_end",
          JSON.stringify(refreshedEstimatedEnd),
        );

        if (estimatedEndUpdated) {
          setMaintenanceEstimatedEnd(refreshedEstimatedEnd);
          didAutoResetEstimatedEnd = true;
        }
      }
    }

    const success = await updateSetting("maintenance.enabled", enabled);

    if (success) {
      setMaintenanceEnabled(enabled);
      toast({
        title: enabled
          ? "Maintenance Mode Enabled"
          : "Maintenance Mode Disabled",
        description: enabled
          ? "Site is now in maintenance mode. Only super admins can access."
          : "Site is now accessible to all users.",
      });
      if (didAutoResetEstimatedEnd) {
        toast({
          title: "Estimated End Updated",
          description:
            "Estimated end time was stale and has been reset to 2 hours from now.",
        });
      }
      await fetchSettings(); // Refresh to get updated timestamp
    } else {
      toast({
        title: "Error",
        description: "Failed to toggle maintenance mode",
        variant: "destructive",
      });
    }

    setIsSaving(false);
  };

  const handleSaveMaintenanceConfig = async () => {
    // Validation
    if (!maintenanceMessage.trim()) {
      toast({
        title: "Validation Error",
        description: "Maintenance message cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    const messageSuccess = await updateSetting(
      "maintenance.message",
      JSON.stringify(maintenanceMessage),
    );
    const estimatedEndSuccess = await updateSetting(
      "maintenance.estimated_end",
      maintenanceEstimatedEnd && maintenanceEstimatedEnd.trim() !== ""
        ? JSON.stringify(maintenanceEstimatedEnd)
        : JSON.stringify(null),
    );

    if (messageSuccess && estimatedEndSuccess) {
      toast({
        title: "Settings Saved",
        description: "Maintenance configuration updated successfully",
      });
      await fetchSettings();
    } else {
      toast({
        title: "Error",
        description: "Failed to save maintenance configuration",
        variant: "destructive",
      });
    }

    setIsSaving(false);
  };

  const handleSaveFeesConfig = async () => {
    setIsSaving(true);

    try {
      const results = await Promise.all([
        updateSetting("fees.platform_fee_fixed", platformFeeFixed),
        updateSetting("fees.platform_fee_percentage", platformFeePercentage),
        updateSetting("fees.payment_processing_fee_fixed", paymentFeeFixed),
        updateSetting(
          "fees.payment_processing_fee_percentage",
          paymentFeePercentage,
        ),
        updateSetting(
          "ticketing.require_guest_details",
          JSON.stringify(guestDetailsRequirement),
        ),
      ]);
      if (results.some((ok) => !ok)) {
        throw new Error("partial failure");
      }

      toast({
        title: "Settings Saved",
        description: "Ticketing & Fees configuration updated successfully",
      });
      await fetchSettings();
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to save fees configuration",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRole = (role: string, enabled: boolean) => {
    setAdminVisibleRoles((prev) =>
      enabled ? [...prev, role] : prev.filter((r) => r !== role),
    );
  };

  const handleSaveRolePermissions = async () => {
    setIsSaving(true);
    const success = await updateSetting(
      "admin.visible_roles",
      adminVisibleRoles,
    );
    if (success) {
      toast({
        title: "Role Permissions Saved",
        description:
          "Admin role visibility settings updated. Changes take effect on next page load.",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to save role permissions",
        variant: "destructive",
      });
    }
    setIsSaving(false);
  };

  const handleSaveBusinessPortalConfig = async () => {
    setIsSaving(true);

    try {
      const results = await Promise.all([
        updateSetting("business_portal_sla_hours_priority", slaHoursPriority),
        updateSetting("business_portal_sla_hours_normal", slaHoursNormal),
        updateSetting("business_portal_sla_hours_low", slaHoursLow),
        updateSetting("business_portal_max_reply_edits", maxReplyEdits),
      ]);
      if (results.some((ok) => !ok)) {
        throw new Error("partial failure");
      }

      toast({
        title: "Settings Saved",
        description: "Business Portal configuration updated successfully",
      });
      await fetchSettings();
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to save Business Portal configuration",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="maintenance" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-[900px]">
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="ticketing">Ticketing & Fees</TabsTrigger>
          <TabsTrigger value="business-portal">
            <Building2 className="h-4 w-4 mr-1.5" />
            Portal
          </TabsTrigger>
          <TabsTrigger value="categories">
            <FolderTree className="h-4 w-4 mr-1.5" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="role-permissions">
            <Shield className="h-4 w-4 mr-1.5" />
            Roles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="maintenance" className="mt-6">
          {/* Maintenance Mode Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl ${
                        maintenanceEnabled
                          ? "bg-orange-500/10"
                          : "bg-green-500/10"
                      }`}
                    >
                      {maintenanceEnabled ? (
                        <PowerOff className="h-6 w-6 text-orange-500" />
                      ) : (
                        <Power className="h-6 w-6 text-green-500" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-2xl">
                        Maintenance Mode
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Control site accessibility during updates and
                        maintenance
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={maintenanceEnabled ? "destructive" : "default"}
                    className="text-sm px-4 py-1"
                  >
                    {maintenanceEnabled ? "ACTIVE" : "INACTIVE"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Toggle Switch */}
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="maintenance-toggle"
                        className="text-lg font-semibold cursor-pointer"
                      >
                        Enable Maintenance Mode
                      </Label>
                      {maintenanceEnabled && (
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {maintenanceEnabled
                        ? "Site is currently in maintenance mode. Only super admins can access."
                        : "Site is accessible to all users."}
                    </p>
                  </div>
                  <Switch
                    id="maintenance-toggle"
                    checked={maintenanceEnabled}
                    onCheckedChange={handleMaintenanceToggle}
                    disabled={isSaving}
                    className="data-[state=checked]:bg-orange-500"
                  />
                </div>

                {/* Warning Banner */}
                {maintenanceEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg"
                  >
                    <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-orange-600 dark:text-orange-400">
                        Maintenance Mode Active
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Regular users will see the maintenance page. Super
                        admins can still access the site normally.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Configuration Fields */}
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="maintenance-message">
                      Maintenance Message *
                    </Label>
                    <Input
                      id="maintenance-message"
                      value={maintenanceMessage}
                      onChange={(e) => setMaintenanceMessage(e.target.value)}
                      placeholder="We are performing scheduled maintenance..."
                      className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Info className="h-3 w-3" />
                      This message will be shown to users on the maintenance
                      page
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estimated-end">
                      Estimated End Time (Optional)
                    </Label>
                    <Input
                      id="estimated-end"
                      type="datetime-local"
                      value={maintenanceEstimatedEnd}
                      onChange={(e) =>
                        setMaintenanceEstimatedEnd(e.target.value)
                      }
                      className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      When maintenance is expected to be completed
                    </p>
                  </div>

                  <Button
                    onClick={handleSaveMaintenanceConfig}
                    disabled={isSaving || !maintenanceMessage.trim()}
                    className="w-full gap-2"
                  >
                    {isSaving ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="ticketing" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Ticket className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Ticketing & Fees</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage platform fees, payment processing charges, and
                      ticket requirements
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-8">
                {/* Platform Fees */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Platform Fees
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="platform-fee-fixed">
                        Fixed Fee (PKR)
                      </Label>
                      <Input
                        id="platform-fee-fixed"
                        type="number"
                        min="0"
                        step="1"
                        value={platformFeeFixed}
                        onChange={(e) =>
                          setPlatformFeeFixed(Number(e.target.value))
                        }
                        className="bg-background"
                      />
                      <p className="text-xs text-muted-foreground">
                        Fixed amount charged per order
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="platform-fee-percent">
                        Percentage Fee (%)
                      </Label>
                      <Input
                        id="platform-fee-percent"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={platformFeePercentage}
                        onChange={(e) =>
                          setPlatformFeePercentage(Number(e.target.value))
                        }
                        className="bg-background"
                      />
                      <p className="text-xs text-muted-foreground">
                        Percentage of total order value
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payment Processing Fees */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Payment Gateway Fees (GoPayFast)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="payment-fee-fixed">Fixed Fee (PKR)</Label>
                      <Input
                        id="payment-fee-fixed"
                        type="number"
                        min="0"
                        step="1"
                        value={paymentFeeFixed}
                        onChange={(e) =>
                          setPaymentFeeFixed(Number(e.target.value))
                        }
                        className="bg-background"
                      />
                      <p className="text-xs text-muted-foreground">
                        Fixed transaction fee
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment-fee-percent">
                        Percentage Fee (%)
                      </Label>
                      <Input
                        id="payment-fee-percent"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={paymentFeePercentage}
                        onChange={(e) =>
                          setPaymentFeePercentage(Number(e.target.value))
                        }
                        className="bg-background"
                      />
                      <p className="text-xs text-muted-foreground">
                        Transaction percentage fee
                      </p>
                    </div>
                  </div>
                </div>

                {/* Ticket Requirements */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Ticket Requirements
                  </h3>
                  <div className="space-y-2">
                    <Label>Guest Details Requirement</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div
                        className={`cursor-pointer rounded-lg border p-4 transition-all hover:border-primary ${
                          guestDetailsRequirement === "always"
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border"
                        }`}
                        onClick={() => setGuestDetailsRequirement("always")}
                      >
                        <div className="font-semibold">Always Required</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Name & CNIC required for every ticket
                        </div>
                      </div>
                      <div
                        className={`cursor-pointer rounded-lg border p-4 transition-all hover:border-primary ${
                          guestDetailsRequirement === "per_event"
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border"
                        }`}
                        onClick={() => setGuestDetailsRequirement("per_event")}
                      >
                        <div className="font-semibold">Per Event</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Configured by organizer per event
                        </div>
                      </div>
                      <div
                        className={`cursor-pointer rounded-lg border p-4 transition-all hover:border-primary ${
                          guestDetailsRequirement === "never"
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border"
                        }`}
                        onClick={() => setGuestDetailsRequirement("never")}
                      >
                        <div className="font-semibold">Never Required</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Only buyer details collected
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleSaveFeesConfig}
                  disabled={isSaving}
                  className="w-full gap-2"
                >
                  {isSaving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Ticketing Configuration
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="business-portal" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">
                      Business Portal Settings
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Configure SLA timelines and review management policies
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* SLA Configuration Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">
                      SLA Response Times
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Set maximum response times for business owner change
                    requests based on priority level
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Priority SLA */}
                    <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <Label className="font-semibold">
                          Priority Requests
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Venue closure, contact info, safety issues
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="sla-priority" className="text-sm">
                          Response Time (hours)
                        </Label>
                        <Input
                          id="sla-priority"
                          type="number"
                          min="1"
                          max="168"
                          value={slaHoursPriority}
                          onChange={(e) =>
                            setSlaHoursPriority(Number(e.target.value))
                          }
                          disabled={isSaving}
                        />
                      </div>
                    </div>

                    {/* Normal SLA */}
                    <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-500" />
                        <Label className="font-semibold">Normal Requests</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Menu updates, descriptions, photos
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="sla-normal" className="text-sm">
                          Response Time (hours)
                        </Label>
                        <Input
                          id="sla-normal"
                          type="number"
                          min="1"
                          max="168"
                          value={slaHoursNormal}
                          onChange={(e) =>
                            setSlaHoursNormal(Number(e.target.value))
                          }
                          disabled={isSaving}
                        />
                      </div>
                    </div>

                    {/* Low Priority SLA */}
                    <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-green-500" />
                        <Label className="font-semibold">Low Priority</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Cosmetic changes, typo fixes
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="sla-low" className="text-sm">
                          Response Time (hours)
                        </Label>
                        <Input
                          id="sla-low"
                          type="number"
                          min="1"
                          max="168"
                          value={slaHoursLow}
                          onChange={(e) =>
                            setSlaHoursLow(Number(e.target.value))
                          }
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Review Management Section */}
                <div className="space-y-4 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">
                      Review Reply Management
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Control how business owners can edit their review responses
                  </p>

                  <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-3">
                    <Label htmlFor="max-edits" className="font-semibold">
                      Maximum Reply Edits (within 24 hours)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Number of times a business owner can edit a review reply
                      after posting
                    </p>
                    <div className="flex items-center gap-4">
                      <Input
                        id="max-edits"
                        type="number"
                        min="0"
                        max="10"
                        value={maxReplyEdits}
                        onChange={(e) =>
                          setMaxReplyEdits(Number(e.target.value))
                        }
                        disabled={isSaving}
                        className="max-w-[200px]"
                      />
                      <Badge variant="outline" className="text-xs">
                        {maxReplyEdits === 0
                          ? "No edits allowed"
                          : `${maxReplyEdits} ${maxReplyEdits === 1 ? "edit" : "edits"} allowed`}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleSaveBusinessPortalConfig}
                  disabled={isSaving}
                  className="w-full gap-2"
                >
                  {isSaving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Business Portal Configuration
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <CategoriesManagementPage />
        </TabsContent>

        <TabsContent value="role-permissions" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">
                      Admin Role Visibility
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Control which user roles are visible and assignable by
                      normal admins.
                      <span className="font-medium text-foreground">
                        {" "}
                        public_user
                      </span>{" "}
                      is always visible.
                      <span className="font-medium text-foreground">
                        {" "}
                        super_admin
                      </span>{" "}
                      is always hidden.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {TOGGLEABLE_ROLES.map((role) => {
                  const isEnabled = adminVisibleRoles.includes(role.value);
                  return (
                    <div
                      key={role.value}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-200 ${
                        isEnabled
                          ? "bg-primary/5 border-primary/30"
                          : "bg-muted/20 border-border/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-1.5 rounded-md transition-colors ${
                            isEnabled ? "bg-primary/10" : "bg-muted"
                          }`}
                        >
                          {isEnabled ? (
                            <Eye className="h-4 w-4 text-primary" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {role.label}
                            <span className="ml-2 text-xs font-mono text-muted-foreground">
                              {role.value}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {role.description}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) =>
                          handleToggleRole(role.value, checked)
                        }
                        disabled={isSaving}
                      />
                    </div>
                  );
                })}

                <div className="pt-2 flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Changes apply to the{" "}
                    <strong>admin role editor modal</strong> and{" "}
                    <strong>role filter dropdown</strong>. Existing users with
                    hidden roles are unaffected — only the UI assignment
                    controls are restricted.
                  </p>
                </div>

                <Button
                  onClick={handleSaveRolePermissions}
                  disabled={isSaving}
                  className="w-full gap-2"
                >
                  {isSaving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Role Permissions
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
