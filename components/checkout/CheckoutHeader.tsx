"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

export function CheckoutHeader() {
    return (
        <div className="flex flex-col items-center text-center space-y-6 mb-12">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium ring-1 ring-primary/20 backdrop-blur-sm"
            >
                <ShieldCheck className="w-4 h-4" />
                <span>Secure Checkout</span>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                className="space-y-4 max-w-2xl px-4 sm:px-0"
            >
                <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                    Finalize Your <span className="text-primary">Experience</span>
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
                    Review your order details and complete your purchase securely.
                    You&apos;re just a few steps away.
                </p>
            </motion.div>
        </div>
    );
}
