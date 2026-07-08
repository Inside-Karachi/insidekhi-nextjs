"use client";

import { useState,useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Tag, Loader2 } from "lucide-react";

interface Deal {
  id?: number;
  title: string;
  description: string;
  deal_type: "general" | "bank_discount";
  bank_id: number | null;
  discount_value: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface DealsTabProps {
  listingId: number;
}

export default function DealsTab({ listingId }: DealsTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [banks, setBanks] = useState<Array<{ id: number; name: string }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [formData, setFormData] = useState<Deal>({
    title: "",
    description: "",
    deal_type: "general",
    bank_id: null,
    discount_value: "",
    start_date: "",
    end_date: "",
    is_active: true,
  });

  useEffect(() => {
    fetchDeals();
    fetchBanks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  async function fetchDeals() {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/listings/${listingId}/deals`);
      if (response.ok) {
        const data = await response.json();
        setDeals(data.deals || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load deals",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch deals:", error);
      toast({
        title: "Error",
        description: "Failed to load deals",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchBanks() {
    try {
      const response = await fetch("/api/banks");
      if (response.ok) {
        const data = await response.json();
        setBanks(data.banks || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load banks",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch banks:", error);
      toast({
        title: "Error",
        description: "Failed to load banks",
        variant: "destructive",
      });
    }
  }

  async function handleSubmit() {
    try {
      const url = `/api/admin/listings/${listingId}/deals`;

      const response = await fetch(url, {
        method: editingDeal ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingDeal ? { ...formData, id: editingDeal.id } : formData),
      });

      if (response.ok) {
        await fetchDeals();
        setShowForm(false);
        setEditingDeal(null);
        setFormData({
          title: "",
          description: "",
          deal_type: "general",
          bank_id: null,
          discount_value: "",
          start_date: "",
          end_date: "",
          is_active: true,
        });
        toast({
          title: "Success",
          description: editingDeal ? "Deal updated" : "Deal added",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to save deal",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to save deal",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: number) {
    try {
      const response = await fetch(
        `/api/admin/listings/${listingId}/deals?dealId=${id}`,
        { method: "DELETE" },
      );

      if (response.ok) {
        await fetchDeals();
        toast({
          title: "Success",
          description: "Deal deleted",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete deal",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to delete deal",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Deals & Promotions</h3>
        </div>
        <Button
          onClick={() => {
            setEditingDeal(null);
            setFormData({
              title: "",
              description: "",
              deal_type: "general",
              bank_id: null,
              discount_value: "",
              start_date: "",
              end_date: "",
              is_active: true,
            });
            setShowForm(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Deal
        </Button>
      </div>

      {deals.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No deals yet. Add your first deal or promotion.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {deals.map((deal) => (
            <Card key={deal.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold">
                  {deal.title}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {deal.is_active ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingDeal(deal);
                      setFormData(deal);
                      setShowForm(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Delete "${deal.title}"?`)) {
                        if (deal.id) handleDelete(deal.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  {deal.description}
                </p>
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="font-medium">Type:</span>{" "}
                    {deal.deal_type === "bank_discount"
                      ? "Bank Deal"
                      : "General"}
                  </div>
                  <div>
                    <span className="font-medium">Discount:</span>{" "}
                    {deal.discount_value}
                  </div>
                  <div>
                    <span className="font-medium">Valid:</span>{" "}
                    {new Date(deal.start_date).toLocaleDateString()} -{" "}
                    {new Date(deal.end_date).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Deal Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingDeal ? "Edit Deal" : "Add New Deal"}
            </DialogTitle>
            <DialogDescription>
              Create special offers and promotions for your listing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Deal Title</Label>
              <Input
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., 20% Off on All Items"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe the deal details"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Deal Type</Label>
                <Select
                  value={formData.deal_type}
                  onValueChange={(value: "general" | "bank_discount") =>
                    setFormData({ ...formData, deal_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Promotion</SelectItem>
                    <SelectItem value="bank_discount">Bank Deal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.deal_type === "bank_discount" && (
                <div>
                  <Label>Bank</Label>
                  <Select
                    value={formData.bank_id?.toString() || ""}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        bank_id: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((bank) => (
                        <SelectItem key={bank.id} value={bank.id.toString()}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div>
              <Label>Discount Value</Label>
              <Input
                value={formData.discount_value}
                onChange={(e) =>
                  setFormData({ ...formData, discount_value: e.target.value })
                }
                placeholder="e.g., 20%, Rs. 500 off"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label>Active</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.title.trim() || !formData.discount_value}
            >
              {editingDeal ? "Update" : "Add"} Deal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
