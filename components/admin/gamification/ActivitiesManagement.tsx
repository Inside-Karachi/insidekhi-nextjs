"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  X,
  Edit2,
  RefreshCw,
  Zap,
  Search,
  Plus,
  AlertCircle,
  Clock,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type { Database } from "@/types/database";

type XPActivity = Database["public"]["Tables"]["xp_activities"]["Row"];

interface TempActivityValues {
  activity_name: string;
  description: string | null;
  xp_value: number;
  cooldown_type: string;
  max_per_day: number | null;
}

interface EditableActivity extends XPActivity {
  isEditing?: boolean;
  tempValues?: TempActivityValues;
}

const cooldownOptions = [
  { value: "once", label: "Once (Lifetime)" },
  { value: "daily", label: "Daily Reset" },
  { value: "weekly", label: "Weekly Reset" },
  { value: "per_target", label: "Per Target" },
  { value: "unlimited", label: "Unlimited" },
];

export function ActivitiesManagement() {
  const [activities, setActivities] = React.useState<EditableActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = React.useState<
    EditableActivity[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const { toast } = useToast();

  // Fetch activities
  const fetchActivities = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/gamification/activities");
      const data = await response.json();

      if (response.ok) {
        setActivities(data.activities || []);
        setFilteredActivities(data.activities || []);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to fetch activities",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load activities",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Filter activities by search
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredActivities(activities);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredActivities(
        activities.filter(
          (activity: EditableActivity) =>
            activity.activity_name.toLowerCase().includes(query) ||
            activity.activity_slug.toLowerCase().includes(query) ||
            (activity.description &&
              activity.description.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, activities]);

  // Start editing
  const startEditing = (activityId: number) => {
    setActivities((prev) =>
      prev.map((activity): EditableActivity => {
        if (activity.id === activityId) {
          return {
            ...activity,
            isEditing: true,
            tempValues: {
              activity_name: activity.activity_name,
              description: activity.description,
              xp_value: activity.xp_value,
              cooldown_type: activity.cooldown_type,
              max_per_day: activity.max_per_day,
            },
          };
        }
        return activity;
      })
    );
  };

  // Cancel editing
  const cancelEditing = (activityId: number) => {
    setActivities((prev) =>
      prev.map((activity) =>
        activity.id === activityId
          ? { ...activity, isEditing: false, tempValues: undefined }
          : activity
      )
    );
  };

  // Update temp values
  const updateTempValue = (
    activityId: number,
    field: keyof TempActivityValues,
    value: string | number | null
  ) => {
    setActivities((prev) =>
      prev.map((activity): EditableActivity => {
        if (activity.id === activityId && activity.tempValues) {
          return {
            ...activity,
            tempValues: {
              ...activity.tempValues,
              [field]: value,
            },
          };
        }
        return activity;
      })
    );
  };

  // Save changes
  const saveActivity = async (activityId: number) => {
    const activity = activities.find((a) => a.id === activityId);
    if (!activity || !activity.tempValues) return;

    // Validation
    if (activity.tempValues.xp_value < 0) {
      toast({
        title: "Validation Error",
        description: "XP value must be positive",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/admin/gamification/activities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_slug: activity.activity_slug,
          ...activity.tempValues,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: `${activity.activity_name} updated successfully`,
        });
        await fetchActivities();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update activity",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle active status
  const toggleActive = async (activityId: number) => {
    const activity = activities.find((a) => a.id === activityId);
    if (!activity) return;

    try {
      const response = await fetch("/api/admin/gamification/activities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_slug: activity.activity_slug,
          is_active: !activity.is_active,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: `${activity.activity_name} ${
            activity.is_active ? "deactivated" : "activated"
          }`,
        });
        await fetchActivities();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to toggle status",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading activities...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-emerald-900 dark:text-emerald-100">
                Activity Configuration Guide
              </p>
              <ul className="text-sm text-emerald-700 dark:text-emerald-300 space-y-1">
                <li>
                  • <strong>Once:</strong> User can earn XP only once in their
                  lifetime
                </li>
                <li>
                  • <strong>Daily:</strong> XP can be earned once per day
                </li>
                <li>
                  • <strong>Weekly:</strong> XP resets every week
                </li>
                <li>
                  • <strong>Per Target:</strong> XP earned per unique target
                  (e.g., per listing review)
                </li>
                <li>
                  • <strong>Unlimited:</strong> No cooldown restriction
                </li>
                <li>
                  • <strong>Max Per Day:</strong> Optional daily cap (applies
                  only to unlimited cooldown)
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, slug, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="whitespace-nowrap"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Activity
        </Button>
      </div>

      {/* Activities Grid */}
      <div className="grid gap-4">
        {filteredActivities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No activities found
            </CardContent>
          </Card>
        ) : (
          filteredActivities.map((activity, index) => {
            const isEditing = activity.isEditing;
            const values =
              isEditing && activity.tempValues ? activity.tempValues : activity;

            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={`group hover:shadow-lg transition-all duration-300 ${
                    !activity.is_active
                      ? "opacity-60 bg-muted/20"
                      : "hover:border-emerald-500/30"
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-6">
                      {/* Left: Activity Info */}
                      <div className="flex-1 space-y-4">
                        {/* Header */}
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/20">
                            <Zap className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex-1">
                            {isEditing ? (
                              <Input
                                value={values.activity_name}
                                onChange={(e) =>
                                  updateTempValue(
                                    activity.id,
                                    "activity_name",
                                    e.target.value
                                  )
                                }
                                className="font-semibold text-lg mb-2"
                                placeholder="Activity name"
                              />
                            ) : (
                              <h3 className="text-xl font-bold">
                                {activity.activity_name}
                              </h3>
                            )}
                            <p className="text-sm text-muted-foreground font-mono">
                              {activity.activity_slug}
                            </p>
                          </div>
                        </div>

                        {/* Description */}
                        {isEditing ? (
                          <Input
                            value={values.description || ""}
                            onChange={(e) =>
                              updateTempValue(
                                activity.id,
                                "description",
                                e.target.value || null
                              )
                            }
                            placeholder="Description (optional)"
                          />
                        ) : (
                          activity.description && (
                            <p className="text-sm text-muted-foreground">
                              {activity.description}
                            </p>
                          )
                        )}

                        {/* Configuration Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* XP Value */}
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">
                              XP Reward
                            </label>
                            {isEditing ? (
                              <Input
                                type="number"
                                min="0"
                                value={values.xp_value}
                                onChange={(e) =>
                                  updateTempValue(
                                    activity.id,
                                    "xp_value",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="font-mono"
                              />
                            ) : (
                              <div className="flex items-center gap-2 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                                <Zap className="h-4 w-4" />
                                {activity.xp_value} XP
                              </div>
                            )}
                          </div>

                          {/* Cooldown Type */}
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">
                              Cooldown Type
                            </label>
                            {isEditing ? (
                              <Select
                                value={values.cooldown_type}
                                onValueChange={(value) =>
                                  updateTempValue(
                                    activity.id,
                                    "cooldown_type",
                                    value
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {cooldownOptions.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {
                                  cooldownOptions.find(
                                    (o) => o.value === activity.cooldown_type
                                  )?.label
                                }
                              </div>
                            )}
                          </div>

                          {/* Max Per Day */}
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">
                              Daily Cap
                            </label>
                            {isEditing ? (
                              <Input
                                type="number"
                                min="0"
                                value={values.max_per_day || ""}
                                onChange={(e) =>
                                  updateTempValue(
                                    activity.id,
                                    "max_per_day",
                                    e.target.value
                                      ? parseInt(e.target.value)
                                      : null
                                  )
                                }
                                placeholder="Unlimited"
                                className="font-mono"
                              />
                            ) : (
                              <div className="text-sm">
                                {activity.max_per_day ? (
                                  <span className="font-semibold">
                                    {activity.max_per_day} per day
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    No limit
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          {activity.is_active ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full font-medium">
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full font-medium">
                              <div className="h-2 w-2 rounded-full bg-gray-400" />
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-col gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => saveActivity(activity.id)}
                              disabled={isSaving}
                            >
                              <Save className="h-4 w-4 mr-2" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelEditing(activity.id)}
                              disabled={isSaving}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(activity.id)}
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleActive(activity.id)}
                            >
                              {activity.is_active ? (
                                <>
                                  <ToggleLeft className="h-4 w-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <ToggleRight className="h-4 w-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Create Dialog */}
      <CreateActivityDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={fetchActivities}
      />
    </div>
  );
}

// Create Activity Dialog
function CreateActivityDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [isCreating, setIsCreating] = React.useState(false);
  const [formData, setFormData] = React.useState({
    activity_slug: "",
    activity_name: "",
    description: "",
    xp_value: 10,
    cooldown_type: "daily",
    max_per_day: null as number | null,
  });
  const { toast } = useToast();

  const handleCreate = async () => {
    // Validation
    if (!formData.activity_slug || !formData.activity_name) {
      toast({
        title: "Validation Error",
        description: "Activity slug and name are required",
        variant: "destructive",
      });
      return;
    }

    if (formData.xp_value < 0) {
      toast({
        title: "Validation Error",
        description: "XP value must be positive",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch("/api/admin/gamification/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          description: formData.description || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Activity created successfully",
        });
        onOpenChange(false);
        onSuccess();
        // Reset form
        setFormData({
          activity_slug: "",
          activity_name: "",
          description: "",
          xp_value: 10,
          cooldown_type: "daily",
          max_per_day: null,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to create activity",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to create activity",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Activity</DialogTitle>
          <DialogDescription>
            Add a new XP activity type for users to earn rewards
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Activity Slug</label>
            <Input
              value={formData.activity_slug}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  activity_slug: e.target.value
                    .toLowerCase()
                    .replace(/\s+/g, "_"),
                }))
              }
              placeholder="e.g., new_user_bonus"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier (lowercase, underscores only)
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Activity Name</label>
            <Input
              value={formData.activity_name}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  activity_name: e.target.value,
                }))
              }
              placeholder="e.g., New User Bonus"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Description (Optional)
            </label>
            <Input
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Describe when users earn this XP"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">XP Reward</label>
              <Input
                type="number"
                min="0"
                value={formData.xp_value}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    xp_value: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cooldown Type</label>
              <Select
                value={formData.cooldown_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    cooldown_type: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cooldownOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Max Per Day (Optional)
            </label>
            <Input
              type="number"
              min="0"
              value={formData.max_per_day || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  max_per_day: e.target.value ? parseInt(e.target.value) : null,
                }))
              }
              placeholder="Leave empty for no limit"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Activity
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
