"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  X,
  Wifi,
  Utensils,
  Shield,
  Heart,
  Star,
  Tag as TagIcon,
} from "lucide-react";
import {
  CustomAttributes,
  CustomAmenity,
  CustomTag,
  CustomAttributesEditorProps,
} from "@/types/listing.types";
import { createClient } from "@/lib/supabase/client";

const amenityCategories = [
  { value: "dining", label: "Dining", icon: Utensils },
  { value: "services", label: "Services", icon: Shield },
  { value: "facilities", label: "Facilities", icon: Wifi },
  { value: "accessibility", label: "Accessibility", icon: Heart },
  { value: "other", label: "Other", icon: Star },
] as const;

const commonAmenities = [
  { name: "Free WiFi", category: "facilities" as const, icon: "📶" },
  { name: "Parking Available", category: "facilities" as const, icon: "🚗" },
  { name: "Air Conditioned", category: "facilities" as const, icon: "❄️" },
  { name: "Family Friendly", category: "other" as const, icon: "👨‍👩‍👧‍👦" },
  { name: "Halal Certified", category: "dining" as const, icon: "☪️" },
  { name: "Card Payments", category: "services" as const, icon: "💳" },
  { name: "Outdoor Seating", category: "facilities" as const, icon: "🌳" },
  { name: "Pet Friendly", category: "other" as const, icon: "🐕" },
  {
    name: "Wheelchair Accessible",
    category: "accessibility" as const,
    icon: "♿",
  },
  { name: "24/7 Service", category: "services" as const, icon: "🕐" },
];

export function CustomAttributesEditor({
  customAttributes,
  onChange,
  isLoading = false,
  listingId,
}: CustomAttributesEditorProps & { listingId?: number }) {
  const [attributes, setAttributes] = React.useState<CustomAttributes>(
    customAttributes || {
      amenities: [],
      tags: [],
      additional_info: {},
      metadata: {},
    },
  );
  const [databaseFeatures, setDatabaseFeatures] = React.useState<
    Array<{
      name: string;
      icon: string;
      description: string;
      featureId: number;
      isAssigned: boolean;
      masterId: number;
    }>
  >([]);
  const [selectedDatabaseFeatures, setSelectedDatabaseFeatures] =
    React.useState<Set<number>>(new Set());
  const [showAllFeatures, setShowAllFeatures] = React.useState(!listingId); // Show all by default for create mode

  // Sync with prop changes (for editing existing listings)
  React.useEffect(() => {
    if (customAttributes) {
      // Check if the data is in the old flat format or new structured format
      if (
        typeof customAttributes === "object" &&
        customAttributes !== null &&
        customAttributes.amenities === undefined &&
        customAttributes.tags === undefined &&
        customAttributes.additional_info === undefined
      ) {
        // This is flat format - convert to structured format
        const structuredAttributes: CustomAttributes = {
          amenities: [],
          tags: [],
          additional_info: customAttributes as Record<
            string,
            string | number | boolean | null | undefined
          >,
          metadata: {},
        };
        setAttributes(structuredAttributes);
      } else {
        // This is already in structured format
        setAttributes(customAttributes as CustomAttributes);
      }

      // Initialize selected database features if they exist
      if (
        customAttributes &&
        typeof customAttributes === "object" &&
        "selectedDatabaseFeatures" in customAttributes
      ) {
        const features = (
          customAttributes as { selectedDatabaseFeatures: number[] }
        ).selectedDatabaseFeatures;
        setSelectedDatabaseFeatures(new Set(features));
      }
    } else {
      // Reset to empty state if no custom attributes
      setAttributes({
        amenities: [],
        tags: [],
        additional_info: {},
        metadata: {},
      });
      setSelectedDatabaseFeatures(new Set());
    }
  }, [customAttributes]);

  // Fetch database features when component mounts (for both create and edit modes)
  React.useEffect(() => {
    const fetchDatabaseFeatures = async () => {
      try {
        const supabase = createClient();

        // Get all available features from master table
        const { data: allFeatures, error: masterError } = await supabase
          .from("listing_features_master")
          .select("id, name, description, icon_emoji")
          .order("name");

        if (masterError) {
          console.error("Error fetching master features:", masterError);
          return;
        }

        // If we have a listingId, also get currently assigned features
        let assignedFeatureIds = new Set<number>();
        if (listingId) {
          const { data: assignedFeatures, error: assignedError } =
            await supabase
              .from("listing_features")
              .select(
                `
              feature_id,
              listing_features_master (
                id,
                name
              )
            `,
              )
              .eq("listing_id", listingId);

          if (assignedError) {
            console.error("Error fetching assigned features:", assignedError);
          } else {
            assignedFeatureIds = new Set(
              assignedFeatures?.map((item) => item.feature_id) || [],
            );
          }
        }

        // For create mode, initialize with any pre-selected features
        if (!listingId && selectedDatabaseFeatures.size > 0) {
          assignedFeatureIds = selectedDatabaseFeatures;
        }

        // Combine all features with assignment status
        if (allFeatures && allFeatures.length > 0) {
          const features = allFeatures.map((masterFeature) => ({
            name: masterFeature.name,
            icon: masterFeature.icon_emoji || "✨",
            description: masterFeature.description || "",
            featureId: assignedFeatureIds.has(masterFeature.id)
              ? masterFeature.id
              : 0, // 0 means not assigned
            isAssigned: assignedFeatureIds.has(masterFeature.id),
            masterId: masterFeature.id,
          }));
          setDatabaseFeatures(features);
        } else {
          setDatabaseFeatures([]);
        }
      } catch (error) {
        console.error("Error fetching database features:", error);
        setDatabaseFeatures([]);
      }
    };

    fetchDatabaseFeatures();
  }, [listingId, selectedDatabaseFeatures]);

  // Update parent when attributes change - prevent infinite loop
  React.useEffect(() => {
    // Only call onChange if attributes actually changed from the prop
    const attributesWithFeatures = {
      ...attributes,
      selectedDatabaseFeatures: Array.from(selectedDatabaseFeatures),
    };

    if (
      JSON.stringify(attributesWithFeatures) !==
      JSON.stringify({
        ...customAttributes,
        selectedDatabaseFeatures:
          customAttributes &&
          typeof customAttributes === "object" &&
          "selectedDatabaseFeatures" in customAttributes
            ? (customAttributes as { selectedDatabaseFeatures: number[] })
                .selectedDatabaseFeatures
            : [],
      })
    ) {
      onChange(attributesWithFeatures);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributes, selectedDatabaseFeatures]); // Include selectedDatabaseFeatures

  const addAmenity = (amenity: Omit<CustomAmenity, "id">) => {
    const newAmenity: CustomAmenity = {
      ...amenity,
      id: `amenity_${Date.now()}_${Math.random()}`,
    };
    setAttributes((prev) => ({
      ...prev,
      amenities: [...(prev.amenities || []), newAmenity],
    }));
  };

  const removeAmenity = (id: string) => {
    setAttributes((prev) => ({
      ...prev,
      amenities: (prev.amenities || []).filter((a) => a.id !== id),
    }));
  };

  const addTag = (name: string, color?: string) => {
    if (!name.trim()) return;
    const newTag: CustomTag = {
      id: `tag_${Date.now()}_${Math.random()}`,
      name: name.trim(),
      color: color || "#3b82f6",
    };
    setAttributes((prev) => ({
      ...prev,
      tags: [...(prev.tags || []), newTag],
    }));
  };

  const removeTag = (id: string) => {
    setAttributes((prev) => ({
      ...prev,
      tags: (prev.tags || []).filter((t) => t.id !== id),
    }));
  };

  const updateAdditionalInfo = (
    key: string,
    value: string | number | boolean,
  ) => {
    setAttributes((prev) => ({
      ...prev,
      additional_info: {
        ...prev.additional_info,
        [key]: value,
      },
    }));
  };

  const removeAdditionalInfo = (key: string) => {
    setAttributes((prev) => {
      const newInfo = { ...prev.additional_info };
      delete newInfo[key];
      return {
        ...prev,
        additional_info: newInfo,
      };
    });
  };

  const removeDatabaseFeature = async (
    masterId: number,
    featureName: string,
  ) => {
    if (listingId) {
      // Edit mode - require confirmation and remove via API
      if (
        !window.confirm(
          `Remove "${featureName}" from this listing? This action cannot be undone.`,
        )
      ) {
        return;
      }

      try {
        const response = await fetch(
          `/api/admin/listings/${listingId}/features`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              listingId,
              featureId: masterId,
              action: "remove",
            }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to remove feature");
        }

        // Update local state
        setDatabaseFeatures((prev) =>
          prev.map((f) =>
            f.masterId === masterId
              ? { ...f, isAssigned: false, featureId: 0 }
              : f,
          ),
        );
      } catch (error) {
        console.error("Error removing feature:", error);
        alert("Failed to remove feature. Please try again.");
      }
    } else {
      // Create mode - just update local state without confirmation
      setSelectedDatabaseFeatures((prev) => {
        const newSet = new Set(prev);
        newSet.delete(masterId);
        return newSet;
      });
      setDatabaseFeatures((prev) =>
        prev.map((f) =>
          f.masterId === masterId
            ? { ...f, isAssigned: false, featureId: 0 }
            : f,
        ),
      );
    }
  };

  const addDatabaseFeature = async (masterId: number) => {
    if (listingId) {
      // Edit mode - add feature via API
      try {
        const response = await fetch(
          `/api/admin/listings/${listingId}/features`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              listingId,
              featureId: masterId,
              action: "add",
            }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to add feature");
        }

        const result = await response.json();

        // Update local state
        setDatabaseFeatures((prev) =>
          prev.map((f) =>
            f.masterId === masterId
              ? { ...f, isAssigned: true, featureId: result.data.id }
              : f,
          ),
        );
      } catch (error) {
        console.error("Error adding feature:", error);
        alert("Failed to add feature. Please try again.");
      }
    } else {
      // Create mode - just update local state
      setSelectedDatabaseFeatures((prev) => new Set([...prev, masterId]));
      setDatabaseFeatures((prev) =>
        prev.map((f) =>
          f.masterId === masterId ? { ...f, isAssigned: true } : f,
        ),
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Amenities & Features Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-lg font-medium">Amenities & Features</h3>
        </div>

        {/* Quick Add Common Amenities */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quick Add</Label>
            <div className="flex flex-wrap gap-2">
              {commonAmenities.map((amenity) => (
                <Button
                  key={amenity.name}
                  variant="outline"
                  size="sm"
                  onClick={() => addAmenity(amenity)}
                  className="text-xs"
                >
                  {amenity.icon} {amenity.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Amenity Form */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Add Custom Amenity</Label>
            <CustomAmenityForm onAdd={addAmenity} />
          </div>

          {/* Current Amenities */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Current Amenities</Label>
            <div className="space-y-3">
              {/* Database Features (managed) */}
              {databaseFeatures.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Database Features:
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllFeatures(!showAllFeatures)}
                      className="h-6 px-2 text-xs"
                    >
                      {showAllFeatures ? "Show Active" : "Show All"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-h-[40px] p-3 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                    {databaseFeatures
                      .filter(
                        (feature) => showAllFeatures || feature.isAssigned,
                      )
                      .map((feature) => (
                        <div
                          key={`db-${feature.masterId}`}
                          className="flex items-center justify-between p-2 rounded border bg-background/80"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{feature.icon}</span>
                            <span className="text-sm font-medium">
                              {feature.name}
                            </span>
                            {feature.isAssigned && (
                              <Badge
                                variant="outline"
                                className="text-xs px-1 py-0"
                              >
                                Active
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant={
                              feature.isAssigned ? "destructive" : "default"
                            }
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() =>
                              feature.isAssigned
                                ? removeDatabaseFeature(
                                    feature.masterId,
                                    feature.name,
                                  )
                                : addDatabaseFeature(feature.masterId)
                            }
                          >
                            {feature.isAssigned ? (
                              <>
                                <X className="h-3 w-3 mr-1" />
                                Remove
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                  </div>
                  {!showAllFeatures &&
                    databaseFeatures.filter((f) => f.isAssigned).length ===
                      0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        No active features. Click &quot;Show All&quot; to see
                        available features.
                      </p>
                    )}
                </div>
              )}

              {/* Custom Attributes Amenities (editable) */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Custom Amenities:
                </Label>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border rounded-lg bg-muted/20">
                  {attributes.amenities?.map((amenity) => (
                    <Badge
                      key={amenity.id}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {amenity.icon || "🏷️"} {amenity.name}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => removeAmenity(amenity.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  {(!attributes.amenities ||
                    attributes.amenities.length === 0) && (
                    <p className="text-sm text-muted-foreground self-center">
                      No custom amenities added yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Tags & Categories Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <TagIcon className="h-4 w-4 text-primary" />
          <h3 className="text-lg font-medium">Tags & Categories</h3>
        </div>

        <div className="space-y-4">
          {/* Add Tag Form */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Add Tag</Label>
            <CustomTagForm onAdd={addTag} />
          </div>

          {/* Current Tags */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Current Tags</Label>
            <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border rounded-lg bg-muted/20">
              {attributes.tags?.map((tag) => (
                <Badge
                  key={tag.id}
                  style={{ backgroundColor: tag.color }}
                  className="text-white flex items-center gap-1"
                >
                  {tag.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-white/20"
                    onClick={() => removeTag(tag.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              {(!attributes.tags || attributes.tags.length === 0) && (
                <p className="text-sm text-muted-foreground self-center">
                  No tags added yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Additional Information Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          <h3 className="text-lg font-medium">Additional Information</h3>
        </div>

        <div className="space-y-4">
          {/* Add Information Form */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Add Information</Label>
            <AdditionalInfoForm onAdd={updateAdditionalInfo} />
          </div>

          {/* Current Additional Info */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Current Information</Label>
            <div className="space-y-2 min-h-[40px] p-3 border rounded-lg bg-muted/20">
              {attributes.additional_info &&
              Object.keys(attributes.additional_info).length > 0 ? (
                Object.entries(attributes.additional_info).map(
                  ([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-2 bg-background rounded border"
                    >
                      <div className="flex-1">
                        <span className="font-medium text-sm">{key}:</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {String(value)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => removeAdditionalInfo(key)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ),
                )
              ) : (
                <p className="text-sm text-muted-foreground">
                  No additional information added yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function CustomAmenityForm({
  onAdd,
}: {
  onAdd: (amenity: Omit<CustomAmenity, "id">) => void;
}) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<string>("other");
  const [icon, setIcon] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      category: category as CustomAmenity["category"],
      icon: icon.trim() || undefined,
    });

    setName("");
    setIcon("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Amenity name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1"
      />
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {amenityCategories.map((cat) => (
            <SelectItem key={cat.value} value={cat.value}>
              {cat.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="Icon (optional)"
        value={icon}
        onChange={(e) => setIcon(e.target.value)}
        className="w-24"
      />
      <Button type="submit" size="sm">
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}

function CustomTagForm({
  onAdd,
}: {
  onAdd: (name: string, color?: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState("#3b82f6");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd(name.trim(), color);
    setName("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Tag name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1"
      />
      <Input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="w-16"
      />
      <Button type="submit" size="sm">
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}

function AdditionalInfoForm({
  onAdd,
}: {
  onAdd: (key: string, value: string | number | boolean) => void;
}) {
  const [key, setKey] = React.useState("");
  const [value, setValue] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !value.trim()) return;

    onAdd(key.trim(), value.trim());
    setKey("");
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        className="flex-1"
      />
      <Input
        placeholder="Value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" size="sm">
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}
