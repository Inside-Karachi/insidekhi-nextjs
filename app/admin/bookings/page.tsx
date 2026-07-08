import { AdminBookingsManagement } from "@/components/admin/BookingsManagement";
import { Ticket } from "lucide-react";

export const metadata = {
  title: "Bookings Management | Admin | Inside Karachi",
  description: "Manage event bookings and payments",
};

export default function AdminBookingsPage() {
  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-8">
      {/* Header - matching other admin pages */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-blue-500/10 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Ticket className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Bookings Management
              </h1>
              <p className="text-muted-foreground mt-1">
                View and manage all event bookings, payments, and ticket passes
              </p>
            </div>
          </div>
        </div>
      </div>

      <AdminBookingsManagement />
    </div>
  );
}
