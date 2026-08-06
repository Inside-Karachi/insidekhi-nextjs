"use client";

import { useState, useEffect, useCallback } from "react";
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
import { BankCardImage } from "@/components/bank-cards/BankCardImage";
import { Plus, Edit2, Trash2, Tag, Loader2, Check, CreditCard } from "lucide-react";

type CardVariant = {
  id: number;
  card_name: string;
  card_type: string;
  card_network: string;
  card_tier: string | null;
  image_filename: string | null;
};

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
  valid_card_variants: number[];
}

interface DealsTabProps {
  listingId: number;
}

const EMPTY_FORM: Deal = {
  title: "",
  description: "",
  deal_type: "general",
  bank_id: null,
  discount_value: "",
  start_date: "",
  end_date: "",
  is_active: true,
  valid_card_variants: [],
};

export default function DealsTab({ listingId }: DealsTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [banks, setBanks] = useState<Array<{ id: number; name: string }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [formData, setFormData] = useState<Deal>(EMPTY_FORM);
  const [cards, setCards] = useState<CardVariant[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [selectedBankName, setSelectedBankName] = useState("");

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

  // Card products for the selected bank - step two of "General/Bank Deal"
  // → "which bank" → "which of the bank's cards" so a deal can be scoped
  // to a specific tier (e.g. Platinum only) instead of the whole bank.
  const fetchCardsForBank = useCallback(
    async (bankId: string) => {
      if (!bankId) {
        setCards([]);
        return;
      }
      setCardsLoading(true);
      try {
        const response = await fetch(`/api/cards?bankId=${bankId}`);
        const data = await response.json();
        if (data.success) {
          setCards(data.cards || []);
        } else {
          setCards([]);
          toast({
            title: "Error",
            description: "Failed to load cards for this bank",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching cards:", error);
        setCards([]);
        toast({
          title: "Error",
          description: "Failed to load cards",
          variant: "destructive",
        });
      } finally {
        setCardsLoading(false);
      }
    },
    [toast],
  );

  function handleBankChange(bankId: string) {
    setFormData({ ...formData, bank_id: parseInt(bankId), valid_card_variants: [] });
    fetchCardsForBank(bankId);
    setSelectedBankName(banks.find((b) => b.id.toString() === bankId)?.name || "");
  }

  function toggleCardVariant(cardId: number) {
    const selected = formData.valid_card_variants.includes(cardId);
    setFormData({
      ...formData,
      valid_card_variants: selected
        ? formData.valid_card_variants.filter((id) => id !== cardId)
        : [...formData.valid_card_variants, cardId],
    });
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
        setFormData(EMPTY_FORM);
        setCards([]);
        setSelectedBankName("");
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

  function openEdit(deal: Deal) {
    setEditingDeal(deal);
    setFormData({ ...deal, valid_card_variants: deal.valid_card_variants || [] });
    if (deal.deal_type === "bank_discount" && deal.bank_id) {
      setSelectedBankName(banks.find((b) => b.id === deal.bank_id)?.name || "");
      fetchCardsForBank(deal.bank_id.toString());
    }
    setShowForm(true);
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
            setFormData(EMPTY_FORM);
            setCards([]);
            setSelectedBankName("");
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
                  {deal.valid_card_variants && deal.valid_card_variants.length > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <CreditCard className="h-3 w-3" />
                      {deal.valid_card_variants.length} Card
                      {deal.valid_card_variants.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {deal.is_active ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openEdit(deal)}>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                    onValueChange={handleBankChange}
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

            {formData.deal_type === "bank_discount" && formData.bank_id && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Valid Cards
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    Leave empty to apply to every {selectedBankName} card
                  </span>
                  {formData.valid_card_variants.length > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({formData.valid_card_variants.length} selected)
                    </span>
                  )}
                </Label>
                {cardsLoading ? (
                  <div className="flex items-center justify-center p-8 border-2 border-dashed border-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">
                        Loading available cards...
                      </span>
                    </div>
                  </div>
                ) : cards.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5 max-h-[280px] overflow-y-auto pr-1 pb-1">
                      {cards.map((card) => {
                        const isSelected = formData.valid_card_variants.includes(card.id);
                        return (
                          <div
                            key={`card-${card.id}`}
                            onClick={() => toggleCardVariant(card.id)}
                            className={`cursor-pointer group relative flex flex-col items-center p-2.5 rounded-xl border transition-all duration-200 ${
                              isSelected
                                ? "bg-primary/5 border-primary shadow-sm"
                                : "bg-card border-border/50 hover:border-primary/50"
                            }`}
                          >
                            <div
                              className={`absolute top-1.5 right-1.5 transition-opacity duration-200 ${
                                isSelected ? "opacity-100" : "opacity-0"
                              }`}
                            >
                              <div className="bg-primary text-primary-foreground rounded-full p-0.5">
                                <Check className="h-3 w-3" />
                              </div>
                            </div>
                            <div className="mb-2">
                              <BankCardImage
                                cardVariant={{
                                  id: card.id,
                                  bank_id: formData.bank_id as number,
                                  card_name: card.card_name,
                                  card_type: card.card_type,
                                  card_network: card.card_network,
                                  card_tier: card.card_tier,
                                  image_filename: card.image_filename,
                                  is_active: true,
                                  created_at: new Date().toISOString(),
                                  updated_at: new Date().toISOString(),
                                }}
                                bankName={selectedBankName}
                                size="md"
                                showName={false}
                              />
                            </div>
                            <p
                              className={`text-xs text-center font-medium leading-relaxed line-clamp-2 ${
                                isSelected ? "text-primary" : "text-muted-foreground"
                              }`}
                              title={card.card_name}
                            >
                              {card.card_name}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    {formData.valid_card_variants.length > 0 && (
                      <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-2 text-sm">
                          <CreditCard className="h-4 w-4 text-primary" />
                          <span className="font-medium">
                            {formData.valid_card_variants.length} card
                            {formData.valid_card_variants.length !== 1 ? "s" : ""} selected
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData({ ...formData, valid_card_variants: [] })}
                          className="text-xs h-7 px-2 hover:bg-destructive/10 hover:text-destructive"
                        >
                          Clear All
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    No card products found for this bank.
                  </p>
                )}
              </div>
            )}

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
