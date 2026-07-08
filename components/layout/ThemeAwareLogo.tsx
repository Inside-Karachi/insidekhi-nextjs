"use client";

import Image from "next/image";
import Link from "next/link";

/**
 * ThemeAwareLogo - Renders immediately using CSS-based theme switching
 * 
 * Uses CSS classes (dark:hidden / dark:block) to switch logos based on theme.
 * This avoids the hydration mismatch issue without using a mounted guard,
 * ensuring the logo appears instantly with the rest of the header.
 */
export function ThemeAwareLogo() {
  return (
    <Link href="/" className="transition-opacity hover:opacity-80 block">
      {/* Light mode logo - hidden in dark mode */}
      <Image
        src="/assets/logo-black.png"
        alt="Inside Karachi Logo"
        width={120}
        height={40}
        className="object-contain w-auto dark:hidden"
        priority
      />
      {/* Dark mode logo - hidden in light mode */}
      <Image
        src="/assets/logo-white.png"
        alt="Inside Karachi Logo"
        width={120}
        height={40}
        className="object-contain w-auto hidden dark:block"
        priority
      />
    </Link>
  );
}