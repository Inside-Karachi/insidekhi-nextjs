import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  TrendingUp,
  Eye,
  Clock,
  CheckCircle,
  Edit,
  BarChart3,
} from "lucide-react";

// Import centralized types
import type { WriterDashboardProps } from "@/types/dashboard.types";

export function WriterDashboard({
  user,
  profile,
  dashboardData,
}: WriterDashboardProps) {
  const { statistics, recentActivity } = dashboardData;

  return (
    <div className="space-y-8">
      {/* Writer Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-full border border-emerald-200/20 mb-4">
          <FileText className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Writer Dashboard
          </span>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
          Content Creation Hub
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Welcome back, {profile?.full_name || user.email}! Track your content
          performance and create amazing stories.
        </p>
      </div>

      {/* Content Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Events</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalEvents}</div>
            <p className="text-xs text-muted-foreground">Events created</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statistics.publishedEvents}
            </div>
            <p className="text-xs text-muted-foreground">Live events</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12.5K</div>
            <p className="text-xs text-muted-foreground">Event page views</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Review
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {statistics.totalEvents - statistics.publishedEvents}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-500" />
              Create Event
            </CardTitle>
            <CardDescription>
              Write and publish new event content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline">
              New Event
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              Performance
            </CardTitle>
            <CardDescription>
              View your content analytics and engagement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline">
              View Analytics
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Trending Topics
            </CardTitle>
            <CardDescription>
              Discover popular topics and trends
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline">
              Explore Trends
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* My Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Events */}
        <Card className="glass-card border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-500" />
              My Events
            </CardTitle>
            <CardDescription>
              Your created events and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.events?.slice(0, 4).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{event.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        event.status === "published" ? "default" : "secondary"
                      }
                    >
                      {event.status}
                    </Badge>
                    <Button size="sm" variant="ghost">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )) || (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No events created yet</p>
                  <Button className="mt-4" variant="outline">
                    Create Your First Event
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Writing Insights */}
        <Card className="glass-card border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Writing Insights
            </CardTitle>
            <CardDescription>
              Your content performance and engagement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">
                    Most Popular Event
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    &ldquo;Karachi Food Festival 2024&rdquo;
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">2.3K views</p>
                  <p className="text-xs text-blue-500">+15% this week</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Engagement Rate
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Average across all events
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">8.7%</p>
                  <p className="text-xs text-green-500">+2.1% this month</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
                <div>
                  <p className="font-medium text-purple-800 dark:text-purple-200">
                    Total Reach
                  </p>
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    Combined audience
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-purple-600">15.2K</p>
                  <p className="text-xs text-purple-500">+8% this week</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
