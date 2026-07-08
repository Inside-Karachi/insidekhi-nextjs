"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, AlertTriangle, Info } from "lucide-react";
import { format } from "date-fns";

interface CleanupLog {
  id: string;
  cleanup_type: string;
  deleted_count: number;
  age_threshold_days: number;
  executed_by: string | null;
  executed_at: string;
  metadata: Record<string, unknown>;
  error_message: string | null;
  deleted_by_profile?: {
    full_name: string;
    email: string;
  };
}

interface CleanupLogsClientProps {
  initialLogs: CleanupLog[];
  userRole: string;
}

export function CleanupLogsClient({
  initialLogs,
  userRole,
}: CleanupLogsClientProps) {
  const { toast } = useToast();
  const [logs, setLogs] = React.useState<CleanupLog[]>(initialLogs);
  const [showCleanupDialog, setShowCleanupDialog] = React.useState(false);
  const [thresholdDays, setThresholdDays] = React.useState("90");
  const [isRunningCleanup, setIsRunningCleanup] = React.useState(false);

  const handleManualCleanup = async () => {
    const days = parseInt(thresholdDays);

    if (isNaN(days) || days < 1) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid number of days (minimum 1)",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(
      `⚠️ This will PERMANENTLY DELETE all soft-deleted replies older than ${days} days.\n\nAre you absolutely sure?`
    );

    if (!confirmed) return;

    setIsRunningCleanup(true);
    try {
      const response = await fetch("/api/admin/forms/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age_threshold_days: days }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "✅ Cleanup Completed",
          description: `Deleted ${data.deleted_count} old replies`,
        });

        // Add new log to the list
        const newLog: CleanupLog = {
          id: data.log_id,
          cleanup_type: "manual",
          deleted_count: data.deleted_count,
          age_threshold_days: days,
          executed_by: null,
          executed_at: new Date().toISOString(),
          metadata: {},
          error_message: null,
        };

        setLogs([newLog, ...logs]);
        setShowCleanupDialog(false);
        setThresholdDays("90");
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Cleanup error:", error);
      toast({
        title: "Cleanup Failed",
        description:
          error instanceof Error ? error.message : "Failed to run cleanup",
        variant: "destructive",
      });
    } finally {
      setIsRunningCleanup(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>Showing last 100 cleanup executions</span>
        </div>

        {userRole === "super_admin" && (
          <Button
            onClick={() => setShowCleanupDialog(true)}
            variant="destructive"
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Run Manual Cleanup
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Executions</div>
          <div className="text-2xl font-bold">{logs.length}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Deleted</div>
          <div className="text-2xl font-bold">
            {logs.reduce((sum, log) => sum + log.deleted_count, 0)}
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Auto Cleanups</div>
          <div className="text-2xl font-bold">
            {logs.filter((l) => l.cleanup_type === "auto").length}
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Manual Cleanups</div>
          <div className="text-2xl font-bold">
            {logs.filter((l) => l.cleanup_type === "manual").length}
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Executed At</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Deleted Count</TableHead>
              <TableHead className="text-right">Age Threshold</TableHead>
              <TableHead>Executed By</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  No cleanup logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-sm">
                    {format(new Date(log.executed_at), "PPp")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.cleanup_type === "auto" ? "outline" : "default"
                      }
                    >
                      {log.cleanup_type === "auto" ? "⚙️ Auto" : "👤 Manual"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {log.deleted_count}
                  </TableCell>
                  <TableCell className="text-right">
                    {log.age_threshold_days} days
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.deleted_by_profile?.full_name || (
                      <span className="text-muted-foreground italic">
                        System
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.error_message ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Error
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="gap-1 text-green-600 border-green-600"
                      >
                        ✅ Success
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Manual Cleanup Dialog */}
      <Dialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Run Manual Cleanup
            </DialogTitle>
            <DialogDescription>
              Permanently delete soft-deleted replies older than the specified
              threshold. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="threshold">Age Threshold (days)</Label>
              <Input
                id="threshold"
                type="number"
                min="1"
                value={thresholdDays}
                onChange={(e) => setThresholdDays(e.target.value)}
                placeholder="90"
              />
              <p className="text-xs text-muted-foreground">
                Replies soft-deleted more than this many days ago will be
                permanently removed
              </p>
            </div>

            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-destructive">Warning</p>
                  <p className="text-destructive/80">
                    This will permanently delete replies from the database. An
                    audit trail will be created but the data cannot be
                    recovered.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCleanupDialog(false)}
              disabled={isRunningCleanup}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleManualCleanup}
              disabled={isRunningCleanup}
              className="gap-2"
            >
              {isRunningCleanup ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running Cleanup...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Run Cleanup
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
