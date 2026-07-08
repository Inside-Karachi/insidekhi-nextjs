import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

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
