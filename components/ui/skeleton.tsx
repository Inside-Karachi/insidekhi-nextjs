import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/80 dark:bg-muted/60",
        // Add shimmer effect for better visibility
        "relative overflow-hidden",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

// Image-specific skeleton with shimmer effect (lighter, not dark)
function ImageSkeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Light gradient background that works on both light and dark themes
        "rounded-md bg-gradient-to-br from-muted/40 via-muted/60 to-muted/40",
        "dark:from-zinc-700/40 dark:via-zinc-600/50 dark:to-zinc-700/40",
        "relative overflow-hidden",
        // Shimmer animation - subtle
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_ease-in-out_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/30 dark:before:via-white/15 before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

// Compact shimmer skeleton for small elements (badges, text placeholders)
function ShimmerSkeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted/50 dark:bg-zinc-700/50",
        "relative overflow-hidden",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_ease-in-out_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/20 dark:before:via-white/10 before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton, ImageSkeleton, ShimmerSkeleton };
