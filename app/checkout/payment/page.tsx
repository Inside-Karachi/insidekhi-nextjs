"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2,
  ShieldCheck,
  Lock,
  Wallet,
  CreditCard,
  Building2,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GoPayFastForm } from "@/components/checkout/GoPayFastForm";
import { CheckoutSteps } from "@/components/checkout/CheckoutSteps";
import Link from "next/link";

interface Booking {
  id: number;
  booking_reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  payment_status: string;
}

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId =
    searchParams.get("bookingId") || searchParams.get("booking_id");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!bookingId) {
      router.push("/checkout");
      return;
    }

    // Fetch booking data (you'll need to create this API endpoint)
    fetch(`/api/bookings/${bookingId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          router.push("/checkout");
        } else {
          setBooking(data);
        }
      })
      .catch(() => {
        router.push("/checkout");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [bookingId, router]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
        {/* Background */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10"
          aria-hidden
        />
        <div className="animate-pulse text-muted-foreground text-lg">
          Loading payment details...
        </div>
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  // Success State
  if (booking.payment_status === "paid") {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
        {/* Background gradient */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-background to-green-500/10"
          aria-hidden
        />

        {/* Decorative orbs */}
        <motion.div
          animate={{ y: [0, 50, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="hidden sm:block absolute -top-32 -right-32 w-96 h-96 bg-green-500/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden
        />

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="container max-w-md px-4 py-20 text-center space-y-6 relative z-10"
        >
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
            <div className="relative bg-background rounded-full p-2 shadow-xl">
              <CheckCircle2 className="h-20 w-20 text-green-500" />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent">
              Payment Successful!
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg">
              Your booking has been confirmed. Check your email for tickets.
            </p>
            <Badge variant="outline" className="mt-4 font-mono">
              {booking.booking_reference}
            </Badge>
          </div>
          <Button
            asChild
            size="lg"
            className="mt-6 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-600/90 hover:to-green-500/90"
          >
            <Link href="/dashboard/bookings">View My Bookings</Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  // Payment State
  const floatingIcons = [
    { icon: ShieldCheck, delay: 0, position: "top-16 left-4 sm:left-20" },
    { icon: Lock, delay: 2, position: "top-24 right-4 sm:right-32" },
    { icon: Wallet, delay: 4, position: "bottom-32 left-8 sm:left-16" },
    { icon: CreditCard, delay: 1, position: "bottom-24 right-8 sm:right-16" },
    { icon: Building2, delay: 3, position: "top-1/2 left-4 sm:left-12" },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10"
        aria-hidden
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(var(--primary-rgb),0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--primary-rgb),0.02)_1px,transparent_1px)] bg-[size:50px_50px]"
        style={{ "--primary-rgb": "255, 24, 77" } as React.CSSProperties}
        aria-hidden
      />

      {/* Decorative orbs */}
      <motion.div
        animate={{ y: [0, 50, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="hidden sm:block absolute -top-32 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden
      />

      <motion.div
        animate={{ y: [0, -30, 0] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        className="hidden sm:block absolute -bottom-32 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none"
        aria-hidden
      />

      {/* Floating decorative icons */}
      {floatingIcons.map((element, index) => (
        <motion.div
          key={index}
          animate={{
            y: [0, -20, 0],
            rotate: [0, element.icon === ShieldCheck ? 4 : -4, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 5 + element.delay,
            repeat: Infinity,
            ease: "easeInOut",
            delay: element.delay,
          }}
          className={`hidden md:block absolute ${element.position} text-primary/10 pointer-events-none`}
          aria-hidden
        >
          <element.icon className="w-8 h-8" />
        </motion.div>
      ))}

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Content Area */}
        <div className="flex-1 py-6 sm:py-12">
          <div className="container mx-auto px-4 max-w-7xl">
            {/* Progress Steps */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <CheckoutSteps currentStep="payment" />
            </motion.div>

            <div className="max-w-6xl mx-auto">
              {/* Desktop: 2 Column Layout, Mobile: Stack */}
              <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 lg:gap-12">
                {/* Left Column: Order Summary */}
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6 }}
                  className="space-y-6 lg:sticky lg:top-24 lg:self-start"
                >
                  <div className="space-y-2">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                      Complete Your Payment
                    </h1>
                    <p className="text-muted-foreground text-sm sm:text-base">
                      Securely pay using your bank account
                    </p>
                  </div>

                  <Card className="border-0 shadow-2xl bg-background/60 backdrop-blur-xl overflow-hidden ring-1 ring-white/10">
                    <CardHeader className="pb-4 pt-6">
                      <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                        <Wallet className="w-5 h-5 text-primary" />
                        Order Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 pb-6">
                      <div className="space-y-4">
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between py-2">
                            <span className="text-muted-foreground">
                              Customer
                            </span>
                            <span className="font-medium text-right">
                              {booking.customer_name}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between py-2">
                            <span className="text-muted-foreground">Email</span>
                            <span className="font-medium text-right text-xs sm:text-sm truncate max-w-[180px]">
                              {booking.customer_email}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between py-2">
                            <span className="text-muted-foreground">
                              Mobile
                            </span>
                            <span className="font-medium">
                              {booking.customer_phone}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <div className="flex justify-between items-end p-4 bg-primary/5 rounded-xl">
                        <span className="text-muted-foreground font-medium">
                          Total Amount
                        </span>
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground mr-1">
                            PKR
                          </span>
                          <span className="text-2xl sm:text-3xl font-bold text-primary">
                            {booking.total_amount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Trust Badges - Desktop */}
                  <div className="hidden lg:flex gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-green-500" />
                      <span>Bank Level Security</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-green-500" />
                      <span>Encrypted Data</span>
                    </div>
                  </div>
                </motion.div>

                {/* Right Column: Payment Form */}
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="space-y-4"
                >
                  <Card className="border-0 shadow-[0_0_50px_-12px_rgba(0,0,0,0.1)] bg-background/80 backdrop-blur-xl ring-1 ring-primary/10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#ff184d] via-[#ff4d7d] to-[#ff184d]" />

                    <CardHeader className="text-center pb-2 pt-6 sm:pt-8 px-4 sm:px-6">
                      <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <CreditCard className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle className="text-xl sm:text-2xl">
                        Card Payment
                      </CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                        Pay securely with debit or credit card
                      </p>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-6 pt-4">
                      <GoPayFastForm
                        bookingReference={booking.booking_reference}
                        amount={booking.total_amount}
                        customerEmail={booking.customer_email}
                        customerMobile={booking.customer_phone}
                        transactionDescription={`Booking ${booking.booking_reference}`}
                      />
                    </CardContent>
                  </Card>

                  <p className="text-center text-xs text-muted-foreground/70 px-4">
                    By proceeding, you agree to our Terms of Service.
                    <br />
                    Payment processed securely by PayFast.
                  </p>

                  {/* Trust Badges - Mobile */}
                  <div className="flex lg:hidden justify-center gap-4 text-xs text-muted-foreground pt-4">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3 text-green-500" />
                      <span>Secure</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-green-500" />
                      <span>Encrypted</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
