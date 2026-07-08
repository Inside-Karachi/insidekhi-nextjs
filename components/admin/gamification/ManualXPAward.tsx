"use client";

import React from "react";
import { Award, Search, Trophy, User, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";

interface XPActivity {
  activity_slug: string;
  activity_name: string;
  xp_value: number;
  description: string;
  cooldown_type: string;
  is_active: boolean;
}

interface UserSearchResult {
  id: string;
  full_name: string | null;
  points: number;
}

export function ManualXPAward() {
  const { toast } = useToast();
  const [activities, setActivities] = React.useState<XPActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = React.useState(true);
  const [userSearch, setUserSearch] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<UserSearchResult[]>(
    []
  );
  const [isSearching, setIsSearching] = React.useState(false);
  const [selectedUser, setSelectedUser] =
    React.useState<UserSearchResult | null>(null);
  const [selectedActivity, setSelectedActivity] = React.useState("");
  const [adminReason, setAdminReason] = React.useState("");
  const [relatedId, setRelatedId] = React.useState("");
  const [isAwarding, setIsAwarding] = React.useState(false);

  // Fetch activities on mount
  const fetchActivities = React.useCallback(async () => {
    try {
      const response = await fetch("/api/admin/gamification/activities");
      const data = await response.json();

      if (data.activities) {
        const activeActivities = data.activities.filter(
          (a: XPActivity) => a.is_active
        );
        setActivities(activeActivities);
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error);
      toast({
        title: "Error",
        description: "Failed to load activities",
        variant: "destructive",
      });
    } finally {
      setIsLoadingActivities(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const searchUsers = async () => {
    if (!userSearch.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, points")
        .or(`full_name.ilike.%${userSearch}%,username.ilike.%${userSearch}%`)
        .limit(10);

      if (error) throw error;

      setSearchResults(data || []);
    } catch (error) {
      console.error("User search error:", error);
      toast({
        title: "Search Error",
        description: "Failed to search users",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAwardXP = async () => {
    if (!selectedUser || !selectedActivity) {
      toast({
        title: "Missing Information",
        description: "Please select a user and activity",
        variant: "destructive",
      });
      return;
    }

    setIsAwarding(true);
    try {
      const response = await fetch("/api/admin/gamification/manual-xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUser.id,
          activity_slug: selectedActivity,
          reason: adminReason || undefined,
          related_id: relatedId || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to award XP");
      }

      toast({
        title: "✅ XP Awarded!",
        description: result.message,
      });

      // Reset form
      setSelectedUser(null);
      setUserSearch("");
      setSearchResults([]);
      setSelectedActivity("");
      setAdminReason("");
      setRelatedId("");
    } catch (error) {
      console.error("Award XP error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to award XP",
        variant: "destructive",
      });
    } finally {
      setIsAwarding(false);
    }
  };

  const selectedActivityData = activities.find(
    (a) => a.activity_slug === selectedActivity
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border/50">
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <Trophy className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Manual XP Award
          </h2>
          <p className="text-sm text-muted-foreground">
            Award XP to users for special cases or corrections
          </p>
        </div>
      </div>

      {/* User Search Section */}
      <div className="space-y-4 p-6 rounded-xl border border-border/50 bg-card/50">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <Label htmlFor="user-search" className="text-base font-semibold">
            Select User
          </Label>
        </div>

        {!selectedUser ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                id="user-search"
                type="text"
                placeholder="Search by name or username..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                className="flex-1"
              />
              <Button
                onClick={searchUsers}
                disabled={isSearching || !userSearch.trim()}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedUser(user);
                      setSearchResults([]);
                      setUserSearch("");
                    }}
                    className="w-full text-left p-3 rounded-lg border border-border/50 hover:bg-accent hover:border-primary/50 transition-colors"
                  >
                    <div className="font-medium">
                      {user.full_name || "Unknown User"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      @{user.id.slice(0, 8)}... (User ID)
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Current XP: {user.points || 0}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div>
              <div className="font-semibold text-foreground">
                {selectedUser.full_name || "Unknown User"}
              </div>
              <div className="text-sm text-muted-foreground">
                User ID: {selectedUser.id.slice(0, 12)}...
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Current XP: {selectedUser.points || 0}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedUser(null)}
            >
              Change User
            </Button>
          </div>
        )}
      </div>

      {/* Activity Selection */}
      <div className="space-y-4 p-6 rounded-xl border border-border/50 bg-card/50">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          <Label htmlFor="activity-select" className="text-base font-semibold">
            Select Activity
          </Label>
        </div>

        <Select value={selectedActivity} onValueChange={setSelectedActivity}>
          <SelectTrigger id="activity-select">
            <SelectValue placeholder="Choose an activity..." />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {isLoadingActivities ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading activities...
              </div>
            ) : activities.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No active activities found
              </div>
            ) : (
              activities.map((activity) => (
                <SelectItem
                  key={activity.activity_slug}
                  value={activity.activity_slug}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{activity.activity_name}</span>
                    <span className="ml-4 text-primary font-semibold">
                      +{activity.xp_value} XP
                    </span>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {selectedActivityData && (
          <div className="p-4 rounded-lg bg-accent/50 border border-border/30">
            <div className="text-sm text-muted-foreground">
              {selectedActivityData.description}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Type: {selectedActivityData.cooldown_type}
            </div>
          </div>
        )}
      </div>

      {/* Optional Fields */}
      <div className="space-y-4 p-6 rounded-xl border border-border/50 bg-card/50">
        <div className="space-y-4">
          <div>
            <Label htmlFor="admin-reason" className="text-base font-semibold">
              Admin Reason (Optional)
            </Label>
            <Textarea
              id="admin-reason"
              placeholder="Explain why you're manually awarding XP (e.g., 'Suggested place via contact form', 'Compensation for bug report')..."
              value={adminReason}
              onChange={(e) => setAdminReason(e.target.value)}
              className="mt-2 min-h-[100px]"
            />
          </div>

          <div>
            <Label htmlFor="related-id" className="text-base font-semibold">
              Related ID (Optional)
            </Label>
            <Input
              id="related-id"
              type="text"
              placeholder="e.g., form submission ID, listing ID..."
              value={relatedId}
              onChange={(e) => setRelatedId(e.target.value)}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              For tracking purposes (form ID, listing ID, etc.)
            </p>
          </div>
        </div>
      </div>

      {/* Award Button */}
      <div className="flex items-center justify-between p-6 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <div>
          <div className="font-semibold text-foreground">
            Ready to award XP?
          </div>
          <div className="text-sm text-muted-foreground">
            This action will be logged in the audit trail
          </div>
        </div>
        <Button
          onClick={handleAwardXP}
          disabled={!selectedUser || !selectedActivity || isAwarding}
          size="lg"
          className="gap-2"
        >
          {isAwarding ? (
            <>Processing...</>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Award XP
            </>
          )}
        </Button>
      </div>

      {/* Info Box */}
      <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            ℹ️ <strong>Note:</strong> Manual XP awards bypass cooldown checks
            for one-time/special cases.
          </p>
          <p>
            ⚠️ Duplicate prevention still applies for per-target activities.
          </p>
          <p>📝 All manual awards are logged with your admin ID and reason.</p>
        </div>
      </div>
    </div>
  );
}
