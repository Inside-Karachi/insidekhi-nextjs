"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/context/cartStore";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowRight, ShoppingBag, AlertCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { OrderSummary } from "./OrderSummary";
import { BuyerDetailsForm } from "./BuyerDetailsForm";
import { GuestDetailsForm } from "./GuestDetailsForm";
import { useToast } from "@/hooks/use-toast";
import { CheckoutSteps } from "./CheckoutSteps";
import { createClient } from "@/lib/supabase/client";

export function CheckoutClient() {
  const router = useRouter();
  const { items, updateGuestInfo, clearCart } = useCartStore();
  const { user, isLoading: isUserLoading } = useSupabaseUser();
  const { toast } = useToast();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventDetails, setEventDetails] = useState<
    Record<number, { require_guest_details: boolean }>
  >({});
  const [existingBooking, setExistingBooking] = useState<{
    id: number;
    booking_reference: string;
    total_amount: number;
  } | null>(null);

  const [buyerDetails, setBuyerDetails] = useState({
    name: "",
    email: "",
    phone: "",
    cnic: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch Config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/system/config");
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
        }
      } catch (error) {
        console.error("Failed to load config", error);
      } finally {
        setIsLoadingConfig(false);
      }
    };
    fetchConfig();
  }, []);

  // Fetch Event Details (for guest requirements)
  useEffect(() => {
    const fetchEvents = async () => {
      const eventIds = Array.from(new Set(items.map((i) => i.eventId)));
      if (eventIds.length === 0) return;

      const { data } = await supabase
        .from("events")
        .select("id, require_guest_details")
        .in("id", eventIds);

      if (data) {
        const map = (
          data as unknown as { id: number; require_guest_details: boolean }[]
        ).reduce(
          (acc: Record<number, { require_guest_details: boolean }>, e) => ({
            ...acc,
            [e.id]: e,
          }),
          {}
        );
        setEventDetails(map);
      }
    };
    fetchEvents();
  }, [items, supabase]);

  // Check for existing pending bookings for the same event (only once on mount)
  const hasCheckedExistingBookings = useRef(false);
  useEffect(() => {
    const checkExistingBookings = async () => {
      if (!user || items.length === 0 || hasCheckedExistingBookings.current)
        return;
      hasCheckedExistingBookings.current = true;

      const eventIds = Array.from(new Set(items.map((i) => i.eventId)));

      const { data: pendingBookings } = await supabase
        .from("bookings")
        .select("id, booking_reference, total_amount, event_id, expires_at")
        .eq("user_id", user.id)
        .in("event_id", eventIds)
        .in("payment_status", ["awaiting_payment", "pending"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (pendingBookings && pendingBookings.length > 0) {
        const booking = pendingBookings[0];
        // Check if booking is not expired and has valid reference
        if (
          booking.booking_reference &&
          (!booking.expires_at || new Date(booking.expires_at) > new Date())
        ) {
          setExistingBooking({
            id: booking.id,
            booking_reference: booking.booking_reference,
            total_amount: booking.total_amount,
          });
        }
      }
    };

    checkExistingBookings();
  }, [user, items, supabase]);

  // Prefill User Details
  useEffect(() => {
    if (user) {
      setBuyerDetails((prev) => ({
        ...prev,
        name: user.user_metadata?.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
      }));
    }
  }, [user]);

  // Redirect if cart is empty
  useEffect(() => {
    if (!isLoadingConfig && items.length === 0) {
      // router.push("/events"); // Uncomment to redirect
    }
  }, [items, isLoadingConfig, router]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    // Buyer Validation
    if (!buyerDetails.name.trim()) newErrors.buyerName = "Name is required";
    if (!buyerDetails.email.trim()) newErrors.buyerEmail = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerDetails.email))
      newErrors.buyerEmail = "Invalid email format";
    if (!buyerDetails.phone.trim()) newErrors.buyerPhone = "Phone is required";

    // CNIC is required for buyer
    if (!buyerDetails.cnic?.trim()) {
      newErrors.buyerCnic = "CNIC is required";
    } else if (buyerDetails.cnic.length < 13) {
      newErrors.buyerCnic = "Invalid CNIC";
    }

    // Guest Validation
    items.forEach((item) => {
      const event = eventDetails[item.eventId];
      const systemRequire = config?.["ticketing.require_guest_details"];

      // Determine if guests are required
      const isRequired =
        systemRequire === "always" ||
        (systemRequire === "per_event" && event?.require_guest_details);

      if (isRequired) {
        for (let i = 0; i < item.quantity; i++) {
          const guest = item.guestInfo[i];
          if (!guest?.name?.trim()) {
            newErrors[`guest-${item.ticketTypeId}-${i}-name`] =
              "Name is required";
          }
          if (!guest?.cnic?.trim()) {
            newErrors[`guest-${item.ticketTypeId}-${i}-cnic`] =
              "CNIC is required";
          } else if (guest.cnic.length < 13) {
            newErrors[`guest-${item.ticketTypeId}-${i}-cnic`] = "Invalid CNIC";
          }
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      isValid = false;
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
    } else {
      setErrors({});
    }

    return isValid;
  };

  const handleProceed = async () => {
    // 1. Check Auth
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to complete your purchase.",
      });
      // Redirect to login with return URL
      const returnUrl = encodeURIComponent("/checkout");
      router.push(`/login?next=${returnUrl}`);
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // 2. Create Booking via API
      const response = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerDetails,
          items,
          fees: {
            platformFeeFixed: Number(config?.["fees.platform_fee_fixed"] || 0),
            platformFeePercentage: Number(
              config?.["fees.platform_fee_percentage"] || 0
            ),
            paymentFeeFixed: Number(
              config?.["fees.payment_processing_fee_fixed"] || 0
            ),
            paymentFeePercentage: Number(
              config?.["fees.payment_processing_fee_percentage"] || 0
            ),
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create booking");
      }

      // 3. Clear cart and redirect to payment
      clearCart();
      router.push(`/checkout/payment?bookingId=${result.bookingId}`);
    } catch (error: unknown) {
      console.error("Booking error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingConfig || isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show existing booking prompt
  if (existingBooking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10 w-full max-w-lg p-0 sm:p-4"
        >
          <Card className="border-white/10 dark:border-white/10 shadow-2xl bg-white/40 dark:bg-black/40 backdrop-blur-md overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
            {/* Top Gradient Accent */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500/40 via-amber-500 to-amber-500/40" />

            <CardContent className="px-5 pb-6 pt-8 sm:px-8 sm:pt-10 sm:pb-8 space-y-6 sm:space-y-8">
              {/* Header Section */}
              <div className="flex flex-col items-center text-center space-y-4 sm:space-y-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full" />
                  <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 ring-1 ring-amber-500/20 flex items-center justify-center shadow-lg">
                    <AlertCircle className="h-7 w-7 sm:h-8 sm:w-8 text-amber-500" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    Pending Booking Found
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-[90%] sm:max-w-[85%] mx-auto">
                    We found an incomplete booking for this event. You can resume your payment securely or start fresh.
                  </p>
                </div>
              </div>

              {/* Booking Details Card */}
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="group relative overflow-hidden rounded-xl border border-border/50 bg-muted/30 p-4 sm:p-5 transition-all duration-300 hover:border-amber-500/30 hover:bg-muted/50"
              >
                {/* Subtle pattern overlay */}
                <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

                <div className="relative z-10 flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-6">
                  <div className="flex items-center justify-between sm:block sm:space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Reference ID
                    </span>
                    <p className="font-mono text-sm sm:text-base font-bold text-foreground">
                      {existingBooking.booking_reference}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:block sm:space-y-1.5 sm:text-right">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Total Amount
                    </span>
                    <p className="font-bold text-base sm:text-lg text-primary">
                      PKR {existingBooking.total_amount.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="relative z-10 mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                  {existingBooking.id && (
                    <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-500">
                      <Clock className="w-3.5 h-3.5" />
                      Awaiting Payment
                    </div>
                  )}
                  {/* Decorative dot */}
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                </div>
              </motion.div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  className="flex-1 h-11 text-base bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/20 border-0 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/40 hover:-translate-y-0.5"
                  onClick={() => {
                    router.push(
                      `/checkout/payment?bookingId=${existingBooking.id}`
                    );
                  }}
                >
                  Resume Payment
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  className="flex-1 h-11 text-base bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20 border-0 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                  onClick={() => setExistingBooking(null)}
                >
                  Create New Booking
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-4 rounded-full bg-muted">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold">Your cart is empty</h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          Looks like you haven&apos;t added any tickets yet.
        </p>
        <Button onClick={() => router.push("/events")}>Browse Events</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CheckoutSteps currentStep="details" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Forms */}
        <div className="lg:col-span-8 space-y-8">
          {/* Buyer Details */}
          <Card className="border-2 border-primary/10 shadow-sm">
            <CardContent className="pt-6">
              <BuyerDetailsForm
                values={buyerDetails}
                onChange={(field, value) =>
                  setBuyerDetails((prev) => ({ ...prev, [field]: value }))
                }
                errors={{
                  name: errors.buyerName,
                  email: errors.buyerEmail,
                  phone: errors.buyerPhone,
                  cnic: errors.buyerCnic,
                }}
                readOnly={false}
              />
            </CardContent>
          </Card>

          {/* Guest Details */}
          {items.map((item) => {
            const event = eventDetails[item.eventId];
            const systemRequire = config?.["ticketing.require_guest_details"];
            const isRequired =
              systemRequire === "always" ||
              (systemRequire === "per_event" && event?.require_guest_details);

            if (!isRequired) return null;

            return (
              <Card
                key={item.ticketTypeId}
                className="border-2 border-primary/10 shadow-sm"
              >
                <CardContent className="pt-6 space-y-6">
                  <h3 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {item.ticketName} - Guest Details
                  </h3>
                  <div className="space-y-6">
                    {Array.from({ length: item.quantity }).map((_, idx) => (
                      <GuestDetailsForm
                        key={`${item.ticketTypeId}-${idx}`}
                        item={item}
                        index={idx}
                        onChange={(field, value) =>
                          updateGuestInfo(item.ticketTypeId, idx, {
                            [field]: value,
                          })
                        }
                        errors={{
                          name: errors[
                            `guest-${item.ticketTypeId}-${idx}-name`
                          ],
                          cnic: errors[
                            `guest-${item.ticketTypeId}-${idx}-cnic`
                          ],
                        }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-24 space-y-6 h-fit">
            <OrderSummary
              items={items}
              platformFeeFixed={Number(
                config?.["fees.platform_fee_fixed"] || 0
              )}
              platformFeePercentage={Number(
                config?.["fees.platform_fee_percentage"] || 0
              )}
              paymentFeeFixed={Number(
                config?.["fees.payment_processing_fee_fixed"] || 0
              )}
              paymentFeePercentage={Number(
                config?.["fees.payment_processing_fee_percentage"] || 0
              )}
            >
              <div className="space-y-4 pt-4">
                <Button
                  className="w-full text-lg py-6 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30"
                  size="lg"
                  onClick={handleProceed}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating Booking...
                    </>
                  ) : (
                    <>
                      Confirm & Continue
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By proceeding, you agree to our Terms of Service and Privacy
                  Policy.
                </p>
              </div>
            </OrderSummary>
          </div>
        </div>
      </div>
    </div>
  );
}
