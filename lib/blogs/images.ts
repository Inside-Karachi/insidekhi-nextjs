import { v4 as uuidv4 } from "uuid";
import {
  copyFile,
  deleteFile,
  getPublicUrl,
  BLOG_IMAGES_PREFIX,
} from "@/lib/storage/spaces";

/**
 * Move a writer's temp-uploaded featured image into its permanent post
 * folder, and clean up the temp copy. Throws if `tempFileName` doesn't
 * belong to the caller's own temp folder (see app/api/writer/blogs/temp-images).
 */
export async function moveTempFeaturedImage(
  userId: string,
  postId: number,
  tempFileName: string,
): Promise<string> {
  const expectedPrefix = `${BLOG_IMAGES_PREFIX}/temp/${userId}/`;
  if (!tempFileName.startsWith(expectedPrefix)) {
    throw new Error("Invalid file path");
  }

  const ext = tempFileName.split(".").pop();
  const newFileName = `${BLOG_IMAGES_PREFIX}/${postId}/${uuidv4()}.${ext}`;

  await copyFile(tempFileName, newFileName);

  try {
    await deleteFile(tempFileName);
  } catch (cleanupError) {
    console.error(`Failed to remove temp blog image ${tempFileName}:`, cleanupError);
  }

  return getPublicUrl(newFileName);
}
