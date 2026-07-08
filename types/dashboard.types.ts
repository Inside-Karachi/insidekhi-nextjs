import { Database } from "./supabase";
import type { FormsOverviewData } from "./form.types";

// User and Profile Types from Supabase
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type User = {
  id: string;
  email?: string;
};

// Dashboard-specific types
export interface DashboardStatistics {
  totalUsers: number;
  activeUsers: number;
  totalEvents: number;
  publishedEvents: number;
  totalListings: number;
  activeListings: number;
  totalReviews: number;
  pendingReviews: number;
  // Comment statistics
  totalComments: number;
  pendingComments: number;
  approvedComments: number;
  rejectedComments: number;
  flaggedComments: number;
}

export interface RecentUser {
  id: string;
  full_name: string | null;
  created_at: string;
  role: Database["public"]["Enums"]["user_role"];
  avatar_url: string | null;
}

export interface RecentEvent {
  id: number;
  name: string;
  created_at: string;
  status: string;
}

export interface RecentListing {
  id: number;
  name: string;
  created_at: string;
  status: string;
}

export interface RecentActivity {
  users: RecentUser[];
  events: RecentEvent[];
  listings: RecentListing[];
}

export interface GrowthMetrics {
  usersThisMonth: number;
  eventsThisMonth: number;
  listingsThisMonth: number;
  usersThisWeek?: number;
  eventsThisWeek?: number;
  listingsThisWeek?: number;
}

// Dashboard Component Props
export interface BaseDashboardProps {
  user: User;
  profile: Profile | null;
  dashboardData: {
    statistics: DashboardStatistics;
    recentActivity: RecentActivity;
    forms?: FormsOverviewData;
  };
}

// Type aliases for dashboard components (can be extended later if needed)
export type SuperAdminDashboardProps = BaseDashboardProps;
export type AdminDashboardProps = BaseDashboardProps;
export type WriterDashboardProps = BaseDashboardProps;
export type ListerDashboardProps = BaseDashboardProps;

// Dashboard Data Types
export interface DashboardData {
  statistics: DashboardStatistics;
  recentActivity: RecentActivity;
  growthMetrics?: GrowthMetrics;
  forms?: FormsOverviewData;
}
