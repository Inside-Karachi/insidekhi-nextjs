"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import LoaderBar from "@/components/ui/LoaderBar";

/**
 * RouteProgress - SIMPLE & CORRECT implementation
 *
 * How it works:
 * 1. Show loader immediately when user clicks a link
 * 2. Hide loader when pathname/searchParams change (navigation complete)
 *
 * That's it. No arbitrary timeouts. Just react to actual events.
 */
export default function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const lastPathRef = useRef<string>("");
  const lastSearchRef = useRef<string>("");
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigationStartedRef = useRef<boolean>(false);

  // Compute a navigation key from pathname + searchParams
  const currentSearch = searchParams?.toString() || "";
  const navKey = `${pathname}?${currentSearch}`;

  // Hide loader with a tiny delay to avoid flicker
  const hideLoader = () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setActive(false);
      navigationStartedRef.current = false;
    }, 100);
  };

  // Show loader immediately
  const showLoader = () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    navigationStartedRef.current = true;
    setActive(true);
  };

  // Listen for link clicks to show loader immediately
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Ignore non-left clicks and modified clicks
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Check if clicked on or inside a link
      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const targetAttr = anchor.getAttribute("target");
      const rel = anchor.getAttribute("rel") || "";
      const isDownload = anchor.hasAttribute("download");

      // Skip external links, downloads, new tabs
      const isExternal =
        !!targetAttr ||
        rel.includes("external") ||
        (href && /^(https?:)?\/\//i.test(href)) ||
        (href && href.startsWith("mailto:"));

      if (isExternal || isDownload) return;
      if (!href || href.startsWith("#")) return;

      // Skip if clicking same page
      if (href === pathname || href === navKey) return;

      // Show loader for internal navigation
      showLoader();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, navKey]);

  // Hide loader when pathname or searchParams change
  useEffect(() => {
    const pathChanged = pathname !== lastPathRef.current;
    const searchChanged = currentSearch !== lastSearchRef.current;

    // Update refs
    lastPathRef.current = pathname;
    lastSearchRef.current = currentSearch;

    // If navigation was in progress and path changed, hide loader
    if (navigationStartedRef.current && (pathChanged || searchChanged)) {
      hideLoader();
    }
  }, [pathname, currentSearch]);

  // Toggle body class while navigating
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (active) {
      root.classList.add("is-navigating");
      root.setAttribute("aria-busy", "true");
    } else {
      root.classList.remove("is-navigating");
      root.removeAttribute("aria-busy");
    }

    return () => {
      root.classList.remove("is-navigating");
      root.removeAttribute("aria-busy");
    };
  }, [active]);

  return (
    <>
      <LoaderBar active={active} />
      <AnimatePresence>
        {active && (
          <motion.div
            aria-hidden
            className="fixed inset-0 z-[9999] pointer-events-auto select-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {/* Subtle dim overlay */}
            <div className="absolute inset-0 bg-background/50 dark:bg-black/40" />
            {/* Top gradient for loader visibility */}
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background/70 to-transparent" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
