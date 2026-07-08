"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CartItem } from "@/lib/context/cartStore";
import { User, CreditCard } from "lucide-react";

interface GuestDetailsFormProps {
  item: CartItem;
  index: number; // Which ticket of this type (0 to quantity-1)
  onChange: (field: "name" | "cnic", value: string) => void;
  errors?: { name?: string; cnic?: string };
}

export function GuestDetailsForm({
  item,
  index,
  onChange,
  errors,
}: GuestDetailsFormProps) {
  const guestInfo = item.guestInfo[index] || { name: "", cnic: "" };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-base sm:text-lg font-semibold">
        <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs sm:text-sm font-bold">
          {index + 1}
        </div>
        <span>Ticket #{index + 1}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`name-${item.ticketTypeId}-${index}`} className="text-base font-semibold">
            Full Name *
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id={`name-${item.ticketTypeId}-${index}`}
              placeholder="Enter full name"
              className={`pl-9 ${errors?.name ? "border-destructive" : ""}`}
              value={guestInfo.name}
              onChange={(e) => onChange("name", e.target.value)}
            />
          </div>
          {errors?.name && (
            <p className="text-xs text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`cnic-${item.ticketTypeId}-${index}`} className="text-base font-semibold">
            CNIC Number *
          </Label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id={`cnic-${item.ticketTypeId}-${index}`}
              placeholder="42101-1234567-1"
              className={`pl-9 ${errors?.cnic ? "border-destructive" : ""}`}
              value={guestInfo.cnic}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, "");
                if (val.length > 13) val = val.slice(0, 13);
                // Format as 42101-1234567-1
                if (val.length > 12) {
                  val =
                    val.slice(0, 5) +
                    "-" +
                    val.slice(5, 12) +
                    "-" +
                    val.slice(12);
                } else if (val.length > 5) {
                  val = val.slice(0, 5) + "-" + val.slice(5);
                }
                onChange("cnic", val);
              }}
              maxLength={15}
            />
          </div>
          {errors?.cnic && (
            <p className="text-xs text-destructive">{errors.cnic}</p>
          )}
        </div>
      </div>
    </div>
  );
}
