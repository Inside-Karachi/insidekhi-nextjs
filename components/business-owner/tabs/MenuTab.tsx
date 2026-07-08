"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChefHat, Trash, Loader2, FileText, Plus, Edit2 } from "lucide-react";

interface MenuSection {
  id: number;
  name: string;
  description: string | null;
  display_order: number;
  menu_items: MenuItem[] | null;
}

interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  is_featured: boolean;
  display_order: number;
  image_url: string | null;
  image_alt: string | null;
}

interface MenuTabProps {
  listingId: number;
}

export default function MenuTab({ listingId }: MenuTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [menuSections, setMenuSections] = useState<MenuSection[]>([]);
  const [menuPdfUrl, setMenuPdfUrl] = useState<string | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);

  // Modal states
  const [showAddSection, setShowAddSection] = useState(false);
  const [showEditSection, setShowEditSection] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showEditItem, setShowEditItem] = useState(false);

  const [selectedSection, setSelectedSection] = useState<MenuSection | null>(
    null,
  );
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // Form data
  const [sectionForm, setSectionForm] = useState({
    name: "",
    description: "",
    display_order: 0,
  });

  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    price: 0,
    is_available: true,
    is_featured: false,
    display_order: 0,
    section_id: 0,
  });

  useEffect(() => {
    fetchMenuData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  async function fetchMenuData() {
    try {
      setLoading(true);
      const [menuRes, listingRes] = await Promise.all([
        fetch(`/api/admin/listings/${listingId}/menu`),
        fetch(`/api/admin/listings/${listingId}`),
      ]);
      if (menuRes.ok) {
        const menuData = await menuRes.json();
        setMenuSections(menuData.data || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load menu sections",
          variant: "destructive",
        });
      }
      if (listingRes.ok) {
        const listingData = await listingRes.json();
        setMenuPdfUrl(listingData.data?.listing?.menu_pdf_url ?? null);
      }
    } catch (error) {
      console.error("Failed to fetch menu:", error);
      toast({
        title: "Error",
        description: "Failed to load menu data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handlePdfUpload(file: File) {
    try {
      setPdfUploading(true);
      const formData = new FormData();
      formData.append("pdf", file);

      const response = await fetch(
        `/api/admin/listings/${listingId}/menu-pdf`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.ok) {
        const data = await response.json();
        setMenuPdfUrl(data.data?.pdf_url);
        toast({
          title: "Success",
          description: "Menu PDF uploaded successfully",
        });
      } else {
        throw new Error("Upload failed");
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to upload PDF",
        variant: "destructive",
      });
    } finally {
      setPdfUploading(false);
    }
  }

  async function handleAddSection() {
    try {
      const response = await fetch(
        `/api/admin/listings/${listingId}/menu`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sectionForm),
        },
      );

      if (response.ok) {
        await fetchMenuData();
        setShowAddSection(false);
        setSectionForm({ name: "", description: "", display_order: 0 });
        toast({
          title: "Success",
          description: "Menu section added",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to add section",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to add section",
        variant: "destructive",
      });
    }
  }

  async function handleEditSection() {
    if (!selectedSection) return;

    try {
      const response = await fetch(
        `/api/admin/listings/${listingId}/menu/sections/${selectedSection.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sectionForm),
        },
      );

      if (response.ok) {
        await fetchMenuData();
        setShowEditSection(false);
        setSelectedSection(null);
        toast({
          title: "Success",
          description: "Section updated",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update section",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to update section",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteSection(sectionId: number) {
    try {
      const response = await fetch(
        `/api/admin/listings/${listingId}/menu/sections/${sectionId}`,
        { method: "DELETE" },
      );

      if (response.ok) {
        await fetchMenuData();
        toast({
          title: "Success",
          description: "Section deleted",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete section",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to delete section",
        variant: "destructive",
      });
    }
  }

  async function handleAddItem() {
    try {
      const response = await fetch(
        `/api/admin/listings/${listingId}/menu/sections/${itemForm.section_id}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemForm),
        },
      );

      if (response.ok) {
        await fetchMenuData();
        setShowAddItem(false);
        setItemForm({
          name: "",
          description: "",
          price: 0,
          is_available: true,
          is_featured: false,
          display_order: 0,
          section_id: 0,
        });
        toast({
          title: "Success",
          description: "Menu item added",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to add item",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to add item",
        variant: "destructive",
      });
    }
  }

  async function handleEditItem() {
    if (!selectedSection || !selectedItem) return;

    try {
      const response = await fetch(
        `/api/admin/listings/${listingId}/menu/sections/${selectedSection.id}/items/${selectedItem.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemForm),
        },
      );

      if (response.ok) {
        await fetchMenuData();
        setShowEditItem(false);
        setSelectedItem(null);
        toast({
          title: "Success",
          description: "Item updated",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update item",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteItem(sectionId: number, itemId: number) {
    try {
      const response = await fetch(
        `/api/admin/listings/${listingId}/menu/sections/${sectionId}/items/${itemId}`,
        { method: "DELETE" },
      );

      if (response.ok) {
        await fetchMenuData();
        toast({
          title: "Success",
          description: "Item deleted",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete item",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to delete item",
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
    <div className="space-y-8">
      {/* PDF Upload Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Menu PDF</h3>
        </div>
        <div className="border-2 border-dashed rounded-lg p-6">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePdfUpload(file);
            }}
            disabled={pdfUploading}
            className="hidden"
            id="pdf-upload"
          />
          <label
            htmlFor="pdf-upload"
            className="flex flex-col items-center justify-center cursor-pointer"
          >
            {pdfUploading ? (
              <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
            ) : (
              <>
                <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {menuPdfUrl ? "Replace Menu PDF" : "Upload Menu PDF"}
                </p>
              </>
            )}
          </label>
          {menuPdfUrl && (
            <div className="mt-4 text-center">
              <a
                href={menuPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View Current PDF
              </a>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Digital Menu Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Digital Menu</h3>
          </div>
          <Button
            onClick={() => {
              setSectionForm({
                name: "",
                description: "",
                display_order: menuSections.length,
              });
              setShowAddSection(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
        </div>

        {menuSections.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <ChefHat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No menu sections yet. Add your first section to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {menuSections.map((section) => (
              <div key={section.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-lg">{section.name}</h4>
                    {section.description && (
                      <p className="text-sm text-muted-foreground">
                        {section.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setItemForm({
                          ...itemForm,
                          section_id: section.id,
                          display_order: section.menu_items?.length || 0,
                        });
                        setShowAddItem(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Item
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSection(section);
                        setSectionForm({
                          name: section.name,
                          description: section.description || "",
                          display_order: section.display_order,
                        });
                        setShowEditSection(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (
                          confirm(
                            `Delete "${section.name}" and all its items?`,
                          )
                        ) {
                          handleDeleteSection(section.id);
                        }
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {section.menu_items && section.menu_items.length > 0 ? (
                  <div className="space-y-2">
                    {section.menu_items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.name}</span>
                            {item.is_featured && (
                              <Badge variant="secondary">Featured</Badge>
                            )}
                            {!item.is_available && (
                              <Badge variant="destructive">Unavailable</Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-semibol text-lg text-primary">
                            Rs. {item.price}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedSection(section);
                                setSelectedItem(item);
                                setItemForm({
                                  name: item.name,
                                  description: item.description || "",
                                  price: item.price,
                                  is_available: item.is_available,
                                  is_featured: item.is_featured,
                                  display_order: item.display_order,
                                  section_id: section.id,
                                });
                                setShowEditItem(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Delete "${item.name}"?`)) {
                                  handleDeleteItem(section.id, item.id);
                                }
                              }}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No items in this section
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Section Dialog */}
      <Dialog open={showAddSection} onOpenChange={setShowAddSection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Menu Section</DialogTitle>
            <DialogDescription>
              Create a new section for your menu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Section Name</Label>
              <Input
                value={sectionForm.name}
                onChange={(e) =>
                  setSectionForm({ ...sectionForm, name: e.target.value })
                }
                placeholder="e.g., Appetizers, Main Course"
              />
            </div>
            <div>
              <Label>Description (Optional)</Label>
              <Textarea
                value={sectionForm.description}
                onChange={(e) =>
                  setSectionForm({
                    ...sectionForm,
                    description: e.target.value,
                  })
                }
                placeholder="Brief description"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddSection(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSection}
              disabled={!sectionForm.name.trim()}
            >
              Add Section
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Section Dialog */}
      <Dialog open={showEditSection} onOpenChange={setShowEditSection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Menu Section</DialogTitle>
            <DialogDescription>Update section details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Section Name</Label>
              <Input
                value={sectionForm.name}
                onChange={(e) =>
                  setSectionForm({ ...sectionForm, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Description (Optional)</Label>
              <Textarea
                value={sectionForm.description}
                onChange={(e) =>
                  setSectionForm({
                    ...sectionForm,
                    description: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditSection(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSection}>Update Section</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Menu Item</DialogTitle>
            <DialogDescription>Add a new item to this section</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item Name</Label>
              <Input
                value={itemForm.name}
                onChange={(e) =>
                  setItemForm({ ...itemForm, name: e.target.value })
                }
                placeholder="e.g., Chicken Biryani"
              />
            </div>
            <div>
              <Label>Description (Optional)</Label>
              <Textarea
                value={itemForm.description}
                onChange={(e) =>
                  setItemForm({ ...itemForm, description: e.target.value })
                }
                placeholder="Brief description"
              />
            </div>
            <div>
              <Label>Price (Rs.)</Label>
              <Input
                type="number"
                value={itemForm.price}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    price: parseFloat(e.target.value) || 0,
                  })
                }
                step="0.01"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={itemForm.is_available}
                  onCheckedChange={(checked) =>
                    setItemForm({ ...itemForm, is_available: checked })
                  }
                />
                <Label>Available</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={itemForm.is_featured}
                  onCheckedChange={(checked) =>
                    setItemForm({ ...itemForm, is_featured: checked })
                  }
                />
                <Label>Featured</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddItem(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem} disabled={!itemForm.name.trim()}>
              Add Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={showEditItem} onOpenChange={setShowEditItem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
            <DialogDescription>Update item details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item Name</Label>
              <Input
                value={itemForm.name}
                onChange={(e) =>
                  setItemForm({ ...itemForm, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Description (Optional)</Label>
              <Textarea
                value={itemForm.description}
                onChange={(e) =>
                  setItemForm({ ...itemForm, description: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Price (Rs.)</Label>
              <Input
                type="number"
                value={itemForm.price}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    price: parseFloat(e.target.value) || 0,
                  })
                }
                step="0.01"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={itemForm.is_available}
                  onCheckedChange={(checked) =>
                    setItemForm({ ...itemForm, is_available: checked })
                  }
                />
                <Label>Available</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={itemForm.is_featured}
                  onCheckedChange={(checked) =>
                    setItemForm({ ...itemForm, is_featured: checked })
                  }
                />
                <Label>Featured</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEditItem(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditItem}>Update Item</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
