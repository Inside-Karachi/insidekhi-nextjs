import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth/session";
import { uploadFile, deleteFile } from "@/lib/storage/spaces";

// POST: Upload a review photo to a per-user temp folder in DigitalOcean
// Spaces (used while composing a review, before the review has an id).
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const path = `review-images/temp/${session.userId}/${uuidv4()}.${ext}`;

    let publicUrl: string;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uploaded = await uploadFile(path, Buffer.from(arrayBuffer), {
        contentType: file.type,
      });
      publicUrl = uploaded.publicUrl;
    } catch (uploadError) {
      console.error("Review temp image upload error:", uploadError);
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
    console.error("Review temp image upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE: Remove a temp file the user decided not to submit (or on modal
// close). Best-effort - failures here shouldn't block the user.
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tempFileName } = await request.json();
    if (!tempFileName || typeof tempFileName !== "string") {
      return NextResponse.json(
        { error: "Missing tempFileName" },
        { status: 400 },
      );
    }

    const expectedPrefix = `review-images/temp/${session.userId}/`;
    if (!tempFileName.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    await deleteFile(tempFileName);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Review temp image delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
