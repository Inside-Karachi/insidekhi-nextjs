"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  X,
  Wifi,
  Utensils,
  Shield,
  Heart,
  Star,
  Settings,
  Loader2,
} from "lucide-react";
import type { Database } from "@/types/supabase";

type Listing = Database["public"]["Tables"]["listings"]["Row"];

interface Feature {
  name: string;
  category: string;
  icon: string;
}

interface FeaturesTabProps {
  listing: Listing;
}

const categoryIcons = {
  dining: Utensils,
  services: Shield,
  facilities: Wifi,
  accessibility: Heart,
  other: Star,
};

const commonFeatures: Feature[] = [
  { name: "Free WiFi", category: "facilities", icon: "📶" },
  { name: "Parking Available", category: "facilities", icon: "🚗" },
  { name: "Air Conditioned", category: "facilities", icon: "❄️" },
  { name: "Family Friendly", category: "other", icon: "👨‍👩‍👧‍👦" },
  { name: "Halal Certified", category: "dining", icon: "☪️" },
  { name: "Card Payments", category: "services", icon: "💳" },
  { name: "Outdoor Seating", category: "facilities", icon: "🌳" },
  { name: "Pet Friendly", category: "other", icon: "🐕" },
  { name: "Wheelchair Accessible", category: "accessibility", icon: "♿" },
  { name: "24/7 Service", category: "services", icon: "🕐" },
];

export default function FeaturesTab({ listing }: FeaturesTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<Feature[]>([]);
  const [customFeature, setCustomFeature] = useState({
    name: "",
    category: "other",
    icon: "⭐",
  });

  useEffect(() => {
    // Load features from listing custom_attributes
    if (listing.custom_attributes) {
      const attrs = listing.custom_attributes as {
        amenities?: Feature[];
      };
      if (attrs.amenities) {
        setSelectedFeatures(attrs.amenities);
      }
    }
  }, [listing]);

  async function handleSave() {
    try {
      setLoading(true);
      const response = await fetch(`/api/business/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          custom_attributes: {
            ...((listing.custom_attributes as object) || {}),
            amenities: selectedFeatures,
          },
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Features updated successfully",
        });
      } else {
        throw new Error("Failed to save");
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to update features",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function addFeature(feature: Feature) {
    if (!selectedFeatures.find((f) => f.name === feature.name)) {
      setSelectedFeatures([...selectedFeatures, feature]);
    }
  }

  function removeFeature(featureName: string) {
    setSelectedFeatures(selectedFeatures.filter((f) => f.name !== featureName));
  }

  function addCustomFeature() {
    if (customFeature.name.trim()) {
      addFeature(customFeature);
      setCustomFeature({ name: "", category: "other", icon: "⭐" });
    }
  }

  const groupedFeatures = selectedFeatures.reduce(
    (acc, feature) => {
      if (!acc[feature.category]) {
        acc[feature.category] = [];
      }
      acc[feature.category].push(feature);
      return acc;
    },
    {} as Record<string, Feature[]>,
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Features & Amenities</h3>
        </div>
        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>

      {/* Quick Add Common Features */}
      <div className="space-y-4">
        <h4 className="font-medium">Quick Add</h4>
        <div className="flex flex-wrap gap-2">
          {commonFeatures.map((feature) => (
            <Button
              key={feature.name}
              variant="outline"
              size="sm"
              onClick={() => addFeature(feature)}
              disabled={selectedFeatures.some((f) => f.name === feature.name)}
            >
              <span className="mr-1">{feature.icon}</span>
              {feature.name}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Add Custom Feature */}
      <div className="space-y-4">
        <h4 className="font-medium">Add Custom Feature</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Feature name"
            value={customFeature.name}
            onChange={(e) =>
              setCustomFeature({ ...customFeature, name: e.target.value })
            }
          />
          <Select
            value={customFeature.category}
            onValueChange={(value) =>
              setCustomFeature({ ...customFeature, category: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dining">Dining</SelectItem>
              <SelectItem value="services">Services</SelectItem>
              <SelectItem value="facilities">Facilities</SelectItem>
              <SelectItem value="accessibility">Accessibility</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addCustomFeature} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      </div>

      <Separator />

      {/* Selected Features */}
      <div className="space-y-6">
        <h4 className="font-medium">Selected Features</h4>
        {Object.keys(groupedFeatures).length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No features added yet. Add features from quick add or create
              custom ones.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedFeatures).map(([category, features]) => {
              const Icon =
                categoryIcons[category as keyof typeof categoryIcons] || Star;
              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <h5 className="font-medium capitalize">{category}</h5>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {features.map((feature) => (
                      <Badge
                        key={feature.name}
                        variant="secondary"
                        className="px-3 py-2"
                      >
                        <span className="mr-2">{feature.icon}</span>
                        {feature.name}
                        <button
                          onClick={() => removeFeature(feature.name)}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
