"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Filter, Calendar, MapPin, Search, X } from "lucide-react";

interface EventsFiltersProps {
  initialSearch?: string | null;
  initialLocation?: string | null;
  initialDate?: string | null;
}

export default function EventsFilters({
  initialSearch,
  initialLocation,
  initialDate,
}: EventsFiltersProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [openDate, setOpenDate] = useState(false);
  const [search, setSearch] = useState(initialSearch ?? "");
  const [location, setLocation] = useState(initialLocation ?? "");
  const [date, setDate] = useState(initialDate ?? "");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const datePanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSearch(initialSearch ?? "");
    setLocation(initialLocation ?? "");
    setDate(initialDate ?? "");
  }, [initialSearch, initialLocation, initialDate]);

  // Close on Escape or click outside
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (
        open &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }

      if (
        openDate &&
        datePanelRef.current &&
        !datePanelRef.current.contains(e.target as Node)
      ) {
        setOpenDate(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, openDate]);

  const applyFilters = () => {
    const url = new URL(window.location.href);
    const sp = url.searchParams;
    // sanitize & set
    if (search && search.trim().length > 0) sp.set("search", search.trim());
    else sp.delete("search");

    if (location && location.trim().length > 0)
      sp.set("location", location.trim());
    else sp.delete("location");

    if (date && date.trim().length > 0) sp.set("date", date.trim());
    else sp.delete("date");

    // push new route
    router.push(url.pathname + "?" + sp.toString());
    setOpen(false);
  };

  const resetFilters = () => {
    setSearch("");
    setLocation("");
    setDate("");
    const url = new URL(window.location.href);
    const sp = url.searchParams;
    sp.delete("search");
    sp.delete("location");
    sp.delete("date");
    router.push(url.pathname + (sp.toString() ? "?" + sp.toString() : ""));
    setOpen(false);
  };

  const openFor = () => setOpen(true);
  const openDateOnly = () => setOpenDate(true);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        className="border-primary/20 hover:bg-primary/5 dark:hover:bg-primary/10"
        onClick={() => openFor()}
      >
        <Filter className="w-4 h-4 mr-2" />
        Filter
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="border-primary/20 hover:bg-primary/5 dark:hover:bg-primary/10"
        onClick={() => openDateOnly()}
      >
        <Calendar className="w-4 h-4 mr-2" />
        Date
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <div
            ref={panelRef}
            className="ml-auto w-full sm:w-96 md:w-[420px] bg-background/60 glass-card p-6 rounded-2xl shadow-premium z-60 m-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold">Refine Events</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  className="p-2"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <div className="text-sm font-medium mb-1">Search</div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Event name or keyword"
                    className="w-full pl-10 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </label>

              <label className="block">
                <div className="text-sm font-medium mb-1">Location</div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                  </span>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, area or venue"
                    className="w-full pl-10 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </label>

              <label className="block">
                <div className="text-sm font-medium mb-1">Date</div>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pr-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={resetFilters}
                className="text-sm"
              >
                Reset
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setOpen(false)}
                  className="text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={applyFilters}
                  className="bg-primary text-primary-foreground"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date-only popover/modal */}
      {openDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

          <div
            ref={datePanelRef}
            className="w-full max-w-sm bg-background/60 glass-card p-6 rounded-2xl shadow-premium z-60 m-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold">Pick a Date</h3>
              <Button
                variant="ghost"
                onClick={() => setOpenDate(false)}
                className="p-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <div className="text-sm font-medium mb-1">Date</div>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pr-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => {
                  setDate("");
                  const u = new URL(window.location.href);
                  u.searchParams.delete("date");
                  router.push(
                    u.pathname +
                      (u.searchParams.toString()
                        ? "?" + u.searchParams.toString()
                        : "")
                  );
                  setOpenDate(false);
                }}
                className="text-sm"
              >
                Reset
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setOpenDate(false)}
                  className="text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const u = new URL(window.location.href);
                    const sp = u.searchParams;
                    if (date && date.trim().length > 0)
                      sp.set("date", date.trim());
                    else sp.delete("date");
                    router.push(
                      u.pathname + (sp.toString() ? "?" + sp.toString() : "")
                    );
                    setOpenDate(false);
                  }}
                  className="bg-primary text-primary-foreground"
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
