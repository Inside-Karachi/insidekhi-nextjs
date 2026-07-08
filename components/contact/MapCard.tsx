"use client";

import { motion } from "framer-motion";
import { MapPin, Navigation, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function MapCard() {
  // Coordinates for Tai Roshan Trade Center (RTC)
  const latitude = 24.8785625;
  const longitude = 67.0674375;
  // Use a simple q=lat,lng embed which doesn't require the pb token
  const embedUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;
  const directionsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;

  return (
    <section className="relative w-full overflow-hidden py-8 lg:py-12">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-background" />
      <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(var(--primary-rgb),0.02)_1px,transparent_1px),linear-gradient(-45deg,rgba(var(--primary-rgb),0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center space-y-4 mb-8 lg:mb-12"
        >
          <Badge className="px-6 py-2 text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
            <MapPin className="w-4 h-4 mr-2" />
            Find Us on the Map
          </Badge>
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">
            Visit Our <span className="gradient-text-primary">Office</span>
          </h2>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
            Located in the heart of Karachi, our office is easily accessible and
            equipped with modern facilities.
          </p>
        </motion.div>

        {/* Map Container */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative max-w-6xl mx-auto"
        >
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-3xl blur-lg sm:blur-xl group-hover:blur-2xl transition-all duration-300" />

            {/* Map Container */}
            <div className="relative overflow-hidden rounded-3xl bg-background/80 backdrop-blur-xl border border-border/50 shadow-premium-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 rounded-3xl" />

              {/* Map */}
              <div className="relative w-full h-64 sm:h-80 md:h-96 lg:h-[28rem] bg-muted/10">
                <iframe
                  src={embedUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="block w-full h-full rounded-3xl"
                  title="Inside Karachi - Office location"
                />
              </div>

              {/* Map Overlay Info */}
              <div className="absolute top-4 left-4 right-4 z-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Office Info Card */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="bg-background/90 backdrop-blur-xl border border-border/50 rounded-2xl p-4 shadow-premium max-w-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base">
                          Inside Karachi HQ
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                          Office #703, Roshan Trade Center
                          <br />
                          Bahadurabad, Karachi
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Action Buttons */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="flex gap-2"
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        asChild
                        size="sm"
                        className="h-9 px-3 bg-primary/90 hover:bg-primary text-primary-foreground rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group text-xs sm:text-sm"
                      >
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Navigation className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 group-hover:rotate-12 transition-transform duration-200" />
                          <span className="hidden sm:inline">Get </span>
                          Directions
                        </a>
                      </Button>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 bg-background/90 backdrop-blur-xl border-border/50 hover:bg-background rounded-xl shadow-lg transition-all duration-300 text-xs sm:text-sm"
                      >
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">View in </span>Maps
                        </a>
                      </Button>
                    </motion.div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
