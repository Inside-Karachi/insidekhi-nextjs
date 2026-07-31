import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { verifyWriter } from "@/lib/blogs/api-utils";
import { uploadFile, deleteFile, BLOG_IMAGES_PREFIX } from "@/lib/storage/spaces";

// POST: Upload a featured-image photo to a per-writer temp folder in
// DigitalOcean Spaces (used while composing a post, before it has an id).
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyWriter();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed." },
        { status: 400 },
      );
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Image must be smaller than 2MB." },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop();
    const path = `${BLOG_IMAGES_PREFIX}/temp/${userId}/${uuidv4()}.${ext}`;

    let publicUrl: string;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uploaded = await uploadFile(path, Buffer.from(arrayBuffer), {
        contentType: file.type,
      });
      publicUrl = uploaded.publicUrl;
    } catch (uploadError) {
      console.error("Blog temp image upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { tempFileName: path, image_url: publicUrl },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Blog temp image upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE: Remove a temp file the writer decided not to use.
export async function DELETE(request: NextRequest) {
  try {
    const userId = await verifyWriter();

    const { tempFileName } = await request.json();
    if (!tempFileName || typeof tempFileName !== "string") {
      return NextResponse.json(
        { error: "Missing tempFileName" },
        { status: 400 },
      );
    }

    const expectedPrefix = `${BLOG_IMAGES_PREFIX}/temp/${userId}/`;
    if (!tempFileName.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    await deleteFile(tempFileName);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Blog temp image delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
