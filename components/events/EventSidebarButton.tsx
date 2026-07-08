"use client";

import { Button } from "@/components/ui/button";

export function EventSidebarButton() {
  const scrollToTickets = () => {
    const ticketsSection = document.getElementById("tickets");
    if (ticketsSection) {
      ticketsSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <Button
      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
      onClick={scrollToTickets}
    >
      Get Tickets
    </Button>
  );
}
