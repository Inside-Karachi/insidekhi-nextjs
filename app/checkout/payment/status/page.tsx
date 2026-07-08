import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

interface PaymentStatusPageProps {
  searchParams: Promise<{
    bookingId: string;
    status?: string;
    message?: string;
  }>;
}

export default async function PaymentStatusPage({
  searchParams,
}: PaymentStatusPageProps) {
  const { bookingId, status: _status, message } = await searchParams;
  const supabase = await createServerSupabase();

  if (!bookingId) {
    redirect("/checkout");
  }

  // Fetch booking
  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", parseInt(bookingId))
    .single();

  if (!booking) {
    return <div>Booking not found</div>;
  }

  // Derive success state from authoritative DB booking state, not URL params
  const isSuccess = booking.payment_status === "paid";

  return (
    <div className="container max-w-md py-20">
      <Card className="border-2 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            {isSuccess ? (
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            ) : (
              <XCircle className="h-16 w-16 text-destructive" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isSuccess ? "Payment Successful" : "Payment Failed"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">
            {isSuccess
              ? `Your booking ${booking.booking_reference} has been confirmed.`
              : message || "There was an issue processing your payment."}
          </p>

          <div className="flex flex-col gap-3">
            <Button
              asChild
              className="w-full"
              variant={isSuccess ? "default" : "outline"}
            >
              <Link href="/dashboard/bookings">View My Bookings</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/">Return to Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
