"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Ban,
  RefreshCw,
  Plus,
  Unlock,
  MapPin,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface BlockedIP {
  id: number;
  ip_address: string;
  reason: string;
  severity: string;
  blocked_at: string;
  expires_at?: string;
  is_permanent: boolean;
  auto_blocked: boolean;
  total_violations: number;
  last_violation_at: string;
}

export function BlockedIPsManagement() {
  const [blockedIPs, setBlockedIPs] = React.useState<BlockedIP[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<"all" | "active">("active");
  const [isBlockDialogOpen, setIsBlockDialogOpen] = React.useState(false);
  const [newIP, setNewIP] = React.useState("");
  const [newReason, setNewReason] = React.useState("");
  const [newSeverity, setNewSeverity] = React.useState<string>("medium");
  const [newDuration, setNewDuration] = React.useState("");
  const { toast } = useToast();

  const fetchBlockedIPs = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const url =
        filter === "active"
          ? "/api/admin/security/blocked-ips?active_only=true"
          : "/api/admin/security/blocked-ips";

      const res = await fetch(url);
      const data = await res.json();

      if (data.blocked_ips) {
        setBlockedIPs(data.blocked_ips);
      }
    } catch (error) {
      console.error("[BLOCKED IPS] Error:", error);
      toast({
        title: "Error",
        description: "Failed to load blocked IPs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [filter, toast]);

  React.useEffect(() => {
    fetchBlockedIPs();
  }, [fetchBlockedIPs]);

  const handleBlockIP = async () => {
    if (!newIP || !newReason) {
      toast({
        title: "Validation Error",
        description: "IP address and reason are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/admin/security/blocked-ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip_address: newIP,
          reason: newReason,
          severity: newSeverity,
          duration_minutes: newDuration ? parseInt(newDuration) : undefined,
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "IP address blocked successfully",
        });
        setIsBlockDialogOpen(false);
        setNewIP("");
        setNewReason("");
        setNewDuration("");
        fetchBlockedIPs();
      } else {
        throw new Error("Failed to block IP");
      }
    } catch (error) {
      console.error("[BLOCK IP] Error:", error);
      toast({
        title: "Error",
        description: "Failed to block IP address",
        variant: "destructive",
      });
    }
  };

  const handleUnblockIP = async (ip: string) => {
    try {
      const res = await fetch(
        `/api/admin/security/blocked-ips/${encodeURIComponent(ip)}`,
        {
          method: "DELETE",
        },
      );

      if (res.ok) {
        toast({
          title: "Success",
          description: "IP address unblocked successfully",
        });
        fetchBlockedIPs();
      } else {
        throw new Error("Failed to unblock IP");
      }
    } catch (error) {
      console.error("[UNBLOCK IP] Error:", error);
      toast({
        title: "Error",
        description: "Failed to unblock IP address",
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      case "high":
        return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20";
      default:
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent backdrop-blur-sm border border-purple-500/20 rounded-xl p-6 shadow-lg"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Ban className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">IP Management</h3>
              <p className="text-sm text-muted-foreground">
                {blockedIPs.length}{" "}
                {filter === "active" ? "active blocks" : "total records"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={filter}
              onValueChange={(v) => setFilter(v as "all" | "active")}
            >
              <SelectTrigger className="w-40 bg-background/50 border-purple-500/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="all">All IPs</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchBlockedIPs}
              disabled={isLoading}
              className="border-purple-500/20 hover:bg-purple-500/10"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setIsBlockDialogOpen(true)}
              className="bg-purple-500 hover:bg-purple-600 shadow-lg shadow-purple-500/25"
            >
              <Plus className="h-4 w-4 mr-2" />
              Block IP
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Blocked IPs List */}
      <Card className="bg-gradient-to-br from-background/50 to-background/30 backdrop-blur-sm border-border/50 shadow-xl">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Ban className="h-5 w-5 text-purple-500" />
            </div>
            Blocked IP Addresses
            <span className="ml-auto text-lg font-bold text-purple-500">
              {blockedIPs.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading blocked IPs...
            </div>
          ) : blockedIPs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ban className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No blocked IPs found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {blockedIPs.map((ip, index) => (
                <motion.div
                  key={ip.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono font-semibold">
                        {ip.ip_address}
                      </span>
                      <Badge
                        variant="outline"
                        className={getSeverityColor(ip.severity)}
                      >
                        {ip.severity}
                      </Badge>
                      {ip.auto_blocked && (
                        <Badge
                          variant="outline"
                          className="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        >
                          Auto-blocked
                        </Badge>
                      )}
                      {ip.is_permanent && (
                        <Badge
                          variant="outline"
                          className="bg-purple-500/10 text-purple-600 dark:text-purple-400"
                        >
                          Permanent
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        <strong>Reason:</strong> {ip.reason}
                      </p>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Blocked: {new Date(ip.blocked_at).toLocaleString()}
                        </span>
                        {ip.expires_at && (
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Expires: {new Date(ip.expires_at).toLocaleString()}
                          </span>
                        )}
                        <span>Violations: {ip.total_violations}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnblockIP(ip.ip_address)}
                  >
                    <Unlock className="h-4 w-4 mr-2" />
                    Unblock
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block IP Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block IP Address</DialogTitle>
            <DialogDescription>
              Manually block an IP address from accessing the platform
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="ip">IP Address</Label>
              <Input
                id="ip"
                placeholder="192.168.1.1"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                placeholder="Suspicious activity detected"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="severity">Severity</Label>
              <Select value={newSeverity} onValueChange={setNewSeverity}>
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="duration">
                Duration (minutes, leave empty for permanent)
              </Label>
              <Input
                id="duration"
                type="number"
                placeholder="60"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBlockDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleBlockIP}>Block IP</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
