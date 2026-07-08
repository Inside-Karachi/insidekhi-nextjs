"use client";

import { ReactNode } from "react";
import {
  MenuModalProvider,
  useMenuModal,
} from "@/lib/context/MenuModalContext";
import {
  DealsModalProvider,
  useDealsModal,
} from "@/lib/context/DealsModalContext";
import { BranchSelectionProvider } from "@/lib/context/BranchSelectionContext";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { PremiumMenuModal } from "./PremiumMenuModal";
import { FullScreenMenu } from "./FullScreenMenu";
import { PremiumDealsModal } from "./PremiumDealsModal";
import { FullScreenDeals } from "./FullScreenDeals";

// A new inner component that will consume the context.
// This is necessary because a component cannot consume a context that it provides.
function MenuRenderer({ children }: { children: ReactNode }) {
  const { isOpen: menuIsOpen, menuData, closeMenu } = useMenuModal();
  const {
    isModalOpen: dealsIsOpen,
    deals,
    businessName,
    setIsModalOpen: closeDeals,
  } = useDealsModal();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  return (
    <>
      {children}

      {/* Menu Modal Logic */}
      {menuData &&
        (isDesktop ? (
          <PremiumMenuModal
            isOpen={menuIsOpen}
            onClose={closeMenu}
            menuSections={menuData.menuSections}
            restaurantName={menuData.restaurantName}
          />
        ) : (
          <FullScreenMenu
            isOpen={menuIsOpen}
            onClose={closeMenu}
            menuSections={menuData.menuSections}
            restaurantName={menuData.restaurantName}
          />
        ))}

      {/* Deals Modal Logic */}
      {isDesktop ? (
        <PremiumDealsModal
          isOpen={dealsIsOpen}
          onClose={() => closeDeals(false)}
          deals={deals}
          businessName={businessName}
        />
      ) : (
        <FullScreenDeals
          isOpen={dealsIsOpen}
          onClose={() => closeDeals(false)}
          deals={deals}
          businessName={businessName}
        />
      )}
    </>
  );
}

// The exported wrapper now composes all Providers and Renderer
export function ListingPageWrapper({ children }: { children: ReactNode }) {
  return (
    <BranchSelectionProvider>
      <MenuModalProvider>
        <DealsModalProvider>
          <MenuRenderer>{children}</MenuRenderer>
        </DealsModalProvider>
      </MenuModalProvider>
    </BranchSelectionProvider>
  );
}
