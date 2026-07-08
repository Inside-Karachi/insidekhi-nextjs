"use client";
import { useState } from "react";
import { isValidCnic } from "@/lib/utils/cnic";
import { useRouter } from "next/navigation";

interface TicketTypeLite {
  id: number;
  name: string;
  price: number;
}

interface Props {
  eventId: number;
  ticketTypes: TicketTypeLite[];
}

export function EventCheckoutForm({ eventId, ticketTypes }: Props) {
  const [cnic, setCnic] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const total = ticketTypes.reduce(
    (acc, t) => acc + (quantities[t.id] || 0) * t.price,
    0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidCnic(cnic)) {
      setError("Invalid CNIC");
      return;
    }
    const tickets = ticketTypes
      .filter((t) => (quantities[t.id] || 0) > 0)
      .map((t) => ({ ticket_type_id: t.id, quantity: quantities[t.id] }));
    if (!tickets.length) {
      setError("Select at least one ticket");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/tickets/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: eventId,
        tickets,
        customer: { name, email, phone, cnic },
      }),
    });
    if (!res.ok) {
      setError("Checkout failed");
      setSubmitting(false);
      return;
    }
    const json = await res.json();
    const form = document.createElement("form");
    form.method = json.method;
    form.action = json.action;
    interface Field {
      name: string;
      value: string;
    }
    (json.fields || []).forEach((f: Field) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = f.name;
      input.value = f.value;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    // Redirect page (return page) should have booking_id param; for mock gateway we add manual navigation fallback.
    router.push(`/tickets/return?booking_id=${json.booking_id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        {ticketTypes.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span>{t.name}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={quantities[t.id] || 0}
                onChange={(e) =>
                  setQuantities((q) => ({
                    ...q,
                    [t.id]: parseInt(e.target.value || "0", 10),
                  }))
                }
                className="w-16 rounded bg-neutral-800 px-2 py-1 text-right outline-none border border-neutral-700"
              />
              <span className="opacity-70">@ {t.price}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          required
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded bg-neutral-800 px-3 py-2 text-sm outline-none border border-neutral-700"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded bg-neutral-800 px-3 py-2 text-sm outline-none border border-neutral-700"
        />
        <input
          required
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded bg-neutral-800 px-3 py-2 text-sm outline-none border border-neutral-700"
        />
        <input
          required
          placeholder="CNIC (13 digits)"
          value={cnic}
          onChange={(e) => setCnic(e.target.value.replace(/[^0-9]/g, ""))}
          maxLength={13}
          className="rounded bg-neutral-800 px-3 py-2 text-sm outline-none border border-neutral-700"
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="opacity-80">Total</span>
        <span className="font-medium">{total}</span>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-pink-600 py-2 text-sm font-medium hover:bg-pink-500 disabled:opacity-50"
      >
        {submitting ? "Processing..." : "Checkout"}
      </button>
    </form>
  );
}
