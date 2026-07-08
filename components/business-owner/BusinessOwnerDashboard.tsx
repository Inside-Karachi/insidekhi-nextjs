"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User } from "@supabase/supabase-js";
import {
  Store,
  TrendingUp,
  Eye,
  Star,
  Clock,
  AlertCircle,
  Plus,
  BarChart3,
} from "lucide-react";
import { PremiumStatCard } from "@/components/admin/PremiumStatCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusinessStats } from "@/hooks/useBusinessStats";
import { useBusinessListings } from "@/hooks/useBusinessListings";
import { BusinessOwnerListingModal } from "./BusinessOwnerListingModal";
import { ListingEditorDialog } from "./ListingEditorDialog";
import Link from "next/link";
import { getListingStatusLabel } from "@/lib/listings/status-display";
import { cn } from "@/lib/utils";
import {
  BusinessOwnerPageHeader,
  BUSINESS_OWNER_CARD_SURFACE,
  BUSINESS_OWNER_EMPTY_STATE,
} from "./BusinessOwnerPageHeader";

interface BusinessOwnerDashboardProps {
  user: User;
  profile: {
    full_name?: string | null;
    role?: string;
  } | null;
}

export function BusinessOwnerDashboard({
  user,
  profile,
}: BusinessOwnerDashboardProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingListingId, setEditingListingId] = useState<number | null>(null);
  const { stats, loading: statsLoading } = useBusinessStats();
  const {
    listings,
    loading: listingsLoading,
    refetch,
  } = useBusinessListings({
    limit: 5,
  });

  const displayName =
    profile?.full_name || user.email?.split("@")[0] || "Business Owner";

  return (
    <div className="w-full">
      <BusinessOwnerPageHeader
        icon={Store}
        title={`Welcome back, ${displayName}`}
        description="Manage your listings and track your business performance"
      />

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-wrap gap-3 mb-8"
      >
        <Button
          size="lg"
          className="gap-2"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add New Listing
        </Button>
        <Button asChild size="lg" variant="outline" className="gap-2">
          <Link href="/dashboard/business/analytics">
            <BarChart3 className="h-4 w-4" />
            View Analytics
          </Link>
        </Button>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        {statsLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i} className={cn("p-6", BUSINESS_OWNER_CARD_SURFACE)}>
                <Skeleton className="h-16 w-full" />
              </Card>
            ))}
          </>
        ) : (
          <>
            <PremiumStatCard
              title="Total Listings"
              value={stats?.total_listings || 0}
              icon={Store}
              color="blue"
              delay={0.1}
            />
            <PremiumStatCard
              title="Active Listings"
              value={stats?.active_listings || 0}
              icon={TrendingUp}
              color="green"
              delay={0.2}
            />
            <PremiumStatCard
              title="Total Views (30d)"
              value={stats?.total_views_30d.toLocaleString() || 0}
              icon={Eye}
              color="purple"
              delay={0.3}
            />
            <PremiumStatCard
              title="Avg Rating"
              value={stats?.avg_rating.toFixed(1) || "N/A"}
              icon={Star}
              color="orange"
              delay={0.4}
              trend={
                stats && stats.total_reviews > 0
                  ? {
                      value: stats.total_reviews,
                      label: `${stats.total_reviews} reviews`,
                      isPositive: true,
                    }
                  : undefined
              }
            />
          </>
        )}
      </motion.div>

      {/* Alerts Section */}
      {!statsLoading &&
        stats &&
        (stats.pending_approvals > 0 || stats.overdue_change_requests > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-8"
          >
            <Card className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] dark:bg-amber-500/10 backdrop-blur-sm p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-2">
                    Attention Required
                  </h3>
                  <ul className="space-y-1 text-sm text-orange-800 dark:text-orange-200">
                    {stats.pending_approvals > 0 && (
                      <li>
                        • {stats.pending_approvals} listing
                        {stats.pending_approvals > 1 ? "s" : ""} pending admin
                        approval
                      </li>
                    )}
                    {stats.overdue_change_requests > 0 && (
                      <li>
                        • {stats.overdue_change_requests} change request
                        {stats.overdue_change_requests > 1 ? "s" : ""} overdue
                      </li>
                    )}
                  </ul>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-4 border-orange-300 dark:border-orange-700"
                  >
                    <Link href="/dashboard/business/change-requests">
                      View Requests
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

      {/* Recent Listings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            Your Listings
          </h2>
          <Button asChild variant="outline">
            <Link href="/dashboard/business/listings">View All</Link>
          </Button>
        </div>

        {listingsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className={cn("p-6", BUSINESS_OWNER_CARD_SURFACE)}>
                <Skeleton className="h-32 w-full" />
              </Card>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className={BUSINESS_OWNER_EMPTY_STATE}>
            <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-6">
              <Store className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-3">
              No listings yet
            </h3>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Create your first listing to appear on Inside Karachi and start
              tracking views and reviews.
            </p>
            <Button size="lg" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first listing
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <Card
                key={listing.id}
                className={cn("p-6 group", BUSINESS_OWNER_CARD_SURFACE)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                      {listing.name}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        listing.status === "published"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                          : listing.status === "draft"
                            ? "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                      }`}
                    >
                      {getListingStatusLabel(listing.status)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span>{listing.total_views.toLocaleString()} views</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>
                      {listing.avg_rating.toFixed(1)} ({listing.total_reviews})
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditingListingId(listing.id)}
                  >
                    Edit
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="flex-1">
                    <Link href={`/listing/${listing.slug}`} target="_blank">
                      View
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </motion.div>

      {/* Performance Tip */}
      {!statsLoading && stats && stats.total_listings > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8"
        >
          <Card className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-background/80 to-primary/[0.04] backdrop-blur-sm p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <Clock className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Performance Tip</h3>
                <p className="text-sm text-muted-foreground">
                  Keep your listings updated with fresh photos and accurate
                  information to improve visibility. Listings with complete
                  details get 3x more views!
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Create Listing Modal */}
      <BusinessOwnerListingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          refetch();
        }}
      />

      {/* Edit Listing Dialog */}
      {editingListingId && (
        <ListingEditorDialog
          listingId={editingListingId}
          onClose={() => {
            setEditingListingId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
