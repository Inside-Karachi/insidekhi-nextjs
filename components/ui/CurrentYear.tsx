"use client";

import { useState, useEffect } from "react";

interface CurrentYearProps {
  className?: string;
}

export function CurrentYear({ className }: CurrentYearProps) {
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState("");

  useEffect(() => {
    setMounted(true);
    setYear(new Date().getFullYear().toString());
  }, []);

  // Return empty string during SSR to prevent hydration mismatch
  if (!mounted) {
    return <span className={className}></span>;
  }

  return <span className={className}>{year}</span>;
}
