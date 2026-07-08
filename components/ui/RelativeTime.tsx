"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

interface RelativeTimeProps {
  date: string | Date;
  addSuffix?: boolean;
  className?: string;
}

export function RelativeTime({
  date,
  addSuffix = true,
  className,
}: RelativeTimeProps) {
  const [mounted, setMounted] = useState(false);
  const [timeString, setTimeString] = useState("");

  useEffect(() => {
    setMounted(true);
    setTimeString(formatDistanceToNow(new Date(date), { addSuffix }));
  }, [date, addSuffix]);

  // Return empty string during SSR to prevent hydration mismatch
  if (!mounted) {
    return <span className={className}></span>;
  }

  return <span className={className}>{timeString}</span>;
}
