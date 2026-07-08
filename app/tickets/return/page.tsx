import { Suspense } from "react";
import { BookingPassReturnContent } from "./return-content";

export default function ReturnPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-xl font-semibold mb-4">Payment Status</h1>
      <Suspense>
        <BookingPassReturnContent />
      </Suspense>
    </div>
  );
}
