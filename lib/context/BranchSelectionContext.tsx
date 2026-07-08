"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface BranchSelectionContextType {
  selectedBranchId: number | null;
  setSelectedBranchId: (branchId: number | null) => void;
}

const BranchSelectionContext = createContext<
  BranchSelectionContextType | undefined
>(undefined);

export function BranchSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  return (
    <BranchSelectionContext.Provider
      value={{ selectedBranchId, setSelectedBranchId }}
    >
      {children}
    </BranchSelectionContext.Provider>
  );
}

export function useBranchSelection() {
  const context = useContext(BranchSelectionContext);
  if (context === undefined) {
    throw new Error(
      "useBranchSelection must be used within BranchSelectionProvider",
    );
  }
  return context;
}
