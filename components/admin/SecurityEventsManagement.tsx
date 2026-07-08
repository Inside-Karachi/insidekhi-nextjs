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
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  Filter,
  MapPin,
  User,
  Calendar,
  AlertTriangle,
} from "lucide-react";

interface SecurityEvent {
  id: number;
  event_type: string;
  severity: string;
  user_email?: string;
  ip_address?: string;
  country_code?: string;
  city?: string;
  endpoint?: string;
  resolved: boolean;
  created_at: string;
}

export function SecurityEventsManagement() {
  const [events, setEvents] = React.useState<SecurityEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [severityFilter, setSeverityFilter] = React.useState<string>("all");
  const [resolvedFilter, setResolvedFilter] =
    React.useState<string>("unresolved");
  const [searchQuery, setSearchQuery] = React.useState("");
  const { toast } = useToast();

  const fetchEvents = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append("limit", "50");

      if (severityFilter !== "all") {
        params.append("severity", severityFilter);
      }

      if (resolvedFilter !== "all") {
        params.append(
          "resolved",
          resolvedFilter === "resolved" ? "true" : "false",
        );
      }

      const res = await fetch(`/api/admin/security/events?${params}`);
      const data = await res.json();

      if (data.events) {
        let filtered = data.events;

        if (searchQuery) {
          filtered = filtered.filter(
            (e: SecurityEvent) =>
              e.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              e.ip_address?.includes(searchQuery) ||
              e.event_type.toLowerCase().includes(searchQuery.toLowerCase()),
          );
        }

        setEvents(filtered);
      }
    } catch (error) {
      console.error("[EVENTS] Error:", error);
      toast({
        title: "Error",
        description: "Failed to load security events",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [severityFilter, resolvedFilter, searchQuery, toast]);

  React.useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

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
      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent backdrop-blur-sm border border-orange-500/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Filter className="h-5 w-5 text-orange-500" />
              </div>
              Event Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <Input
                  placeholder="Email, IP, or event type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-background/50 border-orange-500/20 focus:border-orange-500/50"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Severity
                </label>
                <Select
                  value={severityFilter}
                  onValueChange={setSeverityFilter}
                >
                  <SelectTrigger className="bg-background/50 border-orange-500/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select
                  value={resolvedFilter}
                  onValueChange={setResolvedFilter}
                >
                  <SelectTrigger className="bg-background/50 border-orange-500/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="unresolved">Unresolved</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4">
              <Button
                size="sm"
                onClick={fetchEvents}
                disabled={isLoading}
                className="bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/25"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Events List */}
      <Card className="bg-gradient-to-br from-background/50 to-background/30 backdrop-blur-sm border-border/50 shadow-xl">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
            Security Events
            <span className="ml-auto text-lg font-bold text-orange-500">
              {events.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading events...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No security events found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={getSeverityColor(event.severity)}
                      >
                        {event.severity}
                      </Badge>
                      <span className="font-medium">
                        {event.event_type.replace(/_/g, " ").toUpperCase()}
                      </span>
                      {event.resolved && (
                        <Badge
                          variant="outline"
                          className="bg-green-500/10 text-green-600 dark:text-green-400"
                        >
                          Resolved
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground space-y-1">
                      {event.user_email && (
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          <span>{event.user_email}</span>
                        </div>
                      )}

                      {event.ip_address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3" />
                          <span className="font-mono">{event.ip_address}</span>
                          {event.city && event.country_code && (
                            <span>
                              ({event.city}, {event.country_code})
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
