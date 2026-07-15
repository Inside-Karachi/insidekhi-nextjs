import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, CopyObjectCommand } from "@aws-sdk/client-s3";

const region = process.env.DO_SPACES_REGION || "sgp1";
const endpoint = process.env.DO_SPACES_ENDPOINT || `https://${region}.digitaloceanspaces.com`;
const accessKeyId = process.env.DO_SPACES_KEY || "";
const secretAccessKey = process.env.DO_SPACES_SECRET || "";
const defaultBucket = process.env.DO_SPACES_BUCKET || "insidekhi";
const cdnEndpoint = process.env.DO_SPACES_CDN_ENDPOINT || `https://${defaultBucket}.${region}.cdn.digitaloceanspaces.com/`;

// Initialize S3 client for DigitalOcean Spaces
export const s3Client = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  // digitalocean spaces requires forcing path style in some configurations,
  // but standard endpoints are fine
  forcePathStyle: false,
});

export interface UploadOptions {
  bucket?: string;
  contentType?: string;
  isPublic?: boolean;
}

/**
 * Uploads a file buffer to DigitalOcean Spaces
 */
export async function uploadFile(
  path: string,
  body: Buffer | Uint8Array | Blob | string,
  opts?: UploadOptions
): Promise<{ path: string; publicUrl: string }> {
  const bucket = opts?.bucket || defaultBucket;
  const contentType = opts?.contentType || "application/octet-stream";
  const acl = opts?.isPublic !== false ? "public-read" : "private";

  // Ensure body is correct format
  const uploadBody: Buffer | Uint8Array | string = typeof body === "string" || body instanceof Buffer || body instanceof Uint8Array ? body : Buffer.from(await (body as Blob).arrayBuffer());



  // Remove leading slash in file paths if present
  const cleanPath = path.startsWith("/") ? path.substring(1) : path;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: cleanPath,
      Body: uploadBody,
      ContentType: contentType,
      ACL: acl,
    })
  );

  return {
    path: cleanPath,
    publicUrl: getPublicUrl(cleanPath, bucket),
  };
}

/**
 * Deletes a file or files from DigitalOcean Spaces
 */
export async function deleteFile(path: string, bucket?: string): Promise<void> {
  const targetBucket = bucket || defaultBucket;
  const cleanPath = path.startsWith("/") ? path.substring(1) : path;

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: targetBucket,
      Key: cleanPath,
    })
  );
}

/**
 * Constructs the CDN or standard public URL for a file
 */
export function getPublicUrl(path: string, bucket?: string): string {
  const cleanPath = path.startsWith("/") ? path.substring(1) : path;
  const targetBucket = bucket || defaultBucket;

  // Use Custom CDN Endpoint if available and using the default bucket
  if (targetBucket === defaultBucket && cdnEndpoint) {
    const baseCdn = cdnEndpoint.endsWith("/") ? cdnEndpoint : `${cdnEndpoint}/`;
    return `${baseCdn}${cleanPath}`;
  }

  // Otherwise construct standard spaces URL
  return `https://${targetBucket}.${region}.digitaloceanspaces.com/${cleanPath}`;
}

/**
 * Copies a file within the same bucket to a new key (server-side, no data
 * transfer through this process). There is no native "move" in the S3 API -
 * callers wanting move semantics should call this then deleteFile() on the
 * source path.
 */
export async function copyFile(
  fromPath: string,
  toPath: string,
  bucket?: string
): Promise<void> {
  const targetBucket = bucket || defaultBucket;
  const cleanFrom = fromPath.startsWith("/") ? fromPath.substring(1) : fromPath;
  const cleanTo = toPath.startsWith("/") ? toPath.substring(1) : toPath;

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: targetBucket,
      CopySource: `/${targetBucket}/${encodeURIComponent(cleanFrom)}`,
      Key: cleanTo,
      ACL: "public-read",
    })
  );
}

/**
 * Recovers the object key from a public URL previously produced by
 * getPublicUrl(). Returns null if the URL doesn't match this bucket's CDN or
 * standard endpoint (e.g. a legacy URL from a different storage provider) -
 * callers should treat that as "nothing to delete" rather than an error.
 */
export function getKeyFromPublicUrl(url: string, bucket?: string): string | null {
  const targetBucket = bucket || defaultBucket;

  if (targetBucket === defaultBucket && cdnEndpoint) {
    const baseCdn = cdnEndpoint.endsWith("/") ? cdnEndpoint : `${cdnEndpoint}/`;
    if (url.startsWith(baseCdn)) {
      return url.substring(baseCdn.length);
    }
  }

  const standardBase = `https://${targetBucket}.${region}.digitaloceanspaces.com/`;
  if (url.startsWith(standardBase)) {
    return url.substring(standardBase.length);
  }

  return null;
}

/**
 * List files under a specific folder prefix
 */
export async function listFiles(prefix: string, bucket?: string): Promise<string[]> {
  const targetBucket = bucket || defaultBucket;
  const cleanPrefix = prefix.startsWith("/") ? prefix.substring(1) : prefix;

  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: targetBucket,
      Prefix: cleanPrefix,
    })
  );

  return (response.Contents || [])
    .map((item) => item.Key)
    .filter((key): key is string => !!key);
}
