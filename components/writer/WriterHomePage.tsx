"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PenSquare, Clock, CheckCircle2, XCircle, FileEdit } from "lucide-react";
import { getPostStatusLabel } from "@/lib/blogs/status-display";
import type { PostStatus } from "@/types/blogs.types";
import { DashboardQuickAccess } from "@/components/dashboard/DashboardQuickAccess";

interface RecentPost {
  id: number;
  title: string;
  slug: string;
  status: PostStatus;
  created_at: string;
}

interface WriterHomePageProps {
  fullName: string | null;
  stats: Record<string, number>;
  recentPosts: RecentPost[];
}

type StatVariant = "blue" | "orange" | "green" | "red";

const statVariantStyles: Record<
  StatVariant,
  { card: string; title: string; value: string; iconWrapper: string; icon: string }
> = {
  blue: {
    card: "bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/5 dark:from-blue-500/10 dark:via-blue-500/5 dark:to-blue-500/0 border-blue-500/30 dark:border-blue-500/20",
    title: "text-sm font-medium text-blue-900 dark:text-blue-100",
    value: "text-2xl font-bold text-blue-700 dark:text-blue-300",
    iconWrapper: "p-2 bg-blue-500/10 rounded-lg",
    icon: "h-4 w-4 text-blue-600 dark:text-blue-400",
  },
  orange: {
    card: "bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-orange-500/5 dark:from-orange-500/10 dark:via-orange-500/5 dark:to-orange-500/0 border-orange-500/30 dark:border-orange-500/20",
    title: "text-sm font-medium text-orange-900 dark:text-orange-100",
    value: "text-2xl font-bold text-orange-700 dark:text-orange-300",
    iconWrapper: "p-2 bg-orange-500/10 rounded-lg",
    icon: "h-4 w-4 text-orange-600 dark:text-orange-400",
  },
  green: {
    card: "bg-gradient-to-br from-green-500/20 via-green-500/10 to-green-500/5 dark:from-green-500/10 dark:via-green-500/5 dark:to-green-500/0 border-green-500/30 dark:border-green-500/20",
    title: "text-sm font-medium text-green-900 dark:text-green-100",
    value: "text-2xl font-bold text-green-700 dark:text-green-300",
    iconWrapper: "p-2 bg-green-500/10 rounded-lg",
    icon: "h-4 w-4 text-green-600 dark:text-green-400",
  },
  red: {
    card: "bg-gradient-to-br from-red-500/20 via-red-500/10 to-red-500/5 dark:from-red-500/10 dark:via-red-500/5 dark:to-red-500/0 border-red-500/30 dark:border-red-500/20",
    title: "text-sm font-medium text-red-900 dark:text-red-100",
    value: "text-2xl font-bold text-red-700 dark:text-red-300",
    iconWrapper: "p-2 bg-red-500/10 rounded-lg",
    icon: "h-4 w-4 text-red-600 dark:text-red-400",
  },
};

function getStatusBadge(status: PostStatus) {
  const config: Record<
    PostStatus,
    { variant: "default" | "secondary" | "destructive"; icon: typeof Clock }
  > = {
    draft: { variant: "secondary", icon: FileEdit },
    pending_approval: { variant: "default", icon: Clock },
    published: { variant: "default", icon: CheckCircle2 },
    rejected: { variant: "destructive", icon: XCircle },
  };
  const { variant, icon: Icon } = config[status] ?? config.draft;
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {getPostStatusLabel(status)}
    </Badge>
  );
}

export function WriterHomePage({ fullName, stats, recentPosts }: WriterHomePageProps) {
  const cards: { key: string; label: string; value: number; color: StatVariant }[] = [
    { key: "draft", label: "Drafts", value: stats.draft ?? 0, color: "blue" },
    {
      key: "pending_approval",
      label: "Under Review",
      value: stats.pending_approval ?? 0,
      color: "orange",
    },
    { key: "published", label: "Published", value: stats.published ?? 0, color: "green" },
    { key: "rejected", label: "Needs Changes", value: stats.rejected ?? 0, color: "red" },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/10 to-primary/5 rounded-full border border-primary/20 mb-4">
          <PenSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">
            Writer Dashboard
          </span>
        </div>
        <h1 className="text-4xl font-bold gradient-text-primary">
          Content Creation Hub
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Welcome back{fullName ? `, ${fullName}` : ""}! Write and manage your guides.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const styles = statVariantStyles[card.color];
          return (
            <motion.div key={card.key} whileHover={{ scale: 1.02 }}>
              <Card className={styles.card}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className={styles.title}>{card.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={styles.value}>{card.value}</div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <DashboardQuickAccess role="writer" />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PenSquare className="h-5 w-5 text-primary" />
            My Posts
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/writer/blogs">View All</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/writer/blogs/new">New Post</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentPosts.length === 0 ? (
            <div className="text-center py-8">
              <PenSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No posts yet</p>
              <Button asChild className="mt-4" variant="outline">
                <Link href="/dashboard/writer/blogs/new">Write Your First Post</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/dashboard/writer/blogs/${post.id}`}
                  className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-lg hover:opacity-80 transition-opacity"
                >
                  <div>
                    <p className="font-medium">{post.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {getStatusBadge(post.status)}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
