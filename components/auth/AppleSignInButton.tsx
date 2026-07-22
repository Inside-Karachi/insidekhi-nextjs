"use client";

import { Button } from "@/components/ui/button";

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.415 2.19-1.19 3.02-.94 1-2.19 1.66-3.46 1.56-.14-1.11.41-2.27 1.15-3.05.83-.9 2.25-1.55 3.4-1.6.02.02.03.05.03.07h.07zM20.5 17.06c-.55 1.27-1.22 2.5-2.16 3.62-.86 1-1.75 2-3.02 2-1.25.02-1.65-.78-3.09-.78-1.44 0-1.88.76-3.06.8-1.23.04-2.17-1.08-3.05-2.06-1.86-2.06-3.3-5.82-1.38-8.36 1.03-1.36 2.53-2.15 3.94-2.15 1.35 0 2.2.85 3.32.85 1.08 0 1.75-.85 3.32-.85 1.24 0 2.55.63 3.5 1.72-3.07 1.71-2.57 6.02.68 5.21z" />
    </svg>
  );
}

export function AppleSignInButton({
  next,
  invite,
  label = "Continue with Apple",
}: {
  next?: string;
  invite?: string;
  label?: string;
}) {
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  if (invite) params.set("invite", invite);
  const query = params.toString();
  const href = query ? `/api/auth/apple?${query}` : "/api/auth/apple";

  return (
    <Button
      type="button"
      variant="outline"
      asChild
      className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white font-medium py-3 rounded-lg transition-all duration-200"
    >
      <a href={href} className="flex items-center justify-center gap-2">
        <AppleLogo />
        {label}
      </a>
    </Button>
  );
}
