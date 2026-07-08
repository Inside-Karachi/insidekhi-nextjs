"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Star, MapPin } from "lucide-react";
import type { Database } from "@/types/supabase";

type Branch = Database["public"]["Tables"]["listing_branches"]["Row"];

interface BranchForm {
  name: string;
  address: string;
  phone_number: string;
  latitude: number;
  longitude: number;
  is_primary: boolean;
}

interface BranchesTabProps {
  listingId: number;
}

export default function BranchesTab({ listingId }: BranchesTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<BranchForm>({
    name: "",
    address: "",
    phone_number: "",
    latitude: 24.8607, // Karachi default
    longitude: 67.0011,
    is_primary: false,
  });

  // Fetch branches
  const fetchBranches = useCallback(() => {
    fetch(`/api/business/listings/${listingId}/branches`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setBranches(data.data.branches || []))
      .catch((error) => console.error("Failed to fetch branches:", error));
  }, [listingId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // Create or update branch
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      const endpoint = editingBranch
        ? `/api/business/listings/${listingId}/branches/${editingBranch.id}`
        : `/api/business/listings/${listingId}/branches`;

      const method = editingBranch ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save branch");
      }

      toast({
        title: editingBranch ? "Branch Updated" : "Branch Created",
        description: "Branch saved successfully",
      });

      setFormData({
        name: "",
        address: "",
        phone_number: "",
        latitude: 24.8607,
        longitude: 67.0011,
        is_primary: false,
      });
      setEditingBranch(null);
      setShowForm(false);
      fetchBranches();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save branch",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Delete branch
  async function deleteBranch(branch: Branch) {
    try {
      setLoading(true);

      const response = await fetch(
        `/api/business/listings/${listingId}/branches/${branch.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete branch");
      }

      toast({
        title: "Branch Deleted",
        description: "Branch removed successfully",
      });

      setDeletingBranch(null);
      fetchBranches();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete branch",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Edit branch
  function startEdit(branch: Branch) {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address,
      phone_number: branch.phone_number || "",
      latitude: branch.latitude,
      longitude: branch.longitude,
      is_primary: branch.is_primary || false,
    });
    setShowForm(true);
  }

  // Cancel edit
  function cancelEdit() {
    setEditingBranch(null);
    setShowForm(false);
    setFormData({
      name: "",
      address: "",
      phone_number: "",
      latitude: 24.8607,
      longitude: 67.0011,
      is_primary: false,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Branches & Locations</h3>
          <p className="text-sm text-muted-foreground">
            Manage your business locations
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Branch
          </Button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingBranch ? "Edit Branch" : "Add New Branch"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Branch Name *</Label>
                  <Input
                    id="name"
                    placeholder="Main Branch"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <Input
                    id="phone_number"
                    placeholder="+92 300 1234567"
                    value={formData.phone_number}
                    onChange={(e) =>
                      setFormData({ ...formData, phone_number: e.target.value })
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    placeholder="Street address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="0.000001"
                    value={formData.latitude}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        latitude: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="0.000001"
                    value={formData.longitude}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        longitude: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="flex items-center gap-2 md:col-span-2">
                  <input
                    type="checkbox"
                    id="is_primary"
                    checked={formData.is_primary}
                    onChange={(e) =>
                      setFormData({ ...formData, is_primary: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="is_primary" className="cursor-pointer">
                    Set as primary branch
                  </Label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingBranch ? "Update Branch" : "Add Branch"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Branches List */}
      <div className="grid gap-4 md:grid-cols-2">
        {branches.map((branch) => (
          <Card key={branch.id}>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{branch.name}</h4>
                    {branch.is_primary && (
                      <Badge variant="default" className="gap-1">
                        <Star className="h-3 w-3" />
                        Primary
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEdit(branch)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingBranch(branch)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{branch.address}</span>
                  </div>
                  {branch.phone_number && (
                    <div className="ml-6">{branch.phone_number}</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {branches.length === 0 && !showForm && (
          <div className="md:col-span-2 text-center py-8 text-muted-foreground">
            No branches added yet. Click &quot;Add Branch&quot; to get started.
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingBranch}
        onOpenChange={(open) => !open && setDeletingBranch(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingBranch?.name}
              &quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBranch && deleteBranch(deletingBranch)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
