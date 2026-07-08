"use client";

import { createContext, useContext, useState, ReactNode } from 'react';

interface Deal {
  id: number;
  listing_id: number;
  title: string;
  description: string | null;
  deal_type: string;
  bank_id: number | null;
  discount_value: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  banks?: {
    name: string;
    logo_url: string | null;
  } | null;
}

interface DealsModalContextType {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  openDeals: (data: { deals: Deal[]; businessName: string }) => void;
  deals: Deal[];
  businessName: string;
}

const DealsModalContext = createContext<DealsModalContextType | undefined>(undefined);

export function DealsModalProvider({ children }: { children: ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [businessName, setBusinessName] = useState<string>('');

  const openDeals = ({ deals, businessName }: { deals: Deal[]; businessName: string }) => {
    setDeals(deals);
    setBusinessName(businessName);
    setIsModalOpen(true);
  };

  return (
    <DealsModalContext.Provider value={{
      isModalOpen,
      setIsModalOpen,
      openDeals,
      deals,
      businessName
    }}>
      {children}
    </DealsModalContext.Provider>
  );
}

export function useDealsModal() {
  const context = useContext(DealsModalContext);
  if (context === undefined) {
    throw new Error('useDealsModal must be used within a DealsModalProvider');
  }
  return context;
}
