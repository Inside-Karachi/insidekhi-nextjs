"use client";

import * as React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Star, User, Loader2, CheckCircle, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface ReviewCreationModalProps {
  listingId: number;
  listingName: string;
  branchId: number;
  branchName: string;
  isOpen: boolean;
  onClose: () => void;
  onReviewCreated?: () => void;
}

export function ReviewCreationModal({
  listingId,
  listingName,
  branchId,
  branchName,
  isOpen,
  onClose,
  onReviewCreated,
}: ReviewCreationModalProps) {
  const [rating, setRating] = React.useState<number>(0);
  const [hoverRating, setHoverRating] = React.useState<number>(0);
  const [comment, setComment] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = React.useState<boolean>(true);
  const [uploadedImages, setUploadedImages] = React.useState<
    Array<{
      id: number;
      image_url: string;
      tempFileName?: string;
      uploading?: boolean;
    }>
  >([]);
  const [isUploadingImage, setIsUploadingImage] =
    React.useState<boolean>(false);

  const { toast } = useToast();
  const supabaseRef = React.useRef(createClient());
  const supabase = supabaseRef.current;

  // Track temp images for cleanup
  const tempImagesRef = React.useRef<string[]>([]);

  // Get current user
  React.useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error) throw error;
        setUser(user);
      } catch (error) {
        console.error("Error getting user:", error);
        toast({
          title: "Authentication Required",
          description: "Please log in to write a review.",
          variant: "destructive",
        });
        onClose();
      } finally {
        setIsLoadingUser(false);
      }
    };

    if (isOpen) {
      getUser();
    }
  }, [isOpen, toast, onClose, supabase.auth]);

  // Cleanup temp images when modal closes without submission
  React.useEffect(() => {
    return () => {
      // Only cleanup if modal is closing (not on unmount during submission)
      if (!isOpen && tempImagesRef.current.length > 0) {
        // Async cleanup - don't block modal close
        const cleanupImages = async () => {
          try {
            await supabase.storage
              .from("review-images")
              .remove(tempImagesRef.current);
            console.log(
              `Cleaned up ${tempImagesRef.current.length} temp images`,
            );
          } catch (error) {
            console.error("Error cleaning up temp images:", error);
          }
        };
        cleanupImages();
        tempImagesRef.current = [];
      }
    };
  }, [isOpen, supabase.storage]);

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setRating(0);
      setHoverRating(0);
      setComment("");
      setUploadedImages([]);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to write a review.",
        variant: "destructive",
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please select a rating for this place.",
        variant: "destructive",
      });
      return;
    }

    if (comment.trim().length < 10) {
      toast({
        title: "Review Too Short",
        description: "Please write at least 10 characters for your review.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          branch_id: branchId,
          rating,
          comment: comment.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.message || "Failed to create review");
      }

      const review = result.review;

      // If images uploaded, move from temp to permanent and save to DB
      if (uploadedImages.length > 0) {
        try {
          const moveResponse = await fetch("/api/reviews/move-temp-images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reviewId: review.id,
              userId: user.id,
              tempImages: uploadedImages.map((img) => ({
                tempFileName: img.tempFileName,
                imageUrl: img.image_url,
              })),
            }),
          });

          if (!moveResponse.ok) {
            console.error("Failed to move temp images");
            toast({
              title: "Images Not Attached",
              description: "Your review was submitted but images could not be saved. You can re-upload them later.",
              variant: "destructive",
            });
          }
        } catch (imgError) {
          console.error("Error processing images:", imgError);
          toast({
            title: "Images Not Attached",
            description: "Your review was submitted but images could not be saved. You can re-upload them later.",
            variant: "destructive",
          });
        }
      }

      // Clear temp tracking - images now permanent or cleaned
      tempImagesRef.current = [];

      toast({
        title: "Review Submitted!",
        description:
          "Thank you for your review. It will be published after moderation.",
      });

      // Reset form state
      setRating(0);
      setComment("");
      setUploadedImages([]);

      onClose();
      onReviewCreated?.();
    } catch (error) {
      console.error("Error submitting review:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      toast({
        title: "Failed to Submit Review",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      // Reset form state
      setRating(0);
      setComment("");
      setUploadedImages([]);
      setHoverRating(0);
      // Close modal (cleanup effect will handle temp image deletion)
      onClose();
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Only JPEG, PNG, and WebP images are allowed.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (2MB max)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "Image must be smaller than 2MB.",
        variant: "destructive",
      });
      return;
    }

    // Check image count limit
    if (uploadedImages.length >= 5) {
      toast({
        title: "Too Many Images",
        description: "Maximum 5 images allowed per review.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingImage(true);

    try {
      // Upload directly to Supabase Storage (RLS allows authenticated users)
      const fileExt = file.name.split(".").pop();
      const fileName = `temp/${user!.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("review-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("review-images")
        .getPublicUrl(fileName);

      if (!publicUrlData?.publicUrl) {
        throw new Error("Failed to get public URL");
      }

      // Track temp file for cleanup
      tempImagesRef.current.push(fileName);

      // Add to uploaded images state
      setUploadedImages((prev) => [
        ...prev,
        {
          id: Date.now(),
          image_url: publicUrlData.publicUrl,
          tempFileName: fileName,
          uploading: false,
        },
      ]);

      toast({
        title: "Image Uploaded",
        description: "Image uploaded successfully.",
      });
    } catch (error) {
      console.error("Image upload error:", error);
      toast({
        title: "Upload Failed",
        description:
          error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      event.target.value = "";
    }
  };

  const removeImage = async (imageId: number) => {
    const image = uploadedImages.find((img) => img.id === imageId);
    if (image?.tempFileName) {
      try {
        await supabase.storage
          .from("review-images")
          .remove([image.tempFileName]);

        // Remove from temp tracking
        tempImagesRef.current = tempImagesRef.current.filter(
          (f) => f !== image.tempFileName,
        );
      } catch (error) {
        console.error("Error removing image:", error);
      }
    }

    setUploadedImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  if (isLoadingUser) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Loading Review Form</DialogTitle>
            <DialogDescription className="sr-only">
              Please wait while we load your review form
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Write a Review
          </DialogTitle>
          <DialogDescription>
            Share your experience at <strong>{listingName}</strong> –{" "}
            <span className="text-primary font-medium">{branchName}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Info */}
          {user && (
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">
                  {user.user_metadata?.full_name || user.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  Your review will be published after moderation
                </p>
              </div>
            </div>
          )}

          {/* Rating */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Rating *</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="p-1 hover:scale-110 transition-transform"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  disabled={isSubmitting}
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoverRating || rating)
                        ? "text-amber-400 fill-amber-400"
                        : "text-gray-300"
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-muted-foreground">
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-sm font-medium">
              Your Review *
            </Label>
            <Textarea
              id="comment"
              placeholder="Tell others about your experience... What did you like? What could be improved?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="resize-none"
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              Minimum 10 characters • {comment.length}/500
            </p>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Photos (Optional)</Label>
            <div className="space-y-3">
              {/* Upload Button */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageUpload}
                  disabled={
                    isUploadingImage ||
                    isSubmitting ||
                    uploadedImages.length >= 5
                  }
                  className="hidden"
                  id="image-upload"
                />
                <Label
                  htmlFor="image-upload"
                  className={`flex items-center gap-2 px-4 py-2 text-sm border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    isUploadingImage ||
                    isSubmitting ||
                    uploadedImages.length >= 5
                      ? "border-gray-200 text-gray-400 cursor-not-allowed"
                      : "border-primary/50 text-primary hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  {isUploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {isUploadingImage ? "Uploading..." : "Add Photo"}
                </Label>
                <span className="text-xs text-muted-foreground">
                  {uploadedImages.length}/5 images
                </span>
              </div>

              {/* Uploaded Images Preview */}
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {uploadedImages.map((image) => (
                    <div key={image.id} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                        <Image
                          src={image.image_url}
                          alt="Review photo"
                          width={200}
                          height={200}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeImage(image.id)}
                        disabled={isSubmitting}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Upload up to 5 photos • Max 2MB each • JPEG, PNG, WebP only
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting || rating === 0 || comment.trim().length < 10
              }
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit Review
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
