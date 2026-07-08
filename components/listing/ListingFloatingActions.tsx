"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Database } from "@/types/supabase";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"];

interface ListingFloatingActionsProps {
  listing: Listing;
}

export function ListingFloatingActions({ listing }: ListingFloatingActionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const actions = [
    {
      icon: "📞",
      label: "Call",
      action: () => window.open(`tel:${listing.phone_number}`),
      color: "bg-green-500 hover:bg-green-600",
      available: !!listing.phone_number
    },
    {
      icon: "📍",
      label: "Directions",
      action: () => {
        const query = encodeURIComponent(listing.address || listing.name || "");
        window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
      },
      color: "bg-blue-500 hover:bg-blue-600",
      available: !!listing.address
    },
    {
      icon: "🌐",
      label: "Website",
      action: () => window.open(listing.website!, '_blank'),
      color: "bg-purple-500 hover:bg-purple-600",
      available: !!listing.website
    },
    {
      icon: "📤",
      label: "Share",
      action: () => {
        if (navigator.share) {
          navigator.share({
            title: listing.name || "Check out this place",
            text: listing.description || "Found this amazing place on Inside Karachi",
            url: window.location.href
          });
        } else {
          navigator.clipboard.writeText(window.location.href);
          // You could show a toast here
        }
      },
      color: "bg-orange-500 hover:bg-orange-600",
      available: true
    }
  ].filter(action => action.available);

  const mainAction = actions[0]; // Primary action (usually call)

  return (
    <div className="fixed bottom-6 right-6 z-40 md:hidden">
      <AnimatePresence>
        {/* Expanded Action Buttons */}
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-20 right-0 space-y-3"
          >
            {actions.slice(1).map((action, index) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, scale: 0, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0, y: 20 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <Button
                  onClick={action.action}
                  className={`w-14 h-14 rounded-full shadow-lg ${action.color} text-white text-xl border-4 border-white hover:scale-110 transition-all duration-300`}
                >
                  {action.icon}
                </Button>
                <div className="absolute right-16 top-1/2 -translate-y-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {action.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Backdrop */}
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 -z-10"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Floating Action Button */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={() => {
            if (actions.length === 1) {
              mainAction?.action();
            } else {
              setIsExpanded(!isExpanded);
            }
          }}
          className={`w-16 h-16 rounded-full shadow-2xl ${
            isExpanded 
              ? 'bg-gray-500 hover:bg-gray-600' 
              : mainAction?.color || 'bg-primary hover:bg-primary/90'
          } text-white text-2xl border-4 border-white transition-all duration-300`}
        >
          {isExpanded ? '✕' : (mainAction?.icon || '📞')}
        </Button>
      </motion.div>

      {/* Action Count Indicator */}
      {actions.length > 1 && !isExpanded && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold border-2 border-white"
        >
          {actions.length}
        </motion.div>
      )}
    </div>
  );
}
