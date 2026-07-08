"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import {
  Plus,
  Download,
  Copy,
  Trash2,
  MapPin,
  Calendar,
  Loader2,
  CheckCircle2,
  RefreshCw,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PremiumDropdown } from "@/components/brand/Dropdown";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface QRCode {
  id: number;
  code: string;
  name: string;
  description?: string;
  xp_value: number;
  cooldown_type: "once" | "daily" | "weekly" | "unlimited";
  is_active: boolean;
  expires_at?: string;
  listing_id?: number;
  event_id?: number;
  scan_count: number;
  created_at: string;
  listing?: { name: string };
  event?: { name: string };
}

interface Listing {
  id: number;
  name: string;
}

interface Event {
  id: number;
  name: string;
}

export function AdminQRGenerator() {
  const [qrCodes, setQRCodes] = React.useState<QRCode[]>([]);
  const [listings, setListings] = React.useState<Listing[]>([]);
  // Events fetched but not yet used in UI (future feature)
  const [_events, setEvents] = React.useState<Event[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [selectedQR, setSelectedQR] = React.useState<QRCode | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    qr_type: "listing" as "listing" | "event" | "ticket",
    xp_value: 50,
    cooldown_type: "once" as "once" | "daily" | "weekly" | "unlimited",
    listing_id: "",
    event_id: "",
    expires_days: "",
  });

  // Fetch QR codes
  const fetchQRCodes = React.useCallback(async () => {
    try {
      const response = await fetch("/api/admin/gamification/qr-codes");
      const data = await response.json();
      if (response.ok) {
        setQRCodes(data.qrCodes || []);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load QR codes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch listings and events for dropdown
  const fetchOptions = React.useCallback(async () => {
    try {
      const [listingsRes, eventsRes] = await Promise.all([
        fetch("/api/admin/listings?limit=500"),
        fetch("/api/admin/events?limit=100"),
      ]);

      const listingsData = await listingsRes.json();
      const eventsData = await eventsRes.json();

      // Handle nested response format: {success: true, data: {listings: [...]}}
      let listingsArray: Listing[] = [];
      let eventsArray: Event[] = [];

      if (Array.isArray(listingsData)) {
        listingsArray = listingsData;
      } else if (listingsData?.data?.listings) {
        listingsArray = listingsData.data.listings;
      } else if (listingsData?.listings) {
        listingsArray = listingsData.listings;
      }

      if (Array.isArray(eventsData)) {
        eventsArray = eventsData;
      } else if (eventsData?.data?.events) {
        eventsArray = eventsData.data.events;
      } else if (eventsData?.events) {
        eventsArray = eventsData.events;
      }

      setListings(listingsArray);
      setEvents(eventsArray);
    } catch (_error) {
      // Silently fail - not critical
    }
  }, []);

  React.useEffect(() => {
    fetchQRCodes();
    fetchOptions();
  }, [fetchQRCodes, fetchOptions]);

  // Create QR code
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a name for the QR code",
        variant: "destructive",
      });
      return;
    }

    // Validate - listing_id is OPTIONAL now for testing purposes
    // Only validate if qr_type requires it AND user actually wants to link
    if (formData.qr_type === "event" && !formData.event_id) {
      toast({
        title: "Validation Error",
        description: "Please select an event for event-type QR code",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const payload = {
        name: formData.name,
        qr_type: formData.qr_type,
        description: formData.description || null,
        xp_value: formData.xp_value,
        cooldown_type: formData.cooldown_type,
        listing_id: formData.listing_id ? parseInt(formData.listing_id) : null,
        event_id: formData.event_id ? parseInt(formData.event_id) : null,
        expires_at: formData.expires_days
          ? new Date(
              Date.now() + parseInt(formData.expires_days) * 24 * 60 * 60 * 1000
            ).toISOString()
          : null,
      };

      const response = await fetch("/api/admin/gamification/qr-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "QR code created successfully",
        });
        setShowCreateDialog(false);
        setFormData({
          name: "",
          description: "",
          qr_type: "listing",
          xp_value: 50,
          cooldown_type: "once",
          listing_id: "",
          event_id: "",
          expires_days: "",
        });
        fetchQRCodes();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to create QR code",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to create QR code",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Delete QR code
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this QR code?")) return;

    try {
      const response = await fetch(
        `/api/admin/gamification/qr-codes?id=${id}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        toast({
          title: "Deleted",
          description: "QR code deleted successfully",
        });
        fetchQRCodes();
      } else {
        toast({
          title: "Error",
          description: "Failed to delete QR code",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to delete QR code",
        variant: "destructive",
      });
    }
  };

  // Copy code to clipboard
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied",
      description: "QR code copied to clipboard",
    });
  };

  // Download QR code as PNG
  const downloadQR = (qr: QRCode) => {
    const svg = document.getElementById(`qr-${qr.id}`);
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 400, 400);
      ctx.drawImage(img, 50, 50, 300, 300);

      // Add text
      ctx.fillStyle = "black";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(qr.name, 200, 380);

      const link = document.createElement("a");
      link.download = `qr-${qr.code}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const cooldownLabels: Record<string, string> = {
    once: "One-time use",
    daily: "Daily reset",
    weekly: "Weekly reset",
    unlimited: "Unlimited scans",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Partner QR Codes</h2>
          <p className="text-sm text-muted-foreground">
            Generate QR codes for partner locations to reward users with XP
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchQRCodes}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create QR Code
          </Button>
        </div>
      </div>

      {/* QR Code Grid */}
      {qrCodes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <QrCode className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No QR codes created yet</p>
            <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
              Create your first QR code
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {qrCodes.map((qr) => (
            <motion.div
              key={qr.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className={qr.is_active ? "" : "opacity-60"}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{qr.name}</CardTitle>
                      {qr.description && (
                        <CardDescription className="text-xs mt-1">
                          {qr.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyCode(qr.code)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => downloadQR(qr)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(qr.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* QR Code Preview */}
                  <div
                    className="flex justify-center p-4 bg-white rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setSelectedQR(qr)}
                  >
                    <QRCodeSVG
                      id={`qr-${qr.id}`}
                      value={qr.code}
                      size={120}
                      level="M"
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                    />
                  </div>

                  {/* Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">XP Reward</span>
                      <span className="font-semibold text-primary">
                        +{qr.xp_value} XP
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="text-xs">
                        {cooldownLabels[qr.cooldown_type]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Scans</span>
                      <span className="font-mono">{qr.scan_count}</span>
                    </div>
                    {qr.listing && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {qr.listing.name}
                      </div>
                    )}
                    {qr.event && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {qr.event.name}
                      </div>
                    )}
                  </div>

                  {/* Code */}
                  <div className="font-mono text-xs text-center bg-muted/50 rounded px-2 py-1">
                    {qr.code}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Partner QR Code</DialogTitle>
            <DialogDescription>
              Generate a new QR code for partner locations to reward users with
              XP
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Weekend Special QR"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qr_type">QR Code Type *</Label>
              <Select
                value={formData.qr_type}
                onValueChange={(value: "listing" | "event" | "ticket") =>
                  setFormData({
                    ...formData,
                    qr_type: value,
                    listing_id: "",
                    event_id: "",
                  })
                }
              >
                <SelectTrigger id="qr_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="listing">Location / Listing</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="ticket">Ticket Verification</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formData.qr_type === "listing" &&
                  "For partner restaurants, cafes, and venues"}
                {formData.qr_type === "event" &&
                  "For event check-ins and special XP rewards"}
                {formData.qr_type === "ticket" &&
                  "For ticket verification (organizers only)"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="xp_value">XP Reward</Label>
                <Input
                  id="xp_value"
                  type="number"
                  value={formData.xp_value}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      xp_value: parseInt(e.target.value) || 0,
                    })
                  }
                  min={1}
                  max={1000}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cooldown_type">Cooldown</Label>
                <Select
                  value={formData.cooldown_type}
                  onValueChange={(
                    value: "once" | "daily" | "weekly" | "unlimited"
                  ) => setFormData({ ...formData, cooldown_type: value })}
                >
                  <SelectTrigger id="cooldown_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">One-time use</SelectItem>
                    <SelectItem value="daily">Daily reset</SelectItem>
                    <SelectItem value="weekly">Weekly reset</SelectItem>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Show Listing selector for 'listing' type */}
            {formData.qr_type === "listing" && (
              <div className="space-y-2">
                <Label>Select Listing (Optional)</Label>
                <PremiumDropdown
                  value={formData.listing_id || ""}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      listing_id: value || "",
                    })
                  }
                  options={[
                    { value: "", label: "-- No listing (test QR) --" },
                    ...listings.map((listing) => ({
                      value: listing.id.toString(),
                      label: listing.name,
                    })),
                  ]}
                  placeholder="Search listings..."
                  searchable={true}
                />
                <p className="text-xs text-muted-foreground">
                  {listings.length} listings available. Leave empty for test QR.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="expires_days">Expires in (days)</Label>
              <Input
                id="expires_days"
                type="number"
                value={formData.expires_days}
                onChange={(e) =>
                  setFormData({ ...formData, expires_days: e.target.value })
                }
                placeholder="Leave empty for no expiration"
                min={1}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Create QR Code
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full QR Preview Dialog */}
      <Dialog open={!!selectedQR} onOpenChange={() => setSelectedQR(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selectedQR?.name}</DialogTitle>
            {selectedQR?.description && (
              <DialogDescription>{selectedQR.description}</DialogDescription>
            )}
          </DialogHeader>

          {selectedQR && (
            <div className="flex flex-col items-center py-4">
              <div className="p-6 bg-white rounded-xl">
                <QRCodeSVG
                  id={`qr-full-${selectedQR.id}`}
                  value={selectedQR.code}
                  size={200}
                  level="H"
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                />
              </div>
              <p className="mt-4 font-mono text-sm">{selectedQR.code}</p>
              <p className="text-primary font-semibold mt-2">
                +{selectedQR.xp_value} XP
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => copyCode(selectedQR?.code || "")}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Code
            </Button>
            <Button onClick={() => selectedQR && downloadQR(selectedQR)}>
              <Download className="w-4 h-4 mr-2" />
              Download PNG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
