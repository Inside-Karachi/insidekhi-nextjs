"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface MenuTabProps {
  listingId: number;
  menuPdfUrl?: string | null;
}

export default function MenuTab({
  listingId: _listingId,
  menuPdfUrl,
}: MenuTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Menu Management</h3>
        <p className="text-sm text-muted-foreground">
          Upload menu PDF or create a digital menu
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Menu management feature coming soon. You will be able to upload PDF
          menus or create digital menus.
        </AlertDescription>
      </Alert>

      {menuPdfUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Current Menu</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={menuPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View Menu PDF
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
