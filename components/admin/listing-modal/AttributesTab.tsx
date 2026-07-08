"use client";

import * as React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { CustomAttributes } from "@/types/listing.types";
import { CustomAttributesEditor } from "../CustomAttributesEditor";

interface AttributesTabProps {
  customAttributes: CustomAttributes | null;
  onChange: (attributes: CustomAttributes) => void;
  isLoading: boolean;
  listingId?: number;
}

export function AttributesTab({
  customAttributes,
  onChange,
  isLoading,
  listingId,
}: AttributesTabProps) {
  return (
    <TabsContent value="attributes" className="space-y-8">
      <CustomAttributesEditor
        customAttributes={customAttributes}
        onChange={onChange}
        isLoading={isLoading}
        listingId={listingId}
      />
    </TabsContent>
  );
}
