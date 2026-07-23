"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  RefreshCw,
  Save,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Phone,
  Globe,
  ImageIcon,
} from "lucide-react";
import type {
  ListingCapacityCompleteness,
  ListingCapacityFields,
  ListingCapacityRow,
} from "@/types/listing.types";

type DraftFields = {
  [K in keyof ListingCapacityFields]: string;
};

function toDraft(row: ListingCapacityRow): DraftFields {
  return {
    min_price_per_person:
      row.min_price_per_person == null ? "" : String(row.min_price_per_person),
    max_price_per_person:
      row.max_price_per_person == null ? "" : String(row.max_price_per_person),
    min_guest_capacity:
      row.min_guest_capacity == null ? "" : String(row.min_guest_capacity),
    max_guest_capacity:
      row.max_guest_capacity == null ? "" : String(row.max_guest_capacity),
  };
}

function draftEqualsRow(draft: DraftFields, row: ListingCapacityRow): boolean {
  const original = toDraft(row);
  return (
    draft.min_price_per_person === original.min_price_per_person &&
    draft.max_price_per_person === original.max_price_per_person &&
    draft.min_guest_capacity === original.min_guest_capacity &&
    draft.max_guest_capacity === original.max_guest_capacity
  );
}

function parseDraftField(
  value: string,
  integer: boolean,
): number | null | { error: string } {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return { error: "Invalid number" };
  if (integer && !Number.isInteger(num)) {
    return { error: "Must be a whole number" };
  }
  return num;
}

/** Digits + optional single decimal point (prices). Strips letters and signs. */
function sanitizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("")}`;
}

/** Digits only (guest capacity). */
function sanitizeIntegerInput(value: string): string {
  return value.replace(/\D/g, "");
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "published":
      return "bg-green-500/10 text-green-700 border-green-500/20";
    case "draft":
      return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    case "archived":
      return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    case "pending_approval":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "rejected":
      return "bg-red-500/10 text-red-700 border-red-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ListingCapacityPage() {
  const { toast } = useToast();
  const [listings, setListings] = React.useState<ListingCapacityRow[]>([]);
  const [drafts, setDrafts] = React.useState<Record<number, DraftFields>>({});
  const [savingIds, setSavingIds] = React.useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [completenessFilter, setCompletenessFilter] =
    React.useState<ListingCapacityCompleteness>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [stats, setStats] = React.useState({ total: 0, incomplete: 0 });
  const [categories, setCategories] = React.useState<
    Array<{ value: string; label: string }>
  >([]);
  const [categoriesLoading, setCategoriesLoading] = React.useState(false);
  const [expandedIds, setExpandedIds] = React.useState<Set<number>>(new Set());

  const pageSize = 20;

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  React.useEffect(() => {
    const fetchCategories = async () => {
      setCategoriesLoading(true);
      try {
        const response = await fetch("/api/categories");
        const result = await response.json();
        if (response.ok && result.categories) {
          setCategories(result.categories);
        }
      } catch (error) {
        console.error("Failed to load categories:", error);
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const fetchListings = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        completeness: completenessFilter,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category_id", categoryFilter);

      const response = await fetch(
        `/api/admin/listing-capacity?${params.toString()}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load listings");
      }

      const rows: ListingCapacityRow[] = data.listings || [];
      setListings(rows);
      setDrafts(
        Object.fromEntries(rows.map((row) => [row.id, toDraft(row)])),
      );
      setExpandedIds(new Set());
      setTotalPages(data.pagination?.totalPages || 1);
      setStats({
        total: data.stats?.total ?? data.pagination?.total ?? 0,
        incomplete: data.stats?.incomplete ?? 0,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to load listings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    debouncedSearch,
    statusFilter,
    categoryFilter,
    completenessFilter,
    toast,
  ]);

  React.useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const updateDraft = (
    id: number,
    field: keyof ListingCapacityFields,
    value: string,
  ) => {
    const isPrice = field.includes("price");
    const sanitized = isPrice
      ? sanitizeDecimalInput(value)
      : sanitizeIntegerInput(value);

    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || toDraft(listings.find((l) => l.id === id)!)),
        [field]: sanitized,
      },
    }));
  };

  const handleSave = async (row: ListingCapacityRow) => {
    const draft = drafts[row.id];
    if (!draft) return;

    const minPrice = parseDraftField(draft.min_price_per_person, false);
    const maxPrice = parseDraftField(draft.max_price_per_person, false);
    const minCapacity = parseDraftField(draft.min_guest_capacity, true);
    const maxCapacity = parseDraftField(draft.max_guest_capacity, true);

    for (const parsed of [minPrice, maxPrice, minCapacity, maxCapacity]) {
      if (parsed && typeof parsed === "object" && "error" in parsed) {
        toast({
          title: "Invalid value",
          description: parsed.error,
          variant: "destructive",
        });
        return;
      }
    }

    const payload: ListingCapacityFields = {
      min_price_per_person: minPrice as number | null,
      max_price_per_person: maxPrice as number | null,
      min_guest_capacity: minCapacity as number | null,
      max_guest_capacity: maxCapacity as number | null,
    };

    if (
      payload.min_price_per_person != null &&
      payload.min_price_per_person < 0
    ) {
      toast({
        title: "Invalid value",
        description: "Prices cannot be negative",
        variant: "destructive",
      });
      return;
    }
    if (
      payload.max_price_per_person != null &&
      payload.max_price_per_person < 0
    ) {
      toast({
        title: "Invalid value",
        description: "Prices cannot be negative",
        variant: "destructive",
      });
      return;
    }
    if (
      payload.min_guest_capacity != null &&
      payload.min_guest_capacity < 1
    ) {
      toast({
        title: "Invalid value",
        description: "Guest capacity must be at least 1",
        variant: "destructive",
      });
      return;
    }
    if (
      payload.max_guest_capacity != null &&
      payload.max_guest_capacity < 1
    ) {
      toast({
        title: "Invalid value",
        description: "Guest capacity must be at least 1",
        variant: "destructive",
      });
      return;
    }
    if (
      payload.min_price_per_person != null &&
      payload.max_price_per_person != null &&
      payload.min_price_per_person > payload.max_price_per_person
    ) {
      toast({
        title: "Invalid value",
        description:
          "Minimum price per person cannot exceed maximum price per person",
        variant: "destructive",
      });
      return;
    }
    if (
      payload.min_guest_capacity != null &&
      payload.max_guest_capacity != null &&
      payload.min_guest_capacity > payload.max_guest_capacity
    ) {
      toast({
        title: "Invalid value",
        description:
          "Minimum guest capacity cannot exceed maximum guest capacity",
        variant: "destructive",
      });
      return;
    }

    setSavingIds((prev) => new Set(prev).add(row.id));
    try {
      const response = await fetch(`/api/admin/listing-capacity/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save");
      }

      const updated = data.listing as ListingCapacityRow;
      setListings((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, ...updated } : item)),
      );
      setDrafts((prev) => ({
        ...prev,
        [row.id]: toDraft({ ...row, ...updated }),
      }));
      toast({
        title: "Saved",
        description: `Updated capacity for ${updated.name || row.name}`,
      });

      const wasComplete =
        row.min_price_per_person != null &&
        row.max_price_per_person != null &&
        row.min_guest_capacity != null &&
        row.max_guest_capacity != null;
      const isComplete =
        updated.min_price_per_person != null &&
        updated.max_price_per_person != null &&
        updated.min_guest_capacity != null &&
        updated.max_guest_capacity != null;
      if (wasComplete !== isComplete) {
        setStats((prev) => ({
          ...prev,
          incomplete: Math.max(
            0,
            prev.incomplete + (isComplete ? -1 : 1),
          ),
        }));
      }
    } catch (error) {
      toast({
        title: "Save failed",
        description:
          error instanceof Error ? error.message : "Could not save changes",
        variant: "destructive",
      });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Matching listings
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {stats.total}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Incomplete (any field missing)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            {stats.incomplete}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or address…"
            className="h-11 pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="h-11 w-full lg:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_approval">Pending approval</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter}
          onValueChange={(value) => {
            setCategoryFilter(value);
            setCurrentPage(1);
          }}
          disabled={categoriesLoading}
        >
          <SelectTrigger className="h-11 w-full lg:w-52">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={completenessFilter}
          onValueChange={(value) => {
            setCompletenessFilter(value as ListingCapacityCompleteness);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="h-11 w-full lg:w-44">
            <SelectValue placeholder="Completeness" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rows</SelectItem>
            <SelectItem value="incomplete">Incomplete</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => fetchListings()}
          disabled={isLoading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="min-w-[180px]">Listing</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-[120px]">
                  Min price / person (PKR)
                </TableHead>
                <TableHead className="min-w-[120px]">
                  Max price / person (PKR)
                </TableHead>
                <TableHead className="min-w-[110px]">Min guest capacity</TableHead>
                <TableHead className="min-w-[110px]">Max guest capacity</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Loading listings…
                  </TableCell>
                </TableRow>
              ) : listings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No listings match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                listings.map((row) => {
                  const draft = drafts[row.id] || toDraft(row);
                  const dirty = !draftEqualsRow(draft, row);
                  const saving = savingIds.has(row.id);
                  const expanded = expandedIds.has(row.id);

                  return (
                    <React.Fragment key={row.id}>
                      <TableRow>
                        <TableCell className="pr-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-expanded={expanded}
                            aria-label={
                              expanded
                                ? `Collapse details for ${row.name}`
                                : `Expand details for ${row.name}`
                            }
                            onClick={() => toggleExpanded(row.id)}
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => toggleExpanded(row.id)}
                          >
                            <div className="font-medium">{row.name}</div>
                            {row.address ? (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {row.address}
                              </div>
                            ) : null}
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.category_name || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusBadgeClass(row.status)}
                          >
                            {row.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0"
                            value={draft.min_price_per_person}
                            onChange={(e) =>
                              updateDraft(
                                row.id,
                                "min_price_per_person",
                                e.target.value,
                              )
                            }
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0"
                            value={draft.max_price_per_person}
                            onChange={(e) =>
                              updateDraft(
                                row.id,
                                "max_price_per_person",
                                e.target.value,
                              )
                            }
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="1"
                            value={draft.min_guest_capacity}
                            onChange={(e) =>
                              updateDraft(
                                row.id,
                                "min_guest_capacity",
                                e.target.value,
                              )
                            }
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="1"
                            value={draft.max_guest_capacity}
                            onChange={(e) =>
                              updateDraft(
                                row.id,
                                "max_guest_capacity",
                                e.target.value,
                              )
                            }
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            disabled={!dirty || saving}
                            onClick={() => handleSave(row)}
                          >
                            <Save className="h-3.5 w-3.5 mr-1" />
                            {saving ? "Saving…" : "Save"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expanded ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={9} className="bg-muted/30 p-4">
                            <div className="flex flex-col gap-4 sm:flex-row">
                              <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl border border-border/50 bg-muted sm:h-44 sm:w-56">
                                {row.image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={row.image_url}
                                    alt={
                                      row.image_alt ||
                                      `${row.name} listing photo`
                                    }
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                                    <ImageIcon className="h-8 w-8 opacity-50" />
                                    <span className="text-xs">No photo</span>
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-3">
                                <div>
                                  <h3 className="text-base font-semibold">
                                    {row.name}
                                  </h3>
                                  {row.category_name ? (
                                    <p className="text-sm text-muted-foreground">
                                      {row.category_name}
                                    </p>
                                  ) : null}
                                </div>
                                {row.description ? (
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                                    {row.description}
                                  </p>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">
                                    No description available.
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                                  {row.address ? (
                                    <span className="inline-flex items-start gap-1.5 text-muted-foreground">
                                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                      <span>{row.address}</span>
                                    </span>
                                  ) : null}
                                  {row.phone_number ? (
                                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                      <Phone className="h-3.5 w-3.5 shrink-0" />
                                      <span>{row.phone_number}</span>
                                    </span>
                                  ) : null}
                                  {row.website ? (
                                    <a
                                      href={row.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                                    >
                                      <Globe className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate max-w-[220px]">
                                        {row.website}
                                      </span>
                                    </a>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
