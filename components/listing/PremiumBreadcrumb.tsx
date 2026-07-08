"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface PremiumBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function PremiumBreadcrumb({ items, className = "" }: PremiumBreadcrumbProps) {
  return (
    <nav className={`py-6 ${className}`} aria-label="Breadcrumb">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.ol
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2 text-sm"
        >
          {/* Home Link */}
          <motion.li
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Link
              href="/"
              className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors duration-200 group"
            >
              <Home className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
              <span className="sr-only">Home</span>
            </Link>
          </motion.li>

          {/* Breadcrumb Items */}
          {items.map((item, index) => (
            <motion.li
              key={item.href}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + (index * 0.1) }}
              className="flex items-center gap-2"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
              {index === items.length - 1 ? (
                <span className="font-medium text-foreground truncate max-w-[200px] lg:max-w-none">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-primary transition-colors duration-200 truncate max-w-[120px] lg:max-w-none"
                >
                  {item.label}
                </Link>
              )}
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </nav>
  );
}
