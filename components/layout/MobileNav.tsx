"use client";

import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { useScroll } from "@/lib/context/scroll-context";
import { BottomNav } from "./BottomNav";
import { FullScreenNav } from "./FullScreenNav";
import { FloatingActionButton } from "./FloatingActionButton";
import { User } from "@supabase/supabase-js";

type NavItem = {
  id: number;
  name: string;
  slug: string;
  categories?: { id: number; name: string; slug: string }[];
};

interface ProfileShape {
  role?: string;
}

interface MobileNavProps {
  categoryNavItems: NavItem[];
  simpleNavLinks: NavItem[];
  user?: User | null;
  profile?: ProfileShape | null;
}

export function MobileNav({
  categoryNavItems,
  simpleNavLinks,
  user,
  profile,
}: MobileNavProps) {
  const [isMenuOpen, setMenuOpen] = React.useState(false);
  const { isFooterInView } = useScroll();

  // New state to handle manually expanding the nav when it's collapsed
  const [isNavForcedOpen, setNavForcedOpen] = React.useState(false);

  const openMenu = () => setMenuOpen(true);
  const closeMenu = () => setMenuOpen(false);

  // If the footer is no longer in view, reset the forced open state
  React.useEffect(() => {
    if (!isFooterInView) {
      setNavForcedOpen(false);
    }
  }, [isFooterInView]);

  // Determine if the full nav should be shown
  const showFullNav = !isFooterInView || isNavForcedOpen;

  // Lock body scroll when the full-screen menu is open
  React.useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isMenuOpen]);

  // Prevent server-side rendering of this client-only logic
  const [isClient, setIsClient] = React.useState(false);
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {showFullNav ? (
          // Render the full BottomNav if the condition is met
          <BottomNav onMenuOpen={openMenu} user={user} profile={profile} />
        ) : (
          // Otherwise, render the FloatingActionButton
          <FloatingActionButton onClick={() => setNavForcedOpen(true)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMenuOpen && (
          <FullScreenNav
            categoryNavItems={categoryNavItems}
            simpleNavLinks={simpleNavLinks}
            onClose={closeMenu}
            user={user}
          />
        )}
      </AnimatePresence>
    </>
  );
}
