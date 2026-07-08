"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trophy, Calendar, Target, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Challenge } from "@/types/gamification.types";

const challengeTypes = [
  { value: "reviews", label: "Write Reviews" },
  { value: "visits", label: "Visit Locations" },
  { value: "bookings", label: "Book Events" },
  { value: "favorites", label: "Add Favorites" },
  { value: "shares", label: "Share Links" },
  { value: "custom", label: "Custom Challenge" },
];

export function ChallengesManagement() {
  const [challenges, setChallenges] = React.useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);
  const { toast } = useToast();

  // Form state
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [challengeType, setChallengeType] = React.useState("reviews");
  const [xpReward, setXpReward] = React.useState("50");
  const [targetCount, setTargetCount] = React.useState("5");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  // Fetch challenges
  const fetchChallenges = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/gamification/challenges");

      if (response.ok) {
        const data = await response.json();
        setChallenges(data.challenges || []);
      }
    } catch (error) {
      console.error("Error fetching challenges:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  // Set default dates (start today, end in 7 days)
  React.useEffect(() => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    setStartDate(today.toISOString().split("T")[0]);
    setEndDate(nextWeek.toISOString().split("T")[0]);
  }, []);

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !title ||
      !description ||
      !challengeType ||
      !xpReward ||
      !targetCount ||
      !startDate ||
      !endDate
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);

      const response = await fetch("/api/gamification/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          challenge_type: challengeType,
          xp_reward: parseInt(xpReward, 10),
          target_count: parseInt(targetCount, 10),
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          is_active: true,
          auto_activate: false,
          metadata: {},
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Challenge Created!",
          description:
            result.message || "Weekly challenge has been created successfully",
        });

        // Reset form
        setTitle("");
        setDescription("");
        setChallengeType("reviews");
        setXpReward("50");
        setTargetCount("5");

        // Refresh dates
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        setStartDate(today.toISOString().split("T")[0]);
        setEndDate(nextWeek.toISOString().split("T")[0]);

        // Refresh challenges list
        fetchChallenges();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create challenge",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating challenge:", error);
      toast({
        title: "Error",
        description: "Failed to create challenge. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Create Challenge Form */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-white/50 to-white/30 dark:from-slate-900/50 dark:to-slate-900/30 border-violet-200/30 dark:border-violet-800/30 backdrop-blur-sm">
            <CardHeader className="border-b border-violet-200/20 dark:border-violet-800/20">
              <CardTitle className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                <Plus className="h-5 w-5" />
                Create New Challenge
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleCreateChallenge} className="space-y-4">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Challenge Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    placeholder="Write 5 reviews this week"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="bg-white/50 dark:bg-slate-800/50 border-violet-200/30 dark:border-violet-800/30"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">
                    Description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Share your dining experiences with the community..."
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="bg-white/50 dark:bg-slate-800/50 border-violet-200/30 dark:border-violet-800/30"
                  />
                </div>

                {/* Challenge Type */}
                <div className="space-y-2">
                  <Label htmlFor="type">
                    Challenge Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={challengeType}
                    onValueChange={setChallengeType}
                  >
                    <SelectTrigger className="bg-white/50 dark:bg-slate-800/50 border-violet-200/30 dark:border-violet-800/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {challengeTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* XP Reward & Target Count */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="xp">
                      XP Reward <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="xp"
                      type="number"
                      min="1"
                      placeholder="50"
                      value={xpReward}
                      onChange={(e) => setXpReward(e.target.value)}
                      required
                      className="bg-white/50 dark:bg-slate-800/50 border-violet-200/30 dark:border-violet-800/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target">
                      Target Count <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="target"
                      type="number"
                      min="1"
                      placeholder="5"
                      value={targetCount}
                      onChange={(e) => setTargetCount(e.target.value)}
                      required
                      className="bg-white/50 dark:bg-slate-800/50 border-violet-200/30 dark:border-violet-800/30"
                    />
                  </div>
                </div>

                {/* Start & End Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start">
                      Start Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="bg-white/50 dark:bg-slate-800/50 border-violet-200/30 dark:border-violet-800/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end">
                      End Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="end"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className="bg-white/50 dark:bg-slate-800/50 border-violet-200/30 dark:border-violet-800/30"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                  disabled={isCreating}
                >
                  {isCreating ? "Creating..." : "Create Challenge"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Active Challenges List */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-white/50 to-white/30 dark:from-slate-900/50 dark:to-slate-900/30 border-violet-200/30 dark:border-violet-800/30 backdrop-blur-sm h-full">
            <CardHeader className="border-b border-violet-200/20 dark:border-violet-800/20">
              <CardTitle className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                <Target className="h-5 w-5" />
                Active Challenges
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-24 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : challenges.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 mb-4">
                    <AlertCircle className="h-8 w-8 text-violet-600 dark:text-violet-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No Active Challenges
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Create your first challenge to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {challenges.map((challenge, index) => (
                    <motion.div
                      key={challenge.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 rounded-xl border border-violet-200/30 dark:border-violet-800/30 bg-white/30 dark:bg-slate-800/30 hover:shadow-md hover:border-violet-300/50 dark:hover:border-violet-700/50 transition-all"
                    >
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-foreground">
                            {challenge.title}
                          </h4>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {challenge.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              {new Date(
                                challenge.start_date
                              ).toLocaleDateString()}{" "}
                              -{" "}
                              {new Date(
                                challenge.end_date
                              ).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-violet-500/20 dark:bg-violet-600/20 text-violet-700 dark:text-violet-300 font-semibold">
                            <Trophy className="h-3.5 w-3.5" />
                            <span>+{challenge.xp_reward} XP</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-violet-200/20 dark:border-violet-800/20">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Type:{" "}
                              <span className="font-medium text-foreground capitalize">
                                {challenge.challenge_type}
                              </span>
                            </span>
                            <span className="text-muted-foreground">
                              Target:{" "}
                              <span className="font-medium text-foreground">
                                {challenge.target_count}
                              </span>
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
        </motion.div>
      </div>
    </div>
  );
}
