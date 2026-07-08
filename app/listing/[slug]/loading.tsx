import { Skeleton } from "@/components/ui/skeleton";

export default function ListingLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Skeleton */}
      <div className="relative w-full h-[60vh] md:h-[70vh] lg:h-[80vh] overflow-hidden">
        <Skeleton className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        
        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 lg:p-12">
          <div className="container mx-auto">
            <div className="max-w-4xl space-y-4">
              <Skeleton className="h-8 w-32 bg-muted/60" />
              <Skeleton className="h-12 md:h-16 w-full max-w-2xl bg-muted/60" />
              <Skeleton className="h-6 w-3/4 bg-muted/60" />
              <div className="flex flex-wrap gap-3 mt-4">
                <Skeleton className="h-10 w-24 bg-muted/60" />
                <Skeleton className="h-10 w-28 bg-muted/60" />
                <Skeleton className="h-10 w-32 bg-muted/60" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 md:gap-16 lg:gap-20">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-12">
            {/* Gallery Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-8 w-32" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Skeleton className="aspect-square rounded-xl" />
                <Skeleton className="aspect-square rounded-xl" />
                <Skeleton className="aspect-square rounded-xl" />
                <Skeleton className="aspect-square rounded-xl md:block hidden" />
                <Skeleton className="aspect-square rounded-xl md:block hidden" />
                <Skeleton className="aspect-square rounded-xl md:block hidden" />
              </div>
            </div>

            {/* Features Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
              </div>
            </div>

            {/* Map Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-64 md:h-96 rounded-xl" />
            </div>

            {/* Contact Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-8 w-36" />
              <div className="space-y-3">
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
              </div>
            </div>

            {/* Reviews Skeleton */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-32" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
              </div>
            </div>

            {/* Similar Listings Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-8 w-56" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-64 rounded-xl md:block hidden" />
                <Skeleton className="h-64 rounded-xl md:block hidden" />
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-8">
            {/* Quick Nav Skeleton */}
            <div className="sticky top-20 space-y-4">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
            </div>

            {/* Contact Card Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
