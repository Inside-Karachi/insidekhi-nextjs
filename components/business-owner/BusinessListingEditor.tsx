"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Info,
  MapPin,
  Image as ImageIcon,
  Menu,
  Tag,
  Settings,
  ArrowLeft,
  Store,
} from "lucide-react";
import BasicInfoTab from "./tabs/BasicInfoTab";
import BranchesTab from "@/components/business-owner/tabs/BranchesTab";
import GalleryTab from "@/components/business-owner/tabs/GalleryTab";
import MenuTab from "@/components/business-owner/tabs/MenuTab";
import DealsTab from "@/components/business-owner/tabs/DealsTab";
import FeaturesTab from "@/components/business-owner/tabs/FeaturesTab";
import type { Database } from "@/types/database";
import { cn } from "@/lib/utils";
import { BUSINESS_OWNER_CARD_SURFACE } from "./BusinessOwnerPageHeader";

type Listing = Database["public"]["Tables"]["listings"]["Row"] & {
  category?: {
    id: number;
    name: string;
  } | null;
  branches?: Array<Database["public"]["Tables"]["listing_branches"]["Row"]>;
  images?: Array<Database["public"]["Tables"]["listing_images"]["Row"]>;
};

interface BusinessListingEditorProps {
  listing?: Listing;
  mode: "create" | "edit";
}

export default function BusinessListingEditor({
  listing,
  mode,
}: BusinessListingEditorProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("basic");

  const tabs = [
    { id: "basic", label: "Basic Info", icon: Info },
    { id: "branches", label: "Branches", icon: MapPin },
    { id: "gallery", label: "Gallery", icon: ImageIcon },
    { id: "menu", label: "Menu", icon: Menu },
    { id: "deals", label: "Deals", icon: Tag },
    { id: "features", label: "Features", icon: Settings },
  ];

  // Disable certain tabs in create mode until basic info is saved
  const isCreateMode = mode === "create";
  const disabledTabs =
    isCreateMode && !listing?.id
      ? ["branches", "gallery", "menu", "deals", "features"]
      : [];

  return (
    <div className="w-full space-y-8">
      <div>
        <Link
          href="/dashboard/business/listings"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to listings</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="shrink-0 p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <Store className="h-7 w-7 text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              {mode === "create" ? "Create listing" : "Edit listing"}
            </h1>
            {listing?.name && (
              <p className="text-muted-foreground mt-1">{listing.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Card className={cn("rounded-2xl", BUSINESS_OWNER_CARD_SURFACE)}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <CardHeader className="pb-4">
            <TabsList className="grid w-full grid-cols-6 gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isDisabled = disabledTabs.includes(tab.id);
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    disabled={isDisabled}
                    className="flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </CardHeader>

          <CardContent>
            <TabsContent value="basic" className="mt-0">
              <BasicInfoTab
                listing={listing}
                mode={mode}
                onSaveSuccess={(savedListing) => {
                  if (mode === "create") {
                    router.push(
                      `/dashboard/business/listings/${savedListing.id}`,
                    );
                  } else {
                    router.refresh();
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="branches" className="mt-0">
              {listing?.id ? (
                <BranchesTab listingId={listing.id} />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Save basic info first to manage branches
                </div>
              )}
            </TabsContent>

            <TabsContent value="gallery" className="mt-0">
              {listing?.id ? (
                <GalleryTab listingId={listing.id} />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Save basic info first to upload images
                </div>
              )}
            </TabsContent>

            <TabsContent value="menu" className="mt-0">
              {listing?.id ? (
                <MenuTab listingId={listing.id} />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Save basic info first to add menu
                </div>
              )}
            </TabsContent>

            <TabsContent value="deals" className="mt-0">
              {listing?.id ? (
                <DealsTab listingId={listing.id} />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Save basic info first to add deals
                </div>
              )}
            </TabsContent>

            <TabsContent value="features" className="mt-0">
              {listing?.id ? (
                <FeaturesTab listing={listing} />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Save basic info first to configure features
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Help Text */}
      {isCreateMode && !listing?.id && (
        <Card className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent backdrop-blur-sm shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Getting started</CardTitle>
            <CardDescription>
              Fill in basic information first. After you save, you can add
              branches, images, menu, deals, and features.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
