"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  X,
  Edit2,
  RefreshCw,
  Award,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import type { Database } from "@/types/supabase";

type Rank = Database["public"]["Tables"]["ranks"]["Row"];

interface TempRankValues {
  min_xp_required: number;
  max_slots: number | null;
  benefits: string[];
  color: string;
}

interface EditableRank extends Omit<Rank, "benefits" | "color"> {
  benefits: string[];
  color: string;
  isEditing?: boolean;
  tempValues?: TempRankValues;
}

export function RanksManagement() {
  const [ranks, setRanks] = React.useState<EditableRank[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();

  // Fetch ranks
  const fetchRanks = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/gamification/ranks");
      const data = await response.json();

      if (response.ok) {
        setRanks(data.ranks || []);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to fetch ranks",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load ranks",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchRanks();
  }, [fetchRanks]);

  // Start editing a rank
  const startEditing = (rankId: number) => {
    setRanks((prev) =>
      prev.map((rank) => {
        if (rank.id === rankId) {
          return {
            ...rank,
            isEditing: true,
            tempValues: {
              min_xp_required: rank.min_xp_required,
              max_slots: rank.max_slots,
              benefits: rank.benefits || [],
              color: rank.color || "#6B7280",
            },
          };
        }
        return rank;
      })
    );
  };

  // Cancel editing
  const cancelEditing = (rankId: number) => {
    setRanks((prev) =>
      prev.map((rank) =>
        rank.id === rankId
          ? { ...rank, isEditing: false, tempValues: undefined }
          : rank
      )
    );
  };

  // Update temp values
  const updateTempValue = (
    rankId: number,
    field: keyof TempRankValues,
    value: string | number | string[] | null
  ) => {
    setRanks((prev) =>
      prev.map((rank) => {
        if (rank.id === rankId && rank.tempValues) {
          return {
            ...rank,
            tempValues: {
              ...rank.tempValues,
              [field]: value,
            },
          };
        }
        return rank;
      })
    );
  };

  // Save changes
  const saveRank = async (rankId: number) => {
    const rank = ranks.find((r) => r.id === rankId);
    if (!rank || !rank.tempValues) return;

    // Validate XP ordering
    const sortedRanks = [...ranks].sort(
      (a, b) => a.display_order - b.display_order
    );
    const currentIndex = sortedRanks.findIndex((r) => r.id === rankId);

    if (currentIndex > 0) {
      const prevRank = sortedRanks[currentIndex - 1];
      if (rank.tempValues.min_xp_required <= prevRank.min_xp_required) {
        toast({
          title: "Validation Error",
          description: `XP must be greater than ${prevRank.name} (${prevRank.min_xp_required} XP)`,
          variant: "destructive",
        });
        return;
      }
    }

    if (currentIndex < sortedRanks.length - 1) {
      const nextRank = sortedRanks[currentIndex + 1];
      if (rank.tempValues.min_xp_required >= nextRank.min_xp_required) {
        toast({
          title: "Validation Error",
          description: `XP must be less than ${nextRank.name} (${nextRank.min_xp_required} XP)`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/gamification/ranks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rankId,
          ...rank.tempValues,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: `${rank.name} rank updated successfully`,
        });
        await fetchRanks();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update rank",
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

  // Add benefit tag
  const addBenefit = (rankId: number, benefit: string) => {
    if (!benefit.trim()) return;

    setRanks((prev) =>
      prev.map((rank) => {
        if (rank.id === rankId && rank.tempValues) {
          return {
            ...rank,
            tempValues: {
              ...rank.tempValues,
              benefits: [...(rank.tempValues.benefits || []), benefit.trim()],
            },
          };
        }
        return rank;
      })
    );
  };

  // Remove benefit tag
  const removeBenefit = (rankId: number, index: number) => {
    setRanks((prev) =>
      prev.map((rank) => {
        if (rank.id === rankId && rank.tempValues) {
          return {
            ...rank,
            tempValues: {
              ...rank.tempValues,
              benefits: rank.tempValues.benefits.filter((_, i) => i !== index),
            },
          };
        }
        return rank;
      })
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading ranks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Rank Configuration Rules
              </p>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>
                  • XP thresholds must increase in order (0 → 250 → 750 → 1500 →
                  3000)
                </li>
                <li>
                  • INSIDER rank max_slots is enforced to exactly 100 users
                </li>
                <li>• Benefits are displayed to users as feature highlights</li>
                <li>• Color uses hex format for badge styling</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ranks List */}
      <div className="space-y-4">
        {ranks
          .sort((a, b) => a.display_order - b.display_order)
          .map((rank, index) => {
            const isEditing = rank.isEditing;
            const values =
              isEditing && rank.tempValues ? rank.tempValues : rank;

            return (
              <motion.div
                key={rank.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/30">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-6">
                      {/* Left: Rank Info */}
                      <div className="flex-1 space-y-4">
                        {/* Header */}
                        <div className="flex items-center gap-4">
                          <div
                            className="p-3 rounded-xl"
                            style={{
                              backgroundColor: `${values.color}20`,
                              border: `2px solid ${values.color}40`,
                            }}
                          >
                            <Award
                              className="h-6 w-6"
                              style={{ color: values.color || "#6B7280" }}
                            />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold">{rank.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {rank.slug}
                            </p>
                          </div>
                        </div>

                        {/* XP & Slots */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Min XP */}
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">
                              Minimum XP Required
                            </label>
                            {isEditing && rank.tempValues ? (
                              <Input
                                type="number"
                                min="0"
                                value={rank.tempValues.min_xp_required}
                                onChange={(e) =>
                                  updateTempValue(
                                    rank.id,
                                    "min_xp_required",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="font-mono"
                              />
                            ) : (
                              <div className="flex items-center gap-2 text-lg font-semibold">
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                {rank.min_xp_required.toLocaleString()} XP
                              </div>
                            )}
                          </div>

                          {/* Max Slots */}
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">
                              Maximum Slots
                            </label>
                            {isEditing &&
                            rank.tempValues &&
                            rank.slug !== "insider" ? (
                              <Input
                                type="number"
                                min="0"
                                value={rank.tempValues.max_slots || ""}
                                onChange={(e) =>
                                  updateTempValue(
                                    rank.id,
                                    "max_slots",
                                    e.target.value
                                      ? parseInt(e.target.value)
                                      : null
                                  )
                                }
                                placeholder="Unlimited"
                                className="font-mono"
                              />
                            ) : (
                              <div className="text-lg font-semibold">
                                {rank.max_slots ? (
                                  `${rank.max_slots.toLocaleString()} users`
                                ) : (
                                  <span className="text-muted-foreground">
                                    Unlimited
                                  </span>
                                )}
                                {rank.slug === "insider" && (
                                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                                    (Fixed)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Color */}
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">
                              Badge Color
                            </label>
                            {isEditing && rank.tempValues ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="color"
                                  value={rank.tempValues.color || "#6B7280"}
                                  onChange={(e) =>
                                    updateTempValue(
                                      rank.id,
                                      "color",
                                      e.target.value
                                    )
                                  }
                                  className="h-10 w-20"
                                />
                                <Input
                                  type="text"
                                  value={rank.tempValues.color || ""}
                                  onChange={(e) =>
                                    updateTempValue(
                                      rank.id,
                                      "color",
                                      e.target.value
                                    )
                                  }
                                  className="font-mono text-xs"
                                  placeholder="#000000"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-8 w-8 rounded-lg border-2"
                                  style={{
                                    backgroundColor: rank.color || "#6B7280",
                                    borderColor: `${rank.color || "#6B7280"}80`,
                                  }}
                                />
                                <span className="font-mono text-sm text-muted-foreground">
                                  {rank.color || "#6B7280"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Benefits */}
                        <div>
                          <label className="text-sm font-medium text-muted-foreground mb-2 block">
                            Member Benefits
                          </label>
                          {isEditing && rank.tempValues ? (
                            <BenefitEditor
                              benefits={rank.tempValues.benefits}
                              onAdd={(benefit) => addBenefit(rank.id, benefit)}
                              onRemove={(index) =>
                                removeBenefit(rank.id, index)
                              }
                            />
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {rank.benefits.map((benefit, idx) => (
                                <span
                                  key={idx}
                                  className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full"
                                >
                                  {benefit}
                                </span>
                              ))}
                              {rank.benefits.length === 0 && (
                                <span className="text-sm text-muted-foreground italic">
                                  No benefits configured
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-col gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => saveRank(rank.id)}
                              disabled={isSaving}
                              className="w-full"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelEditing(rank.id)}
                              disabled={isSaving}
                              className="w-full"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditing(rank.id)}
                            className="w-full"
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
      </div>
    </div>
  );
}

// Benefit tag editor component
function BenefitEditor({
  benefits,
  onAdd,
  onRemove,
}: {
  benefits: string[];
  onAdd: (benefit: string) => void;
  onRemove: (index: number) => void;
}) {
  const [inputValue, setInputValue] = React.useState("");

  const handleAdd = () => {
    if (inputValue.trim()) {
      onAdd(inputValue);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a benefit and press Enter"
          className="flex-1"
        />
        <Button type="button" size="sm" onClick={handleAdd}>
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {benefits.map((benefit, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary text-sm rounded-full"
          >
            {benefit}
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
