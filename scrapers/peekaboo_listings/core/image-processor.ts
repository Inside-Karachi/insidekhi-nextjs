/**
 * IMAGE PROCESSOR
 * Downloads images from Peekaboo and uploads to Supabase Storage
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import type {
  ImageDownloadResult,
  ImageProcessingOptions,
} from "@/types/peekaboo-scraper.types";
import { IMAGE_CONFIG, SCRAPER_CONFIG } from "../config";

export class ImageProcessor {
  private supabase: ReturnType<typeof createClient> | null = null;
  private processedHashes = new Set<string>();

  constructor() {
    // Supabase client will be initialized lazily
  }

  /**
   * Initialize Supabase client (lazy initialization)
   */
  private getSupabase() {
    if (!this.supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error(
          "Missing Supabase credentials. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
        );
      }

      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
        },
      });
    }
    return this.supabase;
  }

  /**
   * Generate MD5 hash of image URL to detect duplicates
   */
  private generateUrlHash(url: string): string {
    return crypto.createHash("md5").update(url).digest("hex");
  }

  /**
   * Generate unique filename from URL and hash
   * Uses peekaboo-id-based structure for easier manual inspection
   * Note: listingId here refers to peekaboo_id (not internal listing.id)
   */
  private generateFilename(
    url: string,
    mimeType: string,
    listingId?: number,
    options?: ImageProcessingOptions,
  ): string {
    const hash = this.generateUrlHash(url);
    const ext = mimeType.split("/")[1] || "jpg";

    // Use peekaboo-id-based structure (easier for manual inspection)
    // Format: peekaboo/{listingId}/{subFolder}/{hash}.{ext}
    // REMOVED TIMESTAMP to prevent duplicates. Hash is sufficient for uniqueness.
    if (listingId) {
      if (options?.subFolder) {
        return `peekaboo/${listingId}/${options.subFolder}/${hash}.${ext}`;
      }
      return `peekaboo/${listingId}/${hash}.${ext}`;
    }

    // Fallback for CLI dry-run mode
    if (options?.subFolder) {
      return `peekaboo/temp/${options.subFolder}/${hash}.${ext}`;
    }
    return `peekaboo/temp/${hash}.${ext}`;
  }

  /**
   * Check if image already exists in storage (by URL hash)
   * searches in specific listing folder if provided
   */
  private async checkDuplicateByHash(
    urlHash: string,
    listingId?: number,
    options?: ImageProcessingOptions,
  ): Promise<string | null> {
    try {
      const supabase = this.getSupabase();

      // Determine search path: precise folder if listingId known, else root
      // IMPORTANT: Supabase list() is NOT recursive by default.
      // If we put files in `peekaboo/123/menu/...`, we must search `peekaboo/123/menu`.
      let searchFolder = listingId ? `peekaboo/${listingId}` : "peekaboo";

      if (listingId && options?.subFolder) {
        searchFolder = `peekaboo/${listingId}/${options.subFolder}`;
      }

      const { data: files, error } = await supabase.storage
        .from(SCRAPER_CONFIG.storage.bucket)
        .list(searchFolder, {
          limit: 1000, // Search larger batch to find existing files (100 was too low)
          search: urlHash, // Relies on filename containing the hash
        });

      if (error || !files || files.length === 0) {
        return null;
      }

      // Return first matching file's public URL
      const file = files[0];
      const { data } = supabase.storage
        .from(SCRAPER_CONFIG.storage.bucket)
        .getPublicUrl(`${searchFolder}/${file.name}`);

      return data.publicUrl;
    } catch {
      return null;
    }
  }

  /**
   * Check if a file actually exists in storage
   * Used to verify session cache entries are still valid
   */
  private async fileExistsInStorage(supabaseUrl: string): Promise<boolean> {
    try {
      const supabase = this.getSupabase();

      // Extract path from URL
      // URL format: https://xxx.supabase.co/storage/v1/object/public/listing-images/peekaboo/123/file.jpg
      const pathMatch = supabaseUrl.match(
        /\/storage\/v1\/object\/public\/[^/]+\/(.+)$/,
      );
      if (!pathMatch) {
        return false;
      }

      const filePath = pathMatch[1];

      // Try to get file metadata (this is cheaper than downloading)
      const { data, error } = await supabase.storage
        .from(SCRAPER_CONFIG.storage.bucket)
        .list(filePath.split("/").slice(0, -1).join("/"), {
          limit: 1,
          search: filePath.split("/").pop(),
        });

      return !error && data && data.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Download image from URL
   */
  private async downloadImage(
    url: string,
    options: ImageProcessingOptions,
  ): Promise<{ buffer: Buffer; mimeType: string; sizeBytes: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeout || IMAGE_CONFIG.timeout,
    );

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const mimeType = response.headers.get("content-type") || "image/jpeg";
      const allowedTypes =
        options.allowedMimeTypes || IMAGE_CONFIG.allowedMimeTypes;

      if (!allowedTypes.includes(mimeType)) {
        throw new Error(`Unsupported MIME type: ${mimeType}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const sizeBytes = buffer.length;

      const maxSize = options.maxSizeBytes || IMAGE_CONFIG.maxSizeBytes;
      if (sizeBytes > maxSize) {
        throw new Error(
          `Image too large: ${sizeBytes} bytes (max: ${maxSize} bytes)`,
        );
      }

      return { buffer, mimeType, sizeBytes };
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Upload image buffer to Supabase Storage
   */
  private async uploadToSupabase(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<string> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase.storage
      .from(SCRAPER_CONFIG.storage.bucket)
      .upload(filename, buffer, {
        contentType: mimeType,
        cacheControl: "31536000", // 1 year
        upsert: false, // Prefer idempotent path: same hash -> same object key
      });

    if (error) {
      const status =
        (error as { statusCode?: string; status?: number }).statusCode ??
        (error as { status?: number }).status;
      const msg = (error.message || "").toLowerCase();
      const isDuplicate =
        status === 409 ||
        status === "409" ||
        msg.includes("already exists") ||
        msg.includes("resource already");

      if (isDuplicate) {
        const { data: publicUrlData } = supabase.storage
          .from(SCRAPER_CONFIG.storage.bucket)
          .getPublicUrl(filename);
        return publicUrlData.publicUrl;
      }

      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(SCRAPER_CONFIG.storage.bucket)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  }

  /**
   * Process single image: download and upload to Supabase
   */
  async processImage(
    url: string,
    options: ImageProcessingOptions = {},
  ): Promise<ImageDownloadResult> {
    try {
      console.log(`[IMG] Processing: ${url.substring(0, 60)}...`);

      // Check for duplicates
      const urlHash = this.generateUrlHash(url);

      if (
        options.skipDuplicates !== false &&
        this.processedHashes.has(urlHash)
      ) {
        // CRITICAL FIX: Verify the cached file still exists in storage
        // If bulk delete removed images, session cache may be stale
        const cachedUrl = await this.checkDuplicateByHash(
          urlHash,
          options.listingId,
          options,
        );
        if (cachedUrl && (await this.fileExistsInStorage(cachedUrl))) {
          console.log(`[IMG] Skipped (already processed in this session)`);
          return {
            success: false,
            originalUrl: url,
            error: "Duplicate (already processed)",
          };
        } else {
          // File was deleted, remove from cache and re-process
          console.log(
            `[IMG] Cache invalidated (file no longer exists in storage)`,
          );
          this.processedHashes.delete(urlHash);
        }
      }

      // Check if already exists in storage
      if (options.skipDuplicates !== false) {
        const existingUrl = await this.checkDuplicateByHash(
          urlHash,
          options.listingId,
          options,
        );
        if (existingUrl) {
          console.log(`[IMG] Already exists in storage`);
          this.processedHashes.add(urlHash);
          return {
            success: true,
            supabaseUrl: existingUrl,
            originalUrl: url,
          };
        }
      }

      // Download image
      const { buffer, mimeType, sizeBytes } = await this.downloadImage(
        url,
        options,
      );

      // Generate unique filename with listing ID and subfolder
      const filename = this.generateFilename(
        url,
        mimeType,
        options.listingId,
        options,
      );

      // Upload to Supabase
      const supabaseUrl = await this.uploadToSupabase(
        buffer,
        filename,
        mimeType,
      );

      this.processedHashes.add(urlHash);

      console.log(`[IMG] Uploaded (${(sizeBytes / 1024).toFixed(1)} KB)`);

      return {
        success: true,
        supabaseUrl,
        originalUrl: url,
        sizeBytes,
        mimeType,
      };
    } catch (error) {
      const imgError = error as Error;
      console.error(`[IMG] Failed:`, imgError.message);

      return {
        success: false,
        originalUrl: url,
        error: imgError.message,
      };
    }
  }

  /**
   * Process multiple images in parallel (with concurrency limit)
   */
  async processImages(
    urls: string[],
    options: ImageProcessingOptions = {},
    concurrency = 5,
  ): Promise<ImageDownloadResult[]> {
    const results: ImageDownloadResult[] = [];
    const queue = [...urls];

    console.log(
      `[IMG] Processing ${urls.length} images (concurrency: ${concurrency})...`,
    );

    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchResults = await Promise.all(
        batch.map((url) => this.processImage(url, options)),
      );
      results.push(...batchResults);
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;

    console.log(
      `[IMG] Complete: ${successful} successful, ${failed} failed out of ${results.length}`,
    );

    return results;
  }

  /**
   * Get Supabase public URL for an existing file
   */
  getPublicUrl(path: string): string {
    const supabase = this.getSupabase();
    const { data } = supabase.storage
      .from(SCRAPER_CONFIG.storage.bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Delete image from Supabase Storage
   */
  async deleteImage(path: string): Promise<boolean> {
    try {
      const supabase = this.getSupabase();
      const { error } = await supabase.storage
        .from(SCRAPER_CONFIG.storage.bucket)
        .remove([path]);

      if (error) throw error;

      console.log(`[IMG] Deleted: ${path}`);
      return true;
    } catch (error) {
      const delError = error as Error;
      console.error(`[IMG] Delete failed:`, delError.message);
      return false;
    }
  }

  /**
   * Delete multiple images from Supabase Storage (batch operation)
   */
  async deleteImages(
    paths: string[],
  ): Promise<{ success: number; failed: number }> {
    try {
      if (paths.length === 0) return { success: 0, failed: 0 };

      const supabase = this.getSupabase();
      const { data, error } = await supabase.storage
        .from(SCRAPER_CONFIG.storage.bucket)
        .remove(paths);

      if (error) throw error;

      const success = data?.length || 0;
      const failed = paths.length - success;

      console.log(
        `[IMG] Batch delete: ${success} successful, ${failed} failed`,
      );
      return { success, failed };
    } catch (error) {
      const delError = error as Error;
      console.error(`[IMG] Batch delete failed:`, delError.message);
      return { success: 0, failed: paths.length };
    }
  }

  /**
   * Extract storage path from Supabase public URL
   */
  extractPathFromUrl(publicUrl: string): string | null {
    try {
      const url = new URL(publicUrl);
      // Extract path after /storage/v1/object/public/{bucket}/
      const parts = url.pathname.split(`/${SCRAPER_CONFIG.storage.bucket}/`);
      return parts[1] || null;
    } catch {
      return null;
    }
  }

  /**
   * Get storage statistics
   */
  getStats() {
    return {
      processedCount: this.processedHashes.size,
    };
  }

  /**
   * Reset processed hashes (for new scraping session)
   */
  reset() {
    this.processedHashes.clear();
  }
}

/**
 * Singleton instance
 */
export const imageProcessor = new ImageProcessor();
