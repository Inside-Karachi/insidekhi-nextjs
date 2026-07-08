
import { Skeleton } from "@/components/ui/skeleton";

export default function ListingsLoading() {
    return (
        <div className="min-h-screen bg-background space-y-8">
            {/* Header Skeleton */}
            <div className="border-b bg-background sticky top-0 z-20">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center gap-4 overflow-x-hidden">
                        <Skeleton className="h-10 w-24 rounded-full flex-shrink-0" />
                        <Skeleton className="h-10 w-24 rounded-full flex-shrink-0" />
                        <Skeleton className="h-10 w-24 rounded-full flex-shrink-0" />
                        <Skeleton className="h-10 w-24 rounded-full flex-shrink-0" />
                        <Skeleton className="h-10 w-24 rounded-full flex-shrink-0" />
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-6 lg:px-8 space-y-12 pb-24">
                {/* Carousel Skeleton */}
                <div className="space-y-4">
                    <Skeleton className="h-8 w-48" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Skeleton className="aspect-[4/3] rounded-xl" />
                        <Skeleton className="aspect-[4/3] rounded-xl" />
                        <Skeleton className="aspect-[4/3] rounded-xl hidden lg:block" />
                    </div>
                </div>

                {/* Filters Bar Skeleton */}
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                    <Skeleton className="h-10 w-full md:w-64" />
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-24" />
                    </div>
                </div>

                {/* Listings Grid Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="space-y-4 bg-card rounded-2xl border p-4">
                            <Skeleton className="aspect-[4/3] rounded-xl" />
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                            <div className="flex justify-between pt-2">
                                <Skeleton className="h-5 w-20" />
                                <Skeleton className="h-5 w-16" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
