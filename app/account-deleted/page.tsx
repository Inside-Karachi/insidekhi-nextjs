import { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Account Deleted - Inside Karachi",
  robots: { index: false, follow: false },
};

export default function AccountDeletedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center glass-card border border-border rounded-2xl p-10">
        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Your account has been deleted</h1>
        <p className="text-muted-foreground mb-8">
          We&apos;re sorry to see you go. Your account and personal
          information have been permanently removed.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-5 py-2.5 font-semibold shadow-xs hover:bg-primary/90 transition-colors"
          >
            Back to Inside Karachi
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md border border-border px-5 py-2.5 font-semibold hover:bg-accent transition-colors"
          >
            Create a new account
          </Link>
        </div>
      </div>
    </div>
  );
}
