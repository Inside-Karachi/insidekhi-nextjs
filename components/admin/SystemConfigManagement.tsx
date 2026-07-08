"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Save, Settings as SettingsIcon } from "lucide-react";

interface SystemConfig {
  id: number;
  config_key: string;
  config_value: unknown;
  config_type: string;
  description?: string;
  updated_at: string;
}

export function SystemConfigManagement() {
  const [configs, setConfigs] = React.useState<SystemConfig[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [editingValues, setEditingValues] = React.useState<
    Record<string, string>
  >({});
  const { toast } = useToast();

  const fetchConfigs = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/security/config");
      const data = await res.json();

      if (data.configs) {
        setConfigs(data.configs);
        // Initialize editing values
        const initialValues: Record<string, string> = {};
        data.configs.forEach((config: SystemConfig) => {
          initialValues[config.config_key] = String(config.config_value);
        });
        setEditingValues(initialValues);
      }
    } catch (error) {
      console.error("[CONFIG] Error:", error);
      toast({
        title: "Error",
        description: "Failed to load system configuration",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleUpdateConfig = async (key: string) => {
    try {
      const value = editingValues[key];

      const res = await fetch(
        `/api/admin/security/config/${encodeURIComponent(key)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config_value: value }),
        },
      );

      if (res.ok) {
        toast({
          title: "Success",
          description: "Configuration updated successfully",
        });
        fetchConfigs();
      } else {
        throw new Error("Failed to update config");
      }
    } catch (error) {
      console.error("[UPDATE CONFIG] Error:", error);
      toast({
        title: "Error",
        description: "Failed to update configuration",
        variant: "destructive",
      });
    }
  };

  const getConfigTypeColor = (type: string) => {
    switch (type) {
      case "threshold":
        return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
      case "feature_flag":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      default:
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent backdrop-blur-sm border border-blue-500/20 rounded-xl p-6 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <SettingsIcon className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">System Configuration</h3>
              <p className="text-sm text-muted-foreground">
                {configs.length} configuration settings
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchConfigs}
            disabled={isLoading}
            className="border-blue-500/20 hover:bg-blue-500/10"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Configuration List */}
      <Card className="bg-gradient-to-br from-background/50 to-background/30 backdrop-blur-sm border-border/50 shadow-xl">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <SettingsIcon className="h-5 w-5 text-blue-500" />
            </div>
            Configuration Settings
            <span className="ml-auto text-lg font-bold text-blue-500">
              {configs.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading configuration...
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No configuration found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="p-4 rounded-lg border bg-card space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium font-mono text-sm">
                          {config.config_key}
                        </span>
                        <Badge
                          className={getConfigTypeColor(config.config_type)}
                        >
                          {config.config_type}
                        </Badge>
                      </div>
                      {config.description && (
                        <p className="text-sm text-muted-foreground">
                          {config.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Last updated:{" "}
                        {new Date(config.updated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      value={editingValues[config.config_key] || ""}
                      onChange={(e) =>
                        setEditingValues({
                          ...editingValues,
                          [config.config_key]: e.target.value,
                        })
                      }
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleUpdateConfig(config.config_key)}
                      disabled={
                        editingValues[config.config_key] ===
                        String(config.config_value)
                      }
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
