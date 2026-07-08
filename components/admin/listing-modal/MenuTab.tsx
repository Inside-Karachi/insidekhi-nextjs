"use client";

import * as React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MenuPDFUpload } from "../MenuPDFUpload";
import { MenuItemImageUpload } from "../MenuItemImageUpload";
import { MenuImagesGallery } from "./MenuImagesGallery";
import { ChefHat, Trash, Loader2, FileText, ImageIcon } from "lucide-react";

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
  listingId: number | null;
  menuPdfUrl: string | null;
  onMenuPdfUpdate: (pdfUrl: string | null) => void;
  menuSections: MenuSection[];
  menuLoading: boolean;
  onAddSection: (sectionData: SectionFormData) => void;
  onEditSection: (sectionId: number, sectionData: SectionFormData) => void;
  onDeleteSection: (sectionId: number) => void;
  onAddItem: (itemData: ItemFormData) => void;
  onEditItem: (
    sectionId: number,
    itemId: number,
    itemData: ItemFormData,
    onSuccess?: () => void,
  ) => void;
  onDeleteItem: (sectionId: number, itemId: number) => void;
}

interface SectionFormData {
  name: string;
  description: string;
  display_order: number;
}

interface ItemFormData {
  name: string;
  description: string;
  price: number;
  is_available: boolean;
  display_order: number;
  section_id: number;
  is_featured: boolean;
  image_url: string | null;
  image_alt: string | null;
}

export function MenuTab({
  listingId,
  menuPdfUrl,
  onMenuPdfUpdate,
  menuSections,
  menuLoading,
  onAddSection,
  onEditSection,
  onDeleteSection,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: MenuTabProps) {
  // Local state for modals
  const [showAddSectionModal, setShowAddSectionModal] = React.useState(false);
  const [showEditSectionModal, setShowEditSectionModal] = React.useState(false);
  const [showAddItemModal, setShowAddItemModal] = React.useState(false);
  const [showEditItemModal, setShowEditItemModal] = React.useState(false);

  const [selectedSection, setSelectedSection] =
    React.useState<MenuSection | null>(null);
  const [selectedItem, setSelectedItem] = React.useState<MenuItem | null>(null);

  const [sectionFormData, setSectionFormData] = React.useState<SectionFormData>(
    {
      name: "",
      description: "",
      display_order: 0,
    },
  );

  const [itemFormData, setItemFormData] = React.useState<ItemFormData>({
    name: "",
    description: "",
    price: 0,
    is_available: true,
    display_order: 0,
    section_id: 0,
    is_featured: false,
    image_url: null,
    image_alt: null,
  });

  const handleAddSectionClick = () => {
    setSectionFormData({
      name: "",
      description: "",
      display_order: menuSections.length,
    });
    setShowAddSectionModal(true);
  };

  const handleEditSectionClick = (section: MenuSection) => {
    setSelectedSection(section);
    setSectionFormData({
      name: section.name,
      description: section.description || "",
      display_order: section.display_order,
    });
    setShowEditSectionModal(true);
  };

  const handleAddItemClick = (section: MenuSection) => {
    setItemFormData({
      name: "",
      description: "",
      price: 0,
      is_available: true,
      display_order: section.menu_items?.length || 0,
      section_id: section.id,
      is_featured: false,
      image_url: null,
      image_alt: null,
    });
    setShowAddItemModal(true);
  };

  const handleEditItemClick = (section: MenuSection, item: MenuItem) => {
    setSelectedSection(section);
    setSelectedItem(item);
    setItemFormData({
      name: item.name,
      description: item.description || "",
      price: item.price,
      is_available: item.is_available,
      display_order: item.display_order,
      section_id: section.id,
      is_featured: item.is_featured,
      image_url: item.image_url,
      image_alt: item.image_alt,
    });
    setShowEditItemModal(true);
  };

  const handleAddSection = () => {
    onAddSection(sectionFormData);
    setShowAddSectionModal(false);
    setSectionFormData({ name: "", description: "", display_order: 0 });
  };

  const handleEditSection = () => {
    if (selectedSection) {
      onEditSection(selectedSection.id, sectionFormData);
      setShowEditSectionModal(false);
      setSelectedSection(null);
      setSectionFormData({ name: "", description: "", display_order: 0 });
    }
  };

  const handleAddItem = () => {
    onAddItem(itemFormData);
    setShowAddItemModal(false);
    setItemFormData({
      name: "",
      description: "",
      price: 0,
      is_available: true,
      display_order: 0,
      section_id: 0,
      is_featured: false,
      image_url: null,
      image_alt: null,
    });
  };

  const handleEditItem = async () => {
    if (selectedSection && selectedItem) {
      await onEditItem(
        selectedSection.id,
        selectedItem.id,
        itemFormData,
        () => {
          setShowEditItemModal(false);
          setSelectedItem(null);
          setSelectedSection(null);
          setItemFormData({
            name: "",
            description: "",
            price: 0,
            is_available: true,
            display_order: 0,
            section_id: 0,
            is_featured: false,
            image_url: null,
            image_alt: null,
          });
        },
      );
    }
  };

  return (
    <>
      <TabsContent value="menu" className="space-y-8">
        <div className="py-4">
          {/* Menu Images Gallery - Scraped from Peekaboo */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Menu Images</h3>
            </div>
            <MenuImagesGallery listingId={listingId} />
          </div>

          <Separator className="my-6" />

          {/* Menu PDF Upload Section */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Menu PDF</h3>
            </div>
            <MenuPDFUpload
              listingId={listingId}
              currentPdfUrl={menuPdfUrl}
              onPdfUpdate={onMenuPdfUpdate}
            />
          </div>

          <Separator className="my-6" />

          {menuLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading menu...</div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChefHat className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-medium">Menu Management</h3>
                </div>
                <Button onClick={handleAddSectionClick} size="sm">
                  Add Section
                </Button>
              </div>

              {menuSections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No menu sections found. Add your first menu section to get
                  started.
                </div>
              ) : (
                <div className="space-y-4">
                  {menuSections.map((section) => (
                    <div
                      key={section.id}
                      className="border rounded-lg p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{section.name}</h4>
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
                            onClick={() => handleAddItemClick(section)}
                          >
                            Add Item
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditSectionClick(section)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Are you sure you want to delete "${section.name}" and all its items?`,
                                )
                              ) {
                                onDeleteSection(section.id);
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
                                  <span className="font-medium">
                                    {item.name}
                                  </span>
                                  {!item.is_available && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      Unavailable
                                    </Badge>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-primary">
                                  Rs. {item.price}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleEditItemClick(section, item)
                                  }
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Are you sure you want to delete "${item.name}"?`,
                                      )
                                    ) {
                                      onDeleteItem(section.id, item.id);
                                    }
                                  }}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No items in this section yet.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </TabsContent>

      {/* Add Section Modal */}
      <Dialog open={showAddSectionModal} onOpenChange={setShowAddSectionModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Menu Section</DialogTitle>
            <DialogDescription>
              Create a new section for your menu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="section-name">Section Name</Label>
              <Input
                id="section-name"
                value={sectionFormData.name}
                onChange={(e) =>
                  setSectionFormData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="e.g., Appetizers, Main Course"
              />
            </div>
            <div>
              <Label htmlFor="section-description">
                Description (Optional)
              </Label>
              <Textarea
                id="section-description"
                value={sectionFormData.description}
                onChange={(e) =>
                  setSectionFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description of this section"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="section-order">Display Order</Label>
              <Input
                id="section-order"
                type="number"
                value={sectionFormData.display_order}
                onChange={(e) =>
                  setSectionFormData((prev) => ({
                    ...prev,
                    display_order: parseInt(e.target.value) || 0,
                  }))
                }
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddSectionModal(false);
                setSectionFormData({
                  name: "",
                  description: "",
                  display_order: 0,
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSection}
              disabled={menuLoading || !sectionFormData.name.trim()}
            >
              {menuLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Section"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Section Modal */}
      <Dialog
        open={showEditSectionModal}
        onOpenChange={setShowEditSectionModal}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Menu Section</DialogTitle>
            <DialogDescription>Update the section details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-section-name">Section Name</Label>
              <Input
                id="edit-section-name"
                value={sectionFormData.name}
                onChange={(e) =>
                  setSectionFormData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="e.g., Appetizers, Main Course"
              />
            </div>
            <div>
              <Label htmlFor="edit-section-description">
                Description (Optional)
              </Label>
              <Textarea
                id="edit-section-description"
                value={sectionFormData.description}
                onChange={(e) =>
                  setSectionFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description of this section"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-section-order">Display Order</Label>
              <Input
                id="edit-section-order"
                type="number"
                value={sectionFormData.display_order}
                onChange={(e) =>
                  setSectionFormData((prev) => ({
                    ...prev,
                    display_order: parseInt(e.target.value) || 0,
                  }))
                }
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowEditSectionModal(false);
                setSelectedSection(null);
                setSectionFormData({
                  name: "",
                  description: "",
                  display_order: 0,
                });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSection} disabled={menuLoading}>
              Update Section
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Item Modal */}
      <Dialog open={showAddItemModal} onOpenChange={setShowAddItemModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Menu Item</DialogTitle>
            <DialogDescription>
              Add a new item to this menu section
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="item-name">Item Name</Label>
              <Input
                id="item-name"
                value={itemFormData.name}
                onChange={(e) =>
                  setItemFormData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="e.g., Chicken Biryani"
              />
            </div>
            <div>
              <Label htmlFor="item-description">Description (Optional)</Label>
              <Textarea
                id="item-description"
                value={itemFormData.description}
                onChange={(e) =>
                  setItemFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description of this item"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="item-price">Price (Rs.)</Label>
              <Input
                id="item-price"
                type="number"
                value={itemFormData.price}
                onChange={(e) =>
                  setItemFormData((prev) => ({
                    ...prev,
                    price: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="item-available"
                  checked={itemFormData.is_available}
                  onCheckedChange={(checked) =>
                    setItemFormData((prev) => ({
                      ...prev,
                      is_available: checked,
                    }))
                  }
                />
                <Label htmlFor="item-available">Available</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="item-featured"
                  checked={itemFormData.is_featured}
                  onCheckedChange={(checked) =>
                    setItemFormData((prev) => ({
                      ...prev,
                      is_featured: checked,
                    }))
                  }
                />
                <Label htmlFor="item-featured">Featured Item</Label>
              </div>
            </div>
            <div>
              <Label htmlFor="item-order">Display Order</Label>
              <Input
                id="item-order"
                type="number"
                value={itemFormData.display_order}
                onChange={(e) =>
                  setItemFormData((prev) => ({
                    ...prev,
                    display_order: parseInt(e.target.value) || 0,
                  }))
                }
                placeholder="0"
              />
            </div>
            <div>
              <MenuItemImageUpload
                listingId={listingId || 0}
                sectionId={itemFormData.section_id}
                itemId={0}
                currentImageUrl={itemFormData.image_url}
                currentImageAlt={itemFormData.image_alt}
                onImageUpdate={(
                  imageUrl: string | null,
                  imageAlt: string | null,
                ) =>
                  setItemFormData((prev) => ({
                    ...prev,
                    image_url: imageUrl,
                    image_alt: imageAlt,
                  }))
                }
                isLoading={menuLoading}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddItemModal(false);
                setItemFormData({
                  name: "",
                  description: "",
                  price: 0,
                  is_available: true,
                  display_order: 0,
                  section_id: 0,
                  is_featured: false,
                  image_url: null,
                  image_alt: null,
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={menuLoading || !itemFormData.name.trim()}
            >
              {menuLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Item"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Item Modal */}
      <Dialog open={showEditItemModal} onOpenChange={setShowEditItemModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
            <DialogDescription>Update the item details</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 pl-1 pb-1">
            <div>
              <Label htmlFor="edit-item-name">Item Name</Label>
              <Input
                id="edit-item-name"
                value={itemFormData.name}
                onChange={(e) =>
                  setItemFormData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="e.g., Chicken Biryani"
              />
            </div>
            <div>
              <Label htmlFor="edit-item-description">
                Description (Optional)
              </Label>
              <Textarea
                id="edit-item-description"
                value={itemFormData.description}
                onChange={(e) =>
                  setItemFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description of this item"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-item-price">Price (Rs.)</Label>
              <Input
                id="edit-item-price"
                type="number"
                value={itemFormData.price}
                onChange={(e) =>
                  setItemFormData((prev) => ({
                    ...prev,
                    price: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-item-available"
                  checked={itemFormData.is_available}
                  onCheckedChange={(checked) =>
                    setItemFormData((prev) => ({
                      ...prev,
                      is_available: checked,
                    }))
                  }
                />
                <Label htmlFor="edit-item-available">Available</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-item-featured"
                  checked={itemFormData.is_featured}
                  onCheckedChange={(checked) =>
                    setItemFormData((prev) => ({
                      ...prev,
                      is_featured: checked,
                    }))
                  }
                />
                <Label htmlFor="edit-item-featured">Featured Item</Label>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-item-order">Display Order</Label>
              <Input
                id="edit-item-order"
                type="number"
                value={itemFormData.display_order}
                onChange={(e) =>
                  setItemFormData((prev) => ({
                    ...prev,
                    display_order: parseInt(e.target.value) || 0,
                  }))
                }
                placeholder="0"
              />
            </div>
            <div>
              <MenuItemImageUpload
                listingId={listingId || 0}
                sectionId={selectedItem?.id || itemFormData.section_id}
                itemId={selectedItem?.id || 0}
                currentImageUrl={itemFormData.image_url}
                currentImageAlt={itemFormData.image_alt}
                onImageUpdate={(
                  imageUrl: string | null,
                  imageAlt: string | null,
                ) =>
                  setItemFormData((prev) => ({
                    ...prev,
                    image_url: imageUrl,
                    image_alt: imageAlt,
                  }))
                }
                isLoading={menuLoading}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              disabled={menuLoading}
              onClick={() => {
                setShowEditItemModal(false);
                setSelectedItem(null);
                setItemFormData({
                  name: "",
                  description: "",
                  price: 0,
                  is_available: true,
                  display_order: 0,
                  section_id: 0,
                  is_featured: false,
                  image_url: null,
                  image_alt: null,
                });
              }}
            >
              Cancel
            </Button>
            <Button disabled={menuLoading} onClick={handleEditItem}>
              {menuLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Item"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
