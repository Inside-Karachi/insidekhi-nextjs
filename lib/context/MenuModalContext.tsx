"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { Database } from "@/types/database";

// This type is used by ListingMenu and now also by our context
type MenuSection = Database["public"]["Tables"]["menu_sections"]["Row"] & {
  menu_items: Database["public"]["Tables"]["menu_items"]["Row"][] | null;
};

// This interface defines the data our menu needs
interface MenuData {
  menuSections: MenuSection[];
  restaurantName: string;
  listingId: number;
}

// The new context type includes functions to open/close and the menu data itself
interface MenuModalContextType {
  isOpen: boolean;
  menuData: MenuData | null;
  openMenu: (data: MenuData) => void;
  closeMenu: () => void;
}

const MenuModalContext = createContext<MenuModalContextType | undefined>(
  undefined,
);

export function useMenuModal() {
  const context = useContext(MenuModalContext);
  if (context === undefined) {
    throw new Error("useMenuModal must be used within a MenuModalProvider");
  }
  return context;
}

export function MenuModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuData, setMenuData] = useState<MenuData | null>(null);

  const openMenu = (data: MenuData) => {
    setMenuData(data);
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    // Clear data after animation to prevent content flicker on close
    setTimeout(() => {
      setMenuData(null);
    }, 300);
  };

  return (
    <MenuModalContext.Provider
      value={{ isOpen, menuData, openMenu, closeMenu }}
    >
      {children}
    </MenuModalContext.Provider>
  );
}
