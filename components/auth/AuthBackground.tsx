"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

// Karachi landmark backgrounds with descriptions
export const karachiBackgrounds = [
  {
    id: 1,
    name: "Quaid-e-Azam Mausoleum",
    image: "/assets/auth-backgrounds/mazar-e-quaid.jpg",
    description: "The iconic mausoleum of Pakistan's founder",
    gradient: "from-blue-900/40 via-purple-900/40 to-pink-900/40"
  },
  {
    id: 2,
    name: "Clifton Beach",
    image: "/assets/auth-backgrounds/clifton-beach.jpg",
    description: "Where the city meets the Arabian Sea",
    gradient: "from-orange-900/40 via-red-900/40 to-pink-900/40"
  },
  {
    id: 3,
    name: "Frere Hall",
    image: "/assets/auth-backgrounds/frere-hall.jpg",
    description: "Victorian Gothic heritage in the heart of Karachi",
    gradient: "from-green-900/40 via-emerald-900/40 to-teal-900/40"
  },
  {
    id: 4,
    name: "Port Grand",
    image: "/assets/auth-backgrounds/port-grand.jpg",
    description: "Entertainment and dining by the harbor",
    gradient: "from-indigo-900/40 via-blue-900/40 to-teal-900/40"
  }
];

interface AuthBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthBackground({ children, className = "" }: AuthBackgroundProps) {
  const [currentBg, setCurrentBg] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Rotate backgrounds every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBg((prev) => (prev + 1) % karachiBackgrounds.length);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // Preload images
  useEffect(() => {
    const preloadImages = async () => {
      const imagePromises = karachiBackgrounds.map((bg) => {
        return new Promise((resolve, reject) => {
          const img = new window.Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = bg.image;
        });
      });

      try {
        await Promise.all(imagePromises);
        setIsLoaded(true);
      } catch (error) {
        console.error("Failed to preload images:", error);
        setIsLoaded(true); // Still show the component even if images fail
      }
    };

    preloadImages();
  }, []);

  const currentBackground = karachiBackgrounds[currentBg];

  return (
    <div className={`relative min-h-screen overflow-hidden ${className}`}>
      {/* Background Image with Animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentBackground.id}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <Image
            src={currentBackground.image}
            alt={currentBackground.name}
            fill
            className="object-cover"
            priority={currentBg === 0}
            quality={90}
          />
          
          {/* Gradient Overlay */}
          <div className={`absolute inset-0 bg-gradient-to-br ${currentBackground.gradient}`} />
          
          {/* Dark Overlay for Better Text Readability */}
          <div className="absolute inset-0 bg-black/30" />
        </motion.div>
      </AnimatePresence>

      {/* Floating Elements for Visual Interest */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating Dots */}
        {[
          { left: 15, top: 20, duration: 4, delay: 0 },
          { left: 85, top: 15, duration: 5, delay: 0.5 },
          { left: 25, top: 80, duration: 6, delay: 1 },
          { left: 75, top: 70, duration: 4.5, delay: 1.5 },
          { left: 45, top: 25, duration: 5.5, delay: 0.3 },
          { left: 65, top: 85, duration: 4.2, delay: 0.8 }
        ].map((dot, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white/20 rounded-full"
            style={{
              left: `${dot.left}%`,
              top: `${dot.top}%`,
            }}
            animate={{
              y: [-20, 20, -20],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: dot.duration,
              repeat: Infinity,
              delay: dot.delay,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {children}
      </div>

      {/* Background Info (Optional) */}
      {isLoaded && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="absolute bottom-6 left-6 z-20 text-white/80"
        >
          <p className="text-sm font-medium">{currentBackground.name}</p>
          <p className="text-xs text-white/60">{currentBackground.description}</p>
        </motion.div>
      )}

      {/* Background Indicators */}
      <div className="absolute bottom-6 right-6 z-20 flex space-x-2">
        {karachiBackgrounds.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentBg(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentBg 
                ? "bg-white scale-125" 
                : "bg-white/40 hover:bg-white/60"
            }`}
            aria-label={`Switch to background ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
