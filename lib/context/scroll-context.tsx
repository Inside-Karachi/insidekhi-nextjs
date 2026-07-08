"use client";

import { createContext, useState, useContext, ReactNode } from 'react';

interface ScrollContextType {
  isFooterInView: boolean;
  setIsFooterInView: (isInView: boolean) => void;
}

const ScrollContext = createContext<ScrollContextType | undefined>(undefined);

export function ScrollProvider({ children }: { children: ReactNode }) {
  const [isFooterInView, setIsFooterInView] = useState(false);

  return (
    <ScrollContext.Provider value={{ isFooterInView, setIsFooterInView }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScroll() {
  const context = useContext(ScrollContext);
  if (context === undefined) {
    throw new Error('useScroll must be used within a ScrollProvider');
  }
  return context;
}