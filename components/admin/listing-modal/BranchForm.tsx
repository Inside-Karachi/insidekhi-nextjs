"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BranchFormData,
  BranchWithHours,
  OpeningHour,
} from "@/types/listing.types";
import { Loader2, MapPin, Clock } from "lucide-react";
import { OpeningHoursEditor } from "@/components/listing/OpeningHoursEditor";

interface BranchFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: BranchFormData, hours?: OpeningHour[]) => Promise<void>;
  branch?: BranchWithHours | null;
  isLoading?: boolean;
}

export function BranchForm({
  isOpen,
  onClose,
  onSave,
  branch,
  isLoading = false,
}: BranchFormProps) {
  const [formData, setFormData] = React.useState<BranchFormData>({
    name: "",
    address: "",
    city: "Karachi",
    country: "Pakistan",
    latitude: "",
    longitude: "",
    phone_number: "",
    is_primary: false,
    is_verified: false,
    distance_from_center: "",
  });

  const [openingHours, setOpeningHours] = React.useState<OpeningHour[]>([]);
  const [activeTab, setActiveTab] = React.useState("details");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Initialize form when branch changes
  React.useEffect(() => {
    if (branch) {
      setFormData({
        id: branch.id,
        name: branch.name,
        address: branch.address,
        city: branch.city,
        country: branch.country,
        latitude: branch.latitude,
        longitude: branch.longitude,
        phone_number: branch.phone_number || "",
        is_primary: branch.is_primary,
        is_verified: branch.is_verified,
        distance_from_center: branch.distance_from_center || "",
        custom_attributes: branch.custom_attributes,
      });

      // Handle Opening Hours
      let initialHours: OpeningHour[] = branch.opening_hours || [];

      // If no structured hours, try to parse 'timings' string
      // Format example: "12:00:00-23:59:00"
      if (initialHours.length === 0) {
        const timingsString =
          branch.timings ||
          (branch.custom_attributes?.peekaboo_timings as string);

        if (timingsString && timingsString.includes("-")) {
          try {
            const [start, end] = timingsString.split("-");
            // Slice to HH:mm (first 5 chars) if format is HH:mm:ss
            const openTime = start ? start.trim().slice(0, 5) : null;
            const closeTime = end ? end.trim().slice(0, 5) : null;

            if (openTime && closeTime) {
              // Apply this timing to all 7 days
              initialHours = Array.from({ length: 7 }, (_, i) => ({
                dayOfWeek: i,
                openTime: openTime,
                closeTime: closeTime,
                isClosed: false,
              }));
            }
          } catch (_err) {
            // Invalid format, ignore
          }
        }
      }

      // If still empty (no data or parse failed), initialize with default 7 empty days
      if (initialHours.length === 0) {
        initialHours = Array.from({ length: 7 }, (_, i) => ({
          dayOfWeek: i,
          openTime: null,
          closeTime: null,
          isClosed: false,
        }));
      }

      setOpeningHours(initialHours);
    } else {
      // Reset for new branch
      setFormData({
        name: "",
        address: "",
        city: "Karachi",
        country: "Pakistan",
        latitude: "",
        longitude: "",
        phone_number: "",
        is_primary: false,
        is_verified: false,
        distance_from_center: "",
      });
      // Initialize empty structure for new branch
      setOpeningHours(
        Array.from({ length: 7 }, (_, i) => ({
          dayOfWeek: i,
          openTime: null,
          closeTime: null,
          isClosed: false,
        }))
      );
    }
    setErrors({});
    setActiveTab("details");
  }, [branch, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Branch name is required";
    }
    if (!formData.address.trim()) {
      newErrors.address = "Address is required";
    }
    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }
    if (!formData.latitude || formData.latitude === "") {
      newErrors.latitude = "Latitude is required";
    } else {
      const lat = parseFloat(formData.latitude as string);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        newErrors.latitude = "Invalid latitude (-90 to 90)";
      }
    }
    if (!formData.longitude || formData.longitude === "") {
      newErrors.longitude = "Longitude is required";
    } else {
      const lng = parseFloat(formData.longitude as string);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        newErrors.longitude = "Invalid longitude (-180 to 180)";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Convert string lat/lng to numbers
    const submitData: BranchFormData = {
      ...formData,
      latitude: parseFloat(formData.latitude as string),
      longitude: parseFloat(formData.longitude as string),
    };

    await onSave(submitData, openingHours);
  };

  const handleChange = (field: keyof BranchFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{branch ? "Edit Branch" : "Add New Branch"}</DialogTitle>
          <DialogDescription>
            {branch
              ? "Update branch details and operating hours."
              : "Add a new branch location with its details and operating hours."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Branch Details
              </TabsTrigger>
              <TabsTrigger value="hours" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Opening Hours
              </TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 py-4">
              {/* Branch Name */}
              <div className="space-y-2">
                <Label htmlFor="branch-name">
                  Branch Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="branch-name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g., Gulshan Branch, DHA Location"
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="branch-address">
                  Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="branch-address"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Full street address"
                  className={errors.address ? "border-destructive" : ""}
                />
                {errors.address && (
                  <p className="text-sm text-destructive">{errors.address}</p>
                )}
              </div>

              {/* City & Country */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="branch-city">
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="branch-city"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    placeholder="Karachi"
                    className={errors.city ? "border-destructive" : ""}
                  />
                  {errors.city && (
                    <p className="text-sm text-destructive">{errors.city}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch-country">Country</Label>
                  <Input
                    id="branch-country"
                    value={formData.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                    placeholder="Pakistan"
                  />
                </div>
              </div>

              {/* Latitude & Longitude */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="branch-latitude">
                    Latitude <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="branch-latitude"
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => handleChange("latitude", e.target.value)}
                    placeholder="24.8607"
                    className={errors.latitude ? "border-destructive" : ""}
                  />
                  {errors.latitude && (
                    <p className="text-sm text-destructive">
                      {errors.latitude}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch-longitude">
                    Longitude <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="branch-longitude"
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => handleChange("longitude", e.target.value)}
                    placeholder="67.0011"
                    className={errors.longitude ? "border-destructive" : ""}
                  />
                  {errors.longitude && (
                    <p className="text-sm text-destructive">
                      {errors.longitude}
                    </p>
                  )}
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="branch-phone">Phone Number</Label>
                <Input
                  id="branch-phone"
                  value={formData.phone_number}
                  onChange={(e) => handleChange("phone_number", e.target.value)}
                  placeholder="+92 21 1234567"
                />
              </div>

              {/* Switches */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="is-primary">Primary Branch</Label>
                    <p className="text-sm text-muted-foreground">
                      Set as the main/primary location
                    </p>
                  </div>
                  <Switch
                    id="is-primary"
                    checked={formData.is_primary}
                    onCheckedChange={(checked) =>
                      handleChange("is_primary", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="is-verified">Verified</Label>
                    <p className="text-sm text-muted-foreground">
                      Mark as verified location
                    </p>
                  </div>
                  <Switch
                    id="is-verified"
                    checked={formData.is_verified}
                    onCheckedChange={(checked) =>
                      handleChange("is_verified", checked)
                    }
                  />
                </div>
              </div>
            </TabsContent>

            {/* Opening Hours Tab */}
            <TabsContent value="hours" className="py-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Set the operating hours for this specific branch. These hours
                  will override the general listing hours for this location.
                </p>
                <OpeningHoursEditor
                  value={openingHours}
                  onChange={setOpeningHours}
                  disabled={isLoading}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {branch ? "Update Branch" : "Add Branch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
